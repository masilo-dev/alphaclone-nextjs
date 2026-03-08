'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Send className="w-4 h-4 text-[#f5d400]" />
                        Compose Email
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* AI ASSIST SECTION */}
                    <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 mb-2">
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-indigo-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">AI Drafting Assistant</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {TONES.map(tone => (
                                <button
                                    key={tone.id}
                                    onClick={() => setSelectedTone(tone.id)}
                                    className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${selectedTone === tone.id
                                            ? 'bg-indigo-500 text-white border-indigo-400'
                                            : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-700'
                                        }`}
                                >
                                    {tone.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={aiPrompt}
                                onChange={e => setAiPrompt(e.target.value)}
                                placeholder="Describe your email (e.g., 'Follow up on the project proposal')"
                                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:border-indigo-500/50 outline-none"
                                onKeyDown={e => e.key === 'Enter' && handleAIGenerate()}
                            />
                            <Button
                                onClick={handleAIGenerate}
                                disabled={generating || !aiPrompt.trim()}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-4 rounded-xl shrink-0"
                            >
                                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3 mr-2" />}
                                {generating ? 'GEN...' : 'DRAFT'}
                            </Button>
                        </div>
                    </div>

                    <div className="w-full h-[1px] bg-slate-900" />

                    <div className="relative" ref={dropdownRef}>
                        <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest block mb-2 px-1">Recipient</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                            <input
                                type="text"
                                value={to}
                                onChange={e => {
                                    setTo(e.target.value);
                                    setSearchQuery(e.target.value);
                                    setShowContactDropdown(true);
                                }}
                                onFocus={() => setShowContactDropdown(true)}
                                placeholder="Search contacts or enter email..."
                                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-10 py-3 text-sm text-white focus:border-[#f5d400]/40 outline-none transition-all"
                            />
                        </div>

                        {showContactDropdown && (searchQuery.length > 0 || filteredClients.length > 0) && (
                            <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-[120] max-h-60 overflow-y-auto overflow-x-hidden p-2">
                                {filteredClients.length > 0 ? (
                                    filteredClients.map(client => (
                                        <button
                                            key={client.id}
                                            onClick={() => {
                                                setTo(client.email);
                                                setShowContactDropdown(false);
                                            }}
                                            className="w-full text-left p-3 rounded-xl hover:bg-slate-800 transition-colors group flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
                                                    <User className="w-4 h-4 text-teal-400" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-white group-hover:text-teal-400 transition-colors">{client.name}</p>
                                                    <p className="text-[10px] text-slate-500">{client.email}</p>
                                                </div>
                                            </div>
                                            {to === client.email && <Check className="w-3.5 h-3.5 text-teal-400" />}
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-slate-500 text-xs">
                                        No contacts found matching "{searchQuery}"
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest block mb-2 px-1">Subject</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            placeholder="Enter subject line..."
                            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-[#f5d400]/40 outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest block mb-2 px-1">Message Content</label>
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            placeholder="Write your email here..."
                            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-4 text-sm text-white focus:border-[#f5d400]/40 outline-none transition-all min-h-[200px] resize-none"
                        />
                    </div>
                </div>

                <div className="p-6 pt-0 flex justify-end">
                    <Button
                        onClick={handleSend}
                        disabled={sending}
                        className="bg-[#f5d400] hover:bg-[#ffe100] text-slate-950 px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
                    >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Send Email
                    </Button>
                </div>
            </motion.div >
        </div >
    );
};

export default ComposeEmailModal;
