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
    Zap
} from 'lucide-react';
import { Button, Badge } from '../../ui/UIComponents';
import { leadService, Lead } from '../../../services/leadService';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';

interface AIOutreachModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

const TONES = [
    { id: 'professional', label: 'Professional', description: 'Elite & Business-focused' },
    { id: 'friendly', label: 'Friendly', description: 'Warm & Approachable' },
    { id: 'direct', label: 'Direct', description: 'Concise & Short' },
    { id: 'marketing', label: 'Creative', description: 'Persuasive & Bold' },
];

const AIOutreachModal: React.FC<AIOutreachModalProps> = ({ isOpen, onClose, userId }) => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [customPrompt, setCustomPrompt] = useState('');
    const [selectedTone, setSelectedTone] = useState('professional');
    const [results, setResults] = useState<any[] | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchLeads();
        }
    }, [isOpen]);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const { leads: fetchedLeads, error } = await leadService.getLeads();
            if (error) throw new Error(error);
            // Only show leads with email addresses
            setLeads((fetchedLeads || []).filter(l => !!l.email));
        } catch (err: any) {
            toast.error('Failed to load leads: ' + err.message);
        } finally {
            setLoading(false);
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

        setSending(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();

            const response = await fetch('/api/zoho/outreach', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    userId,
                    leadIds: selectedLeads,
                    customPrompt,
                    tone: selectedTone
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Outreach failed');
            }

            setResults(data.results);
            toast.success(`Successfully processed ${data.results.filter((r: any) => r.status === 'success').length} emails!`);

            // If all successful, we can auto-close or show results
            if (data.results.every((r: any) => r.status === 'success')) {
                // Keep open to show results? Maybe a success state
            }
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
                className="relative w-full max-w-5xl h-[85vh] bg-slate-950 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-[#f5d400]/10 rounded-2xl flex items-center justify-center border border-[#f5d400]/20">
                            <Sparkles className="w-7 h-7 text-[#f5d400]" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">AI Bulk Outreach</h2>
                            <p className="text-sm text-slate-500 font-medium">Smart personalization for your top leads</p>
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
                    <div className="w-1/2 border-r border-slate-800 flex flex-col p-8 bg-slate-950/30">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Users className="w-4 h-4 text-[#f5d400]" />
                                Select Leads ({selectedLeads.length}/20)
                            </h3>
                            <button
                                onClick={() => setSelectedLeads([])}
                                className="text-[10px] text-slate-500 hover:text-white uppercase font-bold tracking-widest transition-colors"
                            >
                                Clear All
                            </button>
                        </div>

                        <div className="relative mb-6">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search leads by name or industry..."
                                className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:border-[#f5d400]/40 outline-none transition-all"
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
                                    <p className="text-sm">No leads found with emails</p>
                                </div>
                            ) : (
                                filteredLeads.map(lead => (
                                    <button
                                        key={lead.id}
                                        onClick={() => toggleLead(lead.id)}
                                        className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 ${selectedLeads.includes(lead.id)
                                                ? 'bg-[#f5d400]/10 border-[#f5d400]/40 translate-x-1'
                                                : 'bg-slate-900/20 border-slate-800 hover:bg-slate-900/50'
                                            }`}
                                    >
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center border ${selectedLeads.includes(lead.id)
                                                ? 'bg-[#f5d400] border-[#f5d400]'
                                                : 'border-slate-700'
                                            }`}>
                                            {selectedLeads.includes(lead.id) && <Check className="w-4 h-4 text-slate-900" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{lead.businessName}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-slate-500 uppercase tracking-widest">{lead.industry || 'Lead'}</span>
                                                <span className="text-[10px] text-slate-700">·</span>
                                                <span className="text-[10px] text-slate-500 truncate">{lead.email}</span>
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right Side: Configuration & AI */}
                    <div className="w-1/2 flex flex-col p-8 overflow-y-auto bg-slate-950">
                        {results ? (
                            <div className="space-y-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-[#f5d400]" />
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
                                                <Badge variant={res.status === 'success' ? 'active' : 'neutral'} size="sm">
                                                    {res.status === 'success' ? 'Sent' : 'Failed'}
                                                </Badge>
                                            </div>
                                            {res.error && <p className="text-[10px] text-red-400 mt-1">{res.error}</p>}
                                        </div>
                                    ))}
                                </div>

                                <Button
                                    className="w-full h-14 rounded-2xl bg-[#f5d400] text-slate-900 font-black uppercase text-sm"
                                    onClick={() => { setResults(null); setSelectedLeads([]); }}
                                >
                                    Start New Batch
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-white font-bold mb-4 flex items-center gap-2 uppercase tracking-wide text-xs opacity-70">
                                        <MessageSquare className="w-4 h-4" />
                                        Step 1: AI Persona & Tone
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {TONES.map(tone => (
                                            <button
                                                key={tone.id}
                                                onClick={() => setSelectedTone(tone.id)}
                                                className={`p-4 rounded-3xl border transition-all text-left ${selectedTone === tone.id
                                                        ? 'bg-[#f5d400]/10 border-[#f5d400]/40 ring-1 ring-[#f5d400]/20'
                                                        : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                                                    }`}
                                            >
                                                <p className={`text-xs font-black uppercase tracking-widest ${selectedTone === tone.id ? 'text-[#f5d400]' : 'text-slate-400'}`}>
                                                    {tone.label}
                                                </p>
                                                <p className="text-[10px] text-slate-500 mt-1">{tone.description}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-white font-bold mb-4 flex items-center gap-2 uppercase tracking-wide text-xs opacity-70">
                                        <Zap className="w-4 h-4" />
                                        Step 2: Custom Directive
                                    </h3>
                                    <div className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-4 focus-within:border-[#f5d400]/40 transition-all">
                                        <textarea
                                            value={customPrompt}
                                            onChange={e => setCustomPrompt(e.target.value)}
                                            placeholder="Example: Mention our 20% spring discount and ask if they have time for a 15-min discovery call on Thursday."
                                            className="w-full bg-transparent border-none focus:ring-0 text-white text-sm min-h-[140px] p-2 resize-none"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-600 mt-3 px-2 italic">
                                        AI will automatically research each lead's industry and location to tailor the message.
                                    </p>
                                </div>

                                <div className="pt-4 mt-auto">
                                    <Button
                                        onClick={handleSend}
                                        disabled={sending || selectedLeads.length === 0}
                                        className="w-full h-16 rounded-[2rem] bg-[#f5d400] hover:bg-[#ffe100] text-slate-950 font-black text-lg shadow-xl shadow-yellow-500/10 disabled:opacity-50 transition-all relative overflow-hidden group"
                                    >
                                        {sending ? (
                                            <div className="flex items-center gap-3">
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                <span>Transmitting...</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center gap-3">
                                                <Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                                <span>Deploy AI Outreach ({selectedLeads.length})</span>
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
