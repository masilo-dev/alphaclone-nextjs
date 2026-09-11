import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { bonnieGetProactiveBrief } from '@/lib/bonnie/bonniePlatformOps';
import { callDeepSeek } from '@/lib/ai/deepseek';
import { routeAIRequest } from '@/services/aiRouter';

export type BonnieMorningBrief = {
  tenantId: string;
  userId: string;
  briefDate: string;
  summary: string;
  attentionItems: string[];
  notificationId?: string;
  read?: boolean;
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function synthesizeBriefSummary(attentionItems: string[], raw: Awaited<ReturnType<typeof bonnieGetProactiveBrief>>): Promise<string> {
  const bulletText = attentionItems.length
    ? attentionItems.join('\n- ')
    : 'No urgent items — workspace looks healthy.';

  const prompt = `Write a 2-3 sentence executive morning briefing for a business owner. Be direct and actionable.\n\nItems:\n- ${bulletText}`;

  if (process.env.DEEPSEEK_API_KEY) {
    try {
      return (await callDeepSeek(prompt, { model: 'deepseek-chat', maxTokens: 220, temperature: 0.4 })).trim();
    } catch {
      // fall through
    }
  }

  try {
    const res = await routeAIRequest({ prompt, maxTokens: 220, temperature: 0.4 });
    return res.content.trim();
  } catch {
    return attentionItems.length
      ? `Good morning. ${attentionItems[0]}${attentionItems.length > 1 ? ` (+${attentionItems.length - 1} more)` : ''}.`
      : 'Good morning. Your workspace looks healthy today.';
  }
}

export async function generateMorningBriefForUser(
  tenantId: string,
  userId: string
): Promise<BonnieMorningBrief> {
  const brief = await bonnieGetProactiveBrief(tenantId, userId);
  const attentionItems = brief.attention_items;
  const summary = await synthesizeBriefSummary(attentionItems, brief);
  const briefDate = todayKey();

  const admin = createSupabaseAdminClient();
  const title = 'Bonnie morning briefing';
  const message = summary;

  const { data: existing } = await admin
    .from('notifications')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('title', title)
    .gte('created_at', `${briefDate}T00:00:00Z`)
    .limit(1)
    .maybeSingle();

  let notificationId = existing?.id;
  if (!notificationId) {
    const { data: inserted } = await admin
      .from('notifications')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        title,
        message: attentionItems.length ? `${summary}\n\n• ${attentionItems.join('\n• ')}` : summary,
        type: 'system',
        link: '/dashboard/bonnie',
        read: false,
      })
      .select('id')
      .single();
    notificationId = inserted?.id;
  } else {
    await admin
      .from('notifications')
      .update({
        message: attentionItems.length ? `${summary}\n\n• ${attentionItems.join('\n• ')}` : summary,
      })
      .eq('id', notificationId);
  }

  return { tenantId, userId, briefDate, summary, attentionItems, notificationId };
}

export async function runMorningBriefsForAllTenants(): Promise<{
  tenants: number;
  users: number;
  errors: string[];
}> {
  const admin = createSupabaseAdminClient();
  const errors: string[] = [];
  let userCount = 0;

  const { data: tenants } = await admin.from('tenants').select('id').limit(500);
  const tenantIds = (tenants || []).map((t: { id: string }) => t.id);

  for (const tenantId of tenantIds) {
    try {
      const { data: members } = await admin
        .from('tenant_users')
        .select('user_id, role')
        .eq('tenant_id', tenantId)
        .in('role', ['tenant_admin', 'admin', 'owner']);

      for (const member of members || []) {
        if (!member.user_id) continue;
        try {
          await generateMorningBriefForUser(tenantId, member.user_id);
          userCount += 1;
        } catch (e: unknown) {
          errors.push(`${tenantId}/${member.user_id}: ${e instanceof Error ? e.message : 'failed'}`);
        }
      }
    } catch (e: unknown) {
      errors.push(`${tenantId}: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }

  return { tenants: tenantIds.length, users: userCount, errors };
}

export async function getTodayBriefForUser(tenantId: string, userId: string): Promise<BonnieMorningBrief | null> {
  const admin = createSupabaseAdminClient();
  const briefDate = todayKey();
  const { data } = await admin
    .from('notifications')
    .select('id, message, read, created_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('title', 'Bonnie morning briefing')
    .gte('created_at', `${briefDate}T00:00:00Z`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const lines = (data.message || '').split('\n• ').filter(Boolean);
  const summary = lines[0] || data.message || '';
  const attentionItems = lines.length > 1 ? lines.slice(1).map((l: string) => l.replace(/^•\s*/, '')) : [];
  return {
    tenantId,
    userId,
    briefDate,
    summary,
    attentionItems,
    notificationId: data.id,
    read: data.read === true,
  };
}
