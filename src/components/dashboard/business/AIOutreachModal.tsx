'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Sparkles,
    Send,
    Users,
    Search,
    Check,
    AlertCircle,
    Loader2,
    MessageSquare,
    Zap,
    Mail,
    ChevronDown
} from 'lucide-react';
import { Button, Badge } from '../../ui/UIComponents';
import { leadService, Lead } from '../../../services/leadService';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '@/contexts/TenantContext';

interface AIOutreachModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    initialSelectedLeads?: string[];
}

const TONES = [
    { id: 'professional', label: 'Professional', description: 'Expert & Business-focused' },
    { id: 'friendly', label: 'Friendly', description: 'Warm & Approachable' },
    { id: 'direct', label: 'Direct', description: 'Concise & Short' },
    { id: 'marketing', label: 'Creative', description: 'Persuasive & Bold' },
];

const AIOutreachModal: React.FC<AIOutreachModalProps> = ({ isOpen, onClose, userId, initialSelectedLeads = [] }) => {
    const { currentTenant } = useTenant();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [selectedLeads, setSelectedLeads] = useState<string[]>(initialSelectedLeads);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [customPrompt, setCustomPrompt] = useState('');
    const [selectedTone, setSelectedTone] = useState('professional');
    const [results, setResults] = useState<any[] | null>(null);
    const [userEmail, setUserEmail] = useState('');
    const [fetchingAccount, setFetchingAccount] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<'sendgrid' | 'resend' | 'brevo' | 'zoho' | 'gmail'>('sendgrid');

    useEffect(() => {
        if (isOpen) {
            fetchLeads();
            fetchAccountInfo();
            if (initialSelectedLeads?.length) {
                setSelectedLeads(initialSelectedLeads.slice(0, 20));
            }
        }
    }, [isOpen, userId, initialSelectedLeads]);

    const fetchAccountInfo = async () => {
        setFetchingAccount(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
                setUserEmail(user.email);
            }
        } catch (err) {
            console.error('Failed to fetch user email:', err);
        } finally {
            setFetchingAccount(false);
        }
    };

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const { leads: fetchedLeads, error } = await leadService.getLeads();
            if (error) throw new Error(error);
            setLeads(fetchedLeads || []);
        } catch (err: any) {
            toast.error('Failed to load leads: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const inferRecipientEmail = (lead: Lead): string | null => {
        const directEmail = String((lead as any).email || '').trim();
        if (directEmail.includes('@')) return directEmail.toLowerCase();

        const website = String((lead as any).website || '').trim();
        if (!website) return null;

        try {
            const normalizedUrl = website.startsWith('http://') || website.startsWith('https://')
                ? website
                : `https://${website}`;
            const host = new URL(normalizedUrl).hostname.replace(/^www\./i, '').toLowerCase();
            if (!host || !host.includes('.') || host.includes('localhost')) return null;
            return `info@${host}`;
        } catch {
            return null;
        }
    };

    const toggleLead = (id: string) => {
        setSelectedLeads(prev => {
            if (prev.includes(id)) return prev.filter(i => i !== id);
            if (prev.length >= 20) {
                toast.error('Maximum 20 leads allowed for bulk AI Outreach');
                return prev;
            }
            return [...prev, id];
        });
    };

    const handleSend = async () => {
        if (selectedLeads.length === 0) {
            toast.error('Please select at least one lead');
            return;
        }
        if (!currentTenant?.id) {
            toast.error('No active workspace selected');
            return;
        }

        setSending(true);
        try {
            const selectedLeadRecords = leads.filter((lead) => selectedLeads.includes(lead.id));
            const generationResponse = await fetch('/api/outreach/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    leads: selectedLeadRecords.map((lead) => {
                        const recipient = inferRecipientEmail(lead);
                        return {
                            business_name: lead.businessName || 'Unknown Business',
                            email: recipient || '',
                            phone: (lead as any).phone || '',
                            website: (lead as any).website || '',
                            address: (lead as any).location || '',
                            category: lead.industry || '',
                            rating: 0,
                            pitchAngle: recipient ? 'growth-opportunity' : 'no-email-follow-up',
                            insights: [],
                            score: 75,
                        };
                    }),
                    industry: 'mixed',
                    tone: selectedTone,
                    customContext: customPrompt,
                    senderName: userEmail || 'AlphaClone Systems',
                    tenantId: currentTenant.id,
                })
            });

            const generationData = await generationResponse.json().catch(() => ({}));
            if (!generationResponse.ok || !generationData.success) {
                throw new Error(generationData.error || 'Outreach generation failed');
            }

            const drafts = Array.isArray(generationData.emails) ? generationData.emails : [];
            
            // Execute all sends in parallel for "all at once" experience
            const sendPromises = drafts.map(async (draft: any) => {
                const recipient = String(draft.recipientEmail || '').trim();
                if (!recipient || !recipient.includes('@')) {
                    return {
                        name: String(draft.business_name || 'Unknown Lead'),
                        status: 'error',
                        error: 'No recipient email available',
                    };
                }

                try {
                    const sendResponse = await fetch('/api/outreach/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            tenantId: currentTenant.id,
                            leadEmail: recipient,
                            leadName: draft.business_name,
                            subject: draft.subject,
                            body: draft.body,
                            pitchAngle: draft.pitchAngle || 'growth-opportunity',
                            industry: 'mixed',
                            score: 75,
                            autoSend: true,
                            consentGranted: true,
                            confidenceScore: 100,
                            deliveryProviders: [selectedProvider],
                            preferredProvider: selectedProvider,
                            balanceByDailyLimit: false,
                        }),
                    });

                    const sendData = await sendResponse.json().catch(() => ({}));
                    if (!sendResponse.ok || !sendData.success) {
                        return {
                            name: String(draft.business_name || 'Unknown Lead'),
                            status: 'error',
                            error: String(sendData.error || 'Outreach failed'),
                        };
                    } else {
                        return {
                            name: String(draft.business_name || 'Unknown Lead'),
                            status: 'success',
                        };
                    }
                } catch (err: any) {
                    return {
                        name: String(draft.business_name || 'Unknown Lead'),
                        status: 'error',
                        error: err.message,
                    };
                }
            });

            const sendResults = await Promise.all(sendPromises);
            setResults(sendResults);
            toast.success(`Successfully processed ${sendResults.filter((r) => r.status === 'success').length} emails`);
        } catch (err: any) {
            toast.error(err.message || 'Bulk outreach failed');
        } finally {
            setSending(false);
        }
    };

    const filteredLeads = leads.filter(l =>
        l.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.industry?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative w-full max-w-4xl h-[80vh] bg-slate-950 border border-slate-800 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-teal-500/10 rounded-2xl flex items-center justify-center border border-teal-500/20">
                            <Sparkles className="w-7 h-7 text-teal-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tighter">AI Bulk Outreach</h2>
                            <p className="text-[9px] text-slate-500 font-medium tracking-wide">MULTI-PROVIDER PERSONALIZATION</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 text-slate-400 hover:text-white hover:bg-slate-900 rounded-2xl transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Side: Lead Selection */}
                    <div className="w-1/2 border-r border-slate-800 flex flex-col p-6 bg-slate-950/30">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-white text-[10px] font-bold flex items-center gap-2 uppercase tracking-widest opacity-70">
                                <Users className="w-3.5 h-3.5 text-teal-400" />
                                Select Leads ({selectedLeads.length}/20)
                            </h3>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setSelectedLeads(filteredLeads.slice(0, 20).map(l => l.id))}
                                    className="text-[10px] text-teal-400 hover:text-teal-300 uppercase font-bold tracking-widest transition-colors"
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={() => setSelectedLeads([])}
                                    className="text-[10px] text-slate-500 hover:text-white uppercase font-bold tracking-widest transition-colors"
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>

                        <div className="relative mb-6">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search leads by name or industry..."
                                className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:border-teal-500/40 outline-none transition-all"
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="h-20 bg-slate-900/40 rounded-2xl animate-pulse" />
                                ))
                            ) : filteredLeads.length === 0 ? (
                                <div className="text-center py-12 text-slate-600">
                                    <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-10" />
                                    <p className="text-sm">No leads available</p>
                                </div>
                            ) : (
                                filteredLeads.map(lead => (
                                    <button
                                        key={lead.id}
                                        onClick={() => toggleLead(lead.id)}
                                        className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 ${selectedLeads.includes(lead.id)
                                            ? 'bg-teal-500/10 border-teal-500/40 translate-x-1'
                                            : 'bg-slate-900/20 border-slate-800 hover:bg-slate-900/50'
                                            }`}
                                    >
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center border ${selectedLeads.includes(lead.id)
                                            ? 'bg-teal-500 border-teal-500'
                                            : 'border-slate-700'
                                            }`}>
                                            {selectedLeads.includes(lead.id) && <Check className="w-4 h-4 text-slate-900" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{lead.businessName}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-slate-500 uppercase tracking-widest">{lead.industry || 'Lead'}</span>
                                                <span className="text-[10px] text-slate-700">·</span>
                                                <span className="text-[10px] text-slate-500 truncate">{inferRecipientEmail(lead) || 'No recipient email'}</span>
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Side: Configuration & AI */}
                    <div className="w-1/2 flex flex-col p-6 overflow-y-auto bg-slate-950">
                        {results ? (
                            <div className="space-y-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-teal-400" />
                                    Campaign Results
                                </h3>

                                <div className="space-y-2">
                                    {results.map((res, i) => (
                                        <div key={i} className={`p-4 rounded-2xl border ${res.status === 'success'
                                            ? 'bg-green-500/10 border-green-500/20'
                                            : 'bg-red-500/10 border-red-500/20'
                                            }`}>
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-white">{res.name}</span>
                                                <Badge variant={res.status === 'success' ? 'success' : 'neutral'}>
                                                    {res.status === 'success' ? 'Sent' : 'Failed'}
                                                </Badge>
                                            </div>
                                            {res.error && <p className="text-[10px] text-red-400 mt-1">{res.error}</p>}
                                        </div>
                                    ))}
                                </div>

                                <Button
                                    className="w-full h-14 rounded-2xl bg-teal-500 hover:bg-teal-400 text-white font-black uppercase text-sm"
                                    onClick={() => { setResults(null); setSelectedLeads([]); }}
                                >
                                    Start New Batch
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-white font-bold mb-4 flex items-center gap-2 uppercase tracking-wide text-[9px] opacity-70">
                                        <Mail className="w-3.5 h-3.5" />
                                        Step 1: Outgoing Email (From)
                                    </h3>
                                    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-4 flex items-center justify-between group hover:border-teal-500/20 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-teal-500/10 rounded-xl flex items-center justify-center border border-teal-500/20">
                                                <Mail className="w-5 h-5 text-teal-400" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Sender Address</p>
                                                {fetchingAccount ? (
                                                    <div className="h-4 w-32 bg-slate-800 animate-pulse rounded mt-1" />
                                                ) : (
                                                    <p className="text-white text-sm font-bold">{userEmail || 'Active Gmail Connection'}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-white font-bold mb-4 flex items-center gap-2 uppercase tracking-wide text-[9px] opacity-70">
                                        <ChevronDown className="w-3.5 h-3.5" />
                                        Step 1b: Delivery Provider
                                    </h3>
                                    <select
                                        value={selectedProvider}
                                        onChange={(e) => setSelectedProvider(e.target.value as 'sendgrid' | 'resend' | 'brevo' | 'zoho' | 'gmail')}
                                        className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-3 px-4 text-sm text-white focus:border-teal-500/40 outline-none transition-all"
                                    >
                                        <option value="sendgrid">SendGrid</option>
                                        <option value="resend">Resend</option>
                                        <option value="brevo">Brevo</option>
                                        <option value="zoho">Zoho Mail</option>
                                        <option value="gmail">Gmail</option>
                                    </select>
                                </div>

                                <div>
                                    <h3 className="text-white font-bold mb-4 flex items-center gap-2 uppercase tracking-wide text-[9px] opacity-70">
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        Step 2: Tone of Voice
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {TONES.map(tone => (
                                            <button
                                                key={tone.id}
                                                onClick={() => setSelectedTone(tone.id)}
                                                className={`p-4 rounded-3xl border transition-all text-left ${selectedTone === tone.id
                                                    ? 'bg-teal-500/10 border-teal-500/40 ring-1 ring-teal-500/20'
                                                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                                                    }`}
                                            >
                                                <p className={`text-xs font-black uppercase tracking-widest ${selectedTone === tone.id ? 'text-teal-400' : 'text-slate-400'}`}>
                                                    {tone.label}
                                                </p>
                                                <p className="text-[10px] text-slate-500 mt-1">{tone.description}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-white font-bold mb-4 flex items-center gap-2 uppercase tracking-wide text-[9px] opacity-70">
                                        <Zap className="w-3.5 h-3.5" />
                                        Step 3: Custom Instructions
                                    </h3>
                                    <div className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-4 focus-within:border-teal-500/40 transition-all">
                                        <textarea
                                            value={customPrompt}
                                            onChange={e => setCustomPrompt(e.target.value)}
                                            placeholder="Example: Mention our current promotion and ask for a quick chat."
                                            className="w-full bg-transparent border-none focus:ring-0 text-white text-sm min-h-[140px] p-2 resize-none"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-600 mt-3 px-2 italic">
                                        AlphaClone AI will personalize each email based on lead data.
                                    </p>
                                </div>

                                <div className="pt-4 mt-auto">
                                    <Button
                                        onClick={handleSend}
                                        disabled={sending}
                                        className="w-full h-16 rounded-[2rem] bg-teal-600 hover:bg-teal-500 text-white font-black text-lg shadow-xl shadow-teal-500/10 disabled:opacity-50 transition-all relative overflow-hidden group border-0"
                                    >
                                        {sending ? (
                                            <div className="flex items-center gap-3">
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                <span className="text-base">Processing Campaign...</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center gap-3">
                                                <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                                <span className="text-base uppercase tracking-wider">Execute Outreach</span>
                                            </div>
                                        )}
                                    </Button>
                                    <p className="text-center text-[10px] text-slate-500 mt-4 uppercase tracking-[0.2em] font-bold">
                                        Powered by AlphaClone Intelligence
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default AIOutreachModal;

