'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Mail, Send, Clock, Users, Eye, Plus, Trash2, Play, Pause,
    ChevronDown, ChevronUp, Sparkles, Tag, FileText, CheckCircle2, Loader2, Upload, Search,
    History, X, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { emailCampaignService, EmailCampaign, EmailTemplate, MarketingContact } from '../../../services/emailCampaignService';
import { tenantService } from '../../../services/tenancy/TenantService';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { useBreakpoint } from '@/hooks/useBreakpoint';

const statusColors: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    scheduled: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    sending: 'bg-teal-600/10 text-teal-500 border-teal-600/20',
    sent: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
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

const CampaignBuilder: React.FC<{ userId: string }> = ({ userId }) => {
    const router = useRouter();
    const { isMobile, isTablet, isDesktop } = useBreakpoint();
    
    const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [contacts, setContacts] = useState<MarketingContact[]>([]);
    const [contactSearch, setContactSearch] = useState('');
    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
    const [activeStep, setActiveStep] = useState(1);
    const [aiGenerating, setAiGenerating] = useState(false);
    const [recipientType, setRecipientType] = useState<'all' | 'specific' | 'few' | 'import' | null>(null);
    const [showHistory, setShowHistory] = useState(false);

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

    const handleCreate = async () => {
        if (!form.name || !form.subject || !form.bodyHtml) {
            toast.error('Name, subject, and message are required');
            return;
        }
        const toastId = toast.loading('Creating campaign...');
        const { campaign, error } = await emailCampaignService.createCampaign(userId, {
            name: form.name,
            subject: form.subject,
            fromName: form.fromName,
            fromEmail: form.fromEmail || 'notifications@alphaclonesystems.com',
            scheduledAt: form.scheduleEnabled && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
            metadata: { bodyHtml: form.bodyHtml },
        });

        if (error) { toast.error(error, { id: toastId }); return; }
        if (campaign) {
            let finalIds = selectedContactIds;
            if (recipientType === 'all') finalIds = contacts.map(c => c.id);
            await emailCampaignService.addRecipientsToCampaign(campaign.id, finalIds);
        }
        toast.success('Campaign saved.', { id: toastId });
        setActiveStep(1);
        setRecipientType(null);
        setSelectedContactIds([]);
        loadData();
    };

    const insertVariable = (tag: string) => {
        setForm(f => ({ ...f, bodyHtml: f.bodyHtml + ' ' + tag }));
    };

    const generateWithAI = async () => {
        if (!form.subject) { toast.error('Enter a subject'); return; }
        setAiGenerating(true);
        try {
            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: `Write email for ${form.subject}` })
            });
            const data = await response.json();
            if (data.text) setForm(f => ({ ...f, bodyHtml: data.text }));
        } finally { setAiGenerating(false); }
    };

    if (loading) return <div className="p-8 text-slate-400">Loading...</div>;

    const HistorySidebar = () => (
        <div className="flex flex-col h-full bg-[#0a0a0a] border-r border-white/5 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recent Activity</h3>
                {isMobile && <button onClick={() => setShowHistory(false)}><X size={18} className="text-slate-500" /></button>}
            </div>
            {campaigns.map(campaign => (
                <div key={campaign.id} className="p-4 rounded-2xl bg-[#141414] border border-white/5 space-y-2">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${statusColors[campaign.status]}`}>{campaign.status}</span>
                    <h4 className="text-xs font-bold text-white truncate">{campaign.name}</h4>
                    <p className="text-[9px] text-slate-500 font-medium">Modified {new Date(campaign.updatedAt || campaign.createdAt).toLocaleDateString()}</p>
                </div>
            ))}
        </div>
    );

    return (
        <div className={`flex flex-col bg-slate-950 rounded-3xl border border-white/5 overflow-hidden backdrop-blur-sm relative ${isMobile ? 'h-auto min-h-[calc(100vh-120px)]' : 'h-[calc(100vh-140px)]'}`}>
            {/* Header */}
            <div className="h-20 border-b border-white/5 bg-slate-900 px-4 sm:px-6 flex items-center justify-between z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-600/20">
                        <Mail size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black tracking-widest text-white uppercase">Campaigns</h1>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Marketing Hub</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isMobile && <button onClick={() => setShowHistory(true)} className="p-2.5 bg-white/5 rounded-xl text-slate-400"><History size={20} /></button>}
                    <button onClick={() => setActiveStep(1)} className="px-4 py-2.5 bg-teal-600 text-white rounded-xl text-xs font-black uppercase tracking-wider">New</button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Desktop History Sidebar */}
                {!isMobile && <div className="w-72 shrink-0"><HistorySidebar /></div>}

                {/* Mobile History Drawer */}
                <AnimatePresence>
                    {isMobile && showHistory && (
                        <>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHistory(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]" />
                            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed inset-y-0 right-0 w-4/5 bg-[#0a0a0a] z-[101] border-l border-white/10 shadow-2xl">
                                <HistorySidebar />
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900/50 p-4 sm:p-10 pb-32">
                    <div className="max-w-4xl mx-auto w-full space-y-12">
                        {/* Progressive Navigation */}
                        <div className="flex items-center justify-center gap-2 sm:gap-4">
                            {[1, 2, 3].map((s, i) => (
                                <React.Fragment key={s}>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-black transition-all ${activeStep === s ? 'bg-teal-600 text-white shadow-lg' : 'bg-slate-800 text-slate-500'}`}>{s}</div>
                                        <span className={`text-[9px] sm:text-xs font-black uppercase tracking-widest hidden sm:inline ${activeStep === s ? 'text-teal-600' : 'text-slate-500'}`}>
                                            {s === 1 ? 'Message' : s === 2 ? 'Audience' : 'Review'}
                                        </span>
                                    </div>
                                    {i < 2 && <div className="w-4 sm:w-12 h-px bg-slate-800" />}
                                </React.Fragment>
                            ))}
                        </div>

                        <AnimatePresence mode="wait">
                            {activeStep === 1 && (
                                <motion.div key="1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Campaign Title</label>
                                            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full h-14 bg-slate-950 border border-white/5 rounded-2xl px-6 text-sm text-white outline-none focus:border-teal-500/50" placeholder="Internal name" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Subject Line</label>
                                            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="w-full h-14 bg-slate-950 border border-white/5 rounded-2xl px-6 text-sm text-white outline-none focus:border-teal-500/50" placeholder="Email subject" />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between px-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Personalization Tags</label>
                                            <button onClick={generateWithAI} disabled={aiGenerating} className="flex items-center gap-2 text-[10px] font-black text-teal-400 uppercase tracking-widest bg-teal-500/10 px-3 py-1.5 rounded-lg border border-teal-500/20 hover:bg-teal-500/20 transition-all">
                                                {aiGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} AI Writer
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                            {PERSONALIZATION_BUTTONS.map(btn => (
                                                <button key={btn.tag} onClick={() => insertVariable(btn.tag)} className="h-10 bg-slate-950 border border-white/5 rounded-xl text-[10px] font-black text-slate-400 uppercase hover:border-teal-500 hover:text-teal-400 transition-all shadow-sm flex items-center justify-center gap-2">
                                                    <Plus size={10} /> {btn.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <textarea value={form.bodyHtml} onChange={e => setForm(f => ({ ...f, bodyHtml: e.target.value }))} className="w-full bg-slate-950 border border-white/5 rounded-[2rem] p-6 sm:p-8 text-base text-slate-200 min-h-[350px] outline-none focus:border-teal-500/50 transition-all resize-none shadow-inner" placeholder="Craft your message..." />
                                    
                                    <div className="flex justify-end pt-4">
                                        <button onClick={() => setActiveStep(2)} disabled={!form.name || !form.subject} className="w-full sm:w-auto px-10 py-5 bg-teal-600 text-white rounded-2xl font-black uppercase text-sm shadow-xl shadow-teal-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale">Next Step</button>
                                    </div>
                                </motion.div>
                            )}

                            {activeStep === 2 && (
                                <motion.div key="2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {[
                                            { id: 'all', title: 'Entire Database', icon: Users },
                                            { id: 'specific', title: 'Segmented Group', icon: Tag },
                                            { id: 'few', title: 'Manual Pick', icon: Send },
                                            { id: 'import', title: 'External List', icon: Upload }
                                        ].map(opt => (
                                            <button key={opt.id} onClick={() => setRecipientType(opt.id as any)} className={`p-8 rounded-[32px] border-2 text-left transition-all ${recipientType === opt.id ? 'bg-teal-500/10 border-teal-600 shadow-lg shadow-teal-600/10' : 'bg-slate-950 border-white/5 hover:border-white/10'}`}>
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${recipientType === opt.id ? 'bg-teal-600 text-white' : 'bg-slate-900 text-slate-500'}`}><opt.icon size={24} /></div>
                                                <h4 className={`font-black uppercase tracking-widest text-sm ${recipientType === opt.id ? 'text-teal-400' : 'text-slate-200'}`}>{opt.title}</h4>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between pt-8 border-t border-white/5">
                                        <button onClick={() => setActiveStep(1)} className="px-8 py-4 text-slate-500 font-black uppercase text-xs hover:text-slate-300">Back</button>
                                        <button onClick={() => setActiveStep(3)} disabled={!recipientType} className="px-10 py-5 bg-teal-600 text-white rounded-2xl font-black uppercase text-sm shadow-xl shadow-teal-900/20 disabled:opacity-50 disabled:grayscale">Review</button>
                                    </div>
                                </motion.div>
                            )}

                            {activeStep === 3 && (
                                <motion.div key="3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                                    <div className="bg-slate-950 rounded-[40px] p-8 sm:p-12 space-y-6 border border-white/5">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                            <div><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Title</span><p className="text-lg font-black text-white">{form.name}</p></div>
                                            <div><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Subject</span><p className="text-lg font-black text-white">{form.subject}</p></div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-8 border-t border-white/5">
                                        <button onClick={() => setActiveStep(2)} className="px-8 py-4 text-slate-500 font-black uppercase text-xs hover:text-slate-300">Edit Audience</button>
                                        <button onClick={handleCreate} className="px-12 py-5 bg-teal-600 text-white rounded-[2rem] font-black uppercase text-sm shadow-2xl shadow-teal-900/40 hover:bg-teal-500 active:scale-95 transition-all">Launch Now</button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Mobile Bottom Navigation Placeholder for Sticky Feel */}
            {isMobile && (
                <div className="fixed bottom-0 left-0 right-0 h-20 bg-slate-900 border-t border-white/5 px-6 flex items-center justify-between z-[60] shadow-[0_-8px_30px_rgba(0,0,0,0.4)]">
                    <button onClick={() => setActiveStep(prev => Math.max(1, prev - 1))} className="text-slate-500"><ArrowLeft size={24} /></button>
                    <div className="flex gap-2">
                        {[1, 2, 3].map(s => <div key={s} className={`w-2 h-2 rounded-full ${activeStep === s ? 'bg-teal-600 w-6' : 'bg-slate-800'} transition-all`} />)}
                    </div>
                    <button onClick={() => setActiveStep(prev => Math.min(3, prev + 1))} className="text-teal-400 font-black uppercase text-[10px]">Next</button>
                </div>
            )}
        </div>
    );
};

export default CampaignBuilder;
