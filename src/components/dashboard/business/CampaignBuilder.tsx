'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Mail, Send, Clock, Users, Eye, Plus, Trash2, Play, Pause,
    ChevronDown, ChevronUp, Sparkles, Tag, FileText, CheckCircle2, Loader2
} from 'lucide-react';
import { emailCampaignService, EmailCampaign, EmailTemplate, MarketingContact } from '../../../services/emailCampaignService';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { showActionNextSteps } from '@/components/common/showActionNextSteps';

const statusColors: Record<string, string> = {
    draft: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    sending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    sent: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    paused: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const VARIABLE_TAGS = ['{{name}}', '{{firstName}}', '{{lastName}}', '{{email}}', '{{company}}', '{{fromName}}'];
const DELIVERY_PROVIDER_OPTIONS = [
    { id: 'sendgrid', label: 'SendGrid' },
    { id: 'resend', label: 'Resend' },
    { id: 'brevo', label: 'Brevo' },
    { id: 'zoho', label: 'Zoho Mail' },
    { id: 'gmail', label: 'Gmail' },
] as const;

const CampaignBuilder: React.FC<{ userId: string }> = ({ userId }) => {
    const router = useRouter();
    const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [contacts, setContacts] = useState<MarketingContact[]>([]);
    const [contactSearch, setContactSearch] = useState('');
    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
    const [sending, setSending] = useState<string | null>(null);
    const [view, setView] = useState<'list' | 'create'>('list');
    const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
    const [aiGenerating, setAiGenerating] = useState(false);

    // New Campaign Form
    const [form, setForm] = useState({
        name: '',
        subject: '',
        bodyHtml: '',
        fromName: 'AlphaClone Systems',
        fromEmail: '',
        scheduledAt: '',
        scheduleEnabled: false,
        skipPreviouslyContacted: true,
        selectedProviders: ['sendgrid', 'resend'] as string[],
        balanceByDailyLimit: true,
        sendImmediately: false,
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const [campsResult, tempsResult, contactsResult] = await Promise.all([
            emailCampaignService.getCampaigns(),
            emailCampaignService.getTemplates(),
            emailCampaignService.getMarketingContacts(),
        ]);
        if (!campsResult.error) setCampaigns(campsResult.campaigns);
        if (!tempsResult.error) setTemplates(tempsResult.templates);
        if (!contactsResult.error) setContacts(contactsResult.contacts);
        setLoading(false);
    };

    const handleCreate = async () => {
        if (!form.name || !form.subject || !form.bodyHtml) {
            toast.error('Campaign name, subject, and body are required');
            return;
        }
        const toastId = toast.loading('Creating campaign...');
        const { campaign, error } = await emailCampaignService.createCampaign(userId, {
            name: form.name,
            subject: form.subject,
            fromName: form.fromName,
            fromEmail: form.fromEmail || 'notifications@alphaclone.tech',
            scheduledAt: form.scheduleEnabled && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
            segmentFilter: {},
            metadata: {
                bodyHtml: form.bodyHtml,
                deliverySettings: {
                    selectedProviders: form.selectedProviders,
                    balanceByDailyLimit: form.balanceByDailyLimit,
                },
            },
        });
        if (error) { toast.error(error, { id: toastId }); return; }

        if (campaign) {
            const recipientsResult = await emailCampaignService.addRecipientsToCampaign(campaign.id, selectedContactIds, {
                skipPreviouslyContacted: form.skipPreviouslyContacted,
            });
            if (recipientsResult.error) {
                toast.error(recipientsResult.error, { id: toastId });
                return;
            }
            if (recipientsResult.added === 0) {
                toast.error('No recipients were added. Select contacts with valid emails.', { id: toastId });
                return;
            }
            if (recipientsResult.skipped > 0) {
                toast.success(`Campaign created. ${recipientsResult.added} recipients added, ${recipientsResult.skipped} skipped (already contacted or duplicate).`, { id: toastId });
            }
        }

        if (campaign && form.sendImmediately) {
            const sendResult = await emailCampaignService.sendCampaign(campaign.id);
            if (!sendResult.success) {
                toast.error(sendResult.error || 'Campaign was created but sending failed', { id: toastId });
            } else {
                toast.success('Campaign created and sent.', { id: toastId });
            }
        } else {
            toast.success('Campaign created for selected contacts.', { id: toastId });
        }
        showActionNextSteps('campaign_created', (path) => router.push(path));
        setView('list');
        setSelectedContactIds([]);
        setForm({
            name: '',
            subject: '',
            bodyHtml: '',
            fromName: 'AlphaClone Systems',
            fromEmail: '',
            scheduledAt: '',
            scheduleEnabled: false,
            skipPreviouslyContacted: true,
            selectedProviders: ['sendgrid', 'resend'],
            balanceByDailyLimit: true,
            sendImmediately: false,
        });
        loadData();
    };

    const filteredContacts = contacts.filter((c) => {
        const needle = contactSearch.trim().toLowerCase();
        if (!needle) return true;
        return (
            c.name.toLowerCase().includes(needle) ||
            c.email.toLowerCase().includes(needle) ||
            String(c.company || '').toLowerCase().includes(needle)
        );
    });

    const toggleContact = (contactId: string) => {
        setSelectedContactIds((prev) =>
            prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
        );
    };

    const toggleProvider = (providerId: string) => {
        setForm((prev) => {
            const exists = prev.selectedProviders.includes(providerId);
            const selectedProviders = exists
                ? prev.selectedProviders.filter((id) => id !== providerId)
                : [...prev.selectedProviders, providerId];
            return {
                ...prev,
                selectedProviders: selectedProviders.length > 0 ? selectedProviders : [providerId],
            };
        });
    };

    const handleSend = async (campaignId: string) => {
        if (!confirm('Send this campaign now?')) return;
        setSending(campaignId);
        const toastId = toast.loading('Sending campaign...');
        const { success, error } = await emailCampaignService.sendCampaign(campaignId);
        if (success) {
            toast.success('Campaign sent!', { id: toastId });
            showActionNextSteps('campaign_sent', (path) => router.push(path));
        } else toast.error(error || 'Failed to send', { id: toastId });
        setSending(null);
        loadData();
    };

    const handleDelete = async (campaignId: string) => {
        if (!confirm('Delete this campaign?')) return;
        await emailCampaignService.deleteCampaign(campaignId);
        loadData();
    };

    const insertVariable = (tag: string) => {
        setForm(f => ({ ...f, bodyHtml: f.bodyHtml + ' ' + tag }));
    };

    const generateWithAI = async () => {
        if (!form.subject) { toast.error('Enter a subject first'); return; }
        setAiGenerating(true);
        try {
            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Write a professional email campaign body for the subject: "${form.subject}". Use {{name}} or {{firstName}} to personalize each recipient and include {{fromName}} in the sign-off. Return only the email body in HTML format with paragraph tags.`,
                    systemPrompt: 'You are an expert email marketer. Write compelling, professional campaign emails.',
                })
            });
            const data = await response.json();
            if (response.ok && data.text) {
                setForm(f => ({ ...f, bodyHtml: data.text }));
                toast.success('AI generated campaign body!');
            } else {
                const fallbackBody = `<p>Hello {{firstName}},</p><p>We are reaching out with a focused business update that can help improve your current results.</p><p>If you are open to a short conversation, reply to this message and we will share a practical next step tailored to your priorities.</p><p>Best regards,<br/>{{fromName}}</p>`;
                setForm((f) => ({ ...f, bodyHtml: fallbackBody }));
                toast.success('Draft prepared. You can edit and send.');
            }
        } catch {
            const fallbackBody = `<p>Hello {{firstName}},</p><p>We are reaching out with a focused business update that can help improve your current results.</p><p>If you are open to a short conversation, reply to this message and we will share a practical next step tailored to your priorities.</p><p>Best regards,<br/>{{fromName}}</p>`;
            setForm((f) => ({ ...f, bodyHtml: fallbackBody }));
            toast.success('Draft prepared. You can edit and send.');
        } finally {
            setAiGenerating(false);
        }
    };

    if (loading) return (
        <div className="flex items-center gap-2 text-slate-400 p-4 sm:p-8 min-w-0">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading campaigns...</span>
        </div>
    );

    return (
        <div className="space-y-6 min-w-0">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
                <div className="min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-white">Email Campaigns</h3>
                    <p className="text-sm text-slate-400">Plan and schedule personalized bulk email campaigns</p>
                </div>
                <button
                    onClick={() => setView(view === 'create' ? 'list' : 'create')}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-semibold transition-all text-sm shadow-lg shadow-teal-900/20 w-full sm:w-auto shrink-0"
                >
                    {view === 'create' ? 'Back to List' : <><Plus className="w-4 h-4" /> New Campaign</>}
                </button>
            </div>

            {/* Create Form */}
            {view === 'create' && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-5">
                    <h4 className="font-bold text-white flex items-center gap-2">
                        <Mail className="w-5 h-5 text-teal-400" /> Campaign Details
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Campaign Name</label>
                            <input
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. March Product Update"
                                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">From Name</label>
                            <input
                                value={form.fromName}
                                onChange={e => setForm(f => ({ ...f, fromName: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Email Subject</label>
                        <input
                            value={form.subject}
                            onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                            placeholder="e.g. Hey {{firstName}}, we have something for you!"
                            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
                        />
                        <p className="text-xs text-slate-500 mt-1">Tip: Use <code className="text-teal-400">{'{{firstName}}'}</code> to personalize for each recipient</p>
                    </div>

                    {/* Personalization Tags */}
                    <div>
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                            <Tag className="w-3 h-3" /> Insert Variable
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {VARIABLE_TAGS.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => insertVariable(tag)}
                                    className="px-3 py-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/20 rounded-lg text-xs font-mono transition-all"
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Body */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Message</label>
                            <button
                                onClick={generateWithAI}
                                disabled={aiGenerating}
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-lg transition-all"
                            >
                                {aiGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                {aiGenerating ? 'Generating...' : 'AI Write'}
                            </button>
                        </div>
                        <textarea
                            value={form.bodyHtml}
                            onChange={e => setForm(f => ({ ...f, bodyHtml: e.target.value }))}
                            rows={10}
                            placeholder="Write your campaign message here. Personalization variables can be inserted above."
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
                        />
                    </div>

                    {/* Recipients */}
                    <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-xl space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <Users className="w-3 h-3" /> Bulk Recipients
                            </label>
                            <span className="text-xs text-slate-500">{selectedContactIds.length} selected</span>
                        </div>
                        <input
                            value={contactSearch}
                            onChange={(e) => setContactSearch(e.target.value)}
                            placeholder="Search by name or email"
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
                        />
                        <div className="max-h-52 overflow-y-auto border border-slate-700 rounded-lg divide-y divide-slate-800">
                            {filteredContacts.map((contact) => (
                                <label key={contact.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-800/70 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedContactIds.includes(contact.id)}
                                        onChange={() => toggleContact(contact.id)}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500"
                                    />
                                    <div className="min-w-0">
                                        <p className="text-white truncate">{contact.name}</p>
                                        <p className="text-xs text-slate-400 truncate">{contact.email}</p>
                                    </div>
                                </label>
                            ))}
                            {filteredContacts.length === 0 && (
                                <div className="px-3 py-4 text-sm text-slate-500 text-center">No contacts match your search.</div>
                            )}
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                                type="checkbox"
                                checked={form.skipPreviouslyContacted}
                                onChange={(e) => setForm((f) => ({ ...f, skipPreviouslyContacted: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500"
                            />
                            Do not send again to contacts who already received campaign emails
                        </label>
                    </div>

                    <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-xl space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Delivery Providers
                            </label>
                            <span className="text-xs text-slate-500">{form.selectedProviders.length} selected</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {DELIVERY_PROVIDER_OPTIONS.map((provider) => (
                                <label key={provider.id} className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg border border-slate-700 text-xs text-slate-200 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.selectedProviders.includes(provider.id)}
                                        onChange={() => toggleProvider(provider.id)}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500"
                                    />
                                    {provider.label}
                                </label>
                            ))}
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                                type="checkbox"
                                checked={form.balanceByDailyLimit}
                                onChange={(e) => setForm((f) => ({ ...f, balanceByDailyLimit: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500"
                            />
                            Balance sends across providers based on daily limits
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                                type="checkbox"
                                checked={form.sendImmediately}
                                onChange={(e) => setForm((f) => ({ ...f, sendImmediately: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500"
                            />
                            Send immediately after campaign creation
                        </label>
                    </div>

                    {/* Schedule */}
                    <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-blue-400" />
                                <span className="font-semibold text-sm text-white">Schedule Send</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.scheduleEnabled}
                                    onChange={e => setForm(f => ({ ...f, scheduleEnabled: e.target.checked }))}
                                    className="sr-only peer"
                                />
                                <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-500"></div>
                            </label>
                        </div>
                        {form.scheduleEnabled && (
                            <input
                                type="datetime-local"
                                value={form.scheduledAt}
                                onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500 text-sm"
                            />
                        )}
                        {!form.scheduleEnabled && (
                            <p className="text-xs text-slate-500">Campaign will be saved as draft and can be sent manually.</p>
                        )}
                    </div>

                    <button
                        onClick={handleCreate}
                        className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-900/20"
                    >
                        <FileText className="w-4 h-4" />
                        Save Campaign
                    </button>
                </div>
            )}

            {/* Campaign List */}
            {view === 'list' && (
                <div className="space-y-3">
                    {campaigns.length === 0 && (
                        <div className="text-center py-16 text-slate-500">
                            <Mail className="w-12 h-12 mx-auto mb-4 opacity-30" />
                            <p className="font-semibold mb-1">No campaigns yet</p>
                            <p className="text-sm">Create your first campaign to get started.</p>
                        </div>
                    )}
                    {campaigns.map(campaign => (
                        <div key={campaign.id} className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
                            <div className="p-4 flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h4 className="font-bold text-white truncate">{campaign.name}</h4>
                                        <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold uppercase tracking-wide flex-shrink-0 ${statusColors[campaign.status]}`}>
                                            {campaign.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-400 truncate">{campaign.subject}</p>
                                    {campaign.scheduledAt && (
                                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Scheduled: {new Date(campaign.scheduledAt).toLocaleString()}
                                        </p>
                                    )}
                                </div>

                                {/* Stats */}
                                <div className="hidden md:flex items-center gap-4 text-xs text-slate-400">
                                    <div className="text-center">
                                        <p className="font-bold text-white text-sm">{campaign.totalSent || 0}</p>
                                        <p>Sent</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-white text-sm">{campaign.totalOpened || 0}</p>
                                        <p>Opened</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-white text-sm">{campaign.totalClicked || 0}</p>
                                        <p>Clicked</p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {campaign.status === 'draft' && (
                                        <button
                                            onClick={() => handleSend(campaign.id)}
                                            disabled={!!sending}
                                            className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
                                        >
                                            {sending === campaign.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                            Send Now
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setExpandedCampaign(expandedCampaign === campaign.id ? null : campaign.id)}
                                        className="p-2 hover:bg-slate-700 text-slate-400 rounded-lg transition-all"
                                    >
                                        {expandedCampaign === campaign.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                    {['draft', 'cancelled'].includes(campaign.status) && (
                                        <button
                                            onClick={() => handleDelete(campaign.id)}
                                            className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-lg transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Expanded Analytics */}
                            {expandedCampaign === campaign.id && (
                                <div className="border-t border-slate-700 px-4 py-4 bg-slate-900/30">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {[
                                            { label: 'Total Sent', value: campaign.totalSent || 0, color: 'text-blue-400' },
                                            { label: 'Delivered', value: campaign.totalDelivered || 0, color: 'text-teal-400' },
                                            { label: 'Opened', value: campaign.totalOpened || 0, color: 'text-purple-400' },
                                            { label: 'Clicked', value: campaign.totalClicked || 0, color: 'text-amber-400' },
                                        ].map(stat => (
                                            <div key={stat.label} className="text-center p-3 bg-slate-800 rounded-xl border border-slate-700">
                                                <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                                                <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {campaign.sentAt && (
                                        <p className="text-xs text-slate-500 mt-3 text-center">
                                            Sent on {new Date(campaign.sentAt).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CampaignBuilder;
