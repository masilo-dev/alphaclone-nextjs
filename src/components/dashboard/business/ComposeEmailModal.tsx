'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, Sparkles, Wand2, User, Search, Check } from 'lucide-react';
import { Button } from '../../ui/UIComponents';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { businessClientService } from '../../../services/businessClientService';
import { useTenant } from '../../../contexts/TenantContext';

interface ComposeEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    initialTo?: string;
    initialSubject?: string;
    initialBody?: string;
}

const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({
    isOpen,
    onClose,
    userId,
    initialTo = '',
    initialSubject = '',
    initialBody = ''
}) => {
    const { currentTenant } = useTenant();
    const [to, setTo] = useState(initialTo);
    const [subject, setSubject] = useState(initialSubject);
    const [body, setBody] = useState(initialBody);
    const [sending, setSending] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [generating, setGenerating] = useState(false);
    const [selectedTone, setSelectedTone] = useState('professional');
    const [clients, setClients] = useState<any[]>([]);
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (isOpen) {
            setTo(initialTo);
            setSubject(initialSubject);
            setBody(initialBody);
            setSearchQuery('');
            setAiPrompt('');
        }
    }, [isOpen, initialTo, initialSubject, initialBody]);

    React.useEffect(() => {
        if (isOpen && currentTenant?.id) {
            businessClientService.getClients(currentTenant.id).then(({ clients }) => {
                setClients(clients || []);
            });
        }
    }, [isOpen, currentTenant?.id]);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowContactDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredClients = clients.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const TONES = [
        { id: 'professional', label: 'Professional' },
        { id: 'friendly', label: 'Friendly' },
        { id: 'direct', label: 'Direct' },
        { id: 'creative', label: 'Creative' },
    ];

    const handleAIGenerate = async () => {
        if (!aiPrompt.trim()) {
            toast.error('Please describe what you want the AI to write');
            return;
        }

        setGenerating(true);
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Write a ${selectedTone} email based on these instructions: "${aiPrompt}". 
                    Recipient context: ${to ? `Writing to ${to}` : 'General business contact'}.
                    Return your response as a JSON object with 'subject' and 'body' fields. 
                    Style: ${selectedTone}.
                    Be professional and concise. Don't add any other text outside the JSON.`,
                    systemPrompt: "You are an expert business email assistant. You respond only with valid JSON focusing on high-conversion outreach."
                })
            });

            if (!res.ok) throw new Error('AI generation failed');
            const data = await res.json();

            try {
                // The AI might return the JSON wrapped in markdown or just plain
                const cleanedText = data.text.replace(/```json|```/g, '').trim();
                const parsed = JSON.parse(cleanedText);
                setSubject(parsed.subject || '');
                setBody(parsed.body || '');
                toast.success('Draft generated!');
            } catch (parseError) {
                // Fallback if not JSON
                setBody(data.text);
                toast.success('Draft ready (body only)');
            }
        } catch (err) {
            toast.error('Failed to generate draft');
        } finally {
            setGenerating(false);
        }
    };

    const handleSend = async () => {
        if (!to || !subject || !body) {
            toast.error('All fields are required');
            return;
        }

        setSending(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();

            const res = await fetch('/api/zoho/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    userId,
                    to,
                    subject,
                    content: body.replace(/\n/g, '<br/>')
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to send message');
            }

            toast.success('Email sent via Zoho Mail');
            onClose();
            setTo('');
            setSubject('');
            setBody('');
        } catch (err: any) {
            toast.error(err.message || 'Failed to send');
        } finally {
            setSending(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col z-[120]"
                    >
                        {/* Header */}
                        <div className="p-6 sm:p-8 border-b border-white/5 flex items-center justify-between bg-white/2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-[#f5d400]/10 flex items-center justify-center border border-[#f5d400]/20">
                                    <Send className="w-5 h-5 text-[#f5d400]" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white uppercase tracking-tight">Compose Signal</h2>
                                    <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Zoho Mail Protocol · AI Dynamic</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-3 text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-2xl transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">
                            {/* AI POWERED DRAFTING SECTION */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 rounded-3xl p-6 relative overflow-hidden group"
                            >
                                <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Sparkles className="w-24 h-24 text-indigo-400" />
                                </div>

                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-2 bg-indigo-500 rounded-lg">
                                        <Wand2 className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Neural Drafting Engine</span>
                                </div>

                                <div className="space-y-4 relative z-10">
                                    <div className="flex flex-wrap gap-2">
                                        {TONES.map(tone => (
                                            <button
                                                key={tone.id}
                                                onClick={() => setSelectedTone(tone.id)}
                                                className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${selectedTone === tone.id
                                                    ? 'bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-500/20'
                                                    : 'bg-slate-950/50 text-slate-500 border-white/5 hover:border-white/10'
                                                    }`}
                                            >
                                                {tone.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex gap-3">
                                        <div className="relative flex-1">
                                            <input
                                                value={aiPrompt}
                                                onChange={e => setAiPrompt(e.target.value)}
                                                placeholder="Instruction: e.g. 'Draft a follow-up about the proposal...'"
                                                className="w-full bg-slate-950/80 border border-white/10 rounded-2xl px-5 py-3.5 text-xs text-white placeholder:text-slate-600 focus:border-indigo-500/50 outline-none transition-all"
                                                onKeyDown={e => e.key === 'Enter' && handleAIGenerate()}
                                            />
                                        </div>
                                        <Button
                                            onClick={handleAIGenerate}
                                            disabled={generating || !aiPrompt.trim()}
                                            className="h-auto bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest px-6 rounded-2xl shrink-0 shadow-xl shadow-indigo-600/20"
                                        >
                                            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Execute AI'}
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>

                            <div className="grid grid-cols-1 gap-6">
                                {/* TO: RECIPIENT */}
                                <div className="relative" ref={dropdownRef}>
                                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] block mb-3 px-1">Recipient Address</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-white/5 rounded-lg group-focus-within:bg-[#f5d400]/10 transition-colors">
                                            <User className="w-3.5 h-3.5 text-slate-500 group-focus-within:text-[#f5d400]" />
                                        </div>
                                        <input
                                            type="text"
                                            value={to}
                                            onChange={e => {
                                                setTo(e.target.value);
                                                setSearchQuery(e.target.value);
                                                setShowContactDropdown(true);
                                            }}
                                            onFocus={() => setShowContactDropdown(true)}
                                            placeholder="Search database or protocol address..."
                                            className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-12 py-4 text-sm text-white focus:border-[#f5d400]/40 outline-none transition-all shadow-inner placeholder:text-slate-700"
                                        />
                                    </div>

                                    <AnimatePresence>
                                        {showContactDropdown && (searchQuery.length > 0 || filteredClients.length > 0) && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                                                className="absolute left-0 right-0 top-full mt-3 bg-slate-900 border border-white/10 rounded-3xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.8)] z-[130] max-h-72 overflow-y-auto p-2 backdrop-blur-2xl"
                                            >
                                                <div className="px-3 py-2 border-b border-white/5 mb-2 flex items-center justify-between">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Matched Contacts</span>
                                                    <span className="text-[9px] font-mono text-teal-400">{filteredClients.length} found</span>
                                                </div>
                                                {filteredClients.length > 0 ? (
                                                    filteredClients.map(client => (
                                                        <button
                                                            key={client.id}
                                                            onClick={() => {
                                                                setTo(client.email);
                                                                setShowContactDropdown(false);
                                                            }}
                                                            className="w-full text-left p-3.5 rounded-2xl hover:bg-white/5 transition-all group flex items-center justify-between border border-transparent hover:border-white/5 mb-1"
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner">
                                                                    <span className="text-xs font-black text-teal-400">{client.name?.charAt(0)}</span>
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{client.name}</p>
                                                                    <p className="text-[10px] text-slate-500 font-mono">{client.email}</p>
                                                                </div>
                                                            </div>
                                                            {to === client.email && (
                                                                <div className="w-6 h-6 rounded-full bg-teal-500/20 flex items-center justify-center border border-teal-500/30">
                                                                    <Check className="w-3.5 h-3.5 text-teal-400" />
                                                                </div>
                                                            )}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="p-8 text-center">
                                                        <Search className="w-8 h-8 mx-auto mb-3 text-slate-700 opacity-20" />
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">No contact matching "{searchQuery}"</p>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* SUBJECT */}
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] block mb-3 px-1">Signal Subject</label>
                                    <input
                                        type="text"
                                        value={subject}
                                        onChange={e => setSubject(e.target.value)}
                                        placeholder="Identification handle..."
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-[#f5d400]/40 outline-none transition-all shadow-inner placeholder:text-slate-700"
                                    />
                                </div>

                                {/* MESSAGE BODY */}
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] block mb-3 px-1">Neural Payload</label>
                                    <div className="relative">
                                        <textarea
                                            value={body}
                                            onChange={e => setBody(e.target.value)}
                                            placeholder="Begin data transmission..."
                                            className="w-full bg-slate-950/50 border border-white/10 rounded-[2rem] px-6 py-6 text-sm text-white focus:border-[#f5d400]/40 outline-none transition-all min-h-[250px] resize-none shadow-inner placeholder:text-slate-700 font-medium leading-relaxed custom-scrollbar"
                                        />
                                        <div className="absolute bottom-4 right-4 text-[10px] font-mono text-slate-600 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5">
                                            SYNS: {body.length} CHARS
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-8 border-t border-white/5 bg-white/2 flex items-center justify-between">
                            <div className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] hidden sm:block">
                                Encrypted Transmission Status: READY
                            </div>
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                <button
                                    onClick={onClose}
                                    className="flex-1 sm:flex-none px-8 py-3.5 text-slate-400 hover:text-white font-black text-[10px] uppercase tracking-widest transition-all"
                                >
                                    Abort
                                </button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleSend}
                                    disabled={sending}
                                    className="flex-1 sm:flex-none bg-[#f5d400] hover:bg-[#ffe100] text-slate-950 px-10 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl shadow-yellow-500/10 disabled:opacity-50 disabled:grayscale"
                                >
                                    {sending ? <Loader2 className="w-4 h-4 animate-spin text-slate-900" /> : <Send className="w-4 h-4 stroke-[2.5px]" />}
                                    Broadcast Signal
                                </motion.button>
                            </div>
                        </div>
                    </motion.div >
                </div >
            )}
        </AnimatePresence>
    );
};

export default ComposeEmailModal;
