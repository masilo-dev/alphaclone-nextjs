'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Mail, Send, Clock, Users, Eye, Plus, Trash2, Play, Pause,
    ChevronDown, ChevronUp, Sparkles, Tag, FileText, CheckCircle2, Loader2, Upload, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { emailCampaignService, EmailCampaign, EmailTemplate, MarketingContact } from '../../../services/emailCampaignService';
import { tenantService } from '../../../services/tenancy/TenantService';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { showActionNextSteps } from '@/components/common/showActionNextSteps';
import { ModuleIntelligenceCard } from '../ModuleIntelligenceCard';

type ProviderHealth = {
    connected: boolean;
    status: string;
    issues: string[];
};

const statusColors: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    sending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    sent: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    paused: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const PERSONALIZATION_BUTTONS = [
    { label: 'First name', tag: '{{firstName}}' },
    { label: 'Last name', tag: '{{lastName}}' },
    { label: 'Full name', tag: '{{name}}' },
    { label: 'Email', tag: '{{email}}' },
    { label: 'Company', tag: '{{company}}' },
    { label: 'Your name', tag: '{{fromName}}' },
];

const CampaignBuilder: React.FC<{ userId: string }> = ({ userId }) => {
    const router = useRouter();
    const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [contacts, setContacts] = useState<MarketingContact[]>([]);
    const [contactSearch, setContactSearch] = useState('');
    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
    const [sending, setSending] = useState<string | null>(null);
    const [activeStep, setActiveStep] = useState(1);
    const [aiGenerating, setAiGenerating] = useState(false);
    const [providerHealth, setProviderHealth] = useState<Record<string, ProviderHealth>>({});
    const [isImportingRecipients, setIsImportingRecipients] = useState(false);
    const [recipientType, setRecipientType] = useState<'all' | 'specific' | 'few' | 'import' | null>(null);

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

    const filteredContacts = contacts.filter(c => 
        c.name.toLowerCase().includes(contactSearch.toLowerCase()) || 
        c.email.toLowerCase().includes(contactSearch.toLowerCase())
    );

    const toggleContact = (id: string) => {
        setSelectedContactIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleImportRecipients = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsImportingRecipients(true);
        toast.loading('Importing contacts...', { id: 'import' });
        
        try {
            // Simplified import logic for now
            const reader = new FileReader();
            reader.onload = async (event) => {
                const text = event.target?.result as string;
                const rows = text.split('\n').filter(Boolean).slice(1); // Skip header
                const emails = rows.map(r => r.split(',')[0].trim()).filter(Boolean);
                
                // In a real app, you'd upload this or process it via API
                // For now, we'll just show a success message
                toast.success(`Found ${emails.length} contacts. Selection logic pending integration.`, { id: 'import' });
            };
            reader.readAsText(file);
        } catch {
            toast.error('Import failed', { id: 'import' });
        } finally {
            setIsImportingRecipients(false);
        }
    };

    useEffect(() => {
        loadData();
        loadProviderHealth();
    }, []);

    const loadSenderProfile = async () => {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) return;
        try {
            const response = await fetch(`/api/email/sender-profile?tenantId=${encodeURIComponent(tenantId)}`);
            const data = await response.json();
            if (!response.ok || !data?.profile) return;
            setForm((prev) => ({
                ...prev,
                fromName: prev.fromName || data.profile.fromName || 'AlphaClone Systems',
                fromEmail: prev.fromEmail || data.profile.fromEmail || '',
            }));
        } catch { /* Ignore */ }
    };

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
        await loadSenderProfile();
        setLoading(false);
    };

    const loadProviderHealth = async () => {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) return;
        try {
            const response = await fetch(`/api/integrations/status?tenantId=${encodeURIComponent(tenantId)}`);
            const data = await response.json().catch(() => ({}));
            if (!response.ok) return;
            const next: Record<string, ProviderHealth> = {};
            (data.integrations || []).forEach((integration: any) => {
                const key = String(integration.type || '').toLowerCase();
                if (!key) return;
                next[key] = {
                    connected: Boolean(integration.connected),
                    status: String(integration.status || ''),
                    issues: Array.isArray(integration.issues) ? integration.issues.map(String) : [],
                };
            });
            setProviderHealth(next);
        } catch { /* Ignore */ }
    };

    const handleCreate = async () => {
        if (!form.name || !form.subject || !form.bodyHtml) {
            toast.error('Campaign name, subject, and message are required');
            return;
        }
        const toastId = toast.loading('Creating campaign...');
        const tenantId = tenantService.getCurrentTenantId() || '';
        
        const { campaign, error } = await emailCampaignService.createCampaign(userId, {
            name: form.name,
            subject: form.subject,
            fromName: form.fromName,
            fromEmail: form.fromEmail || 'notifications@alphaclonesystems.com',
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
            let finalRecipientIds = selectedContactIds;
            if (recipientType === 'all') {
                finalRecipientIds = contacts.map(c => c.id);
            }

            const recipientsResult = await emailCampaignService.addRecipientsToCampaign(campaign.id, finalRecipientIds, {
                skipPreviouslyContacted: form.skipPreviouslyContacted,
            });
            
            if (recipientsResult.error) {
                toast.error(recipientsResult.error, { id: toastId });
                return;
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
            toast.success('Campaign saved as draft.', { id: toastId });
        }

        setActiveStep(1);
        setRecipientType(null);
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
                    prompt: `Write a professional email campaign body for the subject: "${form.subject}". Use {{firstName}} to personalize and include {{fromName}} in the sign-off. Return ONLY the email body in plain text.`,
                    systemPrompt: 'You are an expert email marketer.',
                })
            });
            const data = await response.json();
            if (response.ok && data.text) {
                setForm(f => ({ ...f, bodyHtml: data.text }));
                toast.success('AI generated your message!');
            }
        } catch {
            toast.error('AI generation failed. Try writing it manually.');
        } finally {
            setAiGenerating(false);
        }
    };

    if (loading) return (
        <div className="flex items-center gap-2 text-slate-400 p-8">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading campaigns...</span>
        </div>
    );

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col bg-[#0f0f0f] rounded-3xl border border-white/5 overflow-hidden backdrop-blur-sm relative">
            {/* Top Navigation */}
            <div className="h-16 border-b border-white/5 bg-[#141414] px-6 flex items-center justify-between shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-600/20">
                        <Mail size={18} className="text-white" />
                    </div>
                    <h1 className="text-sm font-black tracking-widest text-white uppercase">Marketing campaigns</h1>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold border border-white/10 transition-all">
                        View all
                    </button>
                    <button 
                        onClick={() => { setActiveStep(1); setRecipientType(null); }}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-teal-900/20 transition-all flex items-center gap-2"
                    >
                        <Plus size={14} /> New campaign
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Sidebar: History */}
                <div className="w-64 flex flex-col bg-[#0a0a0a] border-r border-white/5 overflow-y-auto custom-scrollbar shrink-0">
                    <div className="p-4 space-y-4">
                        <div className="px-3 py-2 border border-dashed border-white/10 rounded-2xl text-center mb-4 opacity-50">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">+ New campaign</span>
                        </div>
                        
                        {campaigns.map(campaign => (
                            <button 
                                key={campaign.id}
                                className="w-full text-left p-4 rounded-2xl bg-[#141414] border border-white/5 hover:border-white/10 transition-all group"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${statusColors[campaign.status]}`}>
                                        {campaign.status}
                                    </span>
                                </div>
                                <h4 className="text-xs font-bold text-white truncate mb-1">{campaign.name}</h4>
                                <p className="text-[10px] text-gray-500 font-medium">
                                    {campaign.status === 'sent' 
                                        ? `${campaign.totalSent || 0} sent — ${new Date(campaign.sentAt || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                                        : campaign.status === 'scheduled'
                                            ? `${new Date(campaign.scheduledAt || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${new Date(campaign.scheduledAt || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                            : `${campaign.totalRecipients || 0} recipients selected`
                                    }
                                </p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content: Step Wizard */}
                <div className="flex-1 flex flex-col bg-white overflow-y-auto custom-scrollbar p-8 relative">
                    <div className="max-w-3xl mx-auto w-full space-y-12 pb-32">
                        {/* Progress Bar */}
                        <div className="flex items-center justify-center gap-4">
                            {[
                                { step: 1, label: 'Write your message' },
                                { step: 2, label: 'Choose who gets it' },
                                { step: 3, label: 'Send or schedule' }
                            ].map((s, idx) => (
                                <React.Fragment key={s.step}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all ${activeStep === s.step ? 'bg-teal-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}>
                                            {s.step}
                                        </div>
                                        <span className={`text-xs font-bold uppercase tracking-widest ${activeStep === s.step ? 'text-teal-600' : 'text-gray-400'}`}>
                                            {s.label}
                                        </span>
                                    </div>
                                    {idx < 2 && <div className="w-12 h-px bg-gray-200" />}
                                </React.Fragment>
                            ))}
                        </div>

                        <AnimatePresence mode="wait">
                            {activeStep === 1 && (
                                <motion.div 
                                    key="step1"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-8"
                                >
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Campaign name</label>
                                                <span className="text-[9px] text-gray-300 font-medium italic">Just for you — recipients won't see this</span>
                                            </div>
                                            <input 
                                                value={form.name}
                                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                                placeholder="e.g. March product update"
                                                className="w-full h-14 bg-[#1a1a1a] border border-white/5 rounded-2xl px-6 text-sm text-white placeholder-gray-600 focus:border-teal-500/50 outline-none transition-all shadow-inner"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email subject line</label>
                                                <span className="text-[9px] text-gray-300 font-medium italic">What people see in their inbox</span>
                                            </div>
                                            <input 
                                                value={form.subject}
                                                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                                                placeholder="e.g. Something big is coming..."
                                                className="w-full h-14 bg-[#1a1a1a] border border-white/5 rounded-2xl px-6 text-sm text-white placeholder-gray-600 focus:border-teal-500/50 outline-none transition-all shadow-inner"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex flex-col">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Make it personal</label>
                                            <p className="text-[10px] text-gray-400 font-medium mb-4">Click a button to insert the recipient's details into your message</p>
                                        </div>
                                        <div className="grid grid-cols-4 gap-3">
                                            {PERSONALIZATION_BUTTONS.map(btn => (
                                                <button 
                                                    key={btn.tag}
                                                    onClick={() => insertVariable(btn.tag)}
                                                    className="h-12 bg-white border border-gray-100 rounded-2xl flex items-center gap-2 px-4 text-xs font-bold text-gray-400 hover:border-teal-500 hover:text-teal-600 transition-all shadow-sm"
                                                >
                                                    <Plus size={12} />
                                                    {btn.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Your message</label>
                                                <p className="text-[10px] text-gray-400 font-medium">Write it yourself or let AI draft it for you</p>
                                            </div>
                                            <button 
                                                onClick={generateWithAI}
                                                disabled={aiGenerating}
                                                className="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-teal-900/20 disabled:opacity-50 transition-all flex items-center gap-2"
                                            >
                                                {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                                {aiGenerating ? 'Generating...' : 'Let AI write this for me'}
                                            </button>
                                        </div>
                                        <textarea 
                                            value={form.bodyHtml}
                                            onChange={e => setForm(f => ({ ...f, bodyHtml: e.target.value }))}
                                            placeholder="Write your message here. Use the buttons above to personalise it for each recipient automatically..."
                                            className="w-full bg-[#1a1a1a] border border-white/5 rounded-[2rem] p-8 text-sm text-white min-h-[300px] outline-none focus:border-teal-500/50 transition-all resize-none shadow-inner leading-relaxed"
                                        />
                                    </div>

                                    <div className="flex justify-end pt-8">
                                        <button 
                                            onClick={() => setActiveStep(2)}
                                            disabled={!form.name || !form.subject || !form.bodyHtml}
                                            className="px-8 py-4 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-teal-900/20 disabled:opacity-50 transition-all"
                                        >
                                            Next: Choose recipients
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {activeStep === 2 && (
                                <motion.div 
                                    key="step2"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-8"
                                >
                                    <div className="text-center space-y-2">
                                        <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Who receives this?</h2>
                                        <p className="text-sm text-gray-400 font-medium">Choose exactly who you want to reach with this campaign</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            { id: 'all', title: 'Everyone', desc: 'Send to all contacts in your workspace', icon: Users },
                                            { id: 'specific', title: 'A specific group', desc: 'Choose a segment or category', icon: Tag },
                                            { id: 'few', title: 'Just a few people', desc: 'Select individual contacts manually', icon: Send },
                                            { id: 'import', title: 'Import a list', desc: 'Upload a CSV or XLSX file', icon: Upload }
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setRecipientType(opt.id as any)}
                                                className={`p-6 rounded-3xl border-2 text-left transition-all ${recipientType === opt.id ? 'bg-teal-50 border-teal-600 shadow-lg shadow-teal-900/5' : 'bg-white border-gray-100 hover:border-teal-200'}`}
                                            >
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${recipientType === opt.id ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                    <opt.icon size={24} />
                                                </div>
                                                <h4 className="font-black text-gray-800 uppercase tracking-wider mb-1">{opt.title}</h4>
                                                <p className="text-xs text-gray-500 font-medium">{opt.desc}</p>
                                            </button>
                                        ))}
                                    </div>

                                    {recipientType === 'few' && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                            <div className="relative">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                <input
                                                    value={contactSearch}
                                                    onChange={(e) => setContactSearch(e.target.value)}
                                                    placeholder="Search recipients by name or email"
                                                    className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 text-sm text-gray-800 outline-none focus:border-teal-500/50 transition-all"
                                                />
                                            </div>
                                            <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-3xl divide-y divide-gray-50 custom-scrollbar">
                                                {filteredContacts.map((contact) => (
                                                    <label key={contact.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedContactIds.includes(contact.id)}
                                                            onChange={() => toggleContact(contact.id)}
                                                            className="w-5 h-5 rounded-lg border-gray-300 text-teal-600 focus:ring-teal-500"
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-gray-800">{contact.name}</p>
                                                            <p className="text-xs text-gray-400 font-medium">{contact.email}</p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {recipientType === 'import' && (
                                        <div className="p-12 border-2 border-dashed border-gray-200 rounded-[2.5rem] text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
                                                <Upload size={32} />
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="font-black text-gray-800 uppercase tracking-wider">Upload your list</h4>
                                                <p className="text-xs text-gray-400 font-medium">Supports CSV and XLSX formats</p>
                                            </div>
                                            <button 
                                                onClick={() => document.getElementById('file-upload')?.click()}
                                                disabled={isImportingRecipients}
                                                className="px-6 py-3 bg-gray-800 hover:bg-black text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                                            >
                                                {isImportingRecipients ? 'Importing...' : 'Select File'}
                                            </button>
                                            <input id="file-upload" type="file" accept=".csv,.xlsx" onChange={handleImportRecipients} className="hidden" />
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-8">
                                        <button 
                                            onClick={() => setActiveStep(1)}
                                            className="px-8 py-4 text-gray-400 hover:text-gray-600 font-black uppercase tracking-widest text-xs transition-all"
                                        >
                                            Back
                                        </button>
                                        <button 
                                            onClick={() => setActiveStep(3)}
                                            disabled={!recipientType || (recipientType === 'few' && selectedContactIds.length === 0)}
                                            className="px-8 py-4 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-teal-900/20 disabled:opacity-50 transition-all"
                                        >
                                            Next: Final Review
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {activeStep === 3 && (
                                <motion.div 
                                    key="step3"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-8"
                                >
                                    <div className="text-center space-y-2">
                                        <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Almost ready!</h2>
                                        <p className="text-sm text-gray-400 font-medium">Double check everything before hitting send</p>
                                    </div>

                                    <div className="bg-gray-50 rounded-[2.5rem] p-8 space-y-6">
                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Campaign</span>
                                                <p className="text-sm font-bold text-gray-800">{form.name}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recipients</span>
                                                <p className="text-sm font-bold text-gray-800">
                                                    {recipientType === 'all' ? 'All contacts' : `${selectedContactIds.length} selected recipients`}
                                                </p>
                                            </div>
                                            <div className="space-y-1 col-span-2">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Subject line</span>
                                                <p className="text-sm font-bold text-gray-800">{form.subject}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">When should we send this?</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button 
                                                onClick={() => setForm(f => ({ ...f, scheduleEnabled: false, sendImmediately: true }))}
                                                className={`p-6 rounded-3xl border-2 text-left transition-all ${!form.scheduleEnabled ? 'bg-teal-50 border-teal-600 shadow-lg shadow-teal-900/5' : 'bg-white border-gray-100 hover:border-teal-200'}`}
                                            >
                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-4 ${!form.scheduleEnabled ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                    <Send size={20} />
                                                </div>
                                                <h4 className="font-black text-gray-800 uppercase tracking-wider mb-1">Right now</h4>
                                                <p className="text-[10px] text-gray-500 font-medium">Send to everyone immediately</p>
                                            </button>
                                            <button 
                                                onClick={() => setForm(f => ({ ...f, scheduleEnabled: true, sendImmediately: false }))}
                                                className={`p-6 rounded-3xl border-2 text-left transition-all ${form.scheduleEnabled ? 'bg-teal-50 border-teal-600 shadow-lg shadow-teal-900/5' : 'bg-white border-gray-100 hover:border-teal-200'}`}
                                            >
                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-4 ${form.scheduleEnabled ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                    <Clock size={20} />
                                                </div>
                                                <h4 className="font-black text-gray-800 uppercase tracking-wider mb-1">Schedule for later</h4>
                                                <p className="text-[10px] text-gray-500 font-medium">Pick a specific date and time</p>
                                            </button>
                                        </div>

                                        {form.scheduleEnabled && (
                                            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                                                <input 
                                                    type="datetime-local" 
                                                    value={form.scheduledAt}
                                                    onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                                                    className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl px-6 text-sm text-gray-800 focus:border-teal-500/50 outline-none"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between pt-8">
                                        <button 
                                            onClick={() => setActiveStep(2)}
                                            className="px-8 py-4 text-gray-400 hover:text-gray-600 font-black uppercase tracking-widest text-xs transition-all"
                                        >
                                            Back
                                        </button>
                                        <button 
                                            onClick={handleCreate}
                                            disabled={sending === 'new' || (form.scheduleEnabled && !form.scheduledAt)}
                                            className="px-12 py-5 bg-gray-800 hover:bg-black text-white rounded-3xl font-black uppercase tracking-[0.2em] text-sm shadow-2xl transition-all disabled:opacity-50"
                                        >
                                            {form.scheduleEnabled ? 'Schedule Campaign' : 'Launch Campaign'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Fixed Footer Actions (Mocked for premium feel) */}
                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-white/80 backdrop-blur-md border-t border-gray-100 px-12 flex items-center justify-between z-20">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Draft saved automatically</span>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={handleCreate}
                                className="px-6 py-3 bg-white border border-gray-100 hover:border-gray-200 text-gray-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                            >
                                Save draft
                            </button>
                            <button 
                                onClick={() => { setActiveStep(3); setForm(f => ({ ...f, scheduleEnabled: true })); }}
                                className="px-6 py-3 bg-white border border-gray-100 hover:border-gray-200 text-gray-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                            >
                                Schedule send
                            </button>
                            <button 
                                onClick={handleCreate}
                                className="px-8 py-3 bg-gray-800 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg"
                            >
                                Send now
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CampaignBuilder;
