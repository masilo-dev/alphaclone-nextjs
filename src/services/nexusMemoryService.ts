import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { mcpStore } from '@/services/mcp/mcpStore';

export type NexusMemoryCategory = 'preference' | 'pattern' | 'workflow' | 'reliability' | 'general';
export type NexusMemorySource = 'dream' | 'manual' | 'agent';

export type NexusMemoryEntry = {
  category: NexusMemoryCategory;
  key: string;
  value: Record<string, unknown>;
  source?: NexusMemorySource;
  confidence?: number;
  expires_at?: string | null;
};

export type NexusMemoryRow = NexusMemoryEntry & {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
};

function slugKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'memory_item';
}

export async function getMemory(
  tenantId: string,
  opts?: { category?: NexusMemoryCategory; key?: string; limit?: number }
): Promise<NexusMemoryRow[]> {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from('nexus_memory')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false });

  if (opts?.category) query = query.eq('category', opts.category);
  if (opts?.key) query = query.eq('key', opts.key);
  query = query.limit(opts?.limit ?? 50);

  const { data, error } = await query;
  if (error) {
    console.warn('[nexusMemory] getMemory failed:', error.message);
    return [];
  }

  const now = Date.now();
  return (data || []).filter((row: NexusMemoryRow & { expires_at?: string | null }) => {
    if (!row.expires_at) return true;
    return new Date(row.expires_at).getTime() > now;
  }) as NexusMemoryRow[];
}

export async function upsertMemory(
  tenantId: string,
  entry: NexusMemoryEntry
): Promise<{ success: boolean; id?: string; error?: string }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('nexus_memory')
    .upsert(
      {
        tenant_id: tenantId,
        category: entry.category,
        key: entry.key,
        value: entry.value,
        source: entry.source || 'manual',
        confidence: entry.confidence ?? null,
        expires_at: entry.expires_at ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,category,key' }
    )
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, id: data?.id };
}

export async function mergeDreamSession(
  tenantId: string,
  sessionId: string,
  userId?: string | null
): Promise<{ merged: number; memorySummary: string }> {
  const admin = createSupabaseAdminClient();
  const { data: dreamSession, error } = await admin
    .from('bonnie_dream_sessions')
    .select('memory_updates, patterns_extracted')
    .eq('id', sessionId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !dreamSession) {
    throw new Error(error?.message || 'Dream session not found');
  }

  const memoryUpdates = (dreamSession.memory_updates as unknown[]) || [];
  const patterns = (dreamSession.patterns_extracted as unknown[]) || [];
  let merged = 0;
  const summaryLines: string[] = [];

  for (const item of memoryUpdates) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const category = String(obj.category || 'pattern') as NexusMemoryCategory;
    const insight = String(obj.insight || obj.update || obj.description || '');
    const action = String(obj.action_recommendation || '');
    if (!insight) continue;

    const key = slugKey(`${category}_${insight.slice(0, 40)}`);
    await upsertMemory(tenantId, {
      category: ['preference', 'pattern', 'workflow', 'reliability'].includes(category)
        ? category
        : 'pattern',
      key,
      value: { insight, action_recommendation: action },
      source: 'dream',
      confidence: 0.75,
    });
    merged += 1;
    summaryLines.push(insight);
  }

  for (const item of patterns) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const description = String(obj.description || obj.pattern || '');
    if (!description) continue;

    const key = slugKey(`pattern_${description.slice(0, 40)}`);
    await upsertMemory(tenantId, {
      category: 'pattern',
      key,
      value: {
        description,
        type: obj.type,
        frequency: obj.frequency,
        severity: obj.severity,
      },
      source: 'dream',
      confidence: 0.7,
    });
    merged += 1;
    summaryLines.push(description);
  }

  const existing = await mcpStore.getBusinessAIState(tenantId, userId);
  const prior = existing.memory_summary || '';
  const addition = summaryLines.slice(0, 8).join('; ');
  const memorySummary = [prior, addition].filter(Boolean).join(' | ').slice(0, 2000);

  await mcpStore.updateBusinessAIState(tenantId, userId, { memory_summary: memorySummary });

  return { merged, memorySummary };
}

export async function buildMemoryContextBlock(tenantId: string, limit = 12): Promise<string> {
  const rows = await getMemory(tenantId, { limit });
  if (!rows.length) return '';

  const lines = rows.map((row, i) => {
    const insight =
      typeof row.value?.insight === 'string'
        ? row.value.insight
        : typeof row.value?.description === 'string'
          ? row.value.description
          : JSON.stringify(row.value).slice(0, 120);
    return `${i + 1}. [${row.category}] ${insight}`;
  });

  const state = await mcpStore.getBusinessAIState(tenantId);
  const summaryLine = state.memory_summary?.trim()
    ? `Business memory summary: ${state.memory_summary.slice(0, 600)}`
    : '';

  return `
TENANT MEMORY (nexus_memory — apply when relevant):
${lines.join('\n')}
${summaryLine ? `\n${summaryLine}` : ''}
`.trim();
}
