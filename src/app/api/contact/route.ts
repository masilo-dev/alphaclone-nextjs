import { escapeHtml } from '@/lib/email/escapeHtml';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClientOrThrow, routeErrorResponse } from '@/lib/apiAuth';
import { contactSchema } from '@/schemas/validation';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { rateLimitMiddleware, rateLimitConfigs } from '@/lib/rateLimit';
import { isTurnstileEnforced, readClientIp, readTurnstileToken, verifyTurnstileToken } from '@/lib/verifyTurnstile';

/**
 * Public marketing site contact form handler.
 *
 * Scope: alphaclonesystems.com public website ONLY.
 * - Persists all valid submissions to `contact_submissions` FIRST.
 * - Sends notification to bonnie@alphaclonesystems.com AFTER persistence.
 * - Email failure NEVER causes inquiry data loss (HTTP 200 still returned).
 * - Honeypot field (`website`) silently drops bot submissions.
 * - CONTACT_TENANT_ID env var is optional; falls back to DEFAULT_TENANT_ID.
 */

const PLATFORM_NOTIFICATION_EMAIL = 'bonnie@alphaclonesystems.com';

/**
 * Build the HTML body for the admin notification email.
 */
function buildNotificationHtml(params: {
  name: string;
  email: string;
  subject: string;
  message: string;
  company?: string | null;
  phone?: string | null;
  submissionId: string;
  submittedAt: string;
}): string {
  const name = escapeHtml(params.name);
  const email = escapeHtml(params.email);
  const subject = escapeHtml(params.subject);
  const message = escapeHtml(params.message);
  const company = params.company ? escapeHtml(params.company) : '';
  const phone = params.phone ? escapeHtml(params.phone) : '';
  const submissionId = escapeHtml(params.submissionId);
  const submittedAt = escapeHtml(params.submittedAt);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New AlphaClone Inquiry</title></head>
<body style="font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:0;">
  <div style="max-width:600px;margin:32px auto;background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
    <div style="padding:20px 28px;background:#0f172a;border-bottom:1px solid #334155;">
      <p style="margin:0;font-size:13px;color:#94a3b8;letter-spacing:0.05em;text-transform:uppercase;font-weight:600;">AlphaClone Systems</p>
      <h1 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#f8fafc;">New Website Inquiry</h1>
    </div>
    <div style="padding:24px 28px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:8px 0;color:#94a3b8;width:100px;vertical-align:top;font-weight:600;">Name</td>
          <td style="padding:8px 0;color:#f1f5f9;">${name}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94a3b8;vertical-align:top;font-weight:600;">Email</td>
          <td style="padding:8px 0;"><a href="mailto:${email}" style="color:#38bdf8;">${email}</a></td>
        </tr>
        ${company ? `<tr><td style="padding:8px 0;color:#94a3b8;vertical-align:top;font-weight:600;">Company</td><td style="padding:8px 0;color:#f1f5f9;">${company}</td></tr>` : ''}
        ${phone ? `<tr><td style="padding:8px 0;color:#94a3b8;vertical-align:top;font-weight:600;">Phone</td><td style="padding:8px 0;color:#f1f5f9;">${phone}</td></tr>` : ''}
        <tr>
          <td style="padding:8px 0;color:#94a3b8;vertical-align:top;font-weight:600;">Subject</td>
          <td style="padding:8px 0;color:#f1f5f9;">${subject}</td>
        </tr>
      </table>
      <div style="margin-top:20px;padding:16px;background:#0f172a;border:1px solid #334155;border-radius:8px;">
        <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Message</p>
        <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${message}</p>
      </div>
    </div>
    <div style="padding:16px 28px;background:#0f172a;border-top:1px solid #334155;font-size:12px;color:#64748b;">
      <p style="margin:0;">Submission ID: ${submissionId} &nbsp;·&nbsp; Received: ${submittedAt}</p>
      <p style="margin:6px 0 0;">Reply directly to this email to respond to the sender.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid contact submission' }, { status: 400 });
    }

    // ── 1. Honeypot check (bots fill the hidden `website` field) ──────────────
    if (typeof body.website === 'string' && body.website.trim().length > 0) {
      // Silently return success to not tip off the bot
      return NextResponse.json({ success: true, message: 'Thank you! We will be in touch soon.' }, { status: 200 });
    }

    // ── 2. Schema validation ─────────────────────────────────────────────────
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name, email, subject, message, company, phone } = parsed.data;

    // ── 3. Rate limiting ─────────────────────────────────────────────────────
    const limited = await rateLimitMiddleware(
      request,
      rateLimitConfigs.public.contact,
      `contact:${email || request.headers.get('x-forwarded-for') || 'anonymous'}`
    );
    if (limited) return limited;

    // ── 4. Cloudflare Turnstile verification ─────────────────────────────────
    if (isTurnstileEnforced()) {
      const turnstileToken = readTurnstileToken(body);
      if (!turnstileToken) {
        return NextResponse.json({ error: 'Security verification required' }, { status: 400 });
      }
      const ok = await verifyTurnstileToken(turnstileToken, readClientIp(request));
      if (!ok) {
        return NextResponse.json({ error: 'Security verification failed. Please try again.' }, { status: 403 });
      }
    }

    // ── 5. Database persistence (must happen BEFORE email attempt) ────────────
    const supabase = createAdminSupabaseClientOrThrow();
    const tenantId =
      process.env.CONTACT_TENANT_ID?.trim() ||
      process.env.DEFAULT_TENANT_ID?.trim() ||
      null;

    const { data: submission, error: dbError } = await supabase
      .from('contact_submissions')
      .insert([
        {
          ...(tenantId ? { tenant_id: tenantId } : {}),
          name,
          email,
          subject: subject || 'General Inquiry',
          message,
          company: company || null,
          status: 'new',
          source: 'website',
          created_at: new Date().toISOString(),
        },
      ])
      .select('id, created_at')
      .single();

    if (dbError || !submission) {
      console.error('[contact] DB insertion failed:', dbError);
      return NextResponse.json(
        { error: 'Failed to save your submission. Please try again or email bonnie@alphaclonesystems.com directly.' },
        { status: 500 }
      );
    }

    // ── 6. Email notification (best-effort — never block response on failure) ─
    const notificationEmailTenantId =
      tenantId || process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000000';

    let notificationSent = false;
    try {
      const notificationHtml = buildNotificationHtml({
        name,
        email,
        subject: subject || 'General Inquiry',
        message,
        company,
        phone,
        submissionId: submission.id,
        submittedAt: new Date(submission.created_at).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Africa/Johannesburg',
        }),
      });

      const emailResult = await sendEmailServer({
        tenantId: notificationEmailTenantId,
        to: PLATFORM_NOTIFICATION_EMAIL,
        replyTo: email,
        subject: `New AlphaClone website inquiry from ${name}`,
        html: notificationHtml,
        text: `From: ${name} <${email}>\nCompany: ${company || '—'}\nPhone: ${phone || '—'}\n\n${message}`,
        templateName: 'websiteContact',
        idempotencyKey: `website-contact:${submission.id}`,
        initiationSource: 'website.contact',
        fromName: 'AlphaClone Website',
        // Must bypass CRM recipient gate — this is an internal platform notification.
        isPlatformNotification: true,
        skipFooter: true,
      });

      notificationSent = emailResult.success;
      if (!emailResult.success) {
        // Non-blocking: log warning but still return success (submission is saved)
        console.warn(
          '[contact] Submission saved but notification email failed:',
          emailResult.error,
          '| code:', emailResult.code,
          '| submission:', submission.id
        );
      }
    } catch (emailErr) {
      // Never let email failure lose the inquiry
      console.error('[contact] Unexpected error sending notification email:', emailErr, '| submission:', submission.id);
    }

    // ── 7. Success response ───────────────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        message: "Thank you for reaching out! We'll be in touch within 24 hours.",
        id: submission.id,
        notificationSent,
      },
      { status: 200 }
    );
  } catch (error) {
    return routeErrorResponse(error, 'Internal server error');
  }
}
