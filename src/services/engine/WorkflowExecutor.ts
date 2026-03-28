/**
 * WORKFLOW EXECUTOR
 * The AlphaClone Flow Engine — Trigger → Conditions → Actions
 * Replaces n8n/Zapier as the internal orchestration layer.
 */

export type TriggerType =
    | 'lead_created'
    | 'facebook_lead_received'
    | 'ingestion_event'
    | 'sms_received'
    | 'form_submitted'
    | 'manual';

export type ActionType =
    | 'send_sms'
    | 'send_email'
    | 'create_task'
    | 'update_lead_status'
    | 'notify_user'
    | 'post_to_facebook'
    | 'webhook_call'
    | 'assign_lead';

export interface WorkflowCondition {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
    value: string | number | boolean;
}

export interface WorkflowAction {
    type: ActionType;
    config: Record<string, unknown>;
}

export interface WorkflowDefinition {
    id: string;
    tenant_id: string;
    name: string;
    trigger_type: TriggerType;
    trigger_config: Record<string, unknown>;
    conditions: WorkflowCondition[];
    actions: WorkflowAction[];
    is_active: boolean;
}

export interface ExecutionContext {
    triggerType: TriggerType;
    data: Record<string, unknown>;   // the event data
    tenantId: string;
}

export interface ExecutionResult {
    workflowId: string;
    conditionsMet: boolean;
    actionsTaken: { type: string; status: 'success' | 'failed'; result?: unknown; error?: string }[];
    status: 'success' | 'partial' | 'failed' | 'skipped';
    durationMs: number;
}

/** Evaluate a single condition against context data */
function evaluateCondition(condition: WorkflowCondition, data: Record<string, unknown>): boolean {
    const fieldValue = getNestedValue(data, condition.field);
    const { operator, value } = condition;

    switch (operator) {
        case 'equals':        return String(fieldValue) === String(value);
        case 'not_equals':    return String(fieldValue) !== String(value);
        case 'contains':      return String(fieldValue ?? '').toLowerCase().includes(String(value).toLowerCase());
        case 'greater_than':  return Number(fieldValue) > Number(value);
        case 'less_than':     return Number(fieldValue) < Number(value);
        case 'exists':        return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
        default:              return false;
    }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((acc: unknown, key) => {
        if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
        return undefined;
    }, obj);
}

/** Evaluate all conditions — ALL must pass (AND logic) */
export function evaluateConditions(conditions: WorkflowCondition[], data: Record<string, unknown>): boolean {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every(c => evaluateCondition(c, data));
}

/**
 * Execute a single action — returns result object.
 * Heavy actions (SMS send, email) are delegated via fetch to API routes
 * so this can run both server-side and client-side.
 */
export async function executeAction(
    action: WorkflowAction,
    context: ExecutionContext
): Promise<{ type: string; status: 'success' | 'failed'; result?: unknown; error?: string }> {
    const { type, config } = action;

    try {
        switch (type) {
            case 'send_sms': {
                const res = await fetch('/api/sms/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: resolveTemplate(String(config.to || ''), context.data),
                        message: resolveTemplate(String(config.message || ''), context.data),
                        tenantId: context.tenantId,
                    }),
                });
                const result = await res.json();
                return { type, status: result.success ? 'success' : 'failed', result };
            }

            case 'send_email': {
                const res = await fetch('/api/communications/email/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: resolveTemplate(String(config.to || ''), context.data),
                        subject: resolveTemplate(String(config.subject || ''), context.data),
                        body: resolveTemplate(String(config.body || ''), context.data),
                        tenantId: context.tenantId,
                    }),
                });
                const result = await res.json();
                return { type, status: result.success ? 'success' : 'failed', result };
            }

            case 'update_lead_status': {
                const leadId = String(context.data.lead_id || context.data.id || config.lead_id || '');
                if (!leadId) return { type, status: 'failed', error: 'No lead_id in context' };
                const res = await fetch(`/api/leads/${leadId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: config.status }),
                });
                return { type, status: res.ok ? 'success' : 'failed' };
            }

            case 'notify_user': {
                // Internal notification — stored in DB via API
                const res = await fetch('/api/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tenantId: context.tenantId,
                        title: resolveTemplate(String(config.title || 'Workflow triggered'), context.data),
                        message: resolveTemplate(String(config.message || ''), context.data),
                        type: config.notificationType || 'info',
                    }),
                });
                return { type, status: res.ok ? 'success' : 'failed' };
            }

            case 'webhook_call': {
                if (!config.url) return { type, status: 'failed', error: 'No URL configured' };
                const res = await fetch(String(config.url), {
                    method: String(config.method || 'POST'),
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...context.data, tenantId: context.tenantId }),
                });
                return { type, status: res.ok ? 'success' : 'failed', result: { statusCode: res.status } };
            }

            default:
                return { type, status: 'failed', error: `Unknown action type: ${type}` };
        }
    } catch (err) {
        return { type, status: 'failed', error: String(err) };
    }
}

/** Replace {{field}} placeholders in a string with context data values */
export function resolveTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
        const val = getNestedValue(data, path);
        return val !== undefined && val !== null ? String(val) : '';
    });
}

/** Run a full workflow against a context — evaluates conditions then executes actions */
export async function runWorkflow(
    workflow: WorkflowDefinition,
    context: ExecutionContext
): Promise<ExecutionResult> {
    const start = Date.now();

    // Check trigger matches
    if (workflow.trigger_type !== context.triggerType) {
        return { workflowId: workflow.id, conditionsMet: false, actionsTaken: [], status: 'skipped', durationMs: 0 };
    }

    // Evaluate conditions
    const conditionsMet = evaluateConditions(workflow.conditions, context.data);
    if (!conditionsMet) {
        return { workflowId: workflow.id, conditionsMet: false, actionsTaken: [], status: 'skipped', durationMs: Date.now() - start };
    }

    // Execute all actions
    const actionsTaken = await Promise.all(
        workflow.actions.map(action => executeAction(action, context))
    );

    const allSuccess = actionsTaken.every(a => a.status === 'success');
    const anySuccess = actionsTaken.some(a => a.status === 'success');

    return {
        workflowId: workflow.id,
        conditionsMet: true,
        actionsTaken,
        status: allSuccess ? 'success' : anySuccess ? 'partial' : 'failed',
        durationMs: Date.now() - start,
    };
}
