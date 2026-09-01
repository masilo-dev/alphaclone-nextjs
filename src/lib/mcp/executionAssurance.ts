/**
 * Execution assurance — receipt completeness, stale action reconciliation, assurance reporting.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type ReceiptIssue =
  | 'missing_provider_ref'
  | 'missing_live_url'
  | 'success_without_evidence'
  | 'stale_pending_action'
  | 'ok';

export type ReceiptAssuranceRow = {
  id: string;
  tool: string;
  success: boolean | null;
  provider_reference: string | null;
  live_url: string | null;
  error_code: string | null;
  entity_id: string | null;
  issue: ReceiptIssue;
  repaired?: boolean;
  repair_detail?: string;
};

export type ExecutionAssuranceReport = {
  period_days: number;
  receipts: {
    total: number;
    complete: number;
    incomplete: number;
    completeness_pct: number;
    target_ambiguous: number;
  };
  external_actions: {
    pending: number;
    stale_pending: number;
    failed: number;
  };
  outcome_runs: {
    total: number;
    verified_completed: number;
    failed: number;
  };
  issues: ReceiptAssuranceRow[];
};

const WRITE_TOOLS = new Set([
  'publish_social_post',
  'publish_post',
  'send_email',
  'create_meeting',
]);

function classifyReceipt(row: {
  tool?: string | null;
  success?: boolean | null;
  provider_reference?: string | null;
  live_url?: string | null;
  entity_id?: string | null;
}): ReceiptIssue {
  const tool = row.tool || '';
  if (!WRITE_TOOLS.has(tool)) return 'ok';
  if (!row.success) return 'ok';
  if (!row.provider_reference) return 'missing_provider_ref';
  if (tool.includes('publish') && !row.live_url) return 'missing_live_url';
  return 'ok';
}

async function enrichSocialReceiptFromPost(
  tenantId: string,
  receiptId: string,
  entityId: string | null
): Promise<{ repaired: boolean; detail?: string }> {
  if (!entityId) return { repaired: false, detail: 'no_entity_id' };
  const admin = createSupabaseAdminClient();
  const { data: post } = await admin
    .from('social_posts')
    .select('id, linkedin_post_urn, facebook_post_id, instagram_post_id, status')
    .eq('tenant_id', tenantId)
    .eq('id', entityId)
    .maybeSingle();

  if (!post) return { repaired: false, detail: 'post_not_found' };

  const providerRef =
    post.linkedin_post_urn || post.facebook_post_id || post.instagram_post_id || null;
  if (!providerRef) {
    return { repaired: false, detail: post.status === 'published' ? 'published_without_ref' : 'not_published_yet' };
  }

  const { error } = await admin
    .from('mcp_action_receipts')
    .update({
      provider_reference: providerRef,
      final_status: 'published',
      error_code: null,
      verification: { repaired_from_social_post: true, verified: true },
    })
    .eq('id', receiptId)
    .eq('tenant_id', tenantId);

  if (error) return { repaired: false, detail: error.message };
  return { repaired: true, detail: `backfilled provider_reference from social_posts` };
}

export async function scanIncompleteReceipts(params: {
  tenantId: string;
  sinceDays?: number;
  limit?: number;
}): Promise<ReceiptAssuranceRow[]> {
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - (params.sinceDays || 7) * 86400_000).toISOString();
  const { data } = await admin
    .from('mcp_action_receipts')
    .select('id, tool, success, provider_reference, live_url, error_code, entity_id, created_at')
    .eq('tenant_id', params.tenantId)
    .gte('created_at', since)
    .eq('success', true)
    .order('created_at', { ascending: false })
    .limit(params.limit || 100);

  return (data || [])
    .map((row) => ({
      id: row.id,
      tool: row.tool || 'unknown',
      success: row.success,
      provider_reference: row.provider_reference,
      live_url: row.live_url,
      error_code: row.error_code,
      entity_id: row.entity_id,
      issue: classifyReceipt(row),
    }))
    .filter((row) => row.issue !== 'ok');
}

export async function reconcileTenantExecutionReceipts(params: {
  tenantId: string;
  sinceDays?: number;
  limit?: number;
  attemptRepair?: boolean;
}): Promise<{
  scanned: number;
  incomplete: number;
  repaired: number;
  rows: ReceiptAssuranceRow[];
}> {
  const incomplete = await scanIncompleteReceipts({
    tenantId: params.tenantId,
    sinceDays: params.sinceDays,
    limit: params.limit,
  });

  let repaired = 0;
  const rows: ReceiptAssuranceRow[] = [];

  for (const row of incomplete) {
    const enriched: ReceiptAssuranceRow = { ...row };
    if (params.attemptRepair !== false && row.issue === 'missing_provider_ref') {
      if (row.tool.includes('publish')) {
        const fix = await enrichSocialReceiptFromPost(params.tenantId, row.id, row.entity_id);
        enriched.repaired = fix.repaired;
        enriched.repair_detail = fix.detail;
        if (fix.repaired) {
          enriched.issue = 'ok';
          repaired += 1;
        }
      }
    }
    if (enriched.issue !== 'ok') rows.push(enriched);
  }

  return {
    scanned: incomplete.length,
    incomplete: rows.length,
    repaired,
    rows,
  };
}

export async function reconcileStaleExternalActions(limit = 40): Promise<{ reviewed: number; marked: number }> {
  const admin = createSupabaseAdminClient();
  const staleBefore = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data } = await admin
    .from('external_actions')
    .select('id, tenant_id, status, created_at, tool_name')
    .eq('status', 'pending')
    .lt('created_at', staleBefore)
    .limit(limit);

  let marked = 0;
  for (const row of data || []) {
    const { error } = await admin
      .from('external_actions')
      .update({
        status: 'stale_pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'pending');
    if (!error) marked += 1;
  }

  return { reviewed: (data || []).length, marked };
}

export async function buildExecutionAssuranceReport(params: {
  tenantId: string;
  sinceDays?: number;
}): Promise<ExecutionAssuranceReport> {
  const admin = createSupabaseAdminClient();
  const days = params.sinceDays || 30;
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const [receiptRes, actionRes, runRes, ambiguousRes] = await Promise.all([
    admin
      .from('mcp_action_receipts')
      .select('id, tool, success, provider_reference, live_url, error_code, entity_id')
      .eq('tenant_id', params.tenantId)
      .gte('created_at', since)
      .limit(5000),
    admin
      .from('external_actions')
      .select('id, status, created_at')
      .eq('tenant_id', params.tenantId)
      .gte('created_at', since)
      .limit(2000),
    admin
      .from('agent_runs')
      .select('id, status, metadata')
      .eq('tenant_id', params.tenantId)
      .gte('created_at', since)
      .not('metadata->outcome_key', 'is', null)
      .limit(500),
    admin
      .from('mcp_action_receipts')
      .select('id')
      .eq('tenant_id', params.tenantId)
      .eq('error_code', 'TARGET_AMBIGUOUS')
      .gte('created_at', since)
      .limit(500),
  ]);

  const receipts = receiptRes.data || [];
  const writeReceipts = receipts.filter((r) => WRITE_TOOLS.has(r.tool || ''));
  const complete = writeReceipts.filter(
    (r) => r.success && r.provider_reference && (!String(r.tool).includes('publish') || r.live_url)
  ).length;
  const incompleteRows = writeReceipts
    .filter((r) => classifyReceipt(r) !== 'ok')
    .slice(0, 20)
    .map((row) => ({
      id: row.id,
      tool: row.tool || 'unknown',
      success: row.success,
      provider_reference: row.provider_reference,
      live_url: row.live_url,
      error_code: row.error_code,
      entity_id: row.entity_id,
      issue: classifyReceipt(row),
    }));

  const actions = actionRes.data || [];
  const stalePending = actions.filter((a) => a.status === 'stale_pending').length;
  const pending = actions.filter((a) => a.status === 'pending').length;
  const failedActions = actions.filter((a) => a.status === 'failed').length;

  const runs = runRes.data || [];
  const verifiedCompleted = runs.filter((r) =>
    ['completed', 'succeeded', 'COMPLETED'].includes(String(r.status))
  ).length;
  const failedRuns = runs.filter((r) => ['failed', 'FAILED'].includes(String(r.status))).length;

  return {
    period_days: days,
    receipts: {
      total: writeReceipts.length,
      complete,
      incomplete: writeReceipts.length - complete,
      completeness_pct: writeReceipts.length
        ? Math.round((complete / writeReceipts.length) * 100)
        : 100,
      target_ambiguous: (ambiguousRes.data || []).length,
    },
    external_actions: {
      pending,
      stale_pending: stalePending,
      failed: failedActions,
    },
    outcome_runs: {
      total: runs.length,
      verified_completed: verifiedCompleted,
      failed: failedRuns,
    },
    issues: incompleteRows,
  };
}

export async function reconcileAllTenantsExecutionReceipts(limitPerTenant = 25): Promise<{
  tenants: number;
  repaired: number;
  incomplete: number;
  staleActions: { reviewed: number; marked: number };
}> {
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: tenants } = await admin
    .from('mcp_action_receipts')
    .select('tenant_id')
    .gte('created_at', since)
    .limit(500);

  const tenantIds = [...new Set((tenants || []).map((t) => t.tenant_id).filter(Boolean))];
  let repaired = 0;
  let incomplete = 0;

  for (const tenantId of tenantIds.slice(0, 20)) {
    const result = await reconcileTenantExecutionReceipts({
      tenantId,
      limit: limitPerTenant,
      attemptRepair: true,
    });
    repaired += result.repaired;
    incomplete += result.incomplete;
  }

  const staleActions = await reconcileStaleExternalActions(40);
  return { tenants: tenantIds.length, repaired, incomplete, staleActions };
}
