'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '../../ui/UIComponents';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';

interface ComposeEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({ isOpen, onClose, userId }) => {
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [generating, setGenerating] = useState(false);

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
                    prompt: `Write an email based on these instructions: "${aiPrompt}". 
                    Return your response as a JSON object with 'subject' and 'body' fields. 
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
                        <div className="flex gap-2">
                            <input
                                value={aiPrompt}
                                onChange={e => setAiPrompt(e.target.value)}
                                placeholder="Example: Write a follow up email about the partnership proposal..."
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

                    <div>
                        <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest block mb-2 px-1">Recipient</label>
                        <input
                            type="email"
                            value={to}
                            onChange={e => setTo(e.target.value)}
                            placeholder="email@example.com"
                            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-[#f5d400]/40 outline-none transition-all"
                        />
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
            </motion.div>
        </div>
    );
};

export default ComposeEmailModal;
