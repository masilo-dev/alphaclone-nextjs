import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { recordTenantEvent } from '@/lib/events/tenantEventLogger';

export interface MeetingOutcomeParams {
  tenantId: string;
  meetingId?: string;
  title: string;
  clientId?: string;
  projectId?: string;
  opportunityId?: string;
  participants?: string[];
  purpose?: string;
  summary: string;
  decisions: Array<{
    decision: string;
    status: 'ACCEPTED' | 'REJECTED' | 'PROPOSED' | 'DEFERRED';
    valueAmount?: number;
    evidenceText?: string;
  }>;
  commitments: Array<{
    commitment: string;
    makerType: 'our_team' | 'client';
    makerName?: string;
    recipientName?: string;
    dueDate?: string;
  }>;
  actionItems: Array<{
    title: string;
    description?: string;
    ownerId?: string;
    ownerName?: string;
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  }>;
}

export interface MeetingOutcomeResult {
  briefId: string | null;
  tasksCreated: number;
  commitmentsCreated: number;
  proposalsUpdated: number;
  eventsEmitted: number;
}

/**
 * Converts agreed meeting outcomes and decisions into actionable tenant operational records.
 */
export async function processMeetingSummaryToActions(
  params: MeetingOutcomeParams
): Promise<MeetingOutcomeResult> {
  const supabase = createSupabaseAdminClient();
  let tasksCreated = 0;
  let commitmentsCreated = 0;
  let proposalsUpdated = 0;
  let eventsEmitted = 0;

  // 1. Store Meeting Intelligence Brief
  const { data: brief, error: briefErr } = await supabase
    .from('meeting_briefs')
    .insert({
      tenant_id: params.tenantId,
      meeting_id: params.meetingId || null,
      project_id: params.projectId || null,
      client_id: params.clientId || null,
      title: params.title,
      objective: params.purpose || null,
      brief_content: {
        participants: params.participants || [],
        summary: params.summary,
        decisions: params.decisions,
      },
      post_meeting_notes: params.summary,
      extracted_decisions: params.decisions,
      extracted_tasks: params.actionItems,
      extracted_commitments: params.commitments,
    })
    .select('id')
    .maybeSingle();

  if (briefErr) {
    console.warn('[meetingActionEngine] Failed to persist meeting brief:', briefErr.message);
  }

  const briefId = brief?.id || null;

  // 2. Record Core Meeting Operational Event
  const { success: meetingEvt } = await recordTenantEvent({
    tenantId: params.tenantId,
    sourceModule: 'MEETINGS',
    action: 'MEETING_COMPLETED',
    title: `Meeting Completed: ${params.title}`,
    description: `Summary: ${params.summary.slice(0, 200)}... Decisions: ${params.decisions.length}, Action Items: ${params.actionItems.length}`,
    clientId: params.clientId,
    projectId: params.projectId,
    opportunityId: params.opportunityId,
    meetingId: params.meetingId,
    status: 'VERIFIED',
    notificationLevel: 'LEVEL_2_DIGEST',
    evidence: {
      briefId,
      participants: params.participants,
      decisions: params.decisions,
      summary: params.summary,
    },
    nextAction: {
      action: 'EXECUTE_MEETING_DECISIONS',
      recommendedAction: `${params.actionItems.length} action items generated from meeting`,
    },
  });

  if (meetingEvt) eventsEmitted++;

  // 3. Process Decisions (Proposals Accepted / Opportunities updated)
  for (const dec of params.decisions) {
    if (dec.status === 'ACCEPTED') {
      // If client approved scope or proposal, update sales opportunity or proposal workflow
      if (params.opportunityId) {
        await supabase
          .from('opportunities')
          .update({
            stage: 'proposal_accepted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.opportunityId)
          .eq('tenant_id', params.tenantId);

        proposalsUpdated++;

        const { success } = await recordTenantEvent({
          tenantId: params.tenantId,
          sourceModule: 'SALES',
          action: 'PROPOSAL_ACCEPTED_IN_MEETING',
          title: `Proposal Accepted in Meeting: ${dec.decision}`,
          description: dec.evidenceText || `Value: $${dec.valueAmount || 0}`,
          clientId: params.clientId,
          opportunityId: params.opportunityId,
          projectId: params.projectId,
          status: 'SUCCESS',
          notificationLevel: 'LEVEL_3_IMMEDIATE',
          evidence: {
            meetingTitle: params.title,
            decision: dec.decision,
            valueAmount: dec.valueAmount,
          },
          nextAction: {
            action: 'GENERATE_CONTRACT_AND_ONBOARD_PROJECT',
            recommendedAction: 'Draft contract and set up project launch',
          },
        });
        if (success) eventsEmitted++;
      }
    }
  }

  // 4. Process Commitments
  for (const com of params.commitments) {
    const { error: comErr } = await supabase.from('commitments').insert({
      tenant_id: params.tenantId,
      project_id: params.projectId || null,
      client_id: params.clientId || null,
      commitment: com.commitment,
      maker_type: com.makerType,
      maker_name: com.makerName || null,
      recipient_name: com.recipientName || null,
      due_date: com.dueDate || null,
      source_type: 'meeting',
      source_id: params.meetingId || briefId || null,
      status: 'pending',
    });

    if (!comErr) {
      commitmentsCreated++;
    }
  }

  // 5. Convert Action Items into Actionable Tasks
  for (const item of params.actionItems) {
    const { data: task, error: taskErr } = await supabase
      .from('tasks')
      .insert({
        tenant_id: params.tenantId,
        title: item.title,
        description: item.description || `Generated from meeting "${params.title}"`,
        project_id: params.projectId || null,
        assigned_to: item.ownerId || null,
        due_date: item.dueDate || null,
        priority: item.priority || 'medium',
        status: 'todo',
      })
      .select('id')
      .maybeSingle();

    if (!taskErr && task) {
      tasksCreated++;

      const { success } = await recordTenantEvent({
        tenantId: params.tenantId,
        sourceModule: 'TASKS',
        action: 'TASK_CREATED_FROM_MEETING',
        title: `Task Created: ${item.title}`,
        description: `Owner: ${item.ownerName || 'Unassigned'}. Due: ${item.dueDate || 'No deadline'}`,
        clientId: params.clientId,
        projectId: params.projectId,
        taskId: task.id,
        status: 'SUCCESS',
        notificationLevel: 'LEVEL_1_RECORD',
        nextAction: {
          action: 'EXECUTE_TASK',
          ownerId: item.ownerId,
          dueDate: item.dueDate,
        },
      });
      if (success) eventsEmitted++;
    }
  }

  return {
    briefId,
    tasksCreated,
    commitmentsCreated,
    proposalsUpdated,
    eventsEmitted,
  };
}
