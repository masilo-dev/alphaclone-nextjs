import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { emailProviderService } from '../EmailProviderService';

export type EmailAutonomyLevel = 'level_1' | 'level_2' | 'level_3' | 'level_4';

export interface StageEmailContext {
  tenantId: string;
  projectId: string;
  clientId: string;
  stage: 'project_confirmed' | 'work_started' | 'milestone_completed' | 'client_review_required' | 'approval_received' | 'project_delayed' | 'project_completed';
  deliverableName?: string;
  requestedResponseDate?: string;
  delayReason?: string;
  revisedCompletionDate?: string;
  nextStepDescription?: string;
}

export interface PreparedEmail {
  tenantId: string;
  projectId: string;
  clientId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  autonomyLevel: EmailAutonomyLevel;
  requiresHumanApproval: boolean;
  humanApprovalId?: string;
}

export class ClientEmailEngine {
  /**
   * Determine Email Autonomy Safety Level based on stage & content risk
   */
  determineAutonomyLevel(stage: StageEmailContext['stage']): EmailAutonomyLevel {
    switch (stage) {
      case 'project_confirmed':
      case 'approval_received':
        return 'level_1'; // Low risk informational
      case 'work_started':
      case 'milestone_completed':
      case 'client_review_required':
        return 'level_2'; // Standard milestone
      case 'project_delayed':
        return 'level_3'; // Sensitive communication requiring approval
      case 'project_completed':
        return 'level_2';
      default:
        return 'level_3';
    }
  }

  /**
   * Grounded email generation using actual database context
   */
  async prepareStageEmail(ctx: StageEmailContext): Promise<PreparedEmail | null> {
    const admin = createSupabaseAdminClient();

    // Fetch client
    const { data: client } = await admin
      .from('business_clients')
      .select('*')
      .eq('id', ctx.clientId)
      .maybeSingle();

    // Fetch project
    const { data: project } = await admin
      .from('projects')
      .select('*')
      .eq('id', ctx.projectId)
      .maybeSingle();

    if (!client || !project || !client.email) {
      console.warn('[ClientEmailEngine] Client or project context missing for email preparation');
      return null;
    }

    const clientName = client.name ? client.name.split(' ')[0] : 'there';
    const companyName = client.company || project.name;
    const autonomyLevel = this.determineAutonomyLevel(ctx.stage);
    const requiresHumanApproval = autonomyLevel === 'level_3' || autonomyLevel === 'level_4';

    let subject = '';
    let body = '';

    switch (ctx.stage) {
      case 'project_confirmed':
        subject = `Project Confirmation — ${project.name}`;
        body = `Hi ${clientName},\n\nWe're delighted to confirm that ${project.name} is officially confirmed!\n\n**Project Summary:**\n- Project: ${project.name}\n- Target Date: ${project.target_date || project.due_date || 'To be scheduled'}\n- Main Contact: ${project.owner_name || 'AlphaClone Team'}\n\nNext step: Execution kick-off is currently being finalized. We will notify you as soon as development begins.\n\nKind regards,\nAlphaClone Systems`;
        break;

      case 'work_started':
        subject = `Execution Started — ${project.name}`;
        body = `Hi ${clientName},\n\nWork on ${project.name} has officially started.\n\n**Current Phase:** Initial Setup & Execution\n**Next Milestone:** ${ctx.deliverableName || 'First Review Stage'}\n\nWe'll keep you updated on progress as we hit key milestones.\n\nKind regards,\nAlphaClone Systems`;
        break;

      case 'milestone_completed':
        subject = `Milestone Completed — ${project.name}`;
        body = `Hi ${clientName},\n\nWe've successfully completed the latest milestone for ${project.name}.\n\n**Completed Deliverable:** ${ctx.deliverableName || 'Milestone Stage'}\n**Next Phase:** ${ctx.nextStepDescription || 'Proceeding to next development sprint'}\n\nIf any input is required from your side, we'll reach out shortly.\n\nKind regards,\nAlphaClone Systems`;
        break;

      case 'client_review_required':
        subject = `Review Required — ${project.name} (${ctx.deliverableName || 'Design / Deliverable'})`;
        body = `Hi ${clientName},\n\nWe've completed the ${ctx.deliverableName || 'latest design stage'} of ${project.name} and it is now ready for your review.\n\nBefore we move into the next phase, we'd like your approval on the current direction.\n\nPlease review the attached deliverable/link and share any feedback by ${ctx.requestedResponseDate || 'Thursday'}. If everything looks good, simply reply confirming your approval and we will immediately proceed.\n\nKind regards,\nAlphaClone Systems`;
        break;

      case 'approval_received':
        subject = `Approval Received — ${project.name}`;
        body = `Hi ${clientName},\n\nThank you for approving the ${ctx.deliverableName || 'latest deliverable'} for ${project.name}.\n\nWe have logged your approval and moved the project into the next execution phase (${ctx.nextStepDescription || 'Development Sprint'}).\n\nKind regards,\nAlphaClone Systems`;
        break;

      case 'project_delayed':
        subject = `Project Schedule Update — ${project.name}`;
        body = `Hi ${clientName},\n\nWe are writing to provide a transparent update regarding the schedule for ${project.name}.\n\nDue to ${ctx.delayReason || 'technical dependencies'}, the estimated completion date has been adjusted to ${ctx.revisedCompletionDate || 'a revised milestone date'}.\n\nOur team is actively executing corrective actions to ensure smooth completion. We appreciate your partnership.\n\nKind regards,\nAlphaClone Systems`;
        break;

      case 'project_completed':
        subject = `Project Completed — ${project.name}`;
        body = `Hi ${clientName},\n\nWe are excited to share that ${project.name} has been successfully completed and delivered!\n\n**Handover & Summary:**\n- Completed Items: ${ctx.deliverableName || 'All contract scope items delivered'}\n- Final Handover Documentation & Instructions are attached.\n\nThank you for working with us. Please let us know if you need any ongoing support.\n\nKind regards,\nAlphaClone Systems`;
        break;
    }

    let humanApprovalId: string | undefined;

    // If Level 3 or Level 4, create a human approval record first!
    if (requiresHumanApproval) {
      const { data: approval } = await admin
        .from('human_approvals')
        .insert({
          tenant_id: ctx.tenantId,
          module: 'email_engine',
          action_type: 'send_sensitive_client_email',
          title: `Client Email Approval Required (${ctx.stage}) — ${project.name}`,
          reason: `Sensitive communication stage (${ctx.stage}) triggers mandatory Level 3/4 human review.`,
          affected_contact_id: ctx.clientId,
          payload: {
            projectId: ctx.projectId,
            clientId: ctx.clientId,
            recipientEmail: client.email,
            subject,
            body,
            stage: ctx.stage,
          },
          status: 'pending',
        })
        .select('id')
        .single();

      humanApprovalId = approval?.id;
    }

    return {
      tenantId: ctx.tenantId,
      projectId: ctx.projectId,
      clientId: ctx.clientId,
      recipientEmail: client.email,
      recipientName: client.name || 'Client',
      subject,
      body,
      autonomyLevel,
      requiresHumanApproval,
      humanApprovalId,
    };
  }

  /**
   * Dispatch email if permitted by autonomy safety rules
   */
  async dispatchPreparedEmail(prepared: PreparedEmail): Promise<{ sent: boolean; message: string }> {
    const admin = createSupabaseAdminClient();

    if (prepared.requiresHumanApproval) {
      // Record in project_email_dispatches as pending approval
      await admin.from('project_email_dispatches').insert({
        tenant_id: prepared.tenantId,
        project_id: prepared.projectId,
        client_id: prepared.clientId,
        stage: 'pending_human_review',
        autonomy_level: prepared.autonomyLevel,
        approval_status: 'pending_approval',
        human_approval_id: prepared.humanApprovalId,
        recipient_email: prepared.recipientEmail,
        subject: prepared.subject,
        body_text: prepared.body,
      });

      return { sent: false, message: `Email prepared and placed in human approval queue (Approval ID: ${prepared.humanApprovalId})` };
    }

    // Auto-send for Level 1 & Level 2
    try {
      const sendResult = await emailProviderService.sendEmail({
        tenantId: prepared.tenantId,
        to: prepared.recipientEmail,
        subject: prepared.subject,
        html: prepared.body.replace(/\n/g, '<br/>'),
        text: prepared.body,
      });

      // Record dispatch
      await admin.from('project_email_dispatches').insert({
        tenant_id: prepared.tenantId,
        project_id: prepared.projectId,
        client_id: prepared.clientId,
        stage: 'auto_dispatched',
        autonomy_level: prepared.autonomyLevel,
        approval_status: 'auto_sent',
        recipient_email: prepared.recipientEmail,
        subject: prepared.subject,
        body_text: prepared.body,
        sent_at: new Date().toISOString(),
      });

      return { sent: sendResult.success, message: sendResult.success ? 'Email sent successfully' : sendResult.error || 'Failed to send' };
    } catch (err) {
      return { sent: false, message: err instanceof Error ? err.message : 'Send error' };
    }
  }
}

export const clientEmailEngine = new ClientEmailEngine();
