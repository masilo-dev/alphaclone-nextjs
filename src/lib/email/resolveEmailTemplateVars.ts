import type { SupabaseClient } from '@supabase/supabase-js';

interface ResolveVarsInput {
  html?: string;
  text?: string;
  /** Recipient's display name if already known (e.g. leadName from outreach route) */
  recipientName?: string;
  /** CRM record ID for name lookup when recipientName is not provided */
  clientId?: string;
  leadId?: string;
  contactId?: string;
  tenantId: string;
}

interface ResolveVarsOutput {
  html?: string;
  text?: string;
  /** The resolved name that was substituted (for logging) */
  resolvedName?: string;
  /** The resolved Calendly/booking link that was substituted (for logging) */
  resolvedLink?: string;
}

/**
 * Substitutes {{client_name}} and {{client_calendly_link}} in HTML and text email bodies.
 *
 * - {{client_name}}: resolved from recipientName arg → CRM record lookup → left blank
 * - {{client_calendly_link}}: resolved from tenant's calendly.eventUrl → native booking slug → left blank
 */
export async function resolveEmailTemplateVars(
  supabase: SupabaseClient,
  input: ResolveVarsInput,
): Promise<ResolveVarsOutput> {
  const { html, text, tenantId } = input;

  // ── 1. Resolve client name ─────────────────────────────────────────────────
  let resolvedName = String(input.recipientName || '').trim();

  if (!resolvedName && input.clientId) {
    const { data } = await supabase
      .from('business_clients')
      .select('name')
      .eq('id', input.clientId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    resolvedName = String(data?.name || '').trim();
  }

  if (!resolvedName && input.leadId) {
    const { data } = await supabase
      .from('leads')
      .select('business_name, contact_name, name')
      .eq('id', input.leadId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    resolvedName = String(
      (data as any)?.contact_name ||
      (data as any)?.business_name ||
      (data as any)?.name ||
      ''
    ).trim();
  }

  if (!resolvedName && input.contactId) {
    const { data } = await supabase
      .from('contacts')
      .select('full_name, name')
      .eq('id', input.contactId)
      .is('deleted_at', null)
      .maybeSingle();
    resolvedName = String((data as any)?.full_name || (data as any)?.name || '').trim();
  }

  // ── 2. Resolve Calendly / booking link ────────────────────────────────────
  let resolvedLink = '';

  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .maybeSingle();

  const settings = ((tenantRow as any)?.settings || {}) as Record<string, any>;
  const calendlyEventUrl = String(settings?.calendly?.eventUrl || '').trim();
  const bookingSlug = String(settings?.booking?.slug || '').trim();

  if (calendlyEventUrl) {
    resolvedLink = calendlyEventUrl;
  } else if (bookingSlug) {
    const base = String(
      process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com'
    ).replace(/\/+$/, '');
    resolvedLink = `${base}/book/${bookingSlug}`;
  }

  // ── 3. Substitute placeholders ────────────────────────────────────────────
  function substitute(src: string | undefined): string | undefined {
    if (!src) return src;
    let out = src;
    if (resolvedName) {
      out = out.split('{{client_name}}').join(resolvedName);
    }
    if (resolvedLink) {
      out = out.split('{{client_calendly_link}}').join(resolvedLink);
    }
    return out;
  }

  return {
    html: substitute(html),
    text: substitute(text),
    resolvedName: resolvedName || undefined,
    resolvedLink: resolvedLink || undefined,
  };
}
