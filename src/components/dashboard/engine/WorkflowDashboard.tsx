'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Zap, Plus, Trash2, Edit2, ToggleLeft, ToggleRight, Play, ChevronDown,
    ChevronUp, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2,
    Activity, Filter, RefreshCw, Info, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';
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
    const [workflows, setWorkflows] = useState<WorkflowDef[]>([]);
    const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'workflows' | 'log'>('workflows');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [seeding, setSeeding] = useState(false);

    const loadData = useCallback(async () => {
        if (!tenant?.id) return;
        setLoading(true);
        const [wfRes, execRes] = await Promise.all([
            supabase.from('workflow_definitions').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
            supabase
                .from('workflow_executions')
                .select('*, workflow_definitions(name)')
                .eq('tenant_id', tenant.id)
                .order('created_at', { ascending: false })
                .limit(50),
        ]);
        if (!wfRes.error) setWorkflows(wfRes.data || []);
        if (!execRes.error) setExecutions(execRes.data || []);
        setLoading(false);
    }, [tenant]);

    useEffect(() => { loadData(); }, [loadData]);

    const seedDefaults = async () => {
        if (!tenant?.id) return;
        setSeeding(true);
        for (const wf of DEFAULT_WORKFLOWS) {
            await supabase.from('workflow_definitions').insert({ ...wf, tenant_id: tenant.id, is_active: false });
        }
        toast.success('Default workflows added');
        loadData();
        setSeeding(false);
    };

    const handleToggle = async (wf: WorkflowDef) => {
        const { error } = await supabase
            .from('workflow_definitions')
            .update({ is_active: !wf.is_active })
            .eq('id', wf.id);
        if (!error) {
            setWorkflows(prev => prev.map(w => w.id === wf.id ? { ...w, is_active: !wf.is_active } : w));
            toast.success(wf.is_active ? 'Workflow paused' : 'Workflow activated');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this workflow?')) return;
        const { error } = await supabase.from('workflow_definitions').delete().eq('id', id);
        if (!error) {
            setWorkflows(prev => prev.filter(w => w.id !== id));
            toast.success('Deleted');
        }
    };

    const handleSave = async () => {
        if (!tenant?.id || !form.name || !form.trigger_type) return toast.error('Name and trigger required');
        if (form.actions.length === 0) return toast.error('Add at least one action');
        setSaving(true);
        const { error } = await supabase.from('workflow_definitions').insert({
            ...form,
            tenant_id: tenant.id,
            is_active: false,
        });
        if (error) { toast.error(error.message); } else {
            toast.success('Workflow created (activate to enable)');
            setShowForm(false);
            setForm({ ...EMPTY_FORM });
            loadData();
        }
        setSaving(false);
    };

    const handleTestRun = async (wf: WorkflowDef) => {
        const toastId = toast.loading('Running test...');
        const res = await fetch('/api/engine/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                trigger_type: wf.trigger_type,
                tenant_id: tenant?.id,
                data: { intent_label: 'high', intent_score: 75, source: 'test', contact_name: 'Test Lead', phone: '+10000000000' },
            }),
        });
        const result = await res.json();
        toast.success(`Test: ${result.executed} workflow(s) executed`, { id: toastId });
        loadData();
    };

    const addCondition = () => setForm(f => ({
        ...f, conditions: [...f.conditions, { field: 'intent_label', operator: 'equals', value: 'high' }]
    }));

    const addAction = () => setForm(f => ({
        ...f, actions: [...f.actions, { type: 'notify_user', config: { title: 'New event', message: '' } }]
    }));

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
        </div>
    );

    const activeCount = workflows.filter(w => w.is_active).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">AlphaClone Flow Engine</h2>
                    <p className="text-sm text-slate-400">{activeCount} active · {workflows.length} total · {executions.length} recent executions</p>
                </div>
                <div className="flex gap-2">
                    {workflows.length === 0 && (
                        <button onClick={seedDefaults} disabled={seeding}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded-xl text-sm transition-colors">
                            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            Add Defaults
                        </button>
                    )}
                    <button onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl font-semibold text-sm transition-colors">
                        <Plus className="w-4 h-4" /> New Workflow
                    </button>
                </div>
            </div>

            {/* Architecture info banner */}
            <div className="flex gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-300 space-y-1">
                    <p className="font-semibold">AlphaClone is your orchestration layer — no n8n/Zapier needed.</p>
                    <p className="text-blue-400">Every event (lead, SMS, form, ingestion) flows through this engine → conditions are evaluated → actions execute automatically.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-800/60 border border-slate-700 rounded-xl w-fit">
                {(['workflows', 'log'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${activeTab === tab ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                        {tab === 'workflows' ? `Workflows (${workflows.length})` : `Execution Log (${executions.length})`}
                    </button>
                ))}
            </div>

            {/* Create Form */}
            {showForm && (
                <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white">New Workflow</h3>
                        <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Name *</label>
                            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. High-Intent Lead Alert"
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Trigger *</label>
                            <select value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value as TriggerType }))}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500 text-sm">
                                {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Conditions */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Conditions (ALL must match)</label>
                            <button onClick={addCondition} className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Add Condition
                            </button>
                        </div>
                        {form.conditions.length === 0 && (
                            <p className="text-xs text-slate-600 italic">No conditions — workflow runs on every trigger event</p>
                        )}
                        {form.conditions.map((c, i) => (
                            <div key={i} className="flex gap-2 mb-2">
                                <input value={c.field} onChange={e => setForm(f => { const conds = [...f.conditions]; conds[i] = { ...conds[i], field: e.target.value }; return { ...f, conditions: conds }; })}
                                    placeholder="field (e.g. intent_label)"
                                    className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-teal-500" />
                                <select value={c.operator} onChange={e => setForm(f => { const conds = [...f.conditions]; conds[i] = { ...conds[i], operator: e.target.value as WorkflowCondition['operator'] }; return { ...f, conditions: conds }; })}
                                    className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-teal-500">
                                    {['equals','not_equals','contains','greater_than','less_than','exists'].map(op => <option key={op} value={op}>{op}</option>)}
                                </select>
                                <input value={String(c.value)} onChange={e => setForm(f => { const conds = [...f.conditions]; conds[i] = { ...conds[i], value: e.target.value }; return { ...f, conditions: conds }; })}
                                    placeholder="value"
                                    className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-teal-500" />
                                <button onClick={() => setForm(f => ({ ...f, conditions: f.conditions.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions *</label>
                            <button onClick={addAction} className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Add Action
                            </button>
                        </div>
                        {form.actions.map((a, i) => (
                            <div key={i} className="flex gap-2 mb-2">
                                <select value={a.type} onChange={e => setForm(f => { const acts = [...f.actions]; acts[i] = { ...acts[i], type: e.target.value as ActionType }; return { ...f, actions: acts }; })}
                                    className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-teal-500">
                                    {Object.entries(ACTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                                <input
                                    value={JSON.stringify(a.config)}
                                    onChange={e => { try { const cfg = JSON.parse(e.target.value); setForm(f => { const acts = [...f.actions]; acts[i] = { ...acts[i], config: cfg }; return { ...f, actions: acts }; }); } catch { } }}
                                    placeholder='{"message":"{{contact_name}} signed up"}'
                                    className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-teal-500" />
                                <button onClick={() => setForm(f => ({ ...f, actions: f.actions.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
                            </div>
                        ))}
                        <p className="text-xs text-slate-600 mt-1">Use <code className="text-teal-400">{'{{field_name}}'}</code> to insert event data into messages</p>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white rounded-xl font-semibold text-sm">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            {saving ? 'Saving...' : 'Create Workflow'}
                        </button>
                        <button onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-sm">Cancel</button>
                    </div>
                </div>
            )}

            {/* WORKFLOWS TAB */}
            {activeTab === 'workflows' && (
                <div className="space-y-3">
                    {workflows.length === 0 ? (
                        <div className="text-center py-16 border border-dashed border-slate-700 rounded-2xl">
                            <Zap className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-400 font-semibold">No workflows yet</p>
                            <p className="text-slate-600 text-sm mt-1 mb-4">Start with our default templates or create your own.</p>
                            <button onClick={seedDefaults} disabled={seeding}
                                className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-sm font-semibold">
                                Load Default Workflows
                            </button>
                        </div>
                    ) : workflows.map(wf => (
                        <div key={wf.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                            <div className="flex items-center gap-3 p-4">
                                <button onClick={() => handleToggle(wf)} className="flex-shrink-0">
                                    {wf.is_active
                                        ? <ToggleRight className="w-8 h-8 text-teal-400" />
                                        : <ToggleLeft className="w-8 h-8 text-slate-600" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-white text-sm">{wf.name}</p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${wf.is_active ? 'bg-teal-500/15 text-teal-400 border-teal-500/30' : 'bg-slate-700/50 text-slate-500 border-slate-700'}`}>
                                            {wf.is_active ? 'Active' : 'Paused'}
                                        </span>
                                    </div>
                                    <div className="flex gap-3 mt-1">
                                        <span className="text-xs text-slate-500">Trigger: <span className="text-slate-400">{TRIGGER_LABELS[wf.trigger_type]}</span></span>
                                        <span className="text-xs text-slate-500">Runs: <span className="text-slate-400">{wf.run_count}</span></span>
                                        {wf.last_run_at && <span className="text-xs text-slate-600">Last: {new Date(wf.last_run_at).toLocaleDateString()}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <button onClick={() => handleTestRun(wf)} title="Test Run"
                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-colors">
                                        <Play className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => setExpandedId(expandedId === wf.id ? null : wf.id)}
                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
                                        {expandedId === wf.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </button>
                                    <button onClick={() => handleDelete(wf.id)}
                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                            {expandedId === wf.id && (
                                <div className="border-t border-slate-800 p-4 bg-slate-950/40 space-y-3">
                                    {wf.description && <p className="text-sm text-slate-400">{wf.description}</p>}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Conditions</p>
                                            {wf.conditions.length === 0
                                                ? <p className="text-xs text-slate-600 italic">Always runs</p>
                                                : wf.conditions.map((c, i) => (
                                                    <div key={i} className="text-xs text-slate-300 font-mono bg-slate-800/50 px-3 py-1.5 rounded-lg mb-1">
                                                        {c.field} <span className="text-slate-500">{c.operator}</span> <span className="text-teal-400">"{String(c.value)}"</span>
                                                    </div>
                                                ))}
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Actions</p>
                                            {wf.actions.map((a, i) => (
                                                <div key={i} className="text-xs bg-slate-800/50 px-3 py-1.5 rounded-lg mb-1">
                                                    <span className="text-amber-400 font-semibold">{ACTION_LABELS[a.type] || a.type}</span>
                                                    <span className="text-slate-500 ml-2">{JSON.stringify(a.config).slice(0, 80)}</span>
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
                        <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-white">
                            <RefreshCw className="w-3 h-3" /> Refresh
                        </button>
                    </div>
                    {executions.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-slate-700 rounded-2xl">
                            <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                            <p className="text-slate-500 text-sm">No executions yet. Activate a workflow and trigger an event.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-800 min-w-0">
                            <table className="w-full min-w-[560px] text-sm">
                                <thead>
                                    <tr className="border-b border-slate-800 bg-slate-900/50">
                                        {['Workflow', 'Status', 'Actions', 'Duration', 'Time'].map(h => (
                                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {executions.map(ex => (
                                        <tr key={ex.id} className="hover:bg-slate-800/30">
                                            <td className="px-4 py-3 text-slate-300 text-xs font-medium">{ex.workflow_definitions?.name || '—'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                                    ex.status === 'success' ? 'bg-green-500/15 text-green-400 border-green-500/30'
                                                    : ex.status === 'failed' ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                                    : ex.status === 'skipped' ? 'bg-slate-700/50 text-slate-500 border-slate-700'
                                                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'}`}>
                                                    {ex.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-400">{(ex.actions_taken as { type: string }[])?.map(a => a.type).join(', ') || '—'}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{ex.duration_ms != null ? `${ex.duration_ms}ms` : '—'}</td>
                                            <td className="px-4 py-3 text-xs text-slate-600">{new Date(ex.created_at).toLocaleString()}</td>
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
