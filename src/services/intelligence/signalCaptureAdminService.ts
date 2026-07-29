import type { SupabaseClient } from '@supabase/supabase-js';
<<<<<<< HEAD
import { extractEmailAddress } from '@/lib/email/parseEmailHeader';
=======
>>>>>>> origin/main
import { resolveContactByEmailAdmin, syncExternalMessageAdmin, type AdminMessageSource, type AdminMessageChannel, type AdminMessageDirection } from '@/services/unified/unifiedMessageAdmin';

function guessSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const t = text.toLowerCase();
  const positive = ['thanks', 'thank you', 'great', 'awesome', 'love', 'perfect', 'sounds good', 'yes', 'approved', 'excited'];
  const negative = ['angry', 'upset', 'refund', 'cancel', 'terrible', 'bad', 'unhappy', 'no', 'never', 'complaint', 'hate'];
  let score = 0;
  for (const p of positive) if (t.includes(p)) score += 1;
  for (const n of negative) if (t.includes(n)) score -= 1;
  if (score >= 2) return 'positive';
  if (score <= -2) return 'negative';
  return 'neutral';
}

function bodyPreview(text: string, html?: string | null) {
  const raw = (text || html || '').trim();
  if (!raw) return '';
  return raw.length > 2000 ? `${raw.slice(0, 2000)}...` : raw;
}

export async function captureUnifiedMessageFromWebhook(params: {
  supabase: SupabaseClient;
  tenantId: string;
  source: AdminMessageSource;
  channel: AdminMessageChannel;
  direction: AdminMessageDirection;
  externalId?: string | null;
  threadId?: string | null;
  from: string;
  to: string;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  receivedAt?: string | null;
  sentAt?: string | null;
  metadata?: Record<string, any>;
}) {
  const content = bodyPreview(params.text || '', params.html);
  const sentiment = content ? guessSentiment(content) : 'neutral';
  const resolved =
    params.channel === 'email'
<<<<<<< HEAD
      ? await resolveContactByEmailAdmin(
          params.supabase,
          params.tenantId,
          extractEmailAddress(params.direction === 'inbound' ? params.from : params.to)
        )
=======
      ? await resolveContactByEmailAdmin(params.supabase, params.tenantId, params.direction === 'inbound' ? params.from : params.to)
>>>>>>> origin/main
      : { contact_id: null, company_id: null };

  const message = await syncExternalMessageAdmin(params.supabase, {
    tenant_id: params.tenantId,
    company_id: resolved.company_id,
    contact_id: resolved.contact_id,
    source: params.source,
    external_id: params.externalId ?? null,
    thread_id: params.threadId ?? null,
    direction: params.direction,
    channel: params.channel,
    subject: params.subject ?? null,
    body: params.text ?? null,
    html_body: params.html ?? null,
    from_address: params.from,
    to_address: params.to,
    sentiment,
    needs_response: params.direction === 'inbound',
    received_at: params.receivedAt ?? (params.direction === 'inbound' ? new Date().toISOString() : null),
    sent_at: params.sentAt ?? (params.direction === 'outbound' ? new Date().toISOString() : null),
    metadata: params.metadata ?? {},
  });

  return { message, resolved };
}

