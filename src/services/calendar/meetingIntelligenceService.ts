import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { commitmentEngine } from '../intelligence/commitmentEngine';

export interface PreMeetingBrief {
  meetingId?: string;
  projectId?: string;
  clientId?: string;
  title: string;
  clientName: string;
  companyName: string;
  objective: string;
  currentStage: string;
  lastCommunicationDate?: string;
  outstandingTasks: Array<{ id: string; title: string; status: string }>;
  blockers: string[];
  previousDecisions: string[];
  unpaidInvoicesTotal: number;
  openCommitments: Array<{ id: string; commitment: string; makerType: string; dueDate?: string }>;
  questionsRequiringAnswers: string[];
}

export class MeetingIntelligenceService {
  /**
   * Synthesizes a structured Pre-Meeting Brief before client meetings
   */
  async generatePreMeetingBrief(tenantId: string, projectId: string, meetingTitle: string): Promise<PreMeetingBrief> {
    const admin = createSupabaseAdminClient();

    // 1. Fetch project & client
    const { data: project } = await admin
      .from('projects')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', projectId)
      .single();

    let clientName = 'Client';
    let companyName = project?.name || 'Company';
    let clientId = project?.client_id;

    if (clientId) {
      const { data: client } = await admin
        .from('business_clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle();
      if (client) {
        clientName = client.name || 'Client';
        companyName = client.company || companyName;
      }
    }

    // 2. Outstanding tasks & blockers
    const { data: tasks } = await admin
      .from('tasks')
      .select('id, title, status, description, requires_approval')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .neq('status', 'completed');

    const outstandingTasks = (tasks || []).map(t => ({ id: t.id, title: t.title, status: t.status }));
    const blockers = (tasks || []).filter(t => t.requires_approval || t.status === 'blocked').map(t => t.title);

    // 3. Commitments
    const commitments = await commitmentEngine.getProjectCommitments(tenantId, projectId);
    const openCommitments = commitments
      .filter(c => c.status === 'pending')
      .map(c => ({ id: c.id, commitment: c.commitment, makerType: c.maker_type, dueDate: c.due_date }));

    // 4. Unpaid Invoices
    let unpaidTotal = 0;
    if (clientId) {
      const { data: invoices } = await admin
        .from('business_invoices')
        .select('total, status')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .neq('status', 'paid');

      if (invoices) {
        unpaidTotal = invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
      }
    }

    const brief: PreMeetingBrief = {
      projectId,
      clientId,
      title: meetingTitle,
      clientName,
      companyName,
      objective: `Align on ${project?.current_stage || 'current milestone'} deliverable status and clear open blockers.`,
      currentStage: project?.current_stage || 'Active',
      lastCommunicationDate: project?.last_client_contact_at,
      outstandingTasks,
      blockers,
      previousDecisions: [
        `Target date confirmed as ${project?.target_date || project?.due_date || 'TBD'}`,
      ],
      unpaidInvoicesTotal: unpaidTotal,
      openCommitments,
      questionsRequiringAnswers: [
        'Has the latest design/deliverable draft been reviewed?',
        'Are there any scope adjustments or technical constraints to address?',
        'Confirm sign-off timeline for the upcoming milestone.',
      ],
    };

    // Store brief in database
    await admin.from('meeting_briefs').insert({
      tenant_id: tenantId,
      project_id: projectId,
      client_id: clientId,
      title: meetingTitle,
      objective: brief.objective,
      brief_content: brief as any,
    });

    return brief;
  }

  /**
   * Process post-meeting notes to extract decisions, tasks, and commitments
   */
  async processPostMeetingNotes(
    tenantId: string,
    projectId: string,
    notesText: string,
    meetingId?: string
  ): Promise<{ tasksCreated: number; commitmentsCreated: number; decisionsLogged: number }> {
    const admin = createSupabaseAdminClient();
    let tasksCreated = 0;
    let commitmentsCreated = 0;

    // Extract commitments
    const extracted = commitmentEngine.extractCommitmentsFromText(notesText, {
      tenantId,
      projectId,
      sourceType: 'meeting',
    });

    for (const c of extracted) {
      if (c.commitment) {
        await commitmentEngine.createCommitment(c as any);
        commitmentsCreated++;
      }
    }

    // Extract structured tasks from action items
    const actionMatches = notesText.match(/(?:todo|action item|task|assigned to):?\s*([^.\n]+)/gi);
    if (actionMatches) {
      for (const actionRaw of actionMatches) {
        const title = actionRaw.replace(/^(?:todo|action item|task|assigned to):?\s*/i, '').trim();
        if (title.length > 3) {
          const { error } = await admin.from('tasks').insert({
            tenant_id: tenantId,
            related_to_project: projectId,
            title,
            description: `Auto-generated from meeting notes${meetingId ? ` (Meeting: ${meetingId})` : ''}`,
            priority: 'medium',
            status: 'todo',
            metadata: {
              source_meeting_id: meetingId || null,
              origin: 'meeting_notes',
              extracted_at: new Date().toISOString(),
            },
          });
          if (!error) tasksCreated++;
        }
      }
    }

    // Simple decision logger into project_decisions
    const decisionMatches = notesText.match(/(?:decided|agreed|confirmed) that ([^.\n]+)/gi);
    let decisionsLogged = 0;
    if (decisionMatches) {
      for (const d of decisionMatches) {
        await admin.from('project_decisions').insert({
          tenant_id: tenantId,
          project_id: projectId,
          title: d.trim(),
          context: 'Extracted from post-meeting notes',
          status: 'decided',
          decided_at: new Date().toISOString(),
        });
        decisionsLogged++;
      }
    }

    return { tasksCreated, commitmentsCreated, decisionsLogged };
  }
}

export const meetingIntelligenceService = new MeetingIntelligenceService();
