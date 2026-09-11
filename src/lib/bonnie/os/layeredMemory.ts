/**
 * Layered memory: organization / user / department / short-term / long-term.
 * Builds on nexus_memory with optional scope columns.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { upsertMemory, getMemory, type NexusMemoryCategory } from '@/services/nexusMemoryService';
import type { MemoryScope } from './types';

export type LayeredMemoryEntry = {
  scope: MemoryScope;
  scopeId?: string | null;
  department?: string | null;
  category: NexusMemoryCategory;
  key: string;
  value: Record<string, unknown>;
  source?: 'dream' | 'manual' | 'agent';
  confidence?: number;
  expiresAt?: string | null;
};

export async function upsertLayeredMemory(
  tenantId: string,
  entry: LayeredMemoryEntry
): Promise<{ success: boolean; id?: string; error?: string }> {
  const admin = createSupabaseAdminClient();
  const base = await upsertMemory(tenantId, {
    category: entry.category,
    key: `${entry.scope}:${entry.department || entry.scopeId || 'default'}:${entry.key}`.slice(0, 80),
    value: {
      ...entry.value,
      _scope: entry.scope,
      _scope_id: entry.scopeId || null,
      _department: entry.department || null,
    },
    source: entry.source || 'agent',
    confidence: entry.confidence,
    expires_at: entry.expiresAt ?? (entry.scope === 'short_term'
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null),
  });

  if (!base.success) return base;

  // Best-effort enrich with scope columns when migration is applied
  if (base.id) {
    try {
      await admin
        .from('nexus_memory')
        .update({
          scope: entry.scope,
          scope_id: entry.scopeId || null,
          department: entry.department || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', base.id);
    } catch {
      // Columns may not exist yet — value payload still carries scope metadata
    }
  }

  return base;
}

export async function getLayeredMemory(
  tenantId: string,
  opts?: {
    scope?: MemoryScope;
    department?: string;
    category?: NexusMemoryCategory;
    limit?: number;
  }
) {
  const rows = await getMemory(tenantId, {
    category: opts?.category,
    limit: opts?.limit ?? 40,
  });

  return rows.filter((row) => {
    const value = (row.value || {}) as Record<string, unknown>;
    const scope = (row as { scope?: string }).scope || value._scope || 'organization';
    const department = (row as { department?: string }).department || value._department || null;
    if (opts?.scope && scope !== opts.scope) return false;
    if (opts?.department && department !== opts.department) return false;
    return true;
  });
}

export async function buildMemoryContextForGoal(
  tenantId: string,
  goal: string,
  departmentHints: string[] = []
): Promise<string> {
  const [org, shortTerm, deptMemories] = await Promise.all([
    getLayeredMemory(tenantId, { scope: 'organization', limit: 12 }),
    getLayeredMemory(tenantId, { scope: 'short_term', limit: 8 }),
    departmentHints.length
      ? Promise.all(departmentHints.map((d) => getLayeredMemory(tenantId, { department: d, limit: 4 }))).then((g) =>
          g.flat()
        )
      : Promise.resolve([]),
  ]);

  const lines: string[] = [];
  for (const row of [...org, ...shortTerm, ...deptMemories].slice(0, 20)) {
    const value = row.value || {};
    const summary =
      typeof value.summary === 'string'
        ? value.summary
        : JSON.stringify(value).slice(0, 180);
    lines.push(`[${row.category}/${row.key}] ${summary}`);
  }

  if (!lines.length) return 'No durable memory yet for this workspace.';
  return `LAYERED MEMORY (use as durable business context for: ${goal.slice(0, 120)}):\n${lines.join('\n')}`;
}
