import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_EVENTS_PER_RUN = 10;
const MAX_ATTEMPTS = 5;
const OUTREACH_CHUNK = 5;
const STALE_PROCESSING_MINUTES = 15;

function backoffMs(attempts: number): number {
  // Exponential backoff with jitter: 1m, 2m, 4m, 8m, 16m…
  const base = Math.min(60_000 * 2 ** Math.max(attempts - 1, 0), 60 * 60_000);
  const jitter = Math.floor(Math.random() * 5_000);
  return base + jitter;
}

async function processBatchOutreachEvent(
  tenantId: string,
  userId: string | null,
  payload: Record<string, unknown>
): Promise<{ sent: number; failed: number }> {
  const { createMCPServer } = await import('@/services/mcp/MCPServer');
  const leadIds = Array.isArray(payload.lead_ids) ? (payload.lead_ids as string[]) : [];
  const clientIds = Array.isArray(payload.client_ids) ? (payload.client_ids as string[]) : [];
  if (!userId) {
    throw new Error('mcp_event_queue row missing user_id — cannot execute tenant-scoped MCP tools');
  }
  const server = createMCPServer({ tenantId, userId });

  let sent = 0;
  let failed = 0;

  const chunks: Array<{ lead_ids: string[]; client_ids: string[] }> = [];
  for (let i = 0; i < leadIds.length; i += OUTREACH_CHUNK) {
    chunks.push({ lead_ids: leadIds.slice(i, i + OUTREACH_CHUNK), client_ids: [] });
  }
  for (let i = 0; i < clientIds.length; i += OUTREACH_CHUNK) {
    chunks.push({ lead_ids: [], client_ids: clientIds.slice(i, i + OUTREACH_CHUNK) });
  }

  for (const chunk of chunks) {
    const result = await server.runTool('send_batch_outreach', {
      tenant_id: tenantId,
      user_id: userId,
      lead_ids: chunk.lead_ids,
      client_ids: chunk.client_ids,
      tone: payload.tone || 'professional',
      custom_context: payload.custom_context || '',
      delivery_provider: payload.delivery_provider || 'sendgrid',
      language_mode: payload.language_mode || 'en',
    });
    if (result.isError) {
      failed += chunk.lead_ids.length + chunk.client_ids.length;
    } else {
      const text = result.content?.[0]?.text || '';
      const match = text.match(/Sent to (\d+)\/(\d+)/);
      if (match) {
        sent += Number(match[1]);
        failed += Number(match[2]) - Number(match[1]);
      } else {
        sent += chunk.lead_ids.length + chunk.client_ids.length;
      }
    }
  }

  return { sent, failed };
}

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const workerId = `mcp-queue-${process.pid}-${Date.now()}`;

  // Reclaim stuck processing rows (worker crash / OOM)
  let reclaimed = 0;
  try {
    const { data: reclaimCount } = await admin.rpc('reclaim_stuck_mcp_queue', {
      p_stale_minutes: STALE_PROCESSING_MINUTES,
    });
    reclaimed = Number(reclaimCount || 0);
  } catch {
    const staleBefore = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60_000).toISOString();
    const { data: stuck } = await admin
      .from('mcp_event_queue')
      .update({
        status: 'pending',
        locked_at: null,
        locked_by: null,
        available_at: nowIso,
        last_error: 'reclaimed_stuck_processing',
        updated_at: nowIso,
      })
      .eq('status', 'processing')
      .lt('updated_at', staleBefore)
      .select('id');
    reclaimed = stuck?.length || 0;
  }

  const { data: events, error } = await admin
    .from('mcp_event_queue')
    .select('id, tenant_id, user_id, event_name, payload, attempts, max_attempts')
    .eq('status', 'pending')
    .lte('available_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(MAX_EVENTS_PER_RUN);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const event of events || []) {
    const { data: claimed } = await admin
      .from('mcp_event_queue')
      .update({
        status: 'processing',
        attempts: (event.attempts || 0) + 1,
        locked_at: nowIso,
        locked_by: workerId,
        updated_at: nowIso,
      })
      .eq('id', event.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    const maxAttempts = Number(event.max_attempts || MAX_ATTEMPTS);

    try {
      const { assertCronRowTenantContext, quarantineTenantIsolationRow } = await import(
        '@/lib/tenant/platformTenant'
      );
      try {
        assertCronRowTenantContext(event);
      } catch (qErr: any) {
        await quarantineTenantIsolationRow({
          tableName: 'mcp_event_queue',
          recordId: event.id,
          reason: 'missing_tenant_id',
          payload: { event_name: event.event_name },
        }).catch(() => undefined);
        await admin
          .from('mcp_event_queue')
          .update({
            status: 'dead_letter',
            last_error: 'missing_tenant_id',
            updated_at: nowIso,
          })
          .eq('id', event.id);
        results.push({
          id: event.id,
          ok: false,
          quarantined: true,
          error: qErr?.message || 'missing_tenant_id',
        });
        continue;
      }

      let outcome: Record<string, unknown> = { skipped: true };

      if (event.event_name === 'send_batch_outreach') {
        outcome = await processBatchOutreachEvent(
          event.tenant_id,
          event.user_id,
          (event.payload || {}) as Record<string, unknown>
        );
      }

      await admin
        .from('mcp_event_queue')
        .update({
          status: 'done',
          last_error: null,
          locked_at: null,
          locked_by: null,
          result: outcome,
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id);

      results.push({ id: event.id, event: event.event_name, status: 'done', ...outcome });
    } catch (err: any) {
      const attempts = (event.attempts || 0) + 1;
      const exhausted = attempts >= maxAttempts;
      const nextAt = new Date(Date.now() + backoffMs(attempts)).toISOString();
      await admin
        .from('mcp_event_queue')
        .update({
          status: exhausted ? 'dead_letter' : 'pending',
          last_error: err?.message || 'Unknown error',
          available_at: exhausted ? nowIso : nextAt,
          next_attempt_at: exhausted ? null : nextAt,
          dead_lettered_at: exhausted ? new Date().toISOString() : null,
          locked_at: null,
          locked_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id);
      results.push({
        id: event.id,
        event: event.event_name,
        error: err?.message,
        exhausted,
        status: exhausted ? 'dead_letter' : 'pending',
        next_attempt_at: exhausted ? null : nextAt,
      });
    }
  }

  return NextResponse.json({
    processed: results.length,
    reclaimed,
    pending_checked_at: nowIso,
    results,
  });
}
