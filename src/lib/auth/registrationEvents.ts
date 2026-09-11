import 'server-only';

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { sendWithProviderSdk, type EmailProvider } from '@/lib/email/providerSdk';
import { ensureFooter } from '@/lib/email/emailComposition';
import { defaultDashboardUrl } from '@/lib/email/platformTemplateEmail';

const BONNIE_REGISTRATION_EMAIL = 'bonnie@alphaclonesystems.com';

type SignupMethod = 'email' | 'google' | 'linkedin' | 'facebook' | 'unknown';

export type RegistrationEventInput = {
  user: User;
  signupMethod?: SignupMethod;
  sourceUrl?: string | null;
  userAgent?: string | null;
  country?: string | null;
  selectedPlan?: string | null;
  referralCode?: string | null;
  businessName?: string | null;
  marketingOptIn?: boolean | null;
  legalAccepted?: boolean | null;
  euConsent?: boolean | null;
  ageConfirmed?: boolean | null;
  metadata?: Record<string, unknown>;
};

type MailConfig = {
  provider: Extract<EmailProvider, 'brevo' | 'sendgrid' | 'resend'>;
  apiKey: string;
  fromEmail: string;
};

function text(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s || null;
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function providerToSignupMethod(provider: string | undefined): SignupMethod {
  if (provider === 'google') return 'google';
  if (provider === 'linkedin_oidc') return 'linkedin';
  if (provider === 'facebook') return 'facebook';
  if (provider === 'email') return 'email';
  return 'unknown';
}

export function inferSignupMethod(user: User, fallback: SignupMethod = 'unknown'): SignupMethod {
  const explicit = text(user.user_metadata?.signup_method);
  if (explicit === 'email') return 'email';
  const inferred = providerToSignupMethod(text(user.app_metadata?.provider) ?? undefined);
  return inferred === 'unknown' ? fallback : inferred;
}

function resolveMailConfig(): MailConfig | null {
  const brevoKey = process.env.BREVO_PLATFORM_API_KEY || process.env.BREVO_API_KEY;
  if (brevoKey) {
    return {
      provider: 'brevo',
      apiKey: brevoKey,
      fromEmail: process.env.BREVO_PLATFORM_FROM_EMAIL || process.env.BREVO_FROM_EMAIL || 'notifications@alphaclonesystems.com',
    };
  }

  if (process.env.SENDGRID_API_KEY) {
    return {
      provider: 'sendgrid',
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.SENDGRID_FROM_EMAIL || 'notifications@alphaclonesystems.com',
    };
  }

  if (process.env.RESEND_API_KEY) {
    return {
      provider: 'resend',
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.RESEND_FROM_EMAIL || 'notifications@alphaclonesystems.com',
    };
  }

  return null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function row(label: string, value: unknown): string {
  return `<tr><td style="padding:6px 12px;color:#64748b;">${escapeHtml(label)}</td><td style="padding:6px 12px;color:#0f172a;font-weight:600;">${escapeHtml(value ?? 'Not provided')}</td></tr>`;
}

async function sendBonnieRegistrationEmail(event: Record<string, any>): Promise<{ ok: boolean; error?: string }> {
  const mail = resolveMailConfig();
  if (!mail) return { ok: false, error: 'Email service not configured' };

  const subject = `New AlphaClone registration: ${event.email}`;
  const dashboardUrl = defaultDashboardUrl();
  const html = ensureFooter(`
    <div style="font-family:Inter,Arial,sans-serif;max-width:680px;margin:0 auto;padding:24px;background:#f8fafc;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
        <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">New user registration</h1>
        <p style="margin:0 0 20px;color:#475569;">A new user registered for AlphaClone Systems.</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          ${row('Email', event.email)}
          ${row('Name', event.name)}
          ${row('Business', event.business_name)}
          ${row('Method', event.signup_method)}
          ${row('Plan', event.selected_plan)}
          ${row('Referral', event.referral_code)}
          ${row('Country', event.country)}
          ${row('Marketing opt-in', event.marketing_opt_in)}
          ${row('Legal accepted', event.legal_accepted)}
          ${row('User ID', event.user_id)}
          ${row('Source', event.source_url)}
        </table>
        <p style="margin:20px 0 0;">
          <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:700;">Open AlphaClone</a>
        </p>
      </div>
    </div>
  `);

  const textBody = [
    'New user registration',
    `Email: ${event.email}`,
    `Name: ${event.name || 'Not provided'}`,
    `Business: ${event.business_name || 'Not provided'}`,
    `Method: ${event.signup_method}`,
    `Plan: ${event.selected_plan || 'Not provided'}`,
    `Referral: ${event.referral_code || 'Not provided'}`,
    `Country: ${event.country || 'Not provided'}`,
    `Marketing opt-in: ${event.marketing_opt_in ?? 'Not provided'}`,
    `Legal accepted: ${event.legal_accepted ?? 'Not provided'}`,
    `User ID: ${event.user_id}`,
    `Source: ${event.source_url || 'Not provided'}`,
  ].join('\n');

  const sent = await sendWithProviderSdk(mail.provider, {
    apiKey: mail.apiKey,
    fromEmail: mail.fromEmail,
    fromName: 'AlphaClone Systems',
    to: BONNIE_REGISTRATION_EMAIL,
    subject,
    html,
    text: ensureFooter(textBody),
  });

  return sent.ok ? { ok: true } : { ok: false, error: sent.error || 'Delivery failed' };
}

async function sendFounderMotivationEmail(event: Record<string, any>): Promise<{ ok: boolean; error?: string }> {
  const mail = resolveMailConfig();
  if (!mail) return { ok: false, error: 'Email service not configured' };

  const name = text(event.name) || 'there';
  const dashboardUrl = defaultDashboardUrl();
  const subject = 'A note from Bonnie at AlphaClone';
  const html = ensureFooter(`
    <div style="font-family:Inter,Arial,sans-serif;max-width:680px;margin:0 auto;padding:24px;background:#f8fafc;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0f766e;">AlphaClone Systems</p>
        <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#0f172a;">Before you make your next big decision, build a clearer room to think in.</h1>
        <p style="margin:0 0 14px;color:#334155;line-height:1.65;">Hi ${escapeHtml(name)}, I am Bonnie, founder of AlphaClone Systems. I started this company because I kept seeing capable people make heavy decisions with scattered information: one conversation in email, one invoice in another tool, the real customer signal hidden in a note nobody had time to read.</p>
        <p style="margin:0 0 14px;color:#334155;line-height:1.65;">That is where good teams lose momentum. Not because they are lazy. Because the truth of the business is split into too many places, and every important choice starts with rebuilding context from memory.</p>
        <p style="margin:0 0 14px;color:#334155;line-height:1.65;">AlphaClone is meant to become the place where your business can think clearly. Add your real customers, leads, tasks, invoices, and conversations. Let Bonnie AI help connect the dots, surface what changed, and turn messy signals into next actions.</p>
        <p style="margin:0 0 14px;color:#334155;line-height:1.65;">Here is the decision habit I want you to practice from day one: do not ask only, "What should I do?" Ask, "What evidence would make this decision obvious?" Then use your workspace to collect that evidence. Better decisions come from better context, shorter feedback loops, and fewer guesses disguised as confidence.</p>
        <p style="margin:0 0 12px;color:#334155;line-height:1.65;">When you open your workspace, start with three things:</p>
        <ol style="margin:0 0 18px 20px;padding:0;color:#334155;line-height:1.65;">
          <li>Add one real customer or contact.</li>
          <li>Add one lead you want to win.</li>
          <li>Add one task that has been sitting in your head.</li>
        </ol>
        <p style="margin:0 0 14px;color:#334155;line-height:1.65;">Then ask Bonnie: "What should I focus on first?"</p>
        <p style="margin:0 0 22px;color:#334155;line-height:1.65;">AlphaClone will not replace your judgment. It will help you see the business clearly enough to use your judgment better. That is how the system starts becoming useful, and that is how your company starts compounding.</p>
        <p style="margin:0 0 22px;color:#0f172a;line-height:1.55;font-weight:700;">Bonnie<br><span style="font-weight:500;color:#64748b;">Founder, AlphaClone Systems</span></p>
        <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:700;">Open your workspace</a>
      </div>
    </div>
  `);

  const textBody = [
    'Before you make your next big decision, build a clearer room to think in.',
    '',
    `Hi ${name}, I am Bonnie, founder of AlphaClone Systems. I started this company because I kept seeing capable people make heavy decisions with scattered information: one conversation in email, one invoice in another tool, the real customer signal hidden in a note nobody had time to read.`,
    '',
    'That is where good teams lose momentum. Not because they are lazy. Because the truth of the business is split into too many places, and every important choice starts with rebuilding context from memory.',
    '',
    'AlphaClone is meant to become the place where your business can think clearly. Add your real customers, leads, tasks, invoices, and conversations. Let Bonnie AI help connect the dots, surface what changed, and turn messy signals into next actions.',
    '',
    'Here is the decision habit I want you to practice from day one: do not ask only, "What should I do?" Ask, "What evidence would make this decision obvious?" Then use your workspace to collect that evidence. Better decisions come from better context, shorter feedback loops, and fewer guesses disguised as confidence.',
    '',
    'When you open your workspace, start with three things:',
    '',
    '1. Add one real customer or contact.',
    '2. Add one lead you want to win.',
    '3. Add one task that has been sitting in your head.',
    '',
    'Then ask Bonnie: "What should I focus on first?"',
    '',
    'AlphaClone will not replace your judgment. It will help you see the business clearly enough to use your judgment better. That is how the system starts becoming useful, and that is how your company starts compounding.',
    '',
    'Bonnie',
    'Founder, AlphaClone Systems',
    '',
    `Open your workspace: ${dashboardUrl}`,
  ].join('\n');

  const sent = await sendWithProviderSdk(mail.provider, {
    apiKey: mail.apiKey,
    fromEmail: mail.fromEmail,
    fromName: 'Bonnie at AlphaClone',
    to: event.email,
    subject,
    html,
    text: ensureFooter(textBody),
  });

  return sent.ok ? { ok: true } : { ok: false, error: sent.error || 'Delivery failed' };
}

export async function recordRegistrationEvent(
  supabase: SupabaseClient,
  input: RegistrationEventInput
): Promise<{ success: boolean; inserted?: boolean; notified?: boolean; error?: string }> {
  const user = input.user;
  const email = text(user.email)?.toLowerCase();
  if (!email) return { success: false, error: 'User email is required' };

  const metadata = user.user_metadata ?? {};
  const name = text(metadata.full_name) || text(metadata.name) || email.split('@')[0];
  const signupMethod = input.signupMethod || inferSignupMethod(user);
  const eventPayload = {
    user_id: user.id,
    email,
    name,
    business_name: text(input.businessName) || text(metadata.business_name),
    signup_method: signupMethod,
    selected_plan: text(input.selectedPlan) || text(metadata.plan),
    referral_code: text(input.referralCode) || text(metadata.referral_code),
    source_url: text(input.sourceUrl),
    user_agent: text(input.userAgent),
    country: text(input.country) || text(metadata.registration_country),
    marketing_opt_in: input.marketingOptIn ?? bool(metadata.marketing_opt_in),
    legal_accepted: input.legalAccepted ?? bool(metadata.legal_accepted),
    eu_consent: input.euConsent ?? bool(metadata.eu_consent),
    age_confirmed: input.ageConfirmed ?? bool(metadata.age_confirmed),
    metadata: {
      provider: text(user.app_metadata?.provider),
      emailConfirmedAt: user.email_confirmed_at ?? null,
      phoneConfirmedAt: user.phone_confirmed_at ?? null,
      ...(input.metadata ?? {}),
    },
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: existingError } = await supabase
    .from('user_registration_events')
    .select('id, notification_sent_at, user_motivation_sent_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingError) return { success: false, error: existingError.message };

  const { data: event, error: upsertError } = await supabase
    .from('user_registration_events')
    .upsert(eventPayload, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (upsertError) return { success: false, error: upsertError.message };
  if (!existing?.user_motivation_sent_at) {
    const motivationResult = await sendFounderMotivationEmail(event);
    await supabase
      .from('user_registration_events')
      .update({
        user_motivation_sent_at: motivationResult.ok ? new Date().toISOString() : null,
        user_motivation_error: motivationResult.ok ? null : motivationResult.error || 'Delivery failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', event.id);
  }

  if (existing?.notification_sent_at) {
    return { success: true, inserted: false, notified: false };
  }

  const notifyResult = await sendBonnieRegistrationEmail(event);
  if (!notifyResult.ok) {
    await supabase
      .from('user_registration_events')
      .update({
        notification_error: notifyResult.error || 'Delivery failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', event.id);
    return {
      success: true,
      inserted: !existing,
      notified: false,
      error: notifyResult.error,
    };
  }

  await supabase
    .from('user_registration_events')
    .update({
      notification_sent_at: new Date().toISOString(),
      notification_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', event.id);

  return { success: true, inserted: !existing, notified: true };
}
