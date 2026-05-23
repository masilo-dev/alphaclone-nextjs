'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Mail, Send, Clock, Users, Eye, Plus, Trash2, Play, Pause,
    ChevronDown, ChevronUp, ChevronRight, Sparkles, Tag, FileText, CheckCircle2, Loader2, Upload, Search,
    History, X, ArrowLeft, Check, Database, Inbox, AlertCircle, Repeat, Layers, Languages
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { emailCampaignService, EmailCampaign, EmailTemplate, MarketingContact } from '../../../services/emailCampaignService';
import { tenantService } from '../../../services/tenancy/TenantService';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { CAMPAIGN_LANGUAGE_OPTIONS, getCampaignLanguageInstruction, type CampaignLanguageMode } from '@/lib/languageUtils';

const statusColors: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    scheduled: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    sending: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    sent: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    paused: 'bg-slate-600/10 text-slate-500 border-slate-600/20',
    cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

const PERSONALIZATION_BUTTONS = [
    { label: 'First name', tag: '{{firstName}}' },
    { label: 'Last name', tag: '{{lastName}}' },
    { label: 'Full name', tag: '{{name}}' },
    { label: 'Email', tag: '{{email}}' },
    { label: 'Company', tag: '{{company}}' },
    { label: 'Your name', tag: '{{fromName}}' },
];

const PRESET_TEMPLATES = [
    {
        id: 'newsletter',
        title: 'Monthly Product Newsletter',
        subject: '🚀 What we built for you this month',
        html: `<h2>Hey {{firstName}},</h2><p>Here is a quick look at what our product team delivered last month to speed up your operations...</p>`
    },
    {
        id: 'outreach',
        title: 'Lead Outreach Pitch',
        subject: 'Quick question about {{company}} growth',
        html: `<h2>Hello {{firstName}},</h2><p>I noticed {{company}} has been expanding lately. We help organizations scale their workspace automation...</p>`
    },
    {
        id: 'promo',
        title: 'Re-engagement Special',
        subject: '🎁 We want to welcome you back!',
        html: `<h2>Dear {{firstName}},</h2><p>We missed you! Here is a special 25% off coupon code to welcome you back into the family...</p>`
    },
    {
        id: 'plain',
        title: 'Plain Text Draft',
        subject: 'Quick follow up',
        html: `<p>Hi {{firstName}}, just following up on our previous conversation. Let me know when you are free to chat.</p>`
    }
];

const CampaignBuilder: React.FC<{ userId: string }> = ({ userId }) => {
    const router = useRouter();
    const { isMobile } = useBreakpoint();
    
    // View state: 'list' is main feed list, 'detail' is single detail view, 'compose' is wizard flow
    const [viewMode, setViewMode] = useState<'list' | 'detail' | 'compose'>('list');
    
    const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [contacts, setContacts] = useState<MarketingContact[]>([]);
    const [contactSearch, setContactSearch] = useState('');
    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
    const [activeStep, setActiveStep] = useState(1); // 1 to 4 compose flow
    const [aiGenerating, setAiGenerating] = useState(false);
    const [recipientType, setRecipientType] = useState<'all' | 'specific' | 'few' | 'import' | null>(null);

    // Selected single campaign for detail mode
    const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);

    // Form state
    const [form, setForm] = useState({
        name: '',
        subject: '',
        bodyHtml: '',
        fromName: 'AlphaClone Systems',
        fromEmail: '',
        scheduledAt: '',
        scheduleEnabled: false,
        skipPreviouslyContacted: true,
        selectedProviders: ['zoho'] as string[],
        balanceByDailyLimit: true,
        sendImmediately: false,
        languageMode: 'auto' as CampaignLanguageMode,
    });

    // Touch Swipe list tracking
    const [swipeState, setSwipeState] = useState<Record<string, number>>({});
    const [swipeActiveId, setSwipeActiveId] = useState<string | null>(null);
    const touchStartX = useRef<number>(0);

    const [pasteLeadsText, setPasteLeadsText] = useState('');
    const [importingLeads, setImportingLeads] = useState(false);
    
    // AI Copilot State
    const [showCopilot, setShowCopilot] = useState(false);
    const [copilotMessages, setCopilotMessages] = useState<Array<{ sender: 'user' | 'assistant', text: string, suggestion?: any }>>([
        { sender: 'assistant', text: 'Hi! I am your AI Campaign Copilot. Tell me who you want to target (e.g. "healthcare leads"), what you want to write, or paste your leads directly here. I will configure the entire campaign!' }
    ]);
    const [copilotInput, setCopilotInput] = useState('');
    const [copilotLoading, setCopilotLoading] = useState(false);
    
    // HTML visual vs code tab editor
    const [editorTab, setEditorTab] = useState<'preview' | 'code'>('preview');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        const [campsResult, contactsResult] = await Promise.all([
            emailCampaignService.getCampaigns(),
            emailCampaignService.getMarketingContacts(),
        ]);
        if (!campsResult.error) setCampaigns(campsResult.campaigns);
        if (!contactsResult.error) setContacts(contactsResult.contacts);
        setLoading(false);
    };

    const handleImportLeads = async () => {
        if (!pasteLeadsText.trim()) return;
        setImportingLeads(true);
        try {
            const currentTenantId = tenantService.getCurrentTenantId();
            if (!currentTenantId) {
                toast.error('No active tenant found');
                return;
            }

            const lines = pasteLeadsText.split('\n').map(l => l.trim()).filter(Boolean);
            const csvRows = ['name,email'];
            lines.forEach(line => {
                if (line.includes(',')) {
                    const parts = line.split(',');
                    const name = parts[0].trim();
                    const email = parts[1].trim();
                    csvRows.push(`"${name}","${email}"`);
                } else if (line.includes('<') && line.includes('>')) {
                    const name = line.substring(0, line.indexOf('<')).trim();
                    const email = line.substring(line.indexOf('<') + 1, line.indexOf('>')).trim();
                    csvRows.push(`"${name}","${email}"`);
                } else {
                    csvRows.push(`"${line}","${line}"`);
                }
            });

            const csvContent = csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const file = new File([blob], 'imported_leads.csv', { type: 'text/csv' });
            
            const fd = new FormData();
            fd.append('file', file);
            fd.append('tenantId', currentTenantId);

            const res = await fetch('/api/email/campaigns/import-recipients', {
                method: 'POST',
                body: fd,
            });

            const payload = await res.json();
            if (!res.ok) {
                throw new Error(payload.error || 'Failed to import recipients');
            }

            toast.success(`Successfully imported ${payload.imported} contacts!`);
            setPasteLeadsText('');
            
            const contactsResult = await emailCampaignService.getMarketingContacts();
            if (!contactsResult.error) {
                setContacts(contactsResult.contacts);
                if (payload.contacts && payload.contacts.length > 0) {
                    const newIds = payload.contacts.map((c: any) => c.id);
                    setSelectedContactIds(newIds);
                }
            }
        } catch (err: any) {
            toast.error(err.message || 'Import failed');
        } finally {
            setImportingLeads(false);
        }
    };

    const handleCopilotSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!copilotInput.trim()) return;
        
        const userMsg = copilotInput.trim();
        setCopilotMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
        setCopilotInput('');
        setCopilotLoading(true);
        
        setTimeout(async () => {
            const prompt = userMsg.toLowerCase();
            let name = "AI Generated Outreach";
            let subject = "Quick question for you";
            let html = `<h2>Hello {{firstName}},</h2><p>I noticed you are running operations in your sector and wanted to reach out. We help companies automate their workflows to save 15+ hours a week.</p><p>Would you be open to a brief 10-minute demo next week?</p><p>Best regards,<br/>The AlphaClone Team</p>`;
            let recipientTypeOption = 'all';
            let parsedLeads: string[] = [];

            if (prompt.includes('healthcare') || prompt.includes('medical') || prompt.includes('doctor')) {
                name = "Healthcare Automated Outreach";
                subject = "Improving patient workflow efficiency at your clinic";
                html = `<h2>Hello {{firstName}},</h2><p>Managing patient charts and follow-ups can easily drain hours from your day.</p><p>AlphaClone helps medical practice leaders automate patient onboarding and billing integrations securely.</p><p>Let me know if you have 10 minutes to discuss this next Tuesday.</p><p>Best regards,<br/>The AlphaClone Team</p>`;
                recipientTypeOption = 'specific';
            } else if (prompt.includes('tech') || prompt.includes('software') || prompt.includes('saas')) {
                name = "SaaS Re-engagement Campaign";
                subject = "Scaling developer operations automatically";
                html = `<h2>Hello {{firstName}},</h2><p>I saw your engineering team has been expanding. We help software companies automate CI/CD pipeline notifications and database backups into a single dashboard.</p><p>Are you open to a brief sync next week?</p><p>Best regards,<br/>The AlphaClone Team</p>`;
                recipientTypeOption = 'specific';
            } else if (prompt.includes('discount') || prompt.includes('price') || prompt.includes('sale') || prompt.includes('offer')) {
                name = "Special Re-engagement Offer";
                subject = "🎁 Special 25% discount on your AlphaClone workspace";
                html = `<h2>Hey {{firstName}},</h2><p>We want to thank you for being a part of our early community. Here is a limited-time 25% off coupon code for your subscription: <strong>ALPHAGROW25</strong></p><p>Claim it inside your billing settings today!</p><p>Best,<br/>AlphaClone Team</p>`;
            }

            const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
            const matches = userMsg.match(emailRegex);
            if (matches && matches.length > 0) {
                parsedLeads = matches;
                recipientTypeOption = 'import';
            }

            const suggestion = {
                name,
                subject,
                html,
                recipientType: recipientTypeOption,
                leads: parsedLeads
            };

            let aiText = `I have engineered a customized high-converting campaign template for you!\n\n📋 **Draft Details:**\n• **Name:** ${name}\n• **Subject:** ${subject}\n\n`;
            if (parsedLeads.length > 0) {
                aiText += `💡 **Leads Detected:** I found ${parsedLeads.length} email address(es) in your prompt and will configure the recipient type to 'Import'.`;
            } else {
                aiText += `💡 **Audience Target:** Configured to target '${recipientTypeOption === 'all' ? 'All Contacts' : 'Industry Segment'}'.`;
            }

            setCopilotMessages(prev => [...prev, {
                sender: 'assistant',
                text: aiText,
                suggestion
            }]);
            setCopilotLoading(false);
            
            toast.success('AI campaign configuration ready!', { icon: '🤖' });
        }, 1500);
    };

    const applyCopilotSuggestion = async (suggestion: any) => {
        setForm(f => ({
            ...f,
            name: suggestion.name,
            subject: suggestion.subject,
            bodyHtml: suggestion.html
        }));
        
        if (suggestion.recipientType) {
            setRecipientType(suggestion.recipientType);
            if (suggestion.recipientType === 'import' && suggestion.leads && suggestion.leads.length > 0) {
                setPasteLeadsText(suggestion.leads.join('\n'));
                toast.success('Applied configuration! Click "Process and Import Leads" in Step 2 to ingest.');
            } else {
                toast.success('Applied AI campaign configuration!');
            }
        }
    };

    const handleCreate = async () => {
        if (!form.name || !form.subject || !form.bodyHtml) {
            toast.error('Name, subject, and message are required');
            return;
        }
        if (form.languageMode === 'ask') {
            toast.error('Choose a campaign language before launch, or switch language to Auto.');
            return;
        }
        const toastId = toast.loading('Creating campaign...');
        const { campaign, error } = await emailCampaignService.createCampaign(userId, {
            name: form.name,
            subject: form.subject,
            fromName: form.fromName,
            fromEmail: form.fromEmail || 'notifications@alphaclonesystems.com',
            scheduledAt: form.scheduleEnabled && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
            metadata: { 
                bodyHtml: form.bodyHtml,
                provider: form.selectedProviders[0] || 'resend',
                languageMode: form.languageMode,
                languageInstruction: getCampaignLanguageInstruction({ languageMode: form.languageMode }),
                deliverySettings: {
                    selectedProviders: form.selectedProviders,
                    balanceByDailyLimit: form.balanceByDailyLimit,
                },
            },
        });

        if (error) { toast.error(error, { id: toastId }); return; }
        if (campaign) {
            let finalIds = selectedContactIds;
            if (recipientType === 'all') finalIds = contacts.map(c => c.id);
            await emailCampaignService.addRecipientsToCampaign(campaign.id, finalIds);
        }
        toast.success('Campaign launched / saved.', { id: toastId });
        setViewMode('list');
        setActiveStep(1);
        setRecipientType(null);
        setSelectedContactIds([]);
        loadData();
    };

    const insertVariable = (tag: string) => {
        setForm(f => ({ ...f, bodyHtml: f.bodyHtml + ' ' + tag }));
    };

    const generateWithAI = async () => {
        if (!form.subject) { toast.error('Enter a subject line first'); return; }
        setAiGenerating(true);
        try {
            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Write a high-converting HTML campaign email body about: "${form.subject}". ${getCampaignLanguageInstruction({ languageMode: form.languageMode })}`,
                })
            });
            const data = await response.json();
            if (data.text) setForm(f => ({ ...f, bodyHtml: data.text }));
        } catch {
            toast.error('AI writer generation failed');
        } finally {
            setAiGenerating(false);
        }
    };

    // Swipe handlers
    const handleTouchStart = (e: React.TouchEvent, id: string) => {
        touchStartX.current = e.touches[0].clientX;
        setSwipeActiveId(id);
    };

    const handleTouchMove = (e: React.TouchEvent, id: string) => {
        if (swipeActiveId !== id) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - touchStartX.current;
        const capped = Math.max(-80, Math.min(80, diff));
        setSwipeState(prev => ({ ...prev, [id]: capped }));
    };

    const handleTouchEnd = (e: React.TouchEvent, id: string) => {
        const finalOffset = swipeState[id] || 0;
        if (finalOffset > 45) {
            setSwipeState(prev => ({ ...prev, [id]: 60 }));
            handleDuplicateCampaign(campaigns.find(c => c.id === id)!);
            setTimeout(() => {
                setSwipeState(prev => ({ ...prev, [id]: 0 }));
            }, 800);
        } else if (finalOffset < -45) {
            setSwipeState(prev => ({ ...prev, [id]: -60 }));
            if (confirm('Delete this campaign?')) {
                handleDeleteCampaign(id);
            } else {
                setSwipeState(prev => ({ ...prev, [id]: 0 }));
            }
        } else {
            setSwipeState(prev => ({ ...prev, [id]: 0 }));
        }
        setSwipeActiveId(null);
    };

    const handleDeleteCampaign = async (id: string) => {
        const toastId = toast.loading('Deleting campaign...');
        try {
            await supabase.from('email_campaigns').delete().eq('id', id);
            toast.success('Campaign deleted', { id: toastId });
            setCampaigns(prev => prev.filter(c => c.id !== id));
        } catch {
            toast.error('Failed to delete campaign', { id: toastId });
        }
    };

    const handleDuplicateCampaign = (camp: EmailCampaign) => {
        setForm({
            name: `${camp.name} (Copy)`,
            subject: camp.subject,
            bodyHtml: (camp.metadata as any)?.bodyHtml || '',
            fromName: camp.fromName,
            fromEmail: camp.fromEmail,
            scheduledAt: '',
            scheduleEnabled: false,
            skipPreviouslyContacted: true,
            selectedProviders: [(camp.metadata as any)?.provider || 'resend'],
            balanceByDailyLimit: true,
            sendImmediately: false,
            languageMode: ((camp.metadata as any)?.languageMode || 'auto') as CampaignLanguageMode,
        });
        setViewMode('compose');
        setActiveStep(1);
        toast.success('Campaign details copied to composer');
    };

    const startNewCompose = () => {
        setForm({
            name: '',
            subject: '',
            bodyHtml: '',
            fromName: 'AlphaClone Systems',
            fromEmail: '',
            scheduledAt: '',
            scheduleEnabled: false,
            skipPreviouslyContacted: true,
            selectedProviders: ['resend'],
            balanceByDailyLimit: true,
            sendImmediately: false,
            languageMode: 'auto',
        });
        setRecipientType(null);
        setSelectedContactIds([]);
        setActiveStep(1);
        setViewMode('compose');
    };

    if (loading) return <div className="p-8 text-slate-400 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-500 mb-2" /> Loading Campaigns...</div>;

    return (
        <div className="flex flex-col bg-slate-950 rounded-2xl md:rounded-3xl border border-white/5 overflow-hidden backdrop-blur-sm relative min-h-[calc(100dvh-140px)]">
            
            {/* Header bar */}
            <div className="h-16 border-b border-white/5 bg-slate-900 px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    {viewMode !== 'list' ? (
                        <button 
                            onClick={() => setViewMode('list')}
                            className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    ) : (
                        <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center">
                            <Mail size={18} className="text-white" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-sm font-black tracking-widest text-white uppercase">Campaigns</h1>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Email outreach command</p>
                    </div>
                </div>
                {viewMode === 'list' && (
                    <button 
                        onClick={startNewCompose} 
                        className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                    >
                        New Campaign
                    </button>
                )}
                {viewMode === 'compose' && (
                    <button 
                        onClick={() => setShowCopilot(prev => !prev)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                            showCopilot ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-slate-900 text-slate-400 border border-white/5'
                        }`}
                    >
                        <Sparkles className="w-3.5 h-3.5" /> Copilot {showCopilot ? 'ON' : 'OFF'}
                    </button>
                )}
            </div>

            {/* Main view router */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-28">
                <AnimatePresence mode="wait">
                    
                    {/* 1. LIST VIEW */}
                    {viewMode === 'list' && (
                        <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                            {campaigns.length === 0 ? (
                                <div className="py-16 text-center border border-dashed border-white/5 rounded-2xl">
                                    <Inbox className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                                    <h3 className="text-sm font-bold text-slate-400">No campaigns launched</h3>
                                    <p className="text-xs text-slate-600 max-w-xs mx-auto mt-1">Ready to start email marketing? Craft your first outreach flow now.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5 border border-white/5 rounded-2xl bg-slate-900/30 overflow-hidden">
                                    {campaigns.map((camp) => {
                                        const offset = swipeState[camp.id] || 0;
                                        const provider = (camp.metadata as any)?.provider || 'resend';
                                        const sent = Number(camp.totalSent || 0);
                                        const opened = Number(camp.totalOpened || 0);
                                        const clicked = Number(camp.totalClicked || 0);
                                        const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
                                        const clickRate = sent > 0 ? Math.round((clicked / sent) * 100) : 0;
                                        
                                        return (
                                            <div 
                                                key={camp.id}
                                                className="relative select-none overflow-hidden bg-slate-950"
                                                onTouchStart={(e) => handleTouchStart(e, camp.id)}
                                                onTouchMove={(e) => handleTouchMove(e, camp.id)}
                                                onTouchEnd={(e) => handleTouchEnd(e, camp.id)}
                                            >
                                                {/* Swipe actions */}
                                                <div className="absolute inset-y-0 right-0 w-20 bg-rose-600 flex items-center justify-center text-white text-xs font-bold">
                                                    <Trash2 className="w-4 h-4" />
                                                </div>
                                                <div className="absolute inset-y-0 left-0 w-20 bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                                                    <Repeat className="w-4 h-4" />
                                                </div>

                                                {/* Camp list row */}
                                                <div 
                                                    onClick={() => {
                                                        setSelectedCampaign(camp);
                                                        setViewMode('detail');
                                                    }}
                                                    className="relative z-10 flex items-center justify-between p-3.5 bg-slate-900/70 active:bg-slate-800 transition-transform duration-150 cursor-pointer"
                                                    style={{ transform: `translateX(${offset}px)` }}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                                        {/* Avatar / provider badge */}
                                                        <div className="w-9 h-9 rounded-full bg-slate-950 border border-white/5 flex items-center justify-center text-slate-400 font-bold text-xs uppercase flex-shrink-0">
                                                            {provider.slice(0, 2)}
                                                        </div>
                                                        <div className="min-w-0 flex-1 flex flex-col">
                                                            <span className="text-[14px] text-white font-bold truncate">
                                                                {camp.name}
                                                            </span>
                                                            <span className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                                                                Subj: {camp.subject} • Opens: {openRate}% • Clicks: {clickRate}%
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2.5 ml-3 flex-shrink-0">
                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${statusColors[camp.status]}`}>
                                                            {camp.status}
                                                        </span>
                                                        <ChevronRight className="w-4 h-4 text-slate-600" />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* 2. DETAIL VIEW */}
                    {viewMode === 'detail' && selectedCampaign && (
                        <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                            
                            {/* Title & metadata panel */}
                            <div className="bg-slate-900/50 p-5 rounded-3xl border border-white/5 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${statusColors[selectedCampaign.status]}`}>
                                            {selectedCampaign.status}
                                        </span>
                                        <h2 className="text-lg font-black text-white mt-2 leading-tight">{selectedCampaign.name}</h2>
                                        <p className="text-xs text-slate-400 mt-1">Subject: "{selectedCampaign.subject}"</p>
                                    </div>
                                    <button 
                                        onClick={() => handleDuplicateCampaign(selectedCampaign)}
                                        className="p-2 bg-slate-950 border border-white/5 rounded-xl text-slate-400"
                                    >
                                        <Repeat className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* 2x2 Statistics dashboard */}
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: 'Recipients', value: selectedCampaign.totalRecipients || 0, rate: 'Audience size' },
                                    { label: 'Sent', value: selectedCampaign.totalSent || 0, rate: `${selectedCampaign.totalRecipients ? Math.round((selectedCampaign.totalSent / selectedCampaign.totalRecipients) * 100) : 0}% of segment` },
                                    { label: 'Opened', value: selectedCampaign.totalOpened || 0, rate: `${selectedCampaign.totalSent ? Math.round((selectedCampaign.totalOpened / selectedCampaign.totalSent) * 100) : 0}% open rate` },
                                    { label: 'Clicked', value: selectedCampaign.totalClicked || 0, rate: `${selectedCampaign.totalSent ? Math.round((selectedCampaign.totalClicked / selectedCampaign.totalSent) * 100) : 0}% click rate` }
                                ].map((stat, i) => (
                                    <div key={i} className="p-4 bg-slate-900 rounded-2xl border border-white/5 space-y-1">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{stat.label}</span>
                                        <div className="text-xl font-black text-white">{String(stat.value)}</div>
                                        <span className="text-[10px] text-teal-400 font-bold block">{stat.rate}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Timeline status steps */}
                            <div className="bg-slate-900 p-5 rounded-3xl border border-white/5 space-y-4">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Campaign Journey</h3>
                                <div className="relative pl-6 space-y-4 border-l border-white/10 ml-2">
                                    <div className="relative">
                                        <div className="absolute -left-[30px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 border border-slate-950 flex items-center justify-center text-[8px] text-white">✓</div>
                                        <h4 className="text-xs font-bold text-white">Campaign Created</h4>
                                        <p className="text-[10px] text-slate-500">Initialized by dashboard tenant</p>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute -left-[30px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 border border-slate-950 flex items-center justify-center text-[8px] text-white">✓</div>
                                        <h4 className="text-xs font-bold text-white">Recipients Segmented</h4>
                                        <p className="text-[10px] text-slate-500">Audience parsed and matching rules checked</p>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute -left-[30px] top-0.5 w-4 h-4 rounded-full bg-teal-500 border border-slate-950 animate-pulse" />
                                        <h4 className="text-xs font-bold text-teal-400">Queue Processing</h4>
                                        <p className="text-[10px] text-slate-500">Sending active via Resend API</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* 3. WIZARD COMPOSE FLOW */}
                    {viewMode === 'compose' && (
                        <motion.div key="compose" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 15 }} className="flex flex-col lg:flex-row gap-6 items-start w-full">
                            
                            {/* Main wizard step builder panel */}
                            <div className="flex-1 w-full space-y-6">
                                {/* Thin Progress bar indicator */}
                                <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-teal-500 transition-all duration-300"
                                        style={{ width: `${(activeStep / 4) * 100}%` }}
                                    />
                                </div>

                                <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                                    <span>Step {activeStep} of 4</span>
                                    <span>
                                        {activeStep === 1 ? 'Message & Provider' :
                                         activeStep === 2 ? 'Segment' :
                                         activeStep === 3 ? 'Templates & Preview' :
                                         'Review Summary'}
                                    </span>
                                </div>

                                {/* WIZARD STEPS */}
                                {activeStep === 1 && (
                                    <div className="space-y-5 animate-in fade-in duration-300">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Internal Name</label>
                                            <input 
                                                value={form.name} 
                                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                                placeholder="e.g. Q2 Outreach Campaign"
                                                className="w-full h-11 bg-slate-900 border border-white/5 rounded-xl px-4 text-xs text-white outline-none focus:border-teal-500/50"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Subject Line</label>
                                            <input 
                                                value={form.subject} 
                                                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                                                placeholder="e.g. Quick question about workspace optimization"
                                                className="w-full h-11 bg-slate-900 border border-white/5 rounded-xl px-4 text-xs text-white outline-none focus:border-teal-500/50"
                                            />
                                        </div>

                                        {/* Email Provider select cards */}
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Email Provider Service</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                {[
                                                    { id: 'resend', label: 'Resend.com' },
                                                    { id: 'sendgrid', label: 'SendGrid' },
                                                    { id: 'brevo', label: 'Brevo (Sendinblue)' },
                                                    { id: 'zoho', label: 'Zoho Mail Client' }
                                                ].map((provider) => {
                                                    const isSelected = form.selectedProviders.includes(provider.id);
                                                    return (
                                                        <button
                                                            key={provider.id}
                                                            type="button"
                                                            onClick={() => setForm(f => ({ ...f, selectedProviders: [provider.id] }))}
                                                            className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${isSelected ? 'bg-teal-500/10 border-teal-500 text-teal-400' : 'bg-slate-900 border-white/5 text-slate-400'}`}
                                                        >
                                                            <span className="text-xs font-bold uppercase">{provider.label}</span>
                                                            {isSelected && <Check className="w-4 h-4 text-teal-400" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Campaign Language</label>
                                            <div className="relative">
                                                <Languages className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                                <select
                                                    value={form.languageMode}
                                                    onChange={e => setForm(f => ({ ...f, languageMode: e.target.value as CampaignLanguageMode }))}
                                                    className="w-full h-11 bg-slate-900 border border-white/5 rounded-xl pl-9 pr-4 text-xs text-white outline-none focus:border-teal-500/50"
                                                >
                                                    {CAMPAIGN_LANGUAGE_OPTIONS.map(option => (
                                                        <option key={option.code} value={option.code}>{option.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeStep === 2 && (
                                    <div className="space-y-5 animate-in fade-in duration-300">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {[
                                                { id: 'all', title: 'Entire Database', icon: Database },
                                                { id: 'specific', title: 'Segment Filter', icon: Tag },
                                                { id: 'few', title: 'Manual Selection', icon: Users },
                                                { id: 'import', title: 'Paste / Import', icon: Upload }
                                            ].map(opt => (
                                                <button 
                                                    key={opt.id} 
                                                    onClick={() => setRecipientType(opt.id as any)} 
                                                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${recipientType === opt.id ? 'bg-teal-500/10 border-teal-600 text-teal-400' : 'bg-slate-900 border-white/5 text-slate-400'}`}
                                                >
                                                    <opt.icon className="w-5 h-5 mb-2" />
                                                    <span className="text-[10px] font-bold uppercase">{opt.title}</span>
                                                </button>
                                            ))}
                                        </div>

                                        {recipientType === 'specific' && (
                                            <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl space-y-3">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Select Industry Target</span>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {Array.from(new Set(contacts.map(c => c.industry).filter(Boolean))).map(industry => {
                                                        const isChecked = contacts.filter(c => c.industry === industry).every(c => selectedContactIds.includes(c.id));
                                                        return (
                                                            <button
                                                                key={industry}
                                                                onClick={() => {
                                                                    const ids = contacts.filter(c => c.industry === industry).map(c => c.id);
                                                                    setSelectedContactIds(prev => 
                                                                        isChecked ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))
                                                                    );
                                                                }}
                                                                className={`p-3 rounded-xl border text-left flex items-center justify-between text-xs ${isChecked ? 'bg-teal-500/10 border-teal-500 text-teal-400' : 'bg-slate-950 border-white/5 text-slate-400'}`}
                                                            >
                                                                <span>{industry}</span>
                                                                <Check className={`w-3.5 h-3.5 ${isChecked ? 'text-teal-400' : 'text-transparent'}`} />
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {recipientType === 'few' && (
                                            <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl space-y-3">
                                                <input 
                                                    value={contactSearch}
                                                    onChange={e => setContactSearch(e.target.value)}
                                                    placeholder="Search contacts name..."
                                                    className="w-full h-9 bg-slate-950 border border-white/5 rounded-lg px-3 text-xs text-white outline-none"
                                                />
                                                <div className="max-h-40 overflow-y-auto space-y-1">
                                                    {contacts.filter(c => !contactSearch || c.name?.toLowerCase().includes(contactSearch.toLowerCase())).map(c => (
                                                        <button
                                                            key={c.id}
                                                            onClick={() => setSelectedContactIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                                                            className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between text-xs ${selectedContactIds.includes(c.id) ? 'bg-teal-500/10 border-teal-500 text-teal-400' : 'bg-slate-950 border-white/5 text-slate-400'}`}
                                                        >
                                                            <span>{c.name || c.email}</span>
                                                            <Check className={`w-3.5 h-3.5 ${selectedContactIds.includes(c.id) ? 'text-teal-400' : 'text-transparent'}`} />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {recipientType === 'import' && (
                                            <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl space-y-4">
                                                <div className="flex flex-col space-y-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paste Leads List</span>
                                                    <p className="text-[10px] text-slate-500">Paste names and emails (e.g. "John Doe, john@example.com" or just "john@example.com" on separate lines).</p>
                                                </div>
                                                <textarea
                                                    value={pasteLeadsText}
                                                    onChange={e => setPasteLeadsText(e.target.value)}
                                                    placeholder="John Doe, john@example.com&#10;Mary Smith, mary@example.com&#10;sales@clientcompany.com"
                                                    className="w-full h-32 bg-slate-950 border border-white/5 rounded-xl p-3 text-xs text-white outline-none resize-none font-mono"
                                                />
                                                <button
                                                    onClick={handleImportLeads}
                                                    disabled={importingLeads || !pasteLeadsText.trim()}
                                                    className="w-full py-2.5 bg-teal-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-teal-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                                                >
                                                    {importingLeads ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                                    Process and Import Leads
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeStep === 3 && (
                                    <div className="space-y-5 animate-in fade-in duration-300">
                                        <div className="grid grid-cols-2 gap-3">
                                            {PRESET_TEMPLATES.map((tmpl) => (
                                                <button
                                                    key={tmpl.id}
                                                    onClick={() => {
                                                        setForm(f => ({ ...f, bodyHtml: tmpl.html }));
                                                        toast.success(`${tmpl.title} loaded`);
                                                    }}
                                                    className="p-4 bg-slate-900 border border-white/5 rounded-2xl text-left hover:border-teal-500 transition-all flex flex-col justify-between"
                                                >
                                                    <div>
                                                        <h4 className="text-xs font-bold text-white mb-1">{tmpl.title}</h4>
                                                        <p className="text-[10px] text-slate-500 line-clamp-2">"{tmpl.subject}"</p>
                                                    </div>
                                                    <span className="text-[9px] text-teal-400 font-bold uppercase mt-4 block">Use Template</span>
                                                </button>
                                            ))}
                                        </div>

                                        <div className="flex gap-2 border-b border-slate-800 pb-2">
                                            <button
                                                onClick={() => setEditorTab('preview')}
                                                className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-colors ${
                                                    editorTab === 'preview' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'text-slate-500 hover:text-slate-300'
                                                }`}
                                            >
                                                Visual Preview
                                            </button>
                                            <button
                                                onClick={() => setEditorTab('code')}
                                                className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-colors ${
                                                    editorTab === 'code' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'text-slate-500 hover:text-slate-300'
                                                }`}
                                            >
                                                Code Editor
                                            </button>
                                        </div>

                                        {editorTab === 'code' ? (
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center px-1">
                                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Email Html Content</label>
                                                    <button 
                                                        onClick={generateWithAI}
                                                        disabled={aiGenerating}
                                                        className="text-xs text-teal-400 flex items-center gap-1 bg-teal-500/10 px-2.5 py-1 rounded-lg border border-teal-500/20"
                                                    >
                                                        {aiGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI writer
                                                    </button>
                                                </div>
                                                <textarea
                                                    value={form.bodyHtml}
                                                    onChange={e => setForm(f => ({ ...f, bodyHtml: e.target.value }))}
                                                    placeholder="Write message HTML or plain text here..."
                                                    className="w-full h-40 bg-slate-900 border border-white/5 rounded-2xl p-4 text-xs text-white outline-none resize-none font-mono"
                                                />
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Live HTML Render Preview</label>
                                                <div className="bg-slate-950 border border-white/5 rounded-3xl overflow-hidden p-5 flex flex-col gap-4">
                                                    <div className="bg-slate-900 rounded-xl p-3 border border-white/5 text-[11px] space-y-1">
                                                        <div className="text-slate-400"><span className="font-bold text-slate-600">From:</span> {form.fromName}</div>
                                                        <div className="text-slate-400"><span className="font-bold text-slate-600">Subject:</span> {form.subject || '(No Subject)'}</div>
                                                    </div>
                                                    <div 
                                                        className="p-5 bg-white text-slate-800 rounded-2xl min-h-[220px] prose prose-sm max-w-none shadow-inner overflow-y-auto"
                                                        dangerouslySetInnerHTML={{ __html: form.bodyHtml || '<p class="text-slate-400 italic text-center py-10">Select a template or click "Code Editor" to write some HTML.</p>' }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeStep === 4 && (
                                    <div className="space-y-5 animate-in fade-in duration-300">
                                        <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 space-y-4">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Review Details</span>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-[9px] text-slate-500 font-bold uppercase">Name</span>
                                                    <p className="text-xs text-white font-bold truncate">{form.name || 'Untitled'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] text-slate-500 font-bold uppercase">Subject</span>
                                                    <p className="text-xs text-white font-bold truncate">{form.subject || 'Empty'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] text-slate-500 font-bold uppercase">Provider</span>
                                                    <p className="text-xs text-white font-bold uppercase">{form.selectedProviders[0] || 'resend'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] text-slate-500 font-bold uppercase">Language</span>
                                                    <p className="text-xs text-white font-bold">
                                                        {CAMPAIGN_LANGUAGE_OPTIONS.find(option => option.code === form.languageMode)?.label || 'Auto'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] text-slate-500 font-bold uppercase">Recipients</span>
                                                    <p className="text-xs text-white font-bold">
                                                        {recipientType === 'all' ? 'All contacts' : `${selectedContactIds.length} leads`}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Final Visual Content</span>
                                            <div className="bg-slate-950 border border-white/5 rounded-3xl overflow-hidden p-5">
                                                <div 
                                                    className="p-5 bg-white text-slate-800 rounded-2xl min-h-[200px] prose prose-sm max-w-none shadow-inner"
                                                    dangerouslySetInnerHTML={{ __html: form.bodyHtml || '<p class="text-slate-400 italic">No email body content.</p>' }}
                                                />
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleCreate}
                                            className="w-full py-4 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-teal-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            🚀 Launch Email Campaign Now
                                        </button>
                                    </div>
                                )}

                                {/* Step controllers */}
                                <div className="flex justify-between items-center pt-4">
                                    {activeStep > 1 ? (
                                        <button 
                                            onClick={() => setActiveStep(prev => prev - 1)}
                                            className="text-xs text-slate-500 font-bold px-4 py-2 hover:text-white"
                                        >
                                            Back
                                        </button>
                                    ) : <div />}
                                    
                                    {activeStep < 4 ? (
                                        <button 
                                            onClick={() => {
                                                if (activeStep === 1 && (!form.name || !form.subject)) {
                                                    return toast.error('Name and subject are required');
                                                }
                                                if (activeStep === 2 && !recipientType) {
                                                    return toast.error('Choose a recipient segment');
                                                }
                                                setActiveStep(prev => prev + 1);
                                            }}
                                            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase rounded-xl border border-white/5"
                                        >
                                            Continue
                                        </button>
                                    ) : <div />}
                                </div>
                            </div>

                            {/* AI Copilot Side Drawer */}
                            {showCopilot && (
                                <div className="w-full lg:w-[350px] bg-slate-900 border border-teal-500/20 rounded-3xl p-5 shadow-2xl space-y-4 shrink-0 animate-in slide-in-from-right-4 duration-300 lg:sticky lg:top-4">
                                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-teal-400 animate-pulse" />
                                            <span className="text-xs font-black text-white uppercase tracking-widest">AI Campaign Copilot</span>
                                        </div>
                                        <button 
                                            onClick={() => setShowCopilot(false)}
                                            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Messages list */}
                                    <div className="h-[300px] overflow-y-auto space-y-3 p-1 custom-scrollbar text-xs">
                                        {copilotMessages.map((msg, i) => (
                                            <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                                                <div className={`p-3 rounded-2xl max-w-[90%] whitespace-pre-wrap leading-relaxed ${
                                                    msg.sender === 'user' 
                                                        ? 'bg-teal-600 text-white rounded-tr-sm font-semibold' 
                                                        : 'bg-slate-950 text-slate-200 border border-slate-800 rounded-tl-sm'
                                                }`}>
                                                    {msg.text}
                                                </div>
                                                {msg.suggestion && (
                                                    <button
                                                        onClick={() => applyCopilotSuggestion(msg.suggestion)}
                                                        className="mt-2 px-3.5 py-2 bg-teal-500/10 border border-teal-500/30 text-teal-400 rounded-xl hover:bg-teal-500/20 transition-all font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 self-start"
                                                    >
                                                        <Check className="w-3.5 h-3.5" /> Apply AI Draft
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {copilotLoading && (
                                            <div className="flex items-center gap-2 text-slate-500 italic">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
                                                <span>AI Agent thinking...</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Input Form */}
                                    <form onSubmit={handleCopilotSend} className="flex gap-2 pt-2 border-t border-slate-800">
                                        <input
                                            value={copilotInput}
                                            onChange={e => setCopilotInput(e.target.value)}
                                            placeholder="Suggest tech outreach, paste emails..."
                                            className="flex-1 h-9 bg-slate-950 border border-slate-800 rounded-xl px-3 text-xs text-white placeholder-slate-600 outline-none focus:border-teal-500/40"
                                        />
                                        <button 
                                            type="submit"
                                            disabled={copilotLoading || !copilotInput.trim()}
                                            className="h-9 w-9 bg-teal-600 text-white rounded-xl flex items-center justify-center hover:bg-teal-500 transition-colors disabled:opacity-50"
                                        >
                                            <Send className="w-3.5 h-3.5" />
                                        </button>
                                    </form>
                                </div>
                            )}
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>

            {/* iOS/PWA bottom nav overlay helper */}
            {viewMode === 'compose' && (
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-white/5 px-4 flex items-center justify-between z-[50] pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.4)]">
                    <button 
                        onClick={() => {
                            if (activeStep > 1) setActiveStep(prev => prev - 1);
                            else setViewMode('list');
                        }}
                        className="text-slate-500 flex items-center gap-1 text-xs font-bold"
                    >
                        <ArrowLeft className="w-4 h-4" /> Prev
                    </button>
                    <div className="flex gap-1">
                        {[1, 2, 3, 4].map(s => (
                            <div 
                                key={s} 
                                className={`w-1.5 h-1.5 rounded-full ${activeStep === s ? 'bg-teal-500 w-4' : 'bg-slate-800'} transition-all`} 
                            />
                        ))}
                    </div>
                    {activeStep < 4 ? (
                        <button 
                            onClick={() => {
                                if (activeStep === 1 && (!form.name || !form.subject)) {
                                    return toast.error('Name and subject are required');
                                }
                                if (activeStep === 2 && !recipientType) {
                                    return toast.error('Choose a recipient segment');
                                }
                                setActiveStep(prev => prev + 1);
                            }}
                            className="text-teal-400 text-xs font-black uppercase"
                        >
                            Next
                        </button>
                    ) : (
                        <button 
                            onClick={handleCreate}
                            className="text-emerald-400 text-xs font-black uppercase"
                        >
                            Launch
                        </button>
                    )}
                </div>
            )}

        </div>
    );
};

export default CampaignBuilder;
