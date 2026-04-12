import { NextResponse } from 'next/server';
import { ZohoMailService } from '../../../../services/zoho/ZohoMailService';
import {
  createAdminSupabaseClientOrThrow,
  requireTenantAccess,
  routeErrorResponse,
} from '@/lib/apiAuth';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL;
const BASE_URL = SITE_URL && !SITE_URL.includes('localhost') 
  ? SITE_URL 
  : 'https://alphaclone.tech';

/**
 * Inject open-tracking pixel into email body HTML.
 * Works with both plain-text and HTML bodies.
 */
function injectTrackingPixel(body: string, trackingId: string): string {
  const pixelUrl = `${BASE_URL}/api/track/open?id=${trackingId}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`;

  if (body.includes('</body>')) {
    return body.replace('</body>', `${pixel}</body>`);
  }
  // Plain text body — wrap in minimal HTML
  const escaped = body.replace(/\n/g, '<br>');
  return `<html><body><p>${escaped}</p>${pixel}</body></html>`;
}

/**
 * POST /api/outreach/send
 *
 * Body:
 * {
 *   tenantId:     string,
 *   leadEmail:    string,
 *   leadName:     string,
 *   subject:      string,
 *   body:         string,
 *   pitchAngle:   string,
 *   industry:     string,
 *   score:        number,
 *   fromAddress?: string,
 *   queue?:       boolean   // if true: log as 'queued' but don't send
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      tenantId,
      leadEmail,
      leadName,
      subject,
      body: emailBody,
      pitchAngle  = 'growth-opportunity',
      industry    = '',
      score       = 0,
      fromAddress,
      queue       = false,
    } = body;

    if (!tenantId)   return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    if (!leadEmail)  return NextResponse.json({ error: 'leadEmail required' }, { status: 400 });
    if (!subject)    return NextResponse.json({ error: 'subject required'   }, { status: 400 });
    if (!emailBody)  return NextResponse.json({ error: 'body required'      }, { status: 400 });

    await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    // 1. Generate tracking ID
    const trackingId = crypto.randomUUID();

    // 2. Inject tracking pixel
    const htmlBody = injectTrackingPixel(emailBody, trackingId);

    // 3. Pre-insert log row as 'queued'
    const { data: logRow, error: logErr } = await admin
      .from('lead_outreach_log')
      .insert({
        tenant_id:    tenantId,
        lead_name:    leadName,
        lead_email:   leadEmail,
        subject,
        body_html:    htmlBody,
        tracking_id:  trackingId,
        pitch_angle:  pitchAngle,
        industry,
        score,
        status:       'queued',
      })
      .select('id')
      .single();

    if (logErr) {
      console.warn('[Outreach/Send] Log insert failed (non-fatal):', logErr);
    }

    const logId = logRow?.id;

    // 4. If queue-only mode → return now
    if (queue) {
      return NextResponse.json({ success: true, status: 'queued', logId, trackingId });
    }

    // 5. Send via Zoho Mail
    let zohoMessageId: string | null = null;
    const zohoService = new ZohoMailService(tenantId);

    try {
      const sendResult = await zohoService.sendEmail({
        toAddress:   leadEmail,
        fromAddress: fromAddress,
        subject,
        content:     htmlBody,
      });
      zohoMessageId = sendResult?.data?.messageId || null;

      // 6a. Update log → sent
      if (logId) {
        await admin
          .from('lead_outreach_log')
          .update({ status: 'sent', sent_at: new Date().toISOString(), zoho_message_id: zohoMessageId })
          .eq('id', logId);
      }

      return NextResponse.json({
        success:    true,
        status:     'sent',
        logId,
        trackingId,
        zohoMessageId,
      });

    } catch (sendErr: unknown) {
      console.error('[Outreach/Send] Zoho send failed:', sendErr);

      // 6b. Update log → failed
      if (logId) {
        await admin
          .from('lead_outreach_log')
          .update({ status: 'failed', error_message: 'Send failed' })
          .eq('id', logId);
      }

      return NextResponse.json(
        {
          success: false,
          status: 'failed',
          error: 'Email could not be sent. Check your Zoho Mail connection in Settings.',
          code: 'ZOHO_SEND_FAILED',
          logId,
          trackingId,
        },
        { status: 502 }
      );
    }

  } catch (error: unknown) {
    return routeErrorResponse(error, 'Failed to send outreach email.', request);
  }
}
