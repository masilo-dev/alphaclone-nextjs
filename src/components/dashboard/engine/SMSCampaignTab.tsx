'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    MessageSquare, Plus, Play, Pause, Send, Users, CheckCircle2, XCircle,
    Clock, Loader2, X, Trash2, RefreshCw, Phone, BarChart3, AlertTriangle, Edit2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';

interface SMSCampaign {
    id: string;
    name: string;
    message_body: string;
    from_number: string | null;
    status: string;
    recipient_source: string;
    recipients_total: number;
    sent_count: number;
    delivered_count: number;
    failed_count: number;
    scheduled_at: string | null;
    completed_at: string | null;
    created_at: string;
}

interface SMSMessage {
    id: string;
    to_number: string;
    body: string;
    status: string;
    twilio_sid: string | null;
    sent_at: string | null;
    created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
    draft:     'bg-slate-700/50 text-slate-400 border-slate-700',
    scheduled: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    running:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
    completed: 'bg-green-500/15 text-green-400 border-green-500/30',
    failed:    'bg-red-500/15 text-red-400 border-red-500/30',
    paused:    'bg-slate-600/30 text-slate-400 border-slate-600',
};

const EMPTY_FORM = {
    name: '',
    message_body: '',
    from_number: '',
    recipient_source: 'leads',
    manual_numbers: '',
    scheduled_at: '',
};

export default function SMSCampaignTab() {
    const { currentTenant: tenant } = useTenant();
    const [campaigns, setCampaigns] = useState<SMSCampaign[]>([]);
    const [messages, setMessages] = useState<SMSMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [runningId, setRunningId] = useState<string | null>(null);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'campaigns' | 'messages' | 'quick'>('campaigns');

    // Quick SMS state
    const [quickTo, setQuickTo] = useState('');
    const [quickMsg, setQuickMsg] = useState('');
    const [sending, setSending] = useState(false);

    const twilioConfigured = !!process.env.NEXT_PUBLIC_TWILIO_CONFIGURED;

    const loadData = useCallback(async () => {
        if (!tenant?.id) return;
        setLoading(true);
        const [campRes, msgRes] = await Promise.all([
            supabase.from('sms_campaigns').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
            supabase.from('sms_messages').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(100),
        ]);
        if (!campRes.error) setCampaigns(campRes.data || []);
        if (!msgRes.error) setMessages(msgRes.data || []);
        setLoading(false);
    }, [tenant?.id]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleCreate = async () => {
        if (!tenant?.id || !form.name || !form.message_body) return toast.error('Name and message required');
        setSaving(true);

        const recipient_filter = form.recipient_source === 'manual'
            ? { numbers: form.manual_numbers.split('\n').map(n => n.trim()).filter(Boolean) }
            : {};

        const res = await fetch('/api/sms/campaign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenantId: tenant.id,
                name: form.name,
                message_body: form.message_body,
                from_number: form.from_number || undefined,
                recipient_source: form.recipient_source,
                recipient_filter,
                scheduled_at: form.scheduled_at || undefined,
            }),
        });
        const data = await res.json();
        if (data.campaign) {
            toast.success('Campaign created');
            setShowForm(false);
            setForm({ ...EMPTY_FORM });
            loadData();
        } else {
            toast.error(data.error || 'Failed');
        }
        setSaving(false);
    };

    const handleRun = async (campaignId: string) => {
        if (!confirm('Send this SMS campaign now? This will send real SMS messages.')) return;
        setRunningId(campaignId);
        const toastId = toast.loading('Running campaign...');
        const res = await fetch(`/api/sms/campaign/${campaignId}/run`, { method: 'POST' });
        const result = await res.json();
        if (result.success) {
            toast.success(`Campaign complete: ${result.sent} sent, ${result.failed} failed`, { id: toastId });
        } else {
            toast.error(result.error || 'Failed', { id: toastId });
        }
        setRunningId(null);
        loadData();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this campaign?')) return;
        await supabase.from('sms_campaigns').delete().eq('id', id);
        setCampaigns(prev => prev.filter(c => c.id !== id));
        toast.success('Deleted');
    };

    const handleQuickSend = async () => {
        if (!quickTo || !quickMsg) return toast.error('Phone and message required');
        setSending(true);
        const toastId = toast.loading('Sending SMS...');
        const res = await fetch('/api/sms/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: quickTo, message: quickMsg, tenantId: tenant?.id }),
        });
        const data = await res.json();
        if (data.success) {
            toast.success(`Sent! SID: ${data.sid}`, { id: toastId });
            setQuickTo('');
            setQuickMsg('');
            loadData();
        } else {
            toast.error(data.error || 'Failed to send', { id: toastId });
        }
        setSending(false);
    };

    const campaignMessages = selectedCampaignId
        ? messages.filter(m => m.status !== undefined)
        : messages;

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
        </div>
    );

    const totalSent = campaigns.reduce((s, c) => s + (c.sent_count || 0), 0);
    const totalFailed = campaigns.reduce((s, c) => s + (c.failed_count || 0), 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">SMS Campaigns</h2>
                    <p className="text-sm text-slate-400">Powered by Twilio · {campaigns.length} campaigns · {totalSent} messages sent</p>
                </div>
                <button onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl font-semibold text-sm">
                    <Plus className="w-4 h-4" /> New Campaign
                </button>
            </div>

            {/* Twilio setup notice */}
            <div className="flex gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-300 space-y-1">
                    <p className="font-semibold">Required env vars to enable SMS:</p>
                    <code className="text-amber-400">TWILIO_ACCOUNT_SID · TWILIO_AUTH_TOKEN · TWILIO_PHONE_NUMBER</code>
                    <p className="text-amber-500">Get these from <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="underline">console.twilio.com</a></p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Campaigns', value: campaigns.length, color: 'text-white' },
                    { label: 'Total Sent', value: totalSent, color: 'text-teal-400' },
                    { label: 'Failed', value: totalFailed, color: 'text-red-400' },
                    { label: 'Messages Log', value: messages.length, color: 'text-blue-400' },
                ].map(s => (
                    <div key={s.label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-center">
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-800/60 border border-slate-700 rounded-xl w-fit">
                {(['campaigns', 'messages', 'quick'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${activeTab === tab ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                        {tab === 'quick' ? 'Quick Send' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Create Campaign Form */}
            {showForm && (
                <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white">New SMS Campaign</h3>
                        <button onClick={() => setShowForm(false)} aria-label="Close form" className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Campaign Name *</label>
                            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Summer Promo 2025"
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Recipients</label>
                            <select value={form.recipient_source} onChange={e => setForm(f => ({ ...f, recipient_source: e.target.value }))}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500 text-sm">
                                <option value="leads">All Leads (with phone)</option>
                                <option value="clients">All Clients (with phone)</option>
                                <option value="manual">Manual Numbers</option>
                            </select>
                        </div>
                    </div>

                    {form.recipient_source === 'manual' && (
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Phone Numbers (one per line)</label>
                            <textarea value={form.manual_numbers} onChange={e => setForm(f => ({ ...f, manual_numbers: e.target.value }))}
                                rows={4} placeholder="+12125550100&#10;+447700900461&#10;+34612345678"
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm font-mono resize-none" />
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Message *</label>
                        <textarea value={form.message_body} onChange={e => setForm(f => ({ ...f, message_body: e.target.value }))}
                            rows={4} placeholder="Write your SMS message here. Keep it under 160 chars for a single SMS."
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm resize-none" />
                        <div className="flex justify-between mt-1">
                            <p className="text-xs text-slate-600">Keep under 160 chars for 1 SMS segment</p>
                            <p className={`text-xs font-medium ${form.message_body.length > 160 ? 'text-amber-400' : 'text-slate-500'}`}>
                                {form.message_body.length} chars · {Math.ceil(form.message_body.length / 160)} segment{Math.ceil(form.message_body.length / 160) !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">From Number (optional)</label>
                            <input value={form.from_number} onChange={e => setForm(f => ({ ...f, from_number: e.target.value }))}
                                placeholder="Uses TWILIO_PHONE_NUMBER if empty"
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Schedule (optional)</label>
                            <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500 text-sm" />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={handleCreate} disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white rounded-xl font-semibold text-sm">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            {saving ? 'Creating...' : 'Create Campaign'}
                        </button>
                        <button onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-sm">Cancel</button>
                    </div>
                </div>
            )}

            {/* CAMPAIGNS TAB */}
            {activeTab === 'campaigns' && (
                <div className="space-y-3">
                    {campaigns.length === 0 ? (
                        <div className="text-center py-16 border border-dashed border-slate-700 rounded-2xl">
                            <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-400 font-semibold">No campaigns yet</p>
                            <p className="text-slate-600 text-sm mt-1">Create your first SMS campaign to reach leads and clients.</p>
                        </div>
                    ) : campaigns.map(campaign => (
                        <div key={campaign.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-white">{campaign.name}</p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[campaign.status] || STATUS_STYLE.draft}`}>
                                            {campaign.status}
                                        </span>
                                        <span className="text-xs text-slate-500 capitalize">{campaign.recipient_source}</span>
                                    </div>
                                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">{campaign.message_body}</p>

                                    {campaign.recipients_total > 0 && (
                                        <div className="flex gap-4 mt-3">
                                            <div className="text-center">
                                                <p className="text-sm font-bold text-white">{campaign.recipients_total}</p>
                                                <p className="text-xs text-slate-500">Total</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-bold text-teal-400">{campaign.sent_count}</p>
                                                <p className="text-xs text-slate-500">Sent</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-bold text-red-400">{campaign.failed_count}</p>
                                                <p className="text-xs text-slate-500">Failed</p>
                                            </div>
                                            {campaign.recipients_total > 0 && (
                                                <div className="flex-1 flex items-center">
                                                    <div className="w-full bg-slate-700 rounded-full h-1.5">
                                                        <div
                                                            className="bg-teal-500 h-1.5 rounded-full transition-all"
                                                            style={{ width: `${Math.round((campaign.sent_count / campaign.recipients_total) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-slate-500 ml-2 whitespace-nowrap">
                                                        {Math.round((campaign.sent_count / campaign.recipients_total) * 100)}%
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {campaign.scheduled_at && campaign.status === 'scheduled' && (
                                        <p className="text-xs text-blue-400 mt-2 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Scheduled: {new Date(campaign.scheduled_at).toLocaleString()}
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {['draft', 'scheduled'].includes(campaign.status) && (
                                        <button onClick={() => handleRun(campaign.id)} disabled={runningId === campaign.id}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-400 rounded-lg text-xs font-semibold transition-colors">
                                            {runningId === campaign.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                                            {runningId === campaign.id ? 'Running...' : 'Run Now'}
                                        </button>
                                    )}
                                    <button onClick={() => handleDelete(campaign.id)}
                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MESSAGES LOG TAB */}
            {activeTab === 'messages' && (
                <div className="space-y-2">
                    <div className="flex justify-end">
                        <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-white">
                            <RefreshCw className="w-3 h-3" /> Refresh
                        </button>
                    </div>
                    {messages.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-slate-700 rounded-2xl">
                            <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                            <p className="text-slate-500 text-sm">No messages yet</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-800">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-800 bg-slate-900/50">
                                        {['To', 'Message', 'Status', 'SID', 'Sent'].map(h => (
                                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {messages.map(msg => (
                                        <tr key={msg.id} className="hover:bg-slate-800/30">
                                            <td className="px-4 py-3 text-slate-300 text-xs font-mono">{msg.to_number}</td>
                                            <td className="px-4 py-3 text-slate-400 text-xs max-w-[200px] truncate">{msg.body}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                                    msg.status === 'sent' || msg.status === 'delivered' ? 'bg-green-500/15 text-green-400 border-green-500/30'
                                                    : msg.status === 'failed' ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                                    : 'bg-slate-700/50 text-slate-400 border-slate-700'}`}>
                                                    {msg.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-600 font-mono">{msg.twilio_sid?.slice(-8) || '—'}</td>
                                            <td className="px-4 py-3 text-xs text-slate-600">{msg.sent_at ? new Date(msg.sent_at).toLocaleString() : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* QUICK SEND TAB */}
            {activeTab === 'quick' && (
                <div className="max-w-lg space-y-4">
                    <p className="text-sm text-slate-400">Send a one-off SMS to any phone number immediately.</p>
                    <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">To Number</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input value={quickTo} onChange={e => setQuickTo(e.target.value)}
                                placeholder="+12125550100"
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm font-mono" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Message</label>
                        <textarea value={quickMsg} onChange={e => setQuickMsg(e.target.value)}
                            rows={4} placeholder="Type your message..."
                            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm resize-none" />
                        <p className="text-xs text-right text-slate-600 mt-1">{quickMsg.length} chars</p>
                    </div>
                    <button onClick={handleQuickSend} disabled={sending}
                        className="flex items-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors">
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {sending ? 'Sending...' : 'Send SMS'}
                    </button>
                </div>
            )}
        </div>
    );
}
