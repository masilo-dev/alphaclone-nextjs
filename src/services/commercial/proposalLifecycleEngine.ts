import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { projectService } from '../projectService';
import { clientEmailEngine } from '../email/clientEmailEngine';

export type ProposalStatus = 'DRAFT' | 'INTERNAL_REVIEW' | 'SENT' | 'VIEWED' | 'CLIENT_QUESTIONS' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'REVISED';

export interface ExecutedProposalWorkflow {
  proposalId: string;
  projectId?: string;
  contractId?: string;
  invoiceId?: string;
  tasksCreated: number;
  confirmationEmailSent: boolean;
}

export class ProposalLifecycleEngine {
  /**
   * Update proposal status and trigger post-acceptance workflow if ACCEPTED
   */
  async updateProposalStatus(
    tenantId: string,
    proposalId: string,
    newStatus: ProposalStatus
  ): Promise<{ success: boolean; executedWorkflow?: ExecutedProposalWorkflow; error?: string }> {
    const admin = createSupabaseAdminClient();

    // 1. Fetch proposal details
    const { data: proposal } = await admin
      .from('quotes')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', proposalId)
      .maybeSingle();

    if (!proposal) {
      return { success: false, error: 'Proposal quote record not found' };
    }

    // Update quotes table status
    await admin
      .from('quotes')
      .update({ status: newStatus.toLowerCase(), updated_at: new Date().toISOString() })
      .eq('id', proposalId);

    // Upsert workflow record
    await admin.from('proposal_workflows').upsert(
      {
        tenant_id: tenantId,
        proposal_id: proposalId,
        client_id: proposal.client_id,
        status: newStatus,
        accepted_at: newStatus === 'ACCEPTED' ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id, proposal_id' }
    );

    // 2. If ACCEPTED -> Execute automated onboarding & project execution workflow!
    if (newStatus === 'ACCEPTED') {
      const executed = await this.executeAcceptedWorkflow(tenantId, proposal);
      return { success: true, executedWorkflow: executed };
    }

    return { success: true };
  }

  /**
   * Post-Acceptance Automated Workflow
   */
  private async executeAcceptedWorkflow(tenantId: string, proposal: any): Promise<ExecutedProposalWorkflow> {
    const admin = createSupabaseAdminClient();
    let projectId: string | undefined;
    let contractId: string | undefined;
    let invoiceId: string | undefined;
    let tasksCreated = 0;
    let confirmationEmailSent = false;

    // A. Create or Link Project
    const { project } = await projectService.createProject({
      name: proposal.title || `Project — ${proposal.id.slice(0, 8)}`,
      category: 'Client Project',
      status: 'Active',
      currentStage: 'Initiation',
      progress: 0,
      clientId: proposal.client_id,
      budget: Number(proposal.total_amount || 0),
      description: proposal.notes || `Generated from accepted proposal ${proposal.id}`,
      team: [],
    });

    if (project) {
      projectId = project.id;
    }

    // B. Create Contract Record
    const { data: contract } = await admin
      .from('contracts')
      .insert({
        tenant_id: tenantId,
        client_id: proposal.client_id,
        title: `Contract — ${proposal.title || 'Client Service Agreement'}`,
        status: 'active',
        contract_text: proposal.notes || 'Standard Client Service Agreement',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (contract) contractId = contract.id;

    // C. Create Initial Invoice (50% Deposit or Full Budget)
    const amount = Number(proposal.total_amount || 0);
    const deposit = amount > 0 ? amount * 0.5 : 0;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    const { data: invoice } = await admin
      .from('business_invoices')
      .insert({
        tenant_id: tenantId,
        client_id: proposal.client_id,
        total: deposit,
        subtotal: deposit,
        status: 'draft',
        notes: `Initial 50% deposit invoice for ${proposal.title || 'Project'}`,
        due_date: dueDate.toISOString().split('T')[0],
        issue_date: new Date().toISOString().split('T')[0],
        invoice_number: `INV-${Date.now()}`,
      })
      .select('id')
      .single();

    if (invoice) invoiceId = invoice.id;

    // D. Create Onboarding Tasks
    if (projectId) {
      const defaultTasks = [
        { title: 'Send Client Onboarding Questionnaire', description: 'Collect logo, brand guidelines, and requirements.' },
        { title: 'Schedule Project Kickoff Meeting', description: 'Confirm team availability and invite client.' },
        { title: 'Set up Project Repository & Environment', description: 'Initialize repository and workspace resources.' },
      ];

      for (const t of defaultTasks) {
        await admin.from('tasks').insert({
          tenant_id: tenantId,
          project_id: projectId,
          title: t.title,
          description: t.description,
          status: 'pending',
          created_at: new Date().toISOString(),
        });
        tasksCreated++;
      }
    }

    // E. Send Professional Confirmation Email
    if (proposal.client_id && projectId) {
      const emailPrep = await clientEmailEngine.prepareStageEmail({
        tenantId,
        projectId,
        clientId: proposal.client_id,
        stage: 'project_confirmed',
      });

      if (emailPrep) {
        const dispatchRes = await clientEmailEngine.dispatchPreparedEmail(emailPrep);
        confirmationEmailSent = dispatchRes.sent;
      }
    }

    // Update executed actions log in proposal_workflows
    await admin
      .from('proposal_workflows')
      .update({
        executed_actions: {
          projectId,
          contractId,
          invoiceId,
          tasksCreated,
          confirmationEmailSent,
          timestamp: new Date().toISOString(),
        },
      })
      .eq('tenant_id', tenantId)
      .eq('proposal_id', proposal.id);

    return {
      proposalId: proposal.id,
      projectId,
      contractId,
      invoiceId,
      tasksCreated,
      confirmationEmailSent,
    };
  }

  /**
   * Follow-up Engine: detect proposals with no response after configured period (e.g. 3 days)
   */
  async checkPendingProposalsAndFollowUp(tenantId: string): Promise<{ followUpsTriggered: number }> {
    const admin = createSupabaseAdminClient();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: workflows } = await admin
      .from('proposal_workflows')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'SENT')
      .lt('updated_at', threeDaysAgo)
      .lt('follow_up_count', 3);

    let count = 0;
    if (workflows) {
      for (const wf of workflows) {
        const nextAttempt = Number(wf.follow_up_count || 0) + 1;
        const sourceKey = `proposal_followup:${wf.id}:${nextAttempt}`;

        const { data: existingTask } = await admin
          .from('tasks')
          .select('id')
          .eq('tenant_id', tenantId)
          .contains('metadata', { autoSourceKey: sourceKey })
          .maybeSingle();

        if (existingTask?.id) continue;

        await admin.from('tasks').insert({
          tenant_id: tenantId,
          title: `Follow up on proposal #${wf.proposal_id.slice(0, 8)}`,
          description: `Proposal sent on ${new Date(wf.created_at).toLocaleDateString()} has received no response after 3 days. Prepare professional follow-up.`,
          status: 'pending',
          metadata: {
            autoSourceKey: sourceKey,
            proposal_workflow_id: wf.id,
            proposal_id: wf.proposal_id,
            follow_up_attempt: nextAttempt,
            source: 'proposal_lifecycle_engine',
          },
          created_at: new Date().toISOString(),
        });

        await admin
          .from('proposal_workflows')
          .update({
            follow_up_count: wf.follow_up_count + 1,
            last_follow_up_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', wf.id);

        count++;
      }
    }

    return { followUpsTriggered: count };
  }
}

export const proposalLifecycleEngine = new ProposalLifecycleEngine();
