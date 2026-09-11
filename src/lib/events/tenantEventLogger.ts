import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { notifyTenantOwners } from '@/lib/notifyTenantOwners';

export type ActorType =
  | 'USER'
  | 'BONNIE'
  | 'AI_AGENT'
  | 'MCP'
  | 'AUTOMATION'
  | 'API'
  | 'WEBHOOK'
  | 'SCHEDULED_JOB'
  | 'EXTERNAL_INTEGRATION'
  | 'SYSTEM';

export type SourceModule =
  | 'CRM'
  | 'LEADS'
  | 'SALES'
  | 'EMAIL'
  | 'PROJECTS'
  | 'TASKS'
  | 'SOCIAL'
  | 'DOCUMENTS'
  | 'PROPOSALS'
  | 'CONTRACTS'
  | 'INVOICES'
  | 'PAYMENTS'
  | 'MEETINGS'
  | 'MARKETING'
  | 'AUTOMATION'
  | 'MCP'
  | 'SYSTEM';

export type EventStatus =
  | 'PROPOSED'
  | 'APPROVED'
  | 'EXECUTING'
  | 'SUCCESS'
  | 'VERIFIED'
  | 'FAILED'
  | 'PARTIAL'
  | 'BLOCKED'
  | 'CANCELLED';

export type NotificationLevel = 'LEVEL_1_RECORD' | 'LEVEL_2_DIGEST' | 'LEVEL_3_IMMEDIATE';

export interface NextActionSpec {
  action?: string;
  ownerId?: string;
  ownerName?: string;
  dueDate?: string;
  recommendedAction?: string;
  [key: string]: unknown;
}

export interface TenantEventParams {
  tenantId: string;
  actorId?: string | null;
  actorName?: string | null;
  actorType?: ActorType;
  sourceModule: SourceModule;
  action: string;
  title: string;
  description?: string | null;

  // Linkage to business objects
  clientId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  leadId?: string | null;
  opportunityId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  proposalId?: string | null;
  contractId?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  meetingId?: string | null;
  documentId?: string | null;
  socialPostId?: string | null;

  status?: EventStatus;
  notificationLevel?: NotificationLevel;
  evidence?: Record<string, unknown> | null;
  nextAction?: NextActionSpec | null;
  metadata?: Record<string, unknown> | null;
  occurredAt?: string;
}

/**
 * Universal Tenant Event Logger
 * Records meaningful business actions across all AlphaClone modules.
 */
export async function recordTenantEvent(params: TenantEventParams): Promise<{
  eventId: string | null;
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = createSupabaseAdminClient();

    // Default status to SUCCESS if omitted
    const status: EventStatus = params.status || 'SUCCESS';

    // Auto-escalate failing or blocked actions to LEVEL_3_IMMEDIATE if omitted
    let level: NotificationLevel = params.notificationLevel || 'LEVEL_1_RECORD';
    if (!params.notificationLevel && (status === 'FAILED' || status === 'BLOCKED' || status === 'PARTIAL')) {
      level = 'LEVEL_3_IMMEDIATE';
    }

    const payload = {
      tenant_id: params.tenantId,
      actor_id: params.actorId || null,
      actor_name: params.actorName || null,
      actor_type: params.actorType || 'SYSTEM',
      source_module: params.sourceModule,
      action: params.action,
      title: params.title,
      description: params.description || null,

      client_id: params.clientId || null,
      contact_id: params.contactId || null,
      company_id: params.companyId || null,
      lead_id: params.leadId || null,
      opportunity_id: params.opportunityId || null,
      project_id: params.projectId || null,
      task_id: params.taskId || null,
      proposal_id: params.proposalId || null,
      contract_id: params.contractId || null,
      invoice_id: params.invoiceId || null,
      payment_id: params.paymentId || null,
      meeting_id: params.meetingId || null,
      document_id: params.documentId || null,
      social_post_id: params.socialPostId || null,

      status,
      notification_level: level,
      evidence: params.evidence || {},
      next_action: params.nextAction || {},
      metadata: params.metadata || {},
      occurred_at: params.occurredAt || new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('tenant_operational_events')
      .insert(payload)
      .select('id')
      .maybeSingle();

    if (error) {
      console.warn('[tenantEventLogger] Failed to persist operational event:', error.message);
      // Fallback: log to standard server audit log if main table fails
      return { eventId: null, success: false, error: error.message };
    }

    const eventId = data?.id || null;

    // LEVEL 3: Dispatch immediate notifications to tenant owners
    if (level === 'LEVEL_3_IMMEDIATE') {
      notifyTenantOwners({
        tenantId: params.tenantId,
        type: `operational_alert_${params.sourceModule.toLowerCase()}`,
        title: `[ALERT] ${params.title}`,
        message: `${params.description || params.action}. Status: ${status}. Actor: ${params.actorType}`,
        link: params.projectId
          ? `/dashboard/projects?id=${params.projectId}`
          : params.clientId
            ? `/dashboard/crm?client=${params.clientId}`
            : '/dashboard/operations',
      }).catch((err) => {
        console.error('[tenantEventLogger] Failed to dispatch immediate alert:', err);
      });
    }

    return { eventId, success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[tenantEventLogger] Unexpected exception:', errorMsg);
    return { eventId: null, success: false, error: errorMsg };
  }
}
