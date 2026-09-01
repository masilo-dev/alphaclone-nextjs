import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { start } from 'workflow/api';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { guardCronTenantRow } from '@/lib/tenant/cronTenantGuard';

// Import workflows
import { dealStageChangedWorkflow } from '@/workflows/deal-flows';
import { invoiceOverdueWorkflow, invoiceCreatedWorkflow } from '@/workflows/invoice-flows';
import { leadCreatedWorkflow } from '@/workflows/lead-flows';
import { contractSignedWorkflow } from '@/workflows/contract-flows';
import { taskOverdueWorkflow, taskCreatedWorkflow } from '@/workflows/task-flows';
import { tenantCreatedWorkflow } from '@/workflows/tenant-flows';
import { quantumDealIntelligenceService } from '@/services/intelligence/quantumDealIntelligenceService';
import { runEnterpriseWorkflowsForTrigger } from '@/lib/crm/crmEnterpriseWorkflowRunner';
import { syncCrmEntity } from '@/lib/crm/crmBridgeServer';
import { isBonnieReasoningEvent, reasonAboutBusinessEvent } from '@/lib/bonnie/os/eventReasoning';

export const dynamic = 'force-dynamic';

/**
 * Main Automation Dispatcher
 * Polls unprocessed business events and triggers the corresponding workflows.
 * Run this every 5 minutes via Railway Cron.
 */
export async function GET(request: NextRequest) {
  const denied = denyIfCronUnauthorized(request);
  if (denied) return denied;

  const supabase = createSupabaseAdminClient();
  const ranAt = new Date().toISOString();

  try {
    // 1. Fetch unprocessed events (limit to prevent timeout)
    const { data: events, error: fetchError } = await supabase
      .from('business_automation_events')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) throw fetchError;

    if (!events || events.length === 0) {
      await logCron('process-events', 'success', { message: 'No pending events' }, ranAt);
      return NextResponse.json({ success: true, message: 'No pending events' });
    }

    const results = [];

    // 2. Dispatch events to workflows
    for (const event of events) {
      const guard = await guardCronTenantRow(event, 'business_automation_events', {
        event_type: event.event_type,
      });
      if (!guard.ok) {
        results.push({ eventId: event.id, status: 'quarantined', error: guard.error });
        continue;
      }

      try {
        // Every business event creates Bonnie reasoning (Observe→…→Learn)
        if (isBonnieReasoningEvent(event.event_type)) {
          try {
            // Durable runtime: persist to event inbox first (duplicate-safe), then wake subscriptions.
            try {
              const { isDurableRuntimeEnabled } = await import('@/lib/bonnie/runtime');
              if (isDurableRuntimeEnabled()) {
                const { persistInboxEvent, processInboxEvent } = await import(
                  '@/lib/bonnie/runtime/inboxService'
                );
                const inbox = await persistInboxEvent({
                  tenantId: event.tenant_id,
                  providerEventId: `bae:${event.id}`,
                  eventType: event.event_type,
                  entityType: (event.payload as any)?.entityType || null,
                  entityId:
                    (event.payload as any)?.invoiceId ||
                    (event.payload as any)?.leadId ||
                    (event.payload as any)?.dealId ||
                    null,
                  payload: (event.payload || {}) as Record<string, unknown>,
                  signatureVerified: true,
                  correlationId: event.id,
                });
                if (!inbox.duplicate) {
                  await processInboxEvent(inbox.id, event.tenant_id);
                }
              }
            } catch (inboxErr) {
              console.warn('[Automation] durable inbox failed:', inboxErr);
            }

            const cognitive = await reasonAboutBusinessEvent({
              tenantId: event.tenant_id,
              eventType: event.event_type,
              eventId: event.id,
              payload: (event.payload || {}) as Record<string, unknown>,
              executeActions: true,
            });
            results.push({
              eventId: event.id,
              status: 'bonnie_reasoned',
              cognitiveRunId: cognitive?.runId || null,
              cognitiveStatus: cognitive?.status || null,
            });
          } catch (reasonErr: unknown) {
            const message = reasonErr instanceof Error ? reasonErr.message : String(reasonErr);
            console.warn(`[Automation] Bonnie reasoning failed for ${event.id}:`, message);
            results.push({ eventId: event.id, status: 'bonnie_reason_failed', error: message });
          }
        }

        let workflowToStart: any = null;

        switch (event.event_type) {
          case 'tenant_created':
            workflowToStart = tenantCreatedWorkflow;
            break;
          case 'deal_stage_changed':
            workflowToStart = dealStageChangedWorkflow;
            break;
          case 'invoice_overdue':
            workflowToStart = invoiceOverdueWorkflow;
            break;
          case 'lead_created':
            workflowToStart = leadCreatedWorkflow;
            break;
          case 'contract_signed': {
            const payload = (event.payload || {}) as Record<string, unknown>;
            const contractId = String(payload.contractId || '');
            const actorUserId = typeof payload.actorUserId === 'string' ? payload.actorUserId : undefined;
            const { isDurableRuntimeEnabled } = await import('@/lib/bonnie/runtime/types');
            if (isDurableRuntimeEnabled() && contractId) {
              const { queueContractSigned } = await import('@/lib/contracts/durableContractSignedRouter');
              const queued = await queueContractSigned({
                tenantId: event.tenant_id,
                contractId,
                userId: actorUserId,
                eventId: event.id,
              });
              await supabase.from('automation_runs').insert({
                id: queued.run_id,
                workflow_type: event.event_type,
                tenant_id: event.tenant_id,
                status: 'running',
              });
              await runCrmCoherenceHooks(supabase, event);
              await supabase.from('business_automation_events').update({ processed: true }).eq('id', event.id);
              results.push({
                eventId: event.id,
                status: 'dispatched',
                runId: queued.run_id,
                durable: queued.durable,
              });
              continue;
            }
            workflowToStart = contractSignedWorkflow;
            break;
          }
          case 'task_overdue':
            workflowToStart = taskOverdueWorkflow;
            break;
          case 'invoice_created':
            workflowToStart = invoiceCreatedWorkflow;
            break;
          case 'task_created':
            workflowToStart = taskCreatedWorkflow;
            break;
          case 'scraper_outreach_requested': {
            const { leadNurtureWorkflow } = await import('@/workflows/lead-nurture');
            for (const leadId of event.payload?.leadIds || []) {
              const { runId } = await start(leadNurtureWorkflow, [{ leadId, tenantId: event.tenant_id }]);
              results.push({ eventId: event.id, status: 'dispatched', runId, type: 'lead_nurture' });
            }
            await supabase.from('business_automation_events').update({ processed: true }).eq('id', event.id);
            continue;
          }
          case 'deal_intelligence_requested': {
            const dealId = String(event.payload?.dealId || '');
            if (!dealId) {
              await supabase
                .from('business_automation_events')
                .update({ processed: true })
                .eq('id', event.id);
              results.push({ eventId: event.id, status: 'skipped', reason: 'missing_deal_id' });
              continue;
            }
            const { data: dealRow } = await supabase
              .from('deals')
              .select('id')
              .eq('tenant_id', event.tenant_id)
              .eq('id', dealId)
              .maybeSingle();
            if (!dealRow) {
              await supabase
                .from('business_automation_events')
                .update({ processed: true })
                .eq('id', event.id);
              results.push({ eventId: event.id, status: 'skipped', reason: 'deal_not_found' });
              continue;
            }
            await quantumDealIntelligenceService.recomputeDeal(supabase, event.tenant_id, dealId);
            await supabase
              .from('business_automation_events')
              .update({ processed: true })
              .eq('id', event.id);
            results.push({ eventId: event.id, status: 'dispatched', type: 'deal_intelligence' });
            continue;
          }
          default:
            console.warn(`[Automation] No workflow mapping for event type: ${event.event_type}`);
        }

        if (workflowToStart) {
          const { runId } = await start(workflowToStart, [
            { 
              tenantId: event.tenant_id, 
              payload: event.payload,
              eventId: event.id 
            }
          ]);
          
          // Log the run
          await supabase.from('automation_runs').insert({
            id: runId, // Use the workflow engine's runId as primary key if possible
            workflow_type: event.event_type,
            tenant_id: event.tenant_id,
            status: 'running'
          });

          await runCrmCoherenceHooks(supabase, event);

          await supabase
            .from('business_automation_events')
            .update({ processed: true })
            .eq('id', event.id);

          results.push({ eventId: event.id, status: 'dispatched', runId });
        } else if (await runCrmCoherenceHooks(supabase, event)) {
          await supabase
            .from('business_automation_events')
            .update({ processed: true })
            .eq('id', event.id);
          results.push({ eventId: event.id, status: 'hooks_only' });
        } else {
          await supabase
            .from('business_automation_events')
            .update({ processed: true })
            .eq('id', event.id);
          results.push({ eventId: event.id, status: 'skipped', reason: 'no_workflow' });
        }

      } catch (err: any) {
        console.error(`[Automation] Error processing event ${event.id}:`, err.message);
        results.push({ eventId: event.id, status: 'failed', error: err.message });
      }
    }

    await logCron('process-events', 'success', { results }, ranAt);
    return NextResponse.json({ success: true, processed_count: events.length, results });

  } catch (error: any) {
    console.error('[Automation] Cron dispatcher failed:', error.message);
    await logCron('process-events', 'failed', { error: error.message }, ranAt);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function logCron(trigger: string, status: string, payload: any, ranAt: string) {
  const supabase = createSupabaseAdminClient();
  await supabase.from('automation_cron_logs').insert({
    trigger_type: trigger,
    status,
    payload,
    ran_at: ranAt,
    error_message: status === 'failed' ? payload.error : null
  });
}

async function runCrmCoherenceHooks(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  event: { tenant_id: string; event_type: string; payload?: Record<string, unknown> | null }
): Promise<boolean> {
  const payload = (event.payload || {}) as Record<string, unknown>;
  const tenantId = event.tenant_id;

  if (event.event_type === 'deal_stage_changed') {
    const dealId = String(payload.dealId || '');
    if (dealId) {
      await syncCrmEntity(supabase, 'deal', dealId, tenantId).catch((err) => {
        console.warn('[Automation] deal bridge sync failed:', err);
      });
    }
    await runEnterpriseWorkflowsForTrigger(
      supabase,
      tenantId,
      'deal_stage_changed',
      { ...payload, tenantId },
      'deal',
      dealId || undefined
    ).catch((err) => console.warn('[Automation] enterprise workflows failed:', err));
    return true;
  }

  if (event.event_type === 'lead_created') {
    const leadId = String(payload.leadId || payload.id || '');
    if (leadId) {
      await syncCrmEntity(supabase, 'lead', leadId, tenantId).catch((err) => {
        console.warn('[Automation] lead bridge sync failed:', err);
      });
    }
    return Boolean(leadId);
  }

  if (event.event_type === 'contract_signed') {
    const contractId = String(payload.contractId || '');
    if (!contractId) return false;

    const { data: contract } = await supabase
      .from('contracts')
      .select('client_id, deal_id, metadata')
      .eq('id', contractId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const { closeDealFromContractSign, resolveContractDealId } = await import(
      '@/lib/contracts/contractCoherenceServer'
    );
    const dealId = contract ? resolveContractDealId(contract) : null;
    await closeDealFromContractSign(supabase, tenantId, {
      dealId,
      partyId: contract?.client_id,
    }).catch((err) => console.warn('[Automation] contract sign coherence failed:', err));

    await runEnterpriseWorkflowsForTrigger(
      supabase,
      tenantId,
      'contract_signed',
      { ...payload, tenantId, dealId },
      'contract',
      contractId
    ).catch((err) => console.warn('[Automation] contract workflows failed:', err));

    return true;
  }

  return false;
}
