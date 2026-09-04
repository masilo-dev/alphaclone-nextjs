/**
 * Phase 1 Universal Chaser detector — observe-only canonical records.
 * Does not send messages; compares against existing fragmented scanners.
 */

import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { upsertChaseInstance } from '@/lib/chaser/chaseInstanceService';
import { isOpenTaskStatus } from '@/lib/crm/canonicalWorkspaceStats';
import { listStaleProjects } from '@/lib/chaser/projectCompatRepository';
import { isChaserEnabledForTenant } from '@/lib/chaser/chaseConfig';

export type ChaseScanResult = {
  tenantId: string;
  detected: number;
  created: number;
  updated: number;
  byPolicy: Record<string, number>;
  errors: string[];
};

const OPEN_QUOTE_STATUSES = new Set(['sent', 'viewed', 'draft']);

export async function runChaseScanForTenant(tenantId: string): Promise<ChaseScanResult> {
  const admin = createSupabaseAdminClient();
  const result: ChaseScanResult = {
    tenantId,
    detected: 0,
    created: 0,
    updated: 0,
    byPolicy: {},
    errors: [],
  };

  if (!(await isChaserEnabledForTenant(tenantId))) {
    return result;
  }

  const bump = (policyKey: string, created: boolean) => {
    result.detected += 1;
    result.byPolicy[policyKey] = (result.byPolicy[policyKey] || 0) + 1;
    if (created) result.created += 1;
    else result.updated += 1;
  };

  const today = new Date().toISOString().slice(0, 10);

  const { data: overdueTasks } = await admin
    .from('tasks')
    .select('id, title, status, due_date, assigned_to, related_to_contact, related_to_project')
    .eq('tenant_id', tenantId)
    .lt('due_date', today)
    .limit(50);

  for (const task of overdueTasks || []) {
    if (!isOpenTaskStatus(String(task.status || ''))) continue;
    const upsert = await upsertChaseInstance({
      tenantId,
      policyKey: 'task_chaser',
      entityType: 'task',
      entityId: task.id,
      reasonCode: 'overdue',
      assigneeUserId: task.assigned_to,
      relatedContactId: task.related_to_contact,
      relatedProjectId: task.related_to_project,
      lastObservedState: String(task.status),
      contextSnapshot: { title: task.title, due_date: task.due_date },
    });
    if (upsert.error) result.errors.push(upsert.error);
    else bump('task_chaser', upsert.created);
  }

  const { data: openQuotes } = await admin
    .from('quotes')
    .select('id, quote_number, status, contact_id, client_id, valid_until, sent_at, viewed_at')
    .eq('tenant_id', tenantId)
    .in('status', Array.from(OPEN_QUOTE_STATUSES))
    .limit(50);

  for (const quote of openQuotes || []) {
    if (quote.status === 'accepted' || quote.status === 'converted') continue;
    const upsert = await upsertChaseInstance({
      tenantId,
      policyKey: 'quote_proposal_chaser',
      entityType: 'quote',
      entityId: quote.id,
      reasonCode: quote.viewed_at ? 'viewed_no_decision' : 'sent_no_response',
      relatedContactId: quote.contact_id || quote.client_id,
      lastObservedState: String(quote.status),
      contextSnapshot: {
        quote_number: quote.quote_number,
        valid_until: quote.valid_until,
        sent_at: quote.sent_at,
        viewed_at: quote.viewed_at,
      },
    });
    if (upsert.error) result.errors.push(upsert.error);
    else bump('quote_proposal_chaser', upsert.created);
  }

  const { data: unpaidInvoices } = await admin
    .from('business_invoices')
    .select('id, invoice_number, status, due_date, client_id, reminder_count, balance_due, total')
    .eq('tenant_id', tenantId)
    .in('status', ['sent', 'viewed', 'overdue', 'partially_paid'])
    .limit(50);

  for (const invoice of unpaidInvoices || []) {
    const upsert = await upsertChaseInstance({
      tenantId,
      policyKey: 'invoice_chaser',
      entityType: 'invoice',
      entityId: invoice.id,
      reasonCode: invoice.due_date && invoice.due_date < today ? 'overdue' : 'awaiting_payment',
      relatedClientId: invoice.client_id,
      lastObservedState: String(invoice.status),
      contextSnapshot: {
        invoice_number: invoice.invoice_number,
        due_date: invoice.due_date,
        reminder_count: invoice.reminder_count,
        balance_due: invoice.balance_due ?? invoice.total,
      },
    });
    if (upsert.error) result.errors.push(upsert.error);
    else bump('invoice_chaser', upsert.created);
  }

  const { data: unsignedContracts } = await admin
    .from('contracts')
    .select('id, title, status, client_id, client_name, sent_at')
    .eq('tenant_id', tenantId)
    .in('status', ['sent', 'pending_signature', 'viewed'])
    .limit(50);

  for (const contract of unsignedContracts || []) {
    const upsert = await upsertChaseInstance({
      tenantId,
      policyKey: 'contract_chaser',
      entityType: 'contract',
      entityId: contract.id,
      reasonCode: 'unsigned',
      relatedClientId: contract.client_id,
      lastObservedState: String(contract.status),
      contextSnapshot: { title: contract.title, client_name: contract.client_name, sent_at: contract.sent_at },
      severity: 'high',
    });
    if (upsert.error) result.errors.push(upsert.error);
    else bump('contract_chaser', upsert.created);
  }

  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
  const { data: staleLeads } = await admin
    .from('leads')
    .select('id, business_name, contact_name, stage, updated_at, email')
    .eq('tenant_id', tenantId)
    .in('stage', ['new', 'lead', 'qualified'])
    .lt('updated_at', threeDaysAgo)
    .limit(50);

  for (const lead of staleLeads || []) {
    const upsert = await upsertChaseInstance({
      tenantId,
      policyKey: 'lead_chaser',
      entityType: 'lead',
      entityId: lead.id,
      reasonCode: 'no_touch',
      lastObservedState: String(lead.stage),
      contextSnapshot: { business_name: lead.business_name, contact_name: lead.contact_name, email: lead.email },
    });
    if (upsert.error) result.errors.push(upsert.error);
    else bump('lead_chaser', upsert.created);
  }

  const { data: breachedSlas } = await admin
    .from('communication_slas')
    .select('id, client_id, contact_email, subject, status, sla_breached')
    .eq('tenant_id', tenantId)
    .eq('status', 'WAITING_ON_CLIENT')
    .eq('sla_breached', true)
    .limit(50);

  for (const sla of breachedSlas || []) {
    const upsert = await upsertChaseInstance({
      tenantId,
      policyKey: 'client_chaser',
      entityType: 'client',
      entityId: sla.client_id || sla.id,
      reasonCode: 'no_reply',
      relatedClientId: sla.client_id,
      waitingOn: 'client',
      lastObservedState: String(sla.status),
      contextSnapshot: { contact_email: sla.contact_email, subject: sla.subject, sla_id: sla.id },
    });
    if (upsert.error) result.errors.push(upsert.error);
    else bump('client_chaser', upsert.created);
  }

  const staleProjects = await listStaleProjects(tenantId, 3, 25);
  for (const project of staleProjects) {
    const upsert = await upsertChaseInstance({
      tenantId,
      policyKey: 'project_chaser',
      entityType: 'project',
      entityId: String(project.id),
      reasonCode: 'no_progress',
      relatedProjectId: String(project.id),
      ownerUserId: (project.owner_id as string) || null,
      lastObservedState: String(project.status),
      contextSnapshot: { name: project.name, source_table: project.source_table, updated_at: project.updated_at },
    });
    if (upsert.error) result.errors.push(upsert.error);
    else bump('project_chaser', upsert.created);
  }

  return result;
}

export async function buildChaseBrief(tenantId: string) {
  const admin = createSupabaseAdminClient();
  const { data: items } = await admin
    .from('chase_instances')
    .select('*')
    .eq('tenant_id', tenantId)
    .not('state', 'in', '("RESOLVED","EXHAUSTED","CANCELLED")')
    .order('severity', { ascending: false })
    .order('next_action_at', { ascending: true })
    .limit(100);

  const grouped = new Map<string, typeof items>();
  for (const item of items || []) {
    const key = item.related_client_id || item.related_project_id || 'general';
    grouped.set(key, [...(grouped.get(key) || []), item]);
  }

  return {
    tenant_id: tenantId,
    generated_at: new Date().toISOString(),
    total_active: items?.length || 0,
    groups: Array.from(grouped.entries()).map(([key, rows]) => ({
      group_key: key,
      count: rows?.length || 0,
      items: rows,
    })),
  };
}
