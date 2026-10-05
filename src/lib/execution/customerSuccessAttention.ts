/**
 * Customer-success attention signals from canonical delivery objects.
 * Uses existing Chase / NBA vocabulary — not a new agent product.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { NextBestAction } from '@/lib/execution/nextBestActionEngine';

export async function deriveCustomerSuccessActions(
  tenantId: string
): Promise<NextBestAction[]> {
  const admin = createSupabaseAdminClient();
  const actions: NextBestAction[] = [];
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400_000).toISOString();

  const [{ data: idleProjects }, { data: unpaid }, { data: unsigned }] = await Promise.all([
    admin
      .from('projects')
      .select('id, name, status, updated_at')
      .eq('tenant_id', tenantId)
      .lt('updated_at', fourteenDaysAgo)
      .not('status', 'in', '("Completed","Cancelled","completed","cancelled")')
      .limit(10),
    admin
      .from('business_invoices')
      .select('id, invoice_number, status, due_date')
      .eq('tenant_id', tenantId)
      .eq('status', 'overdue')
      .limit(10),
    admin
      .from('contracts')
      .select('id, title, status')
      .eq('tenant_id', tenantId)
      .in('status', ['sent', 'pending_signature'])
      .limit(10),
  ]);

  for (const p of idleProjects || []) {
    actions.push({
      object_type: 'project',
      object_id: String(p.id),
      object_label: String(p.name),
      current_state: String(p.status),
      last_meaningful_event: `Idle since ${p.updated_at}`,
      outstanding_action: 'client_update',
      blocking_condition: 'project_inactivity',
      recommended_next_action: 'Check missing client input or send delivery update',
      reason: 'Project inactive >14 days after sale — customer success risk.',
      urgency: 'high',
      recommended_capability: 'update_project_status',
      approval_requirement: 'none',
      href: `/dashboard?module=projects&id=${p.id}`,
    });
  }

  for (const inv of unpaid || []) {
    actions.push({
      object_type: 'invoice',
      object_id: String(inv.id),
      object_label: String(inv.invoice_number),
      current_state: 'overdue',
      last_meaningful_event: inv.due_date ? `Due ${inv.due_date}` : null,
      outstanding_action: 'payment_chase',
      blocking_condition: 'unpaid_invoice',
      recommended_next_action: 'Chase overdue payment via Universal Chaser',
      reason: 'Unpaid invoice after delivery stage.',
      urgency: 'critical',
      recommended_capability: 'send_invoice',
      approval_requirement: 'tenant_policy',
      href: `/dashboard?module=invoicing&id=${inv.id}`,
    });
  }

  for (const c of unsigned || []) {
    actions.push({
      object_type: 'contract',
      object_id: String(c.id),
      object_label: String(c.title),
      current_state: String(c.status),
      last_meaningful_event: null,
      outstanding_action: 'signature',
      blocking_condition: 'unsigned_document',
      recommended_next_action: 'Remind client to sign',
      reason: 'Unsigned contract blocks delivery confidence.',
      urgency: 'high',
      recommended_capability: 'send_contract',
      approval_requirement: 'tenant_policy',
      href: `/dashboard?module=contracts&id=${c.id}`,
    });
  }

  return actions;
}
