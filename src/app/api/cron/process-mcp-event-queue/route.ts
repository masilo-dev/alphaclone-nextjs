import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_EVENTS_PER_RUN = 5;
const MAX_ATTEMPTS = 3;
const OUTREACH_CHUNK = 5;

async function processBatchOutreachEvent(
  tenantId: string,
  userId: string | null,
  payload: Record<string, unknown>
): Promise<{ sent: number; failed: number }> {
  const { createMCPServer } = await import('@/services/mcp/MCPServer');
  const leadIds = Array.isArray(payload.lead_ids) ? (payload.lead_ids as string[]) : [];
  const clientIds = Array.isArray(payload.client_ids) ? (payload.client_ids as string[]) : [];
  const server = userId
    ? createMCPServer({ tenantId, userId })
    : createMCPServer();

  let sent = 0;
  let failed = 0;

  // Chunks of ≤5 process inline in the handler (above 5 it re-queues)
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
    const text = result.content?.[0]?.text || '';
    if (result.isError) {
      failed += chunk.lead_ids.length + chunk.client_ids.length;
    } else {
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

  const { data: events, error } = await admin
    .from('mcp_event_queue')
    .select('id, tenant_id, user_id, event_name, payload, attempts')
    .eq('status', 'pending')
    .lte('available_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(MAX_EVENTS_PER_RUN);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const event of events || []) {
    // Claim the row so concurrent cron runs don't double-process
    const { data: claimed } = await admin
      .from('mcp_event_queue')
      .update({ status: 'processing', attempts: (event.attempts || 0) + 1 })
      .eq('id', event.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    try {
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
        .update({ status: 'done', last_error: null })
        .eq('id', event.id);

      results.push({ id: event.id, event: event.event_name, ...outcome });
    } catch (err: any) {
      const attempts = (event.attempts || 0) + 1;
      const exhausted = attempts >= MAX_ATTEMPTS;
      await admin
        .from('mcp_event_queue')
        .update({
          status: exhausted ? 'failed' : 'pending',
          last_error: err?.message || 'Unknown error',
          available_at: exhausted
            ? nowIso
            : new Date(Date.now() + attempts * 5 * 60_000).toISOString(),
        })
        .eq('id', event.id);
      results.push({ id: event.id, event: event.event_name, error: err?.message, exhausted });
    }
  }

  return NextResponse.json({
    processed: results.length,
    pending_checked_at: nowIso,
    results,
  });
}
