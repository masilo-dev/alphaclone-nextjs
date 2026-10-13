'use client';

import { parseWorkflowConfig, workflowConfigError } from '@/lib/ui/workflowConfig';
import { Input as AlphaCloneInput } from '@/components/ui/input';
import { Select as AlphaCloneSelect } from '@/components/ui/select';


import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Zap, Plus, Trash2, Edit2, ToggleLeft, ToggleRight, Play, ChevronDown,
    ChevronUp, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2,
    Activity, Filter, RefreshCw, Info, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import { ModuleStatCards, type ModuleStat } from '../common/ModuleStatCards';
import { EnterprisePageHeader } from '@/components/dashboard/responsive/EnterpriseModuleChrome';
import type { WorkflowCondition, WorkflowAction, TriggerType, ActionType } from '@/services/engine/WorkflowExecutor';

interface WorkflowDef {
    id: string;
    name: string;
    description: string;
    trigger_type: TriggerType;
    conditions: WorkflowCondition[];
    actions: WorkflowAction[];
    is_active: boolean;
    run_count: number;
    last_run_at: string | null;
    created_at: string;
}

interface WorkflowExecution {
    id: string;
    workflow_id: string;
    conditions_met: boolean;
    actions_taken: { type: string; status: string; error?: string }[];
    status: string;
    duration_ms: number;
    created_at: string;
    workflow_definitions?: { name: string };
}

const TRIGGER_LABELS: Record<string, string> = {
    lead_created: 'Lead Created',
    facebook_lead_received: 'Facebook Lead Received',
    ingestion_event: 'Ingestion Event',
    sms_received: 'SMS Received',
    form_submitted: 'Form Submitted',
    manual: 'Manual Trigger',
};

const ACTION_LABELS: Record<string, string> = {
    send_sms: 'Send SMS',
    send_email: 'Send Email',
    create_task: 'Create Task',
    update_lead_status: 'Update Lead Status',
    notify_user: 'Notify User',
    post_to_facebook: 'Post to Facebook',
    webhook_call: 'Call Webhook',
    assign_lead: 'Assign Lead',
};

const DEFAULT_WORKFLOWS = [
    {
        name: 'High-Intent Lead → SMS Alert',
        description: 'Send SMS notification when a high-intent lead is captured',
        trigger_type: 'lead_created' as TriggerType,
        conditions: [{ field: 'intent_label', operator: 'equals', value: 'high' }] as WorkflowCondition[],
        actions: [{
            type: 'send_sms' as ActionType,
            config: { to: '{{phone}}', message: 'New high-intent lead: {{contact_name}} from {{source}}. Score: {{intent_score}}' }
        }],
    },
    {
        name: 'Urgent Lead → Notify + Task',
        description: 'Create a task and notify team when urgent lead arrives',
        trigger_type: 'ingestion_event' as TriggerType,
        conditions: [{ field: 'intent_label', operator: 'equals', value: 'urgent' }] as WorkflowCondition[],
        actions: [
            { type: 'notify_user' as ActionType, config: { title: 'Urgent Lead!', message: 'Source: {{source}} — "{{raw_content}}"' } },
            { type: 'create_task' as ActionType, config: { title: 'Follow up: {{author_name}}', due_hours: 2 } },
        ],
    },
    {
        name: 'Facebook Lead → Auto SMS',
        description: 'Auto-send SMS to every Facebook Lead Ad submission',
        trigger_type: 'facebook_lead_received' as TriggerType,
        conditions: [],
        actions: [{
            type: 'send_sms' as ActionType,
            config: { to: '{{phone}}', message: 'Hi {{first_name}}, thanks for your interest! We\'ll be in touch shortly.' }
        }],
    },
    // ── VERTICAL MODULE DEFAULT WORKFLOWS ──
    {
        name: 'Low Stock → Purchase Order',
        description: 'Auto-create purchase order when inventory drops below threshold',
        trigger_type: 'inventory_low_stock' as TriggerType,
        conditions: [],
        actions: [{
            type: 'create_purchase_order' as ActionType,
            config: { supplierName: 'Auto-Reorder', items: '{{low_stock_items}}', notes: 'Auto-generated low stock reorder' }
        }],
    },
    {
        name: 'Ticket Created → Assign & Notify',
        description: 'Auto-assign new support tickets and notify the team',
        trigger_type: 'ticket_created' as TriggerType,
        conditions: [],
        actions: [
            { type: 'assign_ticket' as ActionType, config: { assigneeId: '{{default_assignee}}' } },
            { type: 'notify_user' as ActionType, config: { title: 'New Ticket', message: 'Ticket {{ticket_id}}: {{ticket_title}}' } },
        ],
    },
    {
        name: 'Order Placed → Fulfillment & Inventory',
        description: 'Create fulfillment record and decrement inventory when order is placed',
        trigger_type: 'order_created' as TriggerType,
        conditions: [],
        actions: [
            { type: 'fulfill_order' as ActionType, config: { carrier: '{{default_carrier}}' } },
            { type: 'update_inventory' as ActionType, config: { quantityChange: '-{{order_quantity}}', referenceType: 'sale' } },
        ],
    },
    {
        name: 'Shipment Delivered → Invoice',
        description: 'Auto-generate invoice when shipment is marked as delivered',
        trigger_type: 'shipment_delivered' as TriggerType,
        conditions: [],
        actions: [{
            type: 'send_email' as ActionType,
            config: { to: '{{client_email}}', subject: 'Invoice for Shipment {{shipment_id}}', body: 'Your shipment has been delivered. Please find the invoice attached.' }
        }],
    },
    {
        name: 'Signature Completed → Contract Status',
        description: 'Update contract status to executed when all signatures are collected',
        trigger_type: 'signature_completed' as TriggerType,
        conditions: [],
        actions: [{
            type: 'webhook_call' as ActionType,
            config: { url: '{{app_url}}/api/contracts/{{contract_id}}/status', method: 'PATCH', body: JSON.stringify({ status: 'executed' }) }
        }],
    },
    {
        name: 'Sprint Completed → Retrospective',
        description: 'Generate sprint retrospective report when sprint ends',
        trigger_type: 'sprint_completed' as TriggerType,
        conditions: [],
        actions: [{
            type: 'notify_user' as ActionType,
            config: { title: 'Sprint Retrospective', message: 'Sprint {{sprint_name}} has completed. Generate retrospective report.' }
        }],
    },
    {
        name: 'Daily Log → Project Progress Update',
        description: 'Update project progress based on daily log submissions',
        trigger_type: 'daily_log_submitted' as TriggerType,
        conditions: [],
        actions: [{
            type: 'webhook_call' as ActionType,
            config: { url: '{{app_url}}/api/projects/{{project_id}}/progress', method: 'PATCH', body: JSON.stringify({ source: 'daily_log' }) }
        }],
    },
    {
        name: 'Change Order Approved → Budget Update',
        description: 'Update project budget when change order is approved',
        trigger_type: 'change_order_approved' as TriggerType,
        conditions: [],
        actions: [{
            type: 'webhook_call' as ActionType,
            config: { url: '{{app_url}}/api/projects/{{project_id}}/budget', method: 'PATCH', body: JSON.stringify({ changeOrderId: '{{change_order_id}}' }) }
        }],
    },
    {
        name: 'Client Approval → Project Stage',
        description: 'Move project to next stage when client approves',
        trigger_type: 'client_approval_completed' as TriggerType,
        conditions: [],
        actions: [{
            type: 'webhook_call' as ActionType,
            config: { url: '{{app_url}}/api/projects/{{project_id}}/stage', method: 'PATCH', body: JSON.stringify({ stage: 'next' }) }
        }],
    },
    {
        name: 'Retainer Due → Auto Invoice',
        description: 'Generate invoice for active retainer agreements on billing day',
        trigger_type: 'retainer_invoice_generated' as TriggerType,
        conditions: [],
        actions: [{
            type: 'send_email' as ActionType,
            config: { to: '{{client_email}}', subject: 'Monthly Retainer Invoice', body: 'Your retainer invoice for {{period}} is ready.' }
        }],
    },
    {
        name: 'Tax Return Deadline → Reminder',
        description: 'Send reminder when tax return deadline is approaching',
        trigger_type: 'tax_return_filed' as TriggerType,
        conditions: [],
        actions: [{
            type: 'notify_user' as ActionType,
            config: { title: 'Tax Return Due', message: 'Tax return for {{client_name}} is due soon.' }
        }],
    },
];

const EMPTY_FORM = {
    name: '',
    description: '',
    trigger_type: 'lead_created' as TriggerType,
    conditions: [] as WorkflowCondition[],
    actions: [] as WorkflowAction[],
};

export default function WorkflowDashboard() {
    const { currentTenant: tenant } = useTenant();
    const { confirm } = useConfirmDialog();
    const [workflows, setWorkflows] = useState<WorkflowDef[]>([]);
    const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'workflows' | 'log'>('workflows');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [actionDrafts, setActionDrafts] = useState<Record<number, string>>({});
    const invalidActionConfig = Object.values(actionDrafts).some(text => workflowConfigError(text));
    const [saving, setSaving] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [seeding, setSeeding] = useState(false);

    const loadData = useCallback(async () => {
        if (!tenant?.id) return;
        setLoading(true);
        // `workflow_executions.workflow_id` references `workflows`, not
        // `workflow_definitions`, so PostgREST rejects an embedded
        // `workflow_definitions(name)` (400). Resolve names from the definitions
        // loaded alongside instead.
        const [wfRes, execRes] = await Promise.all([
            supabase.from('workflow_definitions').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
            supabase
                .from('workflow_executions')
                .select('*')
                .eq('tenant_id', tenant.id)
                .order('created_at', { ascending: false })
                .limit(50),
        ]);
        if (!wfRes.error) setWorkflows(wfRes.data || []);
        if (!execRes.error) {
            const nameById = new Map<string, string>(
                ((wfRes.data || []) as Array<{ id: string; name?: string }>).map((w) => [w.id, w.name || '']),
            );
            setExecutions(
                ((execRes.data || []) as Array<Record<string, any>>).map((ex) => ({
                    ...ex,
                    workflow_definitions: nameById.has(ex.workflow_id)
                        ? { name: nameById.get(ex.workflow_id) || '' }
                        : ex.workflow_definitions,
                })) as WorkflowExecution[],
            );
        }
        setLoading(false);
    }, [tenant]);

    useEffect(() => { loadData(); }, [loadData]);

    const seedDefaults = async () => {
        if (!tenant?.id) return;
        setSeeding(true);
        await fetch(`/api/tenant/${encodeURIComponent(tenant.id)}/workflows`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workflows: DEFAULT_WORKFLOWS }) });
        toast.success('Default workflows added');
        loadData();
        setSeeding(false);
    };

    const handleToggle = async (wf: WorkflowDef) => {
        const response = await fetch(`/api/tenant/${encodeURIComponent(tenant!.id)}/workflows`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workflowId: wf.id, isActive: !wf.is_active }) });
        if (response.ok) {
            setWorkflows(prev => prev.map(w => w.id === wf.id ? { ...w, is_active: !wf.is_active } : w));
            toast.success(wf.is_active ? 'Workflow paused' : 'Workflow activated');
        }
    };

    const handleDelete = async (id: string) => {
        const ok = await confirm({
            title: 'Delete workflow?',
            description: 'This will remove the workflow definition. Execution history remains in your activity logs.',
            confirmLabel: 'Delete workflow',
            cancelLabel: 'Cancel',
            variant: 'danger',
        });
        if (!ok) return;
        if (!tenant?.id) return;
        const response = await fetch(`/api/tenant/${encodeURIComponent(tenant.id)}/workflows?workflowId=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (response.ok) {
            setWorkflows(prev => prev.filter(w => w.id !== id));
            toast.success('Deleted');
        }
    };

    const handleSave = async () => {
        if (!tenant?.id || !form.name.trim() || !form.trigger_type) return toast.error('Add a name and choose when this automation should start.');
        if (saving || invalidActionConfig) return toast.error('Correct the highlighted action settings before saving.');
        if (form.actions.length === 0) return toast.error('Add at least one action');
        setSaving(true);
        try {
        const payload = { ...form, actions: form.actions.map((action, index) => ({ ...action, config: actionDrafts[index] === undefined ? action.config : parseWorkflowConfig(actionDrafts[index]) })) };
        const response = await fetch(`/api/tenant/${encodeURIComponent(tenant.id)}/workflows`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) { toast.error(result.error || 'Workflow could not be created'); } else {
            toast.success('Workflow created (activate to enable)');
            setShowForm(false);
            setForm({ ...EMPTY_FORM });
            setActionDrafts({});
            loadData();
        }
        } catch {
            toast.error('The automation could not be saved. Check your connection and try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleTestRun = async (wf: WorkflowDef) => {
        if (!tenant?.id) return toast.error('Choose a workspace before testing an automation.');
        const toastId = toast.loading('Previewing automation...');
        try {
        const res = await fetch(`/api/tenant/${encodeURIComponent(tenant.id)}/workflows`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workflowId: wf.id,
                sample: { intent_label: 'high', intent_score: 75, source: 'dry-run', contact_name: 'Sample Lead', phone: '+10000000000' },
            }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) { toast.error(result.error || 'Dry run failed', { id: toastId }); return; }
        toast.success(result.conditionsMet ? `Preview passed: ${result.actions?.length || 0} action(s) checked` : 'Preview complete: the sample did not match your filters', { id: toastId });
        } catch {
            toast.error('Preview could not be loaded. Check your connection and try again.', { id: toastId });
        }
    };

    const addCondition = () => setForm(f => ({
        ...f, conditions: [...f.conditions, { field: 'intent_label', operator: 'equals', value: 'high' }]
    }));

    const addAction = () => setForm(f => ({
        ...f, actions: [...f.actions, { type: 'notify_user', config: { title: 'New event', message: '' } }]
    }));

    const activeCount = useMemo(
        () => workflows.filter(w => w.is_active).length,
        [workflows],
    );

    const workflowStats = useMemo<ModuleStat[]>(() => {
        const succeeded = executions.filter(e => e.status === 'success').length;
        const failed = executions.filter(e => e.status === 'failed').length;
        const decided = succeeded + failed;
        const successRate = decided > 0 ? Math.round((succeeded / decided) * 100) : 0;
        const avgMs = executions.length > 0
            ? Math.round(executions.reduce((s, e) => s + (e.duration_ms || 0), 0) / executions.length)
            : 0;
        return [
            { label: 'Active Flows', value: activeCount, sub: `${workflows.length} total workflows`, Icon: Zap, accent: 'teal' },
            { label: 'Recent Runs', value: executions.length, sub: 'Last execution batch', Icon: Activity, accent: 'blue' },
            { label: 'Success Rate', value: `${successRate}%`, sub: `${succeeded} succeeded`, Icon: CheckCircle2, accent: successRate >= 80 ? 'emerald' : 'amber' },
            { label: 'Avg Duration', value: avgMs > 1000 ? `${(avgMs / 1000).toFixed(1)}s` : `${avgMs}ms`, sub: failed > 0 ? `${failed} failed` : 'All healthy', Icon: Clock, accent: failed > 0 ? 'rose' : 'purple' },
        ];
    }, [workflows.length, activeCount, executions]);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
        </div>
    );

    return (
        <div className="space-y-6 ac-scroll-full ac-enterprise-module">
            <EnterprisePageHeader
                moduleKey="workflows"
                primaryAction={{
                    label: 'New Workflow',
                    onClick: () => setShowForm(true),
                }}
                secondaryActions={
                    workflows.length === 0
                        ? [{
                            label: seeding ? 'Adding…' : 'Add Defaults',
                            onClick: seedDefaults,
                            disabled: seeding,
                        }]
                        : undefined
                }
            />

            {(workflows.length > 0 || executions.length > 0) && (
                <ModuleStatCards stats={workflowStats} />
            )}

            {/* Architecture info banner */}
            <div className="flex gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="type-caption text-blue-300 space-y-1">
                    <p className="font-semibold">Automate a repeatable task</p>
                    <p className="text-blue-400">Choose what starts the workflow, add what should happen, and preview it before activation.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-[var(--ws-surface-secondary)] border border-[var(--ws-border)] rounded-xl w-fit">
                {(['workflows', 'log'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg type-ui font-semibold capitalize transition-all ${activeTab === tab ? 'bg-teal-500 text-[var(--text-inverse)]' : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)]'}`}>
                        {tab === 'workflows' ? `Workflows (${workflows.length})` : `Execution Log (${executions.length})`}
                    </button>
                ))}
            </div>

            {/* Create Form */}
            {showForm && (
                <div className="bg-[var(--ws-panel)] border border-[var(--ws-border)] rounded-2xl p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-[var(--ws-text-primary)]">New Workflow</h3>
                        <button onClick={() => setShowForm(false)} className="text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)]"><X className="w-4 h-4" /></button>
                    </div>

                    <label className="block text-sm text-[var(--ws-text-secondary)]">Start with a template (optional)
                      <AlphaCloneSelect defaultValue="" className="mt-1 w-full" onChange={event => {
                        const template = DEFAULT_WORKFLOWS[Number(event.target.value)];
                        if (event.target.value === '' || !template) return;
                        setForm(structuredClone(template));
                        setActionDrafts({});
                      }}><option value="">Choose a template or build your own</option>{DEFAULT_WORKFLOWS.map((template, index) => <option key={template.name} value={index}>{template.name}</option>)}</AlphaCloneSelect>
                    </label>
                    <p className="text-sm text-[var(--ws-text-secondary)]">New workflows are saved inactive. Review and test before enabling them.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="type-caption font-semibold text-[var(--ws-text-muted)] uppercase tracking-wider mb-1 block">Name *</label>
                            <AlphaCloneInput value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. High-Intent Lead Alert"
                                className="w-full px-3 py-2" />
                        </div>
                        <div>
                            <label className="type-caption font-semibold text-[var(--ws-text-muted)] uppercase tracking-wider mb-1 block">When should it start? *</label>
                            <AlphaCloneSelect value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value as TriggerType }))}
                                className="w-full px-3 py-2">
                                {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </AlphaCloneSelect>
                        </div>
                    </div>

                    {/* Conditions */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="type-caption font-semibold text-[var(--ws-text-muted)] uppercase tracking-wider">Only when these filters match (optional)</label>
                            <button onClick={addCondition} className="type-ui text-teal-400 hover:text-[var(--brand-blue-300)] flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Add Condition
                            </button>
                        </div>
                        {form.conditions.length === 0 && (
                            <p className="type-card-description text-slate-600 italic">No conditions — workflow runs on every trigger event</p>
                        )}
                        {form.conditions.map((c, i) => (
                            <div key={i} className="flex gap-2 mb-2">
                                <AlphaCloneInput value={c.field} onChange={e => setForm(f => { const conds = [...f.conditions]; conds[i] = { ...conds[i], field: e.target.value }; return { ...f, conditions: conds }; })}
                                    placeholder="field (e.g. intent_label)"
                                    className="flex-1 px-3 py-1.5" />
                                <AlphaCloneSelect value={c.operator} onChange={e => setForm(f => { const conds = [...f.conditions]; conds[i] = { ...conds[i], operator: e.target.value as WorkflowCondition['operator'] }; return { ...f, conditions: conds }; })}
                                    className="px-2 py-1.5">
                                    {['equals','not_equals','contains','greater_than','less_than','exists'].map(op => <option key={op} value={op}>{op}</option>)}
                                </AlphaCloneSelect>
                                <AlphaCloneInput value={String(c.value)} onChange={e => setForm(f => { const conds = [...f.conditions]; conds[i] = { ...conds[i], value: e.target.value }; return { ...f, conditions: conds }; })}
                                    placeholder="value"
                                    className="flex-1 px-3 py-1.5" />
                                <button onClick={() => setForm(f => ({ ...f, conditions: f.conditions.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-[var(--error-text,var(--error-500))]"><X className="w-3.5 h-3.5" /></button>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="type-caption font-semibold text-[var(--ws-text-muted)] uppercase tracking-wider">What should happen? *</label>
                            <button onClick={addAction} className="type-ui text-teal-400 hover:text-[var(--brand-blue-300)] flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Add Action
                            </button>
                        </div>
                        {form.actions.map((a, i) => (
                            <div key={i} className="flex gap-2 mb-2">
                                <AlphaCloneSelect value={a.type} onChange={e => setForm(f => { const acts = [...f.actions]; acts[i] = { ...acts[i], type: e.target.value as ActionType }; return { ...f, actions: acts }; })}
                                    className="px-2 py-1.5">
                                    {Object.entries(ACTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </AlphaCloneSelect>
                                <WorkflowSettingsEditor index={i} type={a.type} text={actionDrafts[i] ?? JSON.stringify(a.config, null, 2)} onChange={text => setActionDrafts(current => ({ ...current, [i]: text }))} />
                                <button aria-label="Remove action" onClick={() => { setForm(f => ({ ...f, actions: f.actions.filter((_, j) => j !== i) })); setActionDrafts(current => Object.fromEntries(Object.entries(current).filter(([key]) => Number(key) !== i).map(([key, value]) => [Number(key) > i ? Number(key) - 1 : Number(key), value]))); }} className="text-red-400 hover:text-[var(--error-text,var(--error-500))]"><X className="w-3.5 h-3.5" /></button>
                            </div>
                        ))}
                        <p className="type-card-description text-slate-600 mt-1">Use <code className="text-teal-400">{'{{field_name}}'}</code> to insert event data into messages</p>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={handleSave} disabled={saving || invalidActionConfig}
                            className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-[var(--brand-blue-400)] disabled:opacity-50 text-[var(--text-inverse)] rounded-xl font-semibold type-ui">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            {saving ? 'Saving...' : 'Create Workflow'}
                        </button>
                        <button onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-[var(--ws-surface-secondary)] border border-[var(--ws-border)] text-[var(--ws-text-secondary)] rounded-xl type-ui">Cancel</button>
                    </div>
                </div>
            )}

            {/* WORKFLOWS TAB */}
            {activeTab === 'workflows' && (
                <div className="space-y-3">
                    {workflows.length === 0 ? (
                        <div className="text-center py-16 border border-dashed border-[var(--ws-border)] rounded-2xl">
                            <Zap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                            <p className="text-[var(--ws-text-muted)] font-semibold">No workflows yet</p>
                            <p className="text-slate-600 type-card-description mt-1 mb-4">Start with our default templates or create your own.</p>
                            <button onClick={seedDefaults} disabled={seeding}
                                className="px-4 py-2 bg-teal-500 hover:bg-[var(--brand-blue-400)] text-[var(--text-inverse)] rounded-xl type-ui font-semibold">
                                Load Default Workflows
                            </button>
                        </div>
                    ) : workflows.map(wf => (
                        <div key={wf.id} className="bg-[var(--ws-panel)] border border-[var(--ws-border)] rounded-2xl overflow-hidden">
                            <div className="flex items-center gap-3 p-4">
                                <button onClick={() => handleToggle(wf)} className="flex-shrink-0">
                                    {wf.is_active
                                        ? <ToggleRight className="w-8 h-8 text-teal-400" />
                                        : <ToggleLeft className="w-8 h-8 text-slate-600" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-[var(--ws-text-primary)] type-card-description">{wf.name}</p>
                                        <span className={`type-caption px-2 py-0.5 rounded-full border ${wf.is_active ? 'bg-teal-500/15 text-teal-400 border-teal-500/30' : 'bg-[var(--ws-surface-tertiary)] text-[var(--ws-text-muted)] border-[var(--ws-border)]'}`}>
                                            {wf.is_active ? 'Active' : 'Paused'}
                                        </span>
                                    </div>
                                    <div className="flex gap-3 mt-1">
                                        <span className="type-caption text-[var(--ws-text-muted)]">Trigger: <span className="text-[var(--ws-text-muted)]">{TRIGGER_LABELS[wf.trigger_type]}</span></span>
                                        <span className="type-caption text-[var(--ws-text-muted)]">Runs: <span className="text-[var(--ws-text-muted)]">{wf.run_count}</span></span>
                                        {wf.last_run_at && <span className="type-caption text-slate-600">Last: {new Date(wf.last_run_at).toLocaleDateString()}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button onClick={() => handleTestRun(wf)} title="Test Run"
                                        className="p-1.5 rounded-lg bg-[var(--ws-surface-secondary)] hover:bg-blue-500/20 text-[var(--ws-text-muted)] hover:text-blue-400 transition-colors">
                                        <Play className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => setExpandedId(expandedId === wf.id ? null : wf.id)}
                                        className="p-1.5 rounded-lg bg-[var(--ws-surface-secondary)] hover:bg-[var(--ws-surface-tertiary)] text-[var(--ws-text-muted)] transition-colors">
                                        {expandedId === wf.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </button>
                                    <button onClick={() => handleDelete(wf.id)}
                                        className="p-1.5 rounded-lg bg-[var(--ws-surface-secondary)] hover:bg-[var(--error-500)]/20 text-[var(--ws-text-muted)] hover:text-red-400 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                            {expandedId === wf.id && (
                                <div className="border-t border-[var(--ws-border)] p-4 bg-[var(--ws-canvas)] space-y-3">
                                    {wf.description && <p className="type-card-description text-[var(--ws-text-muted)]">{wf.description}</p>}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <p className="type-caption font-semibold text-[var(--ws-text-muted)] uppercase tracking-wider mb-2">Conditions</p>
                                            {wf.conditions.length === 0
                                                ? <p className="type-card-description text-slate-600 italic">Always runs</p>
                                                : wf.conditions.map((c, i) => (
                                                    <div key={i} className="type-caption text-[var(--ws-text-secondary)] font-mono bg-[var(--ws-surface-secondary)] px-3 py-1.5 rounded-lg mb-1">
                                                        {c.field} <span className="text-[var(--ws-text-muted)]">{c.operator}</span> <span className="text-teal-400">"{String(c.value)}"</span>
                                                    </div>
                                                ))}
                                        </div>
                                        <div>
                                            <p className="type-caption font-semibold text-[var(--ws-text-muted)] uppercase tracking-wider mb-2">Actions</p>
                                            {wf.actions.map((a, i) => (
                                                <div key={i} className="type-caption bg-[var(--ws-surface-secondary)] px-3 py-1.5 rounded-lg mb-1">
                                                    <span className="text-amber-400 font-semibold">{ACTION_LABELS[a.type] || a.type}</span>
                                                    <span className="text-[var(--ws-text-muted)] ml-2">{JSON.stringify(a.config).slice(0, 80)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* EXECUTION LOG TAB */}
            {activeTab === 'log' && (
                <div className="space-y-2">
                    <div className="flex justify-end">
                        <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--ws-surface-secondary)] border border-[var(--ws-border)] rounded-lg type-ui text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)]">
                            <RefreshCw className="w-3 h-3" /> Refresh
                        </button>
                    </div>
                    {executions.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-[var(--ws-border)] rounded-2xl">
                            <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                            <p className="text-[var(--ws-text-muted)] type-card-description">No executions yet. Activate a workflow and trigger an event.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-[var(--ws-border)] min-w-0">
                            <table className="w-full min-w-[560px] type-ui">
                                <thead>
                                    <tr className="border-b border-[var(--ws-border)] bg-[var(--ws-panel)]">
                                        {['Workflow', 'Status', 'Actions', 'Duration', 'Time'].map(h => (
                                            <th key={h} className="text-left px-4 py-3 type-caption font-semibold text-[var(--ws-text-muted)] uppercase tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {executions.map(ex => (
                                        <tr key={ex.id} className="hover:bg-[var(--ws-surface-secondary)]">
                                            <td className="px-4 py-3 text-[var(--ws-text-secondary)] type-table-cell font-medium">{ex.workflow_definitions?.name || '—'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`type-caption px-2 py-0.5 rounded-full border ${
                                                    ex.status === 'success' ? 'bg-green-500/15 text-green-400 border-green-500/30'
                                                    : ex.status === 'failed' ? 'bg-[var(--error-500)]/15 text-red-400 border-red-500/30'
                                                    : ex.status === 'skipped' ? 'bg-[var(--ws-surface-tertiary)] text-[var(--ws-text-muted)] border-[var(--ws-border)]'
                                                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'}`}>
                                                    {ex.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 type-table-cell text-[var(--ws-text-muted)]">{(ex.actions_taken as { type: string }[])?.map(a => a.type).join(', ') || '—'}</td>
                                            <td className="px-4 py-3 type-table-cell text-[var(--ws-text-muted)]">{ex.duration_ms != null ? `${ex.duration_ms}ms` : '—'}</td>
                                            <td className="px-4 py-3 type-table-cell text-slate-600">{new Date(ex.created_at).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const ACTION_FIELDS: Record<string, Array<[string, string]>> = {
  create_task: [['title', 'Task title']],
  notify_user: [['title', 'Notification title'], ['message', 'Message']],
  send_email: [['to', 'Recipient email'], ['subject', 'Subject'], ['body', 'Message']],
  send_sms: [['to', 'Recipient phone'], ['message', 'Message']],
};
function WorkflowSettingsEditor({ index, type, text, onChange }: { index: number; type: string; text: string; onChange: (text: string) => void }) {
  const error = workflowConfigError(text);
  const config = error ? {} : parseWorkflowConfig(text);
  const fields = ACTION_FIELDS[type] || [];
  return <div className="min-w-0 flex-1 space-y-2">
    {!error && fields.map(([field, label]) => <label key={field} className="block text-sm text-[var(--ws-text-secondary)]">{label}<AlphaCloneInput value={String(config[field] || '')} onChange={event => onChange(JSON.stringify({ ...config, [field]: event.target.value }, null, 2))} className="mt-1 w-full" /></label>)}
    <details open={!fields.length || Boolean(error)} className="rounded-md border border-[var(--ws-border)] p-2">
      <summary className="cursor-pointer text-sm text-[var(--ws-text-secondary)]">Advanced action settings</summary>
      <label className="text-xs text-[var(--ws-text-secondary)]" htmlFor={`workflow-action-${index}`}>JSON settings</label>
      <textarea id={`workflow-action-${index}`} rows={3} value={text} onChange={event => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={`workflow-action-error-${index}`} className="w-full rounded-md border border-[var(--ws-border)] bg-[var(--ws-panel)] p-2 font-mono text-sm text-[var(--ws-text-primary)]" />
      <p id={`workflow-action-error-${index}`} role={error ? 'alert' : undefined} className="text-xs text-[var(--error-text)]">{error}</p>
    </details>
  </div>;
}
