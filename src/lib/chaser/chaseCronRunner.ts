/**
 * Unified cron entry for legacy follow-up scanners — phase 5 uses canonical chaser only.
 */

import 'server-only';

import { getUniversalChaserPhase, shouldDelegateLegacyScannersToChaser } from '@/lib/chaser/chaseConfig';
import { runChaseScanForTenant } from '@/lib/chaser/chaseDetector';
import { executeDueChasesForTenant } from '@/lib/chaser/chaseExecutorService';
import { markOverdueInvoicesForTenant } from '@/lib/chaser/chaseInvoiceMaintenance';
import { reconcileSocialChasesForTenant } from '@/lib/chaser/chaseSocialReceiptReconciliation';

export type ChaseCronJob =
  | 'invoice_overdue_reminders'
  | 'contract_signature_reminders'
  | 'follow_up_escalation';

export type ChaseCronResult = {
  mode: 'chaser' | 'legacy' | 'skipped';
  source: ChaseCronJob;
  tenants?: number;
  scan?: { detected: number; created: number; updated: number };
  execution?: { processed: number; executed: number; resolved: number };
  maintenance?: { markedOverdue: number };
  socialReconciled?: number;
  legacy?: unknown;
};

async function runChaserForTenant(tenantId: string, source: ChaseCronJob): Promise<{
  scan: Awaited<ReturnType<typeof runChaseScanForTenant>>;
  execution: Awaited<ReturnType<typeof executeDueChasesForTenant>>;
  maintenance: { markedOverdue: number };
  socialReconciled: number;
}> {
  let maintenance = { markedOverdue: 0 };
  if (source === 'invoice_overdue_reminders') {
    const m = await markOverdueInvoicesForTenant(tenantId);
    maintenance = { markedOverdue: m.markedOverdue };
  }

  const socialReconciled = await reconcileSocialChasesForTenant(tenantId);
  const scan = await runChaseScanForTenant(tenantId);
  const execution = await executeDueChasesForTenant(tenantId);

  return {
    scan: {
      ...scan,
      byPolicy: { ...scan.byPolicy, [`legacy:${source}`]: 1 },
    },
    execution,
    maintenance,
    socialReconciled,
  };
}

export async function runChaseCronJob(source: ChaseCronJob, limit = 50): Promise<ChaseCronResult> {
  if (shouldDelegateLegacyScannersToChaser()) {
    const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
    const admin = createSupabaseAdminClient();
    const effectiveLimit = getUniversalChaserPhase() >= 5 ? 100 : limit;
    const { data: tenants } = await admin.from('tenants').select('id').limit(effectiveLimit);

    let detected = 0;
    let created = 0;
    let updated = 0;
    let processed = 0;
    let executed = 0;
    let resolved = 0;
    let markedOverdue = 0;
    let socialReconciled = 0;

    for (const t of tenants || []) {
      const r = await runChaserForTenant(t.id, source);
      detected += r.scan.detected;
      created += r.scan.created;
      updated += r.scan.updated;
      processed += r.execution.processed;
      executed += r.execution.executed;
      resolved += r.execution.resolved;
      markedOverdue += r.maintenance.markedOverdue;
      socialReconciled += r.socialReconciled;
    }

    return {
      mode: 'chaser',
      source,
      tenants: tenants?.length || 0,
      scan: { detected, created, updated },
      execution: { processed, executed, resolved },
      maintenance: { markedOverdue },
      socialReconciled,
    };
  }

  if (source === 'contract_signature_reminders') {
    const { processAutomaticContractSignatureReminders } = await import(
      '@/services/contractSignatureReminderService'
    );
    return {
      mode: 'legacy',
      source,
      legacy: await processAutomaticContractSignatureReminders(),
    };
  }

  if (source === 'follow_up_escalation') {
    const { runFollowUpEscalationEngine } = await import('@/lib/notifications/followUpEscalationEngine');
    return { mode: 'legacy', source, legacy: await runFollowUpEscalationEngine() };
  }

  if (source === 'invoice_overdue_reminders') {
    const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
    const admin = createSupabaseAdminClient();
    const { data: tenants } = await admin.from('tenants').select('id').limit(limit);
    let markedOverdue = 0;
    let detected = 0;
    for (const t of tenants || []) {
      const m = await markOverdueInvoicesForTenant(t.id);
      markedOverdue += m.markedOverdue;
      const scan = await runChaseScanForTenant(t.id);
      detected += scan.detected;
    }
    return {
      mode: 'legacy',
      source,
      tenants: tenants?.length || 0,
      maintenance: { markedOverdue },
      scan: { detected, created: 0, updated: 0 },
      legacy: { observe_only: true, phase: getUniversalChaserPhase() },
    };
  }

  return { mode: 'skipped', source };
}
