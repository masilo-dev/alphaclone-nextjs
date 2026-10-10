import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { recordBusinessActivity, type BusinessActivityParams } from '@/lib/audit/businessAuditEngine';
import { insertTenantNotification } from './insertTenantNotification';
import { bufferNotificationDigestEvent } from '@/lib/email/notificationDigestEngine';
import { sendPushToUser } from '@/lib/push/sendPushToUser';

export type NotificationLevel = 'level1_record_only' | 'level2_digest' | 'level3_urgent_email';

export type ResponsibleRole =
  | 'record_owner'
  | 'project_owner'
  | 'salesperson'
  | 'account_manager'
  | 'task_owner'
  | 'approver'
  | 'finance_owner'
  | 'operations_owner'
  | 'tenant_admin'
  | 'business_owner';

export interface DispatchNotificationOptions {
  tenantId: string;
  level: NotificationLevel;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;

  // Business Context
  clientName?: string;
  projectName?: string;
  topic?: string;
  slaDeadline?: string;
  actionRequired?: string;

  // Responsibility Mapping
  responsibleUserId?: string;
  responsibleRole?: ResponsibleRole;
  escalationUserId?: string;

  // Business Activity Log Details
  actorName?: string;
  businessContext?: string;
  relatedRecordId?: string;
  relatedRecordType?: string;
  result?: string;
  status?: 'success' | 'failed' | 'waiting' | 'blocked' | 'at_risk' | 'pending_approval';
  nextAction?: string;

  // Technical details (separated from business log)
  technicalDetails?: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'urgent';
}

export interface DispatchNotificationResult {
  inAppCreated: boolean;
  emailSent: boolean;
  pushesSent?: number;
  recipientEmail?: string;
  recipientUserId?: string;
  activityLogId?: string;
  error?: string;
}

/**
 * Resolves the primary responsible person for an event based on explicit user ID,
 * role query, or fallback tenant owner/admin.
 */
export async function resolveResponsibleUserId(
  tenantId: string,
  preferredUserId?: string,
  preferredRole?: ResponsibleRole
): Promise<{ userId: string | null; email: string | null; role: string }> {
  const admin = createSupabaseAdminClient();

  // 1. If explicit user ID provided, retrieve user details
  if (preferredUserId) {
    const { data: profile } = await admin
      .from('profiles')
      .select('id, email, role')
      .eq('id', preferredUserId)
      .maybeSingle();

    if (profile) {
      return {
        userId: profile.id,
        email: profile.email,
        role: preferredRole || profile.role || 'owner',
      };
    }
  }

  // 2. Query tenant_users for owner / admin
  const { data: members } = await admin
    .from('tenant_users')
    .select('user_id, role')
    .eq('tenant_id', tenantId)
    .in('role', ['owner', 'admin', 'tenant_admin', 'super_admin'])
    .limit(1);

  if (members && members.length > 0) {
    const userId = members[0].user_id;
    const { data: profile } = await admin
      .from('profiles')
      .select('id, email, role')
      .eq('id', userId)
      .maybeSingle();

    if (profile) {
      return {
        userId: profile.id,
        email: profile.email,
        role: members[0].role,
      };
    }
  }

  return { userId: null, email: null, role: 'unknown' };
}

/**
 * Core business notification dispatcher implementing 3-tier notification policies,
 * targeted ownership email delivery, and human business audit logging.
 */
export async function dispatchBusinessNotification(
  options: DispatchNotificationOptions
): Promise<DispatchNotificationResult> {
  const admin = createSupabaseAdminClient();
  const result: DispatchNotificationResult = {
    inAppCreated: false,
    emailSent: false,
  };

  // 1. Resolve primary responsible person
  const target = await resolveResponsibleUserId(
    options.tenantId,
    options.responsibleUserId,
    options.responsibleRole
  );

  result.recipientUserId = target.userId || undefined;
  result.recipientEmail = target.email || undefined;

  // 2. LEVEL 1: Business Record Only
  // Record in business activity history. No email required.
  const activityLog = await recordBusinessActivity({
    tenantId: options.tenantId,
    event: options.title,
    actor: options.actorName || 'System',
    client: options.clientName,
    businessContext: options.businessContext || options.message,
    relatedRecordType: options.relatedRecordType || options.type,
    relatedRecordId: options.relatedRecordId,
    result: options.result || options.message,
    status: options.status || 'success',
    nextAction: options.nextAction,
    owner: options.responsibleUserId || target.userId || 'Unassigned',
    technicalDetails: options.technicalDetails,
  });

  result.activityLogId = activityLog.id;

  if (options.level === 'level1_record_only') {
    return result;
  }

  // 3. LEVEL 2 & LEVEL 3: In-Platform Notification
  if (target.userId) {
    const correlationId =
      (typeof options.technicalDetails?.correlationId === 'string' && options.technicalDetails.correlationId) ||
      (typeof options.technicalDetails?.correlation_id === 'string' && options.technicalDetails.correlation_id) ||
      (typeof options.technicalDetails?.execution_id === 'string' && options.technicalDetails.execution_id) ||
      (typeof options.technicalDetails?.actionId === 'string' && options.technicalDetails.actionId) ||
      null;

    const dedupeKey =
      (typeof options.technicalDetails?.dedupeKey === 'string' && options.technicalDetails.dedupeKey) ||
      (typeof options.technicalDetails?.dedupe_key === 'string' && options.technicalDetails.dedupe_key) ||
      (correlationId ? `exec:${correlationId}` : null);

    const resolvedSeverity: 'low' | 'medium' | 'high' | 'urgent' =
      options.severity ||
      (options.status === 'failed' ||
      options.status === 'blocked' ||
      options.status === 'at_risk' ||
      options.type.toLowerCase().includes('fail') ||
      options.type.toLowerCase().includes('error') ||
      options.type.toLowerCase().includes('alert')
        ? 'urgent'
        : options.status === 'success' || options.type.toLowerCase().includes('success')
        ? 'medium'
        : options.level === 'level3_urgent_email'
        ? 'urgent'
        : 'medium');

    const inserted = await insertTenantNotification(admin, {
      tenantId: options.tenantId,
      recipientUserId: target.userId,
      recipientRole: target.role,
      entityType: options.relatedRecordType,
      entityId: options.relatedRecordId,
      eventType: options.type,
      title: options.title,
      message: options.message,
      severity: resolvedSeverity,
      channel: 'in_app',
      actionUrl: options.actionUrl || null,
      correlationId,
      dedupeKey,
      metadata: {
        clientName: options.clientName,
        projectName: options.projectName,
        slaDeadline: options.slaDeadline,
        actionRequired: options.actionRequired,
      },
    });

    if (inserted.created || inserted.updated) {
      result.inAppCreated = true;

      // Deliver Web Push to recipient's registered devices so they receive it on phone/PWA
      try {
        const pushResult = await sendPushToUser(
          target.userId,
          {
            title: options.title,
            body: options.message,
            url: options.actionUrl || '/dashboard',
            tag: options.type,
            data: {
              tenantId: options.tenantId,
              type: options.type,
              entityType: options.relatedRecordType,
              entityId: options.relatedRecordId,
            },
          },
          options.tenantId
        );
        result.pushesSent = pushResult.sent;
      } catch (pushErr) {
        console.warn('[dispatchBusinessNotification] Web push delivery failed (non-blocking):', pushErr);
      }
    } else if (inserted.error && inserted.error !== 'duplicate') {
      console.warn('[dispatchBusinessNotification] In-app notification insert error:', inserted.error);
    }
  }

  // 4. Internal business events are digest-only. Level 3 means prominent
  // in-app placement; only the tightly-scoped immediate exception path may email.
  if (options.level === 'level3_urgent_email' && target.email) {
    if (target.userId) {
      const buffered = await bufferNotificationDigestEvent({
        tenantId: options.tenantId, userId: target.userId, recipientEmail: target.email,
        eventType: options.type, eventCategory: options.relatedRecordType || 'business',
        entityType: options.relatedRecordType, entityId: options.relatedRecordId,
        source: String(options.technicalDetails?.source || 'system'),
        sourceAction: options.type,
        severity: options.status === 'failed' || options.status === 'blocked' ? 'error' : options.status === 'at_risk' ? 'warning' : 'info',
        title: options.title, summary: options.message, metadata: options.technicalDetails,
      });
      if (buffered.error) result.error = buffered.error.message;
    }
    return result;
  }

  // 5. Check if SLA breach escalation is required (if escalation user provided)
  if (options.status === 'at_risk' && options.escalationUserId) {
    const manager = await resolveResponsibleUserId(options.tenantId, options.escalationUserId);
    if (manager.email && manager.userId && manager.userId !== target.userId) {
      await bufferNotificationDigestEvent({
        tenantId: options.tenantId, userId: manager.userId, recipientEmail: manager.email,
        eventType: `${options.type}.escalated`, eventCategory: 'escalation',
        entityType: options.relatedRecordType, entityId: options.relatedRecordId,
        source: 'system', sourceAction: 'escalate', severity: 'warning',
        title: `[ESCALATION] ${options.title}`, summary: options.message,
      });
    }
  }

  return result;
}
