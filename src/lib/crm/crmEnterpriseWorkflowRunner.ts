import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

function interpolate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(context[key] ?? ''));
}

function matchesTriggerConditions(
  conditions: Record<string, unknown> | null | undefined,
  context: Record<string, unknown>
): boolean {
  if (!conditions || Object.keys(conditions).length === 0) return true;

  const expectedStage = conditions.stage ?? conditions.to_stage ?? conditions.newStage;
  if (expectedStage) {
    const actual = context.newStage ?? context.toStage ?? context.to_stage;
    if (String(actual) !== String(expectedStage)) return false;
  }

  const fromStage = conditions.from_stage ?? conditions.oldStage;
  if (fromStage) {
    const actual = context.oldStage ?? context.from_stage;
    if (String(actual) !== String(fromStage)) return false;
  }

  return true;
}

async function executeEnterpriseAction(
  admin: SupabaseClient,
  tenantId: string,
  action: { action_type: string; action_config?: Record<string, unknown> | null },
  context: Record<string, unknown>
): Promise<void> {
  const config = (action.action_config || {}) as Record<string, unknown>;
  const type = action.action_type;

  switch (type) {
    case 'create_task': {
      const dueHours = Number(config.due_hours ?? config.dueHours ?? 48);
      await admin.from('tasks').insert({
        tenant_id: tenantId,
        title: interpolate(String(config.title || 'CRM follow-up'), context),
        description: interpolate(String(config.description || ''), context),
        status: 'todo',
        priority: config.priority || 'medium',
        due_date: new Date(Date.now() + dueHours * 3600000).toISOString(),
        related_to_deal: config.dealId || context.dealId || null,
        related_to_contact: config.contactId || context.contactId || null,
        related_to_lead: config.leadId || context.leadId || null,
        assigned_to: config.assignedTo || context.ownerId || context.userId || null,
        created_by: config.assignedTo || context.userId || context.ownerId || null,
      });
      return;
    }
    case 'send_email': {
      const to = config.to || context.email || context.contactEmail;
      if (!to) return;
      const { sendEmailServer } = await import('@/lib/email/sendEmailServer');
      const result = await sendEmailServer({
        to: String(to),
        subject: interpolate(String(config.subject || 'CRM update'), context),
        html: interpolate(String(config.body || config.html || config.message || ''), context),
        tenantId,
        isPlatformNotification: true,
      });
      if (!result.success) throw new Error(result.error || 'send_email failed');
      return;
    }
    case 'send_notification': {
      const userId = config.recipientId || context.ownerId || context.userId;
      if (!userId) return;
      await admin.from('notifications').insert({
        user_id: userId,
        tenant_id: tenantId,
        title: interpolate(String(config.title || 'Workflow notification'), context),
        message: interpolate(String(config.message || ''), context),
        type: config.notificationType || 'info',
        read: false,
        created_at: new Date().toISOString(),
      });
      return;
    }
    case 'assign_user': {
      const dealId = config.dealId || context.dealId;
      const userId = config.userId || config.assignedTo;
      if (dealId && userId) {
        await admin.from('deals').update({ owner_id: userId }).eq('id', dealId).eq('tenant_id', tenantId);
      }
      return;
    }
    case 'change_stage': {
      const dealId = config.dealId || context.dealId;
      const stage = config.stage || config.newStage;
      if (dealId && stage) {
        await admin.from('deals').update({ stage }).eq('id', dealId).eq('tenant_id', tenantId);
      }
      return;
    }
    case 'wait':
      return;
    default:
      console.warn(`[CRM workflows] Unsupported action type: ${type}`);
  }
}

export async function runEnterpriseWorkflowsForTrigger(
  admin: SupabaseClient,
  tenantId: string,
  triggerType: string,
  context: Record<string, unknown>,
  entityType = 'event',
  entityId?: string
): Promise<{ ran: number; failed: number }> {
  const { data: workflows, error } = await admin
    .from('workflows')
    .select('id, name, trigger_conditions, execution_count')
    .eq('tenant_id', tenantId)
    .eq('trigger_type', triggerType)
    .eq('is_active', true);

  if (error) {
    console.error('[CRM workflows] Failed to load workflows:', error.message);
    return { ran: 0, failed: 0 };
  }

  let ran = 0;
  let failed = 0;

  for (const workflow of workflows || []) {
    if (!matchesTriggerConditions(workflow.trigger_conditions as Record<string, unknown>, context)) {
      continue;
    }

    const resolvedEntityId = entityId || String(context.dealId || context.leadId || context.id || 'system');
    const { data: execution, error: execError } = await admin
      .from('workflow_executions')
      .insert({
        workflow_id: workflow.id,
        triggered_by_entity_type: entityType,
        triggered_by_entity_id: resolvedEntityId,
        status: 'running',
        started_at: new Date().toISOString(),
        metadata: { trigger: triggerType, context },
      })
      .select('id')
      .single();

    if (execError) {
      console.error('[CRM workflows] Failed to create execution:', execError.message);
      failed++;
      continue;
    }

    const { data: actions } = await admin
      .from('workflow_actions')
      .select('action_type, action_config, action_order, is_active')
      .eq('workflow_id', workflow.id)
      .eq('is_active', true)
      .order('action_order', { ascending: true });

    const log: Array<Record<string, unknown>> = [];
    let actionError: string | null = null;

    for (const action of actions || []) {
      try {
        await executeEnterpriseAction(admin, tenantId, action, context);
        log.push({ action: action.action_type, status: 'ok' });
      } catch (err) {
        actionError = err instanceof Error ? err.message : 'action_failed';
        log.push({ action: action.action_type, status: 'failed', error: actionError });
        break;
      }
    }

    await admin
      .from('workflow_executions')
      .update({
        status: actionError ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        error_message: actionError,
        execution_log: log,
      })
      .eq('id', execution.id);

    if (actionError) {
      failed++;
    } else {
      ran++;
      await admin
        .from('workflows')
        .update({
          execution_count: (workflow.execution_count || 0) + 1,
          last_executed_at: new Date().toISOString(),
        })
        .eq('id', workflow.id);
    }
  }

  return { ran, failed };
}
