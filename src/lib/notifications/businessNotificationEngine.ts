import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { sendUniversalEmail, mapEventTypeToTemplateKey } from '@/lib/email/universalEmailEngine';
import { buildValidatedPublicUrl } from '@/lib/urls';
import { escapeHtml } from '@/lib/email/sanitizeEmailHtml';
import { recordBusinessActivity, type BusinessActivityParams } from '@/lib/audit/businessAuditEngine';

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
    const { error: inAppError } = await admin.from('notifications').insert({
      user_id: target.userId,
      tenant_id: options.tenantId,
      type: options.type,
      title: options.title,
      message: options.message,
      action_url: options.actionUrl || null,
      read: false,
      priority: options.level === 'level3_urgent_email' ? 'urgent' : 'medium',
      metadata: {
        clientName: options.clientName,
        projectName: options.projectName,
        slaDeadline: options.slaDeadline,
        actionRequired: options.actionRequired,
      },
    });

    if (!inAppError) {
      result.inAppCreated = true;
    } else {
      console.warn('[dispatchBusinessNotification] In-app notification insert error:', inAppError.message);
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

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #0f172a; padding: 24px; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #38bdf8;">AlphaClone Systems Alert</h2>
          <p style="margin: 6px 0 0 0; font-size: 14px; color: #94a3b8;">${escapeHtml(options.title)}</p>
        </div>
        
        <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
          <p style="font-size: 16px; font-weight: 500; margin-top: 0;">${escapeHtml(options.message)}</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; font-size: 14px;">
            ${options.clientName ? `<tr><td style="padding: 10px 16px; color: #64748b; font-weight: 500; border-bottom: 1px solid #e2e8f0;">Client:</td><td style="padding: 10px 16px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${escapeHtml(options.clientName)}</td></tr>` : ''}
            ${options.projectName ? `<tr><td style="padding: 10px 16px; color: #64748b; font-weight: 500; border-bottom: 1px solid #e2e8f0;">Project:</td><td style="padding: 10px 16px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${escapeHtml(options.projectName)}</td></tr>` : ''}
            ${options.topic ? `<tr><td style="padding: 10px 16px; color: #64748b; font-weight: 500; border-bottom: 1px solid #e2e8f0;">Topic:</td><td style="padding: 10px 16px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${escapeHtml(options.topic)}</td></tr>` : ''}
            ${options.slaDeadline ? `<tr><td style="padding: 10px 16px; color: #64748b; font-weight: 500; border-bottom: 1px solid #e2e8f0;">Response Deadline:</td><td style="padding: 10px 16px; font-weight: 600; color: #dc2626; border-bottom: 1px solid #e2e8f0;">${escapeHtml(options.slaDeadline)}</td></tr>` : ''}
            ${options.actionRequired ? `<tr><td style="padding: 10px 16px; color: #64748b; font-weight: 500;">Action Required:</td><td style="padding: 10px 16px; font-weight: 600; color: #0284c7;">${escapeHtml(options.actionRequired)}</td></tr>` : ''}
          </table>

          ${publicActionUrl ? `
            <div style="margin-top: 24px; text-align: center;">
              <a href="${escapeHtml(publicActionUrl)}" style="display: inline-block; padding: 12px 24px; background: #0284c7; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px;">View & Respond in AlphaClone</a>
            </div>
          ` : ''}
        </div>

        <div style="padding: 16px 24px; background: #f1f5f9; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b;">
          This is an automated operational alert from AlphaClone Systems. Routed based on account ownership responsibility.
        </div>
      </div>
    `;

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
