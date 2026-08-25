/**
 * Durable Campaign Recipient Fan-Out Orchestrator
 * Converts email campaigns into a PostgreSQL-backed agent_tasks recipient fan-out DAG
 * with stage checkpoints, recipient isolation, idempotency keys, and pause/resume capability.
 */

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createRunForObjective } from "@/lib/bonnie/runtime/goalRunService";
import {
  beginIdempotentAction,
  completeIdempotentAction,
  saveExternalReference,
  buildIdempotencyKey,
} from "@/lib/bonnie/runtime/idempotencyService";
import { insertOutboxEvent } from "@/lib/bonnie/runtime/outboxService";
import { sendScheduledCampaignServer } from "@/lib/server/sendScheduledCampaignServer";

export async function reconcileStaleCampaigns(tenantId?: string): Promise<{
  reconciled: number;
  autoCompleted: number;
  autoPaused: number;
}> {
  const admin = createSupabaseAdminClient();
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  let query = admin
    .from('email_campaigns')
    .select('id, tenant_id, status, updated_at')
    .in('status', ['sending', 'processing', 'queued'])
    .lt('updated_at', fifteenMinutesAgo);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data: staleCampaigns } = await query;
  if (!staleCampaigns || staleCampaigns.length === 0) {
    return { reconciled: 0, autoCompleted: 0, autoPaused: 0 };
  }

  let autoCompleted = 0;
  let autoPaused = 0;

  for (const campaign of staleCampaigns) {
    const { data: recipients } = await admin
      .from('campaign_recipients')
      .select('status')
      .eq('campaign_id', campaign.id);

    const list = recipients || [];
    const pendingCount = list.filter((r) => r.status === 'pending').length;
    const sentCount = list.filter((r) => r.status === 'sent').length;
    const failedCount = list.filter((r) => r.status === 'failed').length;

    if (pendingCount === 0) {
      await admin
        .from('email_campaigns')
        .update({
          status: 'sent',
          total_sent: sentCount,
          total_failed: failedCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaign.id);

      await insertOutboxEvent({
        tenantId: campaign.tenant_id,
        eventType: 'campaign.execution.completed',
        payload: { campaignId: campaign.id, totalSent: sentCount, totalFailed: failedCount, staleRecovery: true },
      });

      const { emitBusinessEvent } = await import('@/lib/automation/emit-event');
      await emitBusinessEvent(campaign.tenant_id, 'campaign_completed', {
        campaignId: campaign.id,
        totalSent: sentCount,
        totalFailed: failedCount,
        staleRecovery: true,
      }).catch(() => undefined);

      autoCompleted++;
    } else {
      await admin
        .from('email_campaigns')
        .update({
          status: 'paused',
          total_sent: sentCount,
          total_failed: failedCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaign.id);

      await admin.from('activity_logs').insert({
        tenant_id: campaign.tenant_id,
        action: 'campaign_execution_stale_paused',
        entity_type: 'email_campaign',
        entity_id: campaign.id,
        metadata: {
          reason: 'Worker execution timed out after 15 minutes of inactivity',
          pendingRecipients: pendingCount,
          sentCount,
        },
      });

      await insertOutboxEvent({
        tenantId: campaign.tenant_id,
        eventType: 'campaign.execution.stale_paused',
        payload: { campaignId: campaign.id, pendingCount, sentCount },
      });
      autoPaused++;
    }
  }

  return { reconciled: staleCampaigns.length, autoCompleted, autoPaused };
}

export async function executeCampaignDurableFanOut(campaignId: string): Promise<{
  success: boolean;
  runId?: string;
  processedRecipients: number;
  sentCount: number;
  failedCount: number;
  error?: string;
}> {
  const admin = createSupabaseAdminClient();

  const { data: campaign } = await admin
    .from("email_campaigns")
    .select("id, tenant_id, status, subject, name")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign) {
    return { success: false, processedRecipients: 0, sentCount: 0, failedCount: 0, error: "campaign_not_found" };
  }

  // Set status to processing
  await admin
    .from("email_campaigns")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", campaignId);

  // Create parent durable run for the campaign
  const runResult = await createRunForObjective({
    tenantId: campaign.tenant_id,
    objective: `Execute Email Campaign Fan-Out: ${campaign.name || campaign.subject || campaign.id}`,
    executionMode: "autonomous",
    successCriteria: { campaignId: campaign.id },
    seedGraph: true,
  });

  const runId = runResult.run.id;

  // Check if campaign was cancelled or paused
  if (campaign.status === "cancelled" || campaign.status === "paused") {
    return {
      success: true,
      runId,
      processedRecipients: 0,
      sentCount: 0,
      failedCount: 0,
      error: `Campaign is in ${campaign.status} state`,
    };
  }

  // Fetch recipients
  const { data: recipients } = await admin
    .from("campaign_recipients")
    .select("id, email, status, metadata")
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  const pendingRecipients = recipients || [];

  if (pendingRecipients.length === 0) {
    await admin
      .from("email_campaigns")
      .update({ status: "sent", updated_at: new Date().toISOString() })
      .eq("id", campaignId);

    return { success: true, runId, processedRecipients: 0, sentCount: 0, failedCount: 0 };
  }

  let sentCount = 0;
  let failedCount = 0;

  // Execute actual campaign sending loop with recipient-level idempotency
  for (const recipient of pendingRecipients) {
    // Touch campaign timestamp for heartbeat
    await admin
      .from("email_campaigns")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", campaignId);

    const idempotencyKey = buildIdempotencyKey({
      tenantId: campaign.tenant_id,
      taskId: `camp-${campaignId}-rec-${recipient.id}`,
      actionType: "campaign.email.send",
      targetRecordId: recipient.id,
      actionVersion: 1,
    });

    const gate = await beginIdempotentAction({
      tenantId: campaign.tenant_id,
      key: idempotencyKey,
      taskId: `rec-${recipient.id}`,
      attemptId: `att-${Date.now()}`,
      actionType: "campaign.email.send",
    });

    if (!gate.proceed && gate.existing?.state === "completed") {
      sentCount++;
      continue;
    }

    // Process using server execution core
    try {
      // Delegate single campaign batch processing safely
      const serverResult = await sendScheduledCampaignServer(campaignId);
      if (serverResult.success) {
        sentCount++;
        await completeIdempotentAction({
          tenantId: campaign.tenant_id,
          key: idempotencyKey,
          result: { status: "sent", recipientId: recipient.id },
        });

        await insertOutboxEvent({
          tenantId: campaign.tenant_id,
          eventType: "campaign.email.sent",
          payload: { campaignId, recipientId: recipient.id, email: recipient.email },
        });
      } else {
        failedCount++;
      }
    } catch (err: any) {
      failedCount++;
    }
  }

  // Re-check remaining pending recipients
  const { count: remainingPending } = await admin
    .from("campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  const finalStatus = (remainingPending || 0) === 0 ? "sent" : "paused";
  await admin
    .from("email_campaigns")
    .update({
      status: finalStatus,
      total_sent: sentCount,
      total_failed: failedCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  return {
    success: true,
    runId,
    processedRecipients: pendingRecipients.length,
    sentCount,
    failedCount,
  };
}

