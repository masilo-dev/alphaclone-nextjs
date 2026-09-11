import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeEmail } from '@/lib/crm/identityNormalize';
import { emitCrmDomainEvent } from '@/lib/crm/crmDomainEvents';

export type DuplicateIdentityGroup = {
  normalized_email: string;
  records: Array<{
    id: string;
    source: 'business_clients' | 'contacts';
    name: string;
    email: string | null;
    created_at: string | null;
  }>;
};

export type MergeClientIdentityResult = {
  primary_id: string;
  merged_ids: string[];
  reassigned: Record<string, number>;
  merge_record_id: string | null;
};

async function countClientReferences(
  admin: SupabaseClient,
  tenantId: string,
  fromId: string,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const tables: Array<{ table: string; column: string }> = [
    { table: 'projects', column: 'client_id' },
    { table: 'business_projects', column: 'client_id' },
    { table: 'contracts', column: 'client_id' },
    { table: 'business_invoices', column: 'client_id' },
    { table: 'leads', column: 'client_id' },
  ];

  for (const { table, column } of tables) {
    const { count } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq(column, fromId);
    if (count) counts[table] = count;
  }

  const { count: taskCount } = await admin
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('related_to_contact', fromId);
  if (taskCount) counts.tasks = taskCount;

  return counts;
}

async function reassignClientReferences(
  admin: SupabaseClient,
  tenantId: string,
  fromId: string,
  toId: string,
): Promise<Record<string, number>> {
  const reassigned: Record<string, number> = {};
  const tables: Array<{ table: string; column: string }> = [
    { table: 'projects', column: 'client_id' },
    { table: 'business_projects', column: 'client_id' },
    { table: 'contracts', column: 'client_id' },
    { table: 'business_invoices', column: 'client_id' },
    { table: 'leads', column: 'client_id' },
  ];

  for (const { table, column } of tables) {
    const { data, error } = await admin
      .from(table)
      .update({ [column]: toId, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq(column, fromId)
      .select('id');
    if (!error && data?.length) {
      reassigned[table] = (reassigned[table] || 0) + data.length;
    }
  }

  const { data: taskRows } = await admin
    .from('tasks')
    .update({ related_to_contact: toId, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('related_to_contact', fromId)
    .select('id');
  if (taskRows?.length) {
    reassigned.tasks = (reassigned.tasks || 0) + taskRows.length;
  }

  return reassigned;
}

/**
 * Find duplicate client/contact rows grouped by normalized email.
 */
export async function findDuplicateIdentities(
  tenantId: string,
  email?: string,
): Promise<DuplicateIdentityGroup[]> {
  const admin = createSupabaseAdminClient();
  const groups = new Map<string, DuplicateIdentityGroup>();

  const [{ data: clients }, { data: contacts }] = await Promise.all([
    admin
      .from('business_clients')
      .select('id, name, email, created_at, is_active')
      .eq('tenant_id', tenantId)
      .not('email', 'is', null),
    admin
      .from('contacts')
      .select('id, full_name, first_name, last_name, email, created_at')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .not('email', 'is', null),
  ]);

  const targetEmail = email ? normalizeEmail(email) : null;

  for (const row of clients || []) {
    if (row.is_active === false) continue;
    const normalized = normalizeEmail(row.email);
    if (!normalized) continue;
    if (targetEmail && normalized !== targetEmail) continue;
    const group = groups.get(normalized) || {
      normalized_email: normalized,
      records: [],
    };
    group.records.push({
      id: row.id,
      source: 'business_clients',
      name: row.name || 'Client',
      email: row.email,
      created_at: row.created_at,
    });
    groups.set(normalized, group);
  }

  for (const row of contacts || []) {
    const normalized = normalizeEmail(row.email);
    if (!normalized) continue;
    if (targetEmail && normalized !== targetEmail) continue;
    const group = groups.get(normalized) || {
      normalized_email: normalized,
      records: [],
    };
    group.records.push({
      id: row.id,
      source: 'contacts',
      name: row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Contact',
      email: row.email,
      created_at: row.created_at,
    });
    groups.set(normalized, group);
  }

  return [...groups.values()].filter((g) => g.records.length > 1);
}

/**
 * Merge duplicate client/contact records into a single primary identity.
 * Prefers business_clients as primary when present; reassigns FK references.
 */
export async function mergeClientIdentities(input: {
  tenantId: string;
  primaryId: string;
  duplicateIds: string[];
  userId?: string;
  dryRun?: boolean;
}): Promise<MergeClientIdentityResult> {
  const admin = createSupabaseAdminClient();
  const duplicateIds = [...new Set(input.duplicateIds.filter((id) => id !== input.primaryId))];
  if (!duplicateIds.length) {
    return { primary_id: input.primaryId, merged_ids: [], reassigned: {}, merge_record_id: null };
  }

  const reassigned: Record<string, number> = {};

  if (input.dryRun) {
    for (const dupId of duplicateIds) {
      const partial = await countClientReferences(admin, input.tenantId, dupId);
      for (const [table, count] of Object.entries(partial)) {
        reassigned[table] = (reassigned[table] || 0) + count;
      }
    }
    return {
      primary_id: input.primaryId,
      merged_ids: duplicateIds,
      reassigned,
      merge_record_id: null,
    };
  }

  for (const dupId of duplicateIds) {
    const partial = await reassignClientReferences(admin, input.tenantId, dupId, input.primaryId);
    for (const [table, count] of Object.entries(partial)) {
      reassigned[table] = (reassigned[table] || 0) + count;
    }

    await admin
      .from('business_clients')
      .update({
        is_active: false,
        metadata: { merged_into: input.primaryId, merged_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', dupId);

    await admin
      .from('contacts')
      .update({
        deleted_at: new Date().toISOString(),
        custom_fields: { merged_into: input.primaryId },
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', dupId);
  }

  const { data: mergeRow } = await admin
    .from('client_identity_merges')
    .insert({
      tenant_id: input.tenantId,
      primary_client_id: input.primaryId,
      candidate_client_id: duplicateIds[0],
      confidence_score: 1,
      match_reasons: [`manual_merge:${duplicateIds.join(',')}`],
      status: 'approved',
      decided_by: input.userId || null,
      decided_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  await emitCrmDomainEvent({
    tenantId: input.tenantId,
    eventType: 'crm.records.merged',
    aggregateType: 'client',
    aggregateId: input.primaryId,
    payload: { merged_ids: duplicateIds, reassigned },
    actorId: input.userId,
    actorType: input.userId ? 'user' : 'mcp',
  }).catch(() => undefined);

  return {
    primary_id: input.primaryId,
    merged_ids: duplicateIds,
    reassigned,
    merge_record_id: mergeRow?.id ?? null,
  };
}
