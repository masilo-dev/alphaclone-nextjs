/**
 * WORKFLOW EXECUTOR
 * The AlphaClone Flow Engine — Trigger → Conditions → Actions
 * Replaces n8n/Zapier as the internal orchestration layer.
 */

import { DailyCall } from '@daily-co/daily-js';
import { sendAuditToMeeting } from '../../lib/meetingAudit';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { normalizePhoneNumber } from './CommunicationEngine';
import { assertSafeExternalHttpUrl } from '@/lib/security/externalUrl';

// Global reference to the Daily call object (set by the meeting component)
let _dailyCallObject: DailyCall | null = null;

export function setDailyCallObject(callObject: DailyCall | null) {
    _dailyCallObject = callObject;
}

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
    run_count?: number;
    last_run_at?: string;
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
                const to = normalizePhoneNumber(resolveTemplate(String(config.to || ''), context.data));
                const message = resolveTemplate(String(config.message || ''), context.data).trim();
                if (!to || !message) return { type, status: 'failed', error: 'SMS recipient and message are required' };
                const supabase = createSupabaseAdminClient();
                const { data: optOut } = await supabase.from('sms_opt_outs').select('id').eq('tenant_id', context.tenantId).eq('phone_number', to).maybeSingle();
                if (optOut) return { type, status: 'failed', error: 'Recipient has opted out of SMS' };
                const { data: integration, error: integrationError } = await supabase.from('twilio_integrations').select('account_sid,auth_token,phone_number').eq('tenant_id', context.tenantId).eq('is_active', true).maybeSingle();
                if (integrationError) throw integrationError;
                const accountSid = integration?.account_sid || process.env.TWILIO_ACCOUNT_SID;
                const authToken = integration?.auth_token || process.env.TWILIO_AUTH_TOKEN;
                const from = String(config.from || integration?.phone_number || process.env.TWILIO_PHONE_NUMBER || '');
                if (!accountSid || !authToken || !from) return { type, status: 'failed', error: 'Twilio is not configured for this workspace' };
                const body = /(^|\s)stop(\s|$)/i.test(message) ? message : `${message}\n\nReply STOP to unsubscribe.`;
                const params = new URLSearchParams({ To: to, From: from, Body: body });
                const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}` }, body: params.toString(), signal: AbortSignal.timeout(15_000) });
                const result = await response.json().catch(() => ({}));
                const { error: logError } = await supabase.from('sms_messages').insert({ tenant_id: context.tenantId, to_number: to, from_number: from, body, status: response.ok ? 'sent' : 'failed', twilio_sid: result.sid || null, error_message: response.ok ? null : 'Twilio delivery failed', sent_at: response.ok ? new Date().toISOString() : null });
                if (logError) throw logError;
                return response.ok ? { type, status: 'success', result: { sid: result.sid, status: result.status } } : { type, status: 'failed', error: 'Twilio rejected the SMS' };
            }

            case 'send_email': {
                const result = await sendEmailServer({ tenantId: context.tenantId, to: resolveTemplate(String(config.to || ''), context.data), subject: resolveTemplate(String(config.subject || ''), context.data), text: resolveTemplate(String(config.body || ''), context.data), templateName: 'workflowActionEmail' });
                return result.success ? { type, status: 'success', result: { provider: result.provider, emailId: result.emailId } } : { type, status: 'failed', error: result.error || 'Email delivery failed' };
            }

            case 'create_task': {
                const title = resolveTemplate(String(config.title || 'Workflow task'), context.data).trim();
                const assignedTo = String(config.assigned_to || config.assignedTo || context.data.owner_id || context.data.user_id || '').trim();
                if (!assignedTo) return { type, status: 'failed', error: 'Task has no assignee' };
                const supabase = createSupabaseAdminClient();
                const { data: member } = await supabase.from('tenant_users').select('user_id').eq('tenant_id', context.tenantId).eq('user_id', assignedTo).maybeSingle();
                if (!member) return { type, status: 'failed', error: 'Task assignee is not a workspace member' };
                const { data: task, error } = await supabase.from('tasks').insert({ tenant_id: context.tenantId, title, description: resolveTemplate(String(config.description || ''), context.data), assigned_to: assignedTo, created_by: assignedTo, status: 'todo', priority: ['low', 'medium', 'high', 'urgent'].includes(String(config.priority)) ? config.priority : 'medium', due_date: config.due_date ? resolveTemplate(String(config.due_date), context.data) : null, metadata: { createdByWorkflow: true } }).select('id').single();
                if (error) throw error;
                return { type, status: 'success', result: { taskId: task.id } };
            }

            case 'update_lead_status': {
                const leadId = String(context.data.lead_id || context.data.id || config.lead_id || '');
                if (!leadId) return { type, status: 'failed', error: 'No lead_id in context' };
                const supabase = createSupabaseAdminClient();
                const { data, error } = await supabase.from('leads').update({ status: config.status, updated_at: new Date().toISOString() }).eq('tenant_id', context.tenantId).eq('id', leadId).select('id').maybeSingle();
                if (error) throw error;
                return data ? { type, status: 'success' } : { type, status: 'failed', error: 'Lead not found' };
            }

            case 'notify_user': {
                const userId = String(config.userId || context.data.user_id || context.data.owner_id || '').trim();
                if (!userId) return { type, status: 'failed', error: 'Notification has no recipient' };
                const supabase = createSupabaseAdminClient();
                const { data: member } = await supabase.from('tenant_users').select('user_id').eq('tenant_id', context.tenantId).eq('user_id', userId).maybeSingle();
                if (!member) return { type, status: 'failed', error: 'Notification recipient is not a workspace member' };
                const { data, error } = await supabase.from('notifications').insert({ tenant_id: context.tenantId, user_id: userId, title: resolveTemplate(String(config.title || 'Workflow triggered'), context.data), message: resolveTemplate(String(config.message || ''), context.data), type: 'system', priority: 'medium', read: false, metadata: { createdByWorkflow: true } }).select('id').single();
                if (error) throw error;
                return { type, status: 'success', result: { notificationId: data.id } };
            }

            case 'assign_lead': {
                const leadId = String(context.data.lead_id || context.data.id || config.lead_id || '');
                const assignee = String(config.userId || config.assigned_to || context.data.owner_id || '');
                if (!leadId || !assignee) return { type, status: 'failed', error: 'Lead and assignee are required' };
                const supabase = createSupabaseAdminClient();
                const { data: member } = await supabase.from('tenant_users').select('user_id').eq('tenant_id', context.tenantId).eq('user_id', assignee).maybeSingle();
                if (!member) return { type, status: 'failed', error: 'Lead assignee is not a workspace member' };
                const { data, error } = await supabase.from('leads').update({ assigned_to: assignee, updated_at: new Date().toISOString() }).eq('tenant_id', context.tenantId).eq('id', leadId).select('id').maybeSingle();
                if (error) throw error;
                return data ? { type, status: 'success' } : { type, status: 'failed', error: 'Lead not found' };
            }

            case 'webhook_call': {
                if (!config.url) return { type, status: 'failed', error: 'No URL configured' };
                const safeUrl = await assertSafeExternalHttpUrl(String(config.url));
                const method = String(config.method || 'POST').toUpperCase();
                if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return { type, status: 'failed', error: 'Unsupported webhook method' };
                const res = await fetch(safeUrl, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: method === 'GET' ? undefined : JSON.stringify({ ...context.data, tenantId: context.tenantId }),
                    redirect: 'manual',
                    signal: AbortSignal.timeout(15_000),
                });
                return { type, status: res.ok ? 'success' : 'failed', result: { statusCode: res.status }, error: res.ok ? undefined : `Webhook returned HTTP ${res.status}` };
            }

            case 'post_to_facebook': {
                const message = resolveTemplate(
                    String(config.message || config.caption || config.text || ''),
                    context.data
                ).trim();
                if (!message) {
                    return { type, status: 'failed', error: 'No Facebook message configured' };
                }

                const mediaUrl = config.mediaUrl
                    ? resolveTemplate(String(config.mediaUrl), context.data).trim()
                    : '';
                const mediaType = String(config.mediaType || '').toLowerCase() === 'video' ? 'video' : 'image';

                const supabase = createSupabaseAdminClient();

                let pageId = String(config.pageId || config.page_id || '').trim();
                if (!pageId) {
                    const { data: pages, error: pagesError } = await supabase
                        .from('facebook_integrations')
                        .select('page_id, page_name')
                        .eq('tenant_id', context.tenantId)
                        .eq('is_active', true)
                        .limit(1);

                    if (pagesError) {
                        return { type, status: 'failed', error: pagesError.message };
                    }

                    pageId = String(pages?.[0]?.page_id || '').trim();
                }

                if (!pageId) {
                    return { type, status: 'failed', error: 'No connected Facebook Page found' };
                }

                const { facebookService } = await import('../facebookService');
                const publishResult = await facebookService.publishPost(
                    context.tenantId,
                    pageId,
                    message,
                    mediaUrl || undefined,
                    mediaType
                );

                return {
                    type,
                    status: 'success',
                    result: {
                        pageId,
                        published: true,
                        publishResult,
                    },
                };
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

    const actionsTaken: ExecutionResult['actionsTaken'] = [];
    for (const action of workflow.actions) actionsTaken.push(await executeAction(action, context));

    const allSuccess = actionsTaken.every(a => a.status === 'success');
    const anySuccess = actionsTaken.some(a => a.status === 'success');

    // Send audit to meeting
    if (_dailyCallObject) {
        sendAuditToMeeting(_dailyCallObject, {
            source: 'workflow',
            type: 'workflow_executed',
            details: {
                workflowId: workflow.id,
                workflowName: workflow.name,
                conditionsMet,
                actionsCount: workflow.actions.length,
                status: allSuccess ? 'success' : anySuccess ? 'partial' : 'failed',
                durationMs: Date.now() - start,
            },
            timestamp: new Date().toISOString(),
        });
    }

    return {
        workflowId: workflow.id,
        conditionsMet: true,
        actionsTaken,
        status: allSuccess ? 'success' : anySuccess ? 'partial' : 'failed',
        durationMs: Date.now() - start,
    };
}
