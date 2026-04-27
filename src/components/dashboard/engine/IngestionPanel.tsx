'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Database, Plus, RefreshCw, Loader2, X, Send, TrendingUp,
    AlertTriangle, CheckCircle2, Clock, Filter, Zap, ExternalLink,
    MessageSquare, Globe, Facebook, FileText, Sparkles
} from 'lucide-react';
import AIOutreachModal from '../business/AIOutreachModal';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';

interface IngestionEvent {
    id: string;
    source: string;
    raw_content: string;
    author_name: string | null;
    author_contact: string | null;
    intent_score: number;
    intent_label: string;
    keywords_found: string[];
    processed: boolean;
    lead_id: string | null;
    workflow_triggered: boolean;
    created_at: string;
}

const INTENT_STYLE: Record<string, string> = {
    unknown:  'bg-slate-700/50 text-slate-400 border-slate-700',
    low:      'bg-slate-600/30 text-slate-400 border-slate-600',
    medium:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
    high:     'bg-amber-500/15 text-amber-400 border-amber-500/30',
    urgent:   'bg-red-500/15 text-red-400 border-red-500/30',
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {
    facebook_group: <Facebook className="w-3.5 h-3.5 text-blue-400" />,
    facebook_lead:  <Facebook className="w-3.5 h-3.5 text-blue-400" />,
    manual:         <FileText className="w-3.5 h-3.5 text-slate-400" />,
    form:           <MessageSquare className="w-3.5 h-3.5 text-teal-400" />,
    sms:            <MessageSquare className="w-3.5 h-3.5 text-green-400" />,
    webhook:        <Globe className="w-3.5 h-3.5 text-purple-400" />,
};

const EMPTY_FORM = {
    source: 'manual',
    raw_content: '',
    author_name: '',
    author_contact: '',
    url: '',
};

export default function IngestionPanel() {
    const { currentTenant: tenant } = useTenant();
    const [events, setEvents] = useState<IngestionEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [submitting, setSubmitting] = useState(false);
    const [intentFilter, setIntentFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
    const [showOutreachModal, setShowOutreachModal] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string>('');

    const loadEvents = useCallback(async () => {
        if (!tenant?.id) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('ingestion_events')
            .select('*')
            .eq('tenant_id', tenant.id)
            .order('created_at', { ascending: false })
            .limit(100);
        if (!error) setEvents(data || []);
        setLoading(false);
    }, [tenant]);

    useEffect(() => { 
        loadEvents(); 
        const fetchUser = async () => {
            const { data } = await supabase.auth.getUser();
            if (data?.user) setCurrentUserId(data.user.id);
        };
        fetchUser();
    }, [loadEvents]);

    const handleSubmit = async () => {
        if (!form.raw_content.trim()) return toast.error('Content is required');
        if (!tenant?.id) return;
        setSubmitting(true);
        const toastId = toast.loading('Processing...');

        const res = await fetch('/api/engine/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenant_id: tenant.id,
                source: form.source,
                raw_content: form.raw_content,
                author_name: form.author_name || undefined,
                author_contact: form.author_contact || undefined,
                url: form.url || undefined,
            }),
        });
        const data = await res.json();

        if (data.success) {
            toast.success(
                `${data.intent.label.toUpperCase()} intent (${data.intent.score}/100)${data.lead_id ? ' — Lead created' : ''}`,
                { id: toastId, duration: 4000 }
            );
            setForm({ ...EMPTY_FORM });
            setShowForm(false);
            loadEvents();
        } else {
            toast.error(data.error || 'Failed', { id: toastId });
        }
        setSubmitting(false);
    };

    const filtered = events.filter(e => {
        if (intentFilter !== 'all' && e.intent_label !== intentFilter) return false;
        if (sourceFilter !== 'all' && e.source !== sourceFilter) return false;
        return true;
    });

    const sources = [...new Set(events.map(e => e.source))];
    const highCount = events.filter(e => ['high','urgent'].includes(e.intent_label)).length;
    const leadsCreated = events.filter(e => e.lead_id).length;

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Lead Ingestion</h2>
                    <p className="text-sm text-slate-400">Capture raw content → auto-detect intent → create leads</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={loadEvents} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-400 hover:text-white transition-colors">
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                    <button onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl font-semibold text-sm transition-colors">
                        <Plus className="w-4 h-4" /> Ingest Content
                    </button>
                    {selectedLeadIds.length > 0 && (
                        <button onClick={() => setShowOutreachModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-teal-500/20">
                            <Sparkles className="w-4 h-4" /> Outreach ({selectedLeadIds.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Architecture note */}
            <div className="flex gap-3 p-4 bg-teal-500/10 border border-teal-500/20 rounded-xl">
                <Zap className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-teal-300 space-y-1">
                    <p className="font-semibold">Ingestion Engine → Processing Engine → Workflow Engine</p>
                    <p className="text-teal-400">Paste any content (Facebook group post, chat message, ad comment). The engine detects keywords, scores intent 0–100, auto-creates a lead for HIGH/URGENT signals, and fires your active workflows.</p>
                    <p className="text-teal-500">API endpoint: <code className="text-teal-400">POST /api/engine/ingest</code> · Use webhooks for automated ingestion from any source.</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total Events', value: events.length, color: 'text-white' },
                    { label: 'High/Urgent', value: highCount, color: 'text-amber-400' },
                    { label: 'Leads Created', value: leadsCreated, color: 'text-teal-400' },
                    { label: 'Sources', value: sources.length, color: 'text-blue-400' },
                ].map(s => (
                    <div key={s.label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-center">
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Manual ingestion form */}
            {showForm && (
                <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white">Ingest Content</h3>
                        <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Source</label>
                            <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500 text-sm">
                                <option value="manual">Manual</option>
                                <option value="facebook_group">Facebook Group</option>
                                <option value="facebook_lead">Facebook Lead</option>
                                <option value="form">Contact Form</option>
                                <option value="sms">SMS</option>
                                <option value="webhook">Webhook</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Author / Name</label>
                            <input value={form.author_name} onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))}
                                placeholder="John Doe"
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Contact (email/phone)</label>
                            <input value={form.author_contact} onChange={e => setForm(f => ({ ...f, author_contact: e.target.value }))}
                                placeholder="john@example.com"
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm" />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Content *</label>
                        <textarea value={form.raw_content} onChange={e => setForm(f => ({ ...f, raw_content: e.target.value }))}
                            rows={5}
                            placeholder="Paste content here — Facebook post, message, comment, ad response, etc.&#10;&#10;Example: 'Hi, I'm looking for a web developer urgently. Need a website for my restaurant. Budget $2000. DM me.'"
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm resize-none font-mono" />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Source URL (optional)</label>
                        <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                            placeholder="https://facebook.com/groups/..."
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm" />
                    </div>

                    <div className="flex gap-3">
                        <button onClick={handleSubmit} disabled={submitting}
                            className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors">
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            {submitting ? 'Processing...' : 'Process & Ingest'}
                        </button>
                        <button onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-sm">Cancel</button>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <select value={intentFilter} onChange={e => setIntentFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500">
                    <option value="all">All Intents</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="unknown">Unknown</option>
                </select>
                <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500">
                    <option value="all">All Sources</option>
                    {sources.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {(intentFilter !== 'all' || sourceFilter !== 'all') && (
                    <button onClick={() => { setIntentFilter('all'); setSourceFilter('all'); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 hover:bg-red-500/20">
                        <X className="w-3 h-3" /> Clear
                    </button>
                )}
            </div>

            {/* Events list */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-slate-700 rounded-2xl">
                    <Database className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 font-semibold">No ingestion events yet</p>
                    <p className="text-slate-600 text-sm mt-1 mb-4">Click "Ingest Content" to manually capture a lead, or send data to <code className="text-teal-400">/api/engine/ingest</code></p>
                    <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-sm font-semibold">
                        Ingest First Content
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(event => (
                        <div key={event.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <div className="flex-shrink-0 mt-0.5 flex flex-col gap-3">
                                        {SOURCE_ICONS[event.source] || <Globe className="w-3.5 h-3.5 text-slate-500" />}
                                        {event.lead_id && (
                                                    <div 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const leadId = event.lead_id;
                                                            if (!leadId) return;
                                                            setSelectedLeadIds(prev => 
                                                                prev.includes(leadId) 
                                                                    ? prev.filter(id => id !== leadId) 
                                                                    : [...prev, leadId].slice(0, 20)
                                                            );
                                                        }}
                                                        className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-all ${event.lead_id && selectedLeadIds.includes(event.lead_id) ? 'bg-teal-500 border-teal-500' : 'border-slate-700 hover:border-slate-500'}`}
                                                    >
                                                        {event.lead_id && selectedLeadIds.includes(event.lead_id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                                    </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <span className="text-xs text-slate-500 capitalize">{event.source.replace('_', ' ')}</span>
                                            {event.author_name && <span className="text-xs font-medium text-slate-300">{event.author_name}</span>}
                                            {event.author_contact && <span className="text-xs text-slate-500">{event.author_contact}</span>}
                                        </div>
                                        <p className="text-sm text-slate-300 line-clamp-2">{event.raw_content}</p>
                                        {event.keywords_found?.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {event.keywords_found.slice(0, 5).map(kw => (
                                                    <span key={kw} className="text-xs px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-500">{kw}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                    <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${INTENT_STYLE[event.intent_label] || INTENT_STYLE.unknown}`}>
                                        {event.intent_label} · {event.intent_score}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {event.lead_id && (
                                            <span className="text-xs px-2 py-0.5 bg-teal-500/10 border border-teal-500/20 rounded text-teal-400 flex items-center gap-1">
                                                <CheckCircle2 className="w-2.5 h-2.5" /> Lead
                                            </span>
                                        )}
                                        <span className="text-xs text-slate-600">{new Date(event.created_at).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <AIOutreachModal
                isOpen={showOutreachModal}
                onClose={() => setShowOutreachModal(false)}
                userId={currentUserId}
                initialSelectedLeads={selectedLeadIds}
            />
        </div>
    );
}
