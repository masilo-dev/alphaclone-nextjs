import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type EmailAutoReplyMode = 'off' | 'draft_only' | 'auto_send';

export const EMAIL_AUTO_REPLY_MODE_LABELS: Record<EmailAutoReplyMode, string> = {
  off: 'Off — no AI replies',
  draft_only: 'Draft only — AI writes, you review and send',
  auto_send: 'Auto-send — AI drafts then sends after delay',
};

export function normalizeEmailAutoReplyMode(value: unknown): EmailAutoReplyMode {
  const v = String(value || 'draft_only').trim().toLowerCase();
  if (v === 'off' || v === 'disabled' || v === 'false') return 'off';
  if (v === 'auto_send' || v === 'auto' || v === 'send') return 'auto_send';
  return 'draft_only';
}

export async function getEmailAutoReplyMode(tenantId: string): Promise<EmailAutoReplyMode> {
  if (process.env.EMAIL_AUTO_REPLY_AUTO_SEND === 'true') {
    return 'auto_send';
  }
  if (process.env.EMAIL_AUTO_REPLY_DISABLED === 'true') {
    return 'off';
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from('business_settings')
      .select('settings')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const email = ((data?.settings || {}) as Record<string, unknown>).email as
      | Record<string, unknown>
      | undefined;
    return normalizeEmailAutoReplyMode(email?.auto_reply_mode || email?.autoReplyMode);
  } catch {
    return 'draft_only';
  }
}
