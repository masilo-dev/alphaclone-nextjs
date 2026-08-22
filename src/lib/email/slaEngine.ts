import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { recordTenantEvent } from '@/lib/events/tenantEventLogger';

export type SlaStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'ACKNOWLEDGED'
  | 'RESPONDED'
  | 'WAITING_ON_CLIENT'
  | 'ESCALATED'
  | 'CLOSED';

export interface RegisterIncomingSlaParams {
  tenantId: string;
  sourceType: 'email' | 'chat' | 'form' | 'whatsapp' | 'phone' | 'meeting';
  sourceId?: string;
  clientId?: string;
  contactEmail?: string;
  subject?: string;
  assignedOwnerId?: string;
  slaHours?: number; // default 24h
}

export interface SlaEvaluationResult {
  totalActive: number;
  approachingBreach: number;
  breached: number;
  breachedItems: Array<{
    id: string;
    contactEmail: string;
    subject: string;
    hoursOverdue: number;
    assignedOwnerId?: string;
  }>;
}

/**
 * Registers incoming client/prospect communication and establishes 24-hour response SLA tracking.
 */
export async function trackIncomingCommunication(params: RegisterIncomingSlaParams): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const slaHours = params.slaHours || 24;
  const deadline = new Date(Date.now() + slaHours * 3600 * 1000).toISOString();

  const { data, error } = await supabase
    .from('communication_slas')
    .insert({
      tenant_id: params.tenantId,
      source_type: params.sourceType,
      source_id: params.sourceId || null,
      client_id: params.clientId || null,
      contact_email: params.contactEmail || null,
      subject: params.subject || `${params.sourceType.toUpperCase()} received`,
      received_at: new Date().toISOString(),
      assigned_owner_id: params.assignedOwnerId || null,
      response_deadline_at: deadline,
      status: params.assignedOwnerId ? 'ASSIGNED' : 'NEW',
      sla_breached: false,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    console.warn('[slaEngine] Failed to register communication SLA:', error.message);
    return null;
  }

  // Record operational event
  await recordTenantEvent({
    tenantId: params.tenantId,
    sourceModule: 'EMAIL',
    action: 'COMMUNICATION_RECEIVED',
    title: `Incoming ${params.sourceType.toUpperCase()} from ${params.contactEmail || 'Client'}`,
    description: `Subject: ${params.subject || 'N/A'}. 24-hour response SLA clock started.`,
    clientId: params.clientId,
    status: 'EXECUTING',
    notificationLevel: 'LEVEL_2_DIGEST',
    nextAction: {
      action: 'RESPOND_TO_COMMUNICATION',
      dueDate: deadline,
      recommendedAction: 'Acknowledge & send reply within SLA window',
    },
    evidence: {
      receivedAt: new Date().toISOString(),
      deadline,
    },
  });

  return data?.id || null;
}

/**
 * Updates communication SLA status (e.g. RECEIVED -> ASSIGNED -> ACKNOWLEDGED -> RESPONDED).
 */
export async function updateSlaStatus(params: {
  tenantId: string;
  slaId: string;
  newStatus: SlaStatus;
  ownerId?: string;
  notes?: string;
}): Promise<boolean> {
  const supabase = createSupabaseAdminClient();

  const { data: existing } = await supabase
    .from('communication_slas')
    .select('*')
    .eq('id', params.slaId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();

  if (!existing) return false;

  const now = new Date();
  const receivedAt = new Date(existing.received_at);
  const deadlineAt = new Date(existing.response_deadline_at);

  const updates: Record<string, unknown> = {
    status: params.newStatus,
    updated_at: now.toISOString(),
  };

  if (params.ownerId) {
    updates.assigned_owner_id = params.ownerId;
  }

  if (params.newStatus === 'RESPONDED' || params.newStatus === 'CLOSED') {
    updates.actual_response_at = now.toISOString();
    const responseMinutes = Math.round((now.getTime() - receivedAt.getTime()) / (1000 * 60));
    updates.response_time_minutes = responseMinutes;
    updates.sla_breached = now.getTime() > deadlineAt.getTime();
  }

  const { error } = await supabase
    .from('communication_slas')
    .update(updates)
    .eq('id', params.slaId)
    .eq('tenant_id', params.tenantId);

  if (error) {
    console.warn('[slaEngine] Failed to update SLA status:', error.message);
    return false;
  }

  // Record operational event on completion or escalation
  if (params.newStatus === 'RESPONDED') {
    await recordTenantEvent({
      tenantId: params.tenantId,
      sourceModule: 'EMAIL',
      action: 'COMMUNICATION_RESPONDED',
      title: `Client communication responded in ${updates.response_time_minutes} minutes`,
      description: `Subject: ${existing.subject}`,
      clientId: existing.client_id,
      status: updates.sla_breached ? 'PARTIAL' : 'VERIFIED',
      notificationLevel: updates.sla_breached ? 'LEVEL_3_IMMEDIATE' : 'LEVEL_1_RECORD',
      evidence: {
        receivedAt: existing.received_at,
        respondedAt: now.toISOString(),
        responseTimeMinutes: updates.response_time_minutes,
        slaBreached: updates.sla_breached,
      },
    });
  }

  return true;
}

/**
 * Scans active communication SLAs for approaching or breached response deadlines.
 */
export async function evaluateTenantSlas(tenantId: string): Promise<SlaEvaluationResult> {
  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const fourHoursFromNow = new Date(now.getTime() + 4 * 3600 * 1000);

  const { data: activeSlas } = await supabase
    .from('communication_slas')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('status', ['NEW', 'ASSIGNED', 'ACKNOWLEDGED']);

  const items = activeSlas || [];
  let approachingBreach = 0;
  let breached = 0;
  const breachedItems: SlaEvaluationResult['breachedItems'] = [];

  for (const sla of items) {
    const deadline = new Date(sla.response_deadline_at);

    if (now > deadline) {
      breached++;
      const hoursOverdue = Math.round((now.getTime() - deadline.getTime()) / (1000 * 3600) * 10) / 10;

      breachedItems.push({
        id: sla.id,
        contactEmail: sla.contact_email || 'Unknown',
        subject: sla.subject || 'Client Communication',
        hoursOverdue,
        assignedOwnerId: sla.assigned_owner_id,
      });

      // Mark SLA breached in DB if not already flagged
      if (!sla.sla_breached) {
        await supabase
          .from('communication_slas')
          .update({ sla_breached: true, status: 'ESCALATED' })
          .eq('id', sla.id);

        // Immediate Level 3 Alert for SLA breach
        await recordTenantEvent({
          tenantId,
          sourceModule: 'EMAIL',
          action: 'COMMUNICATION_SLA_BREACHED',
          title: `[SLA BREACH] Response overdue for ${sla.contact_email || 'Client'}`,
          description: `Subject: ${sla.subject}. Overdue by ${hoursOverdue} hours.`,
          clientId: sla.client_id,
          status: 'FAILED',
          notificationLevel: 'LEVEL_3_IMMEDIATE',
          nextAction: {
            action: 'IMMEDIATE_CLIENT_RESPONSE_REQUIRED',
            ownerId: sla.assigned_owner_id,
            recommendedAction: 'Respond immediately to resolve client SLA breach',
          },
          evidence: {
            receivedAt: sla.received_at,
            deadline: sla.response_deadline_at,
            hoursOverdue,
          },
        });
      }
    } else if (deadline <= fourHoursFromNow) {
      approachingBreach++;
      const hoursRemaining = Math.round((deadline.getTime() - now.getTime()) / (1000 * 3600) * 10) / 10;

      await recordTenantEvent({
        tenantId,
        sourceModule: 'EMAIL',
        action: 'COMMUNICATION_SLA_RISK',
        title: `[SLA RISK] Client response due in ${hoursRemaining} hours`,
        description: `Subject: ${sla.subject} from ${sla.contact_email || 'Client'}`,
        clientId: sla.client_id,
        status: 'BLOCKED',
        notificationLevel: 'LEVEL_2_DIGEST',
        nextAction: {
          action: 'RESPOND_BEFORE_SLA_BREACH',
          ownerId: sla.assigned_owner_id,
          dueDate: sla.response_deadline_at,
        },
      });
    }
  }

  return {
    totalActive: items.length,
    approachingBreach,
    breached,
    breachedItems,
  };
}
