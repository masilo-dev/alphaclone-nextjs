import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { sendUniversalEmail, mapEventTypeToTemplateKey } from '@/lib/email/universalEmailEngine';
import { buildValidatedPublicUrl } from '@/lib/urls';
import { escapeHtml } from '@/lib/email/escapeHtml';
import { recordBusinessActivity, type BusinessActivityParams } from '@/lib/audit/businessAuditEngine';
import { insertTenantNotification } from './insertTenantNotification';
import { renderAlphaCloneEmailLayout } from '@/lib/email/alphaCloneEmailLayouts';

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
}

export interface DispatchNotificationResult {
  inAppCreated: boolean;
  emailSent: boolean;
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
    const inserted = await insertTenantNotification(admin, {
      tenantId: options.tenantId,
      recipientUserId: target.userId,
      recipientRole: target.role,
      entityType: options.relatedRecordType,
      entityId: options.relatedRecordId,
      eventType: options.type,
      title: options.title,
      message: options.message,
      severity: options.level === 'level3_urgent_email' ? 'urgent' : 'medium',
      channel: 'in_app',
      actionUrl: options.actionUrl || null,
      metadata: {
        clientName: options.clientName,
        projectName: options.projectName,
        slaDeadline: options.slaDeadline,
        actionRequired: options.actionRequired,
      },
    });

    if (inserted.created) {
      result.inAppCreated = true;
    } else if (inserted.error && inserted.error !== 'duplicate') {
      console.warn('[dispatchBusinessNotification] In-app notification insert error:', inserted.error);
    }
  }

  // 4. LEVEL 3: Email + Platform Notification to Responsible Person
  if (options.level === 'level3_urgent_email' && target.email) {
    const publicActionUrl = options.actionUrl ? buildValidatedPublicUrl(options.actionUrl) : undefined;
    const templateKey = mapEventTypeToTemplateKey(options.type);
    const universalVariables = {
      first_name: target.email.split('@')[0],
      client_name: options.clientName || '',
      business_name: options.projectName || options.clientName || '',
      cta_url: publicActionUrl || '',
    };

    if (templateKey) {
      const universal = await sendUniversalEmail({
        templateKey,
        tenantId: options.tenantId,
        recipientEmail: target.email,
        userId: target.userId || undefined,
        recipientType: 'user',
        entityType: options.relatedRecordType,
        entityId: options.relatedRecordId,
        eventType: options.type,
        variables: {
          ...universalVariables,
          lead_count: String(options.technicalDetails?.lead_count || ''),
          reply_count: String(options.technicalDetails?.reply_count || ''),
        },
        ctaUrl: publicActionUrl,
        stats: options.clientName
          ? [{ label: 'Client', value: options.clientName }]
          : undefined,
      });

      if (universal.success) {
        result.emailSent = true;
        return result;
      }
      if (universal.skipped) {
        console.warn('[dispatchBusinessNotification] Universal email skipped:', universal.skipReason);
        return result;
      }
    }

    const emailSubject = options.title.startsWith('AlphaClone') || options.title.startsWith('Client')
      ? options.title
      : `AlphaClone Action Required: ${options.title}`;

    const branded = renderAlphaCloneEmailLayout({
      layoutFamily: options.status === 'failed' ? 'failure' : 'action_required',
      subject: emailSubject,
      headline: options.title,
      bodyHtml: `<p>${escapeHtml(options.message)}</p>`,
      ctaLabel: publicActionUrl ? 'View in AlphaClone' : undefined,
      ctaUrl: publicActionUrl,
      stats: [
        ...(options.clientName ? [{ label: 'Client', value: options.clientName }] : []),
        ...(options.projectName ? [{ label: 'Project', value: options.projectName }] : []),
        ...(options.actionRequired ? [{ label: 'Action', value: options.actionRequired }] : []),
      ],
    });
    const htmlContent = branded.html;

    const emailResult = await sendEmailServer({
      tenantId: options.tenantId,
      userId: target.userId || undefined,
      to: target.email,
      subject: emailSubject,
      html: htmlContent,
      text: `${options.title}\n\n${options.message}\n\nAction Required: ${options.actionRequired || 'Review record'}\nLink: ${publicActionUrl || ''}`,
      isPlatformNotification: true,
      templateName: 'business_alert',
    });

    if (emailResult.success) {
      result.emailSent = true;
    } else {
      result.error = emailResult.error;
      console.error('[dispatchBusinessNotification] Urgent email failed:', emailResult.error);
    }
  }

  // 5. Check if SLA breach escalation is required (if escalation user provided)
  if (options.status === 'at_risk' && options.escalationUserId) {
    const manager = await resolveResponsibleUserId(options.tenantId, options.escalationUserId);
    if (manager.email && manager.userId !== target.userId) {
      await sendEmailServer({
        tenantId: options.tenantId,
        userId: manager.userId || undefined,
        to: manager.email,
        subject: `[ESCALATION] ${options.title}`,
        html: `<p><strong>SLA Escalation Alert:</strong> The following operational issue requires attention:</p><p>${escapeHtml(options.message)}</p>`,
        isPlatformNotification: true,
      }).catch((err) => console.error('[dispatchBusinessNotification] Escalation email failed:', err));
    }
  }

  return result;
}
