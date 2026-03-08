'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mail,
    Send,
    Star,
    Trash2,
    RefreshCw,
    Loader2,
    ArrowLeft,
    MoreVertical,
    User as UserIcon,
    Archive,
    CheckCircle2,
    AlertCircle,
    ExternalLink,
    Plus,
    Sparkles,
    Wand2
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Button, Badge } from '../../ui/UIComponents';
import toast from 'react-hot-toast';
import AIOutreachModal from './AIOutreachModal';
import ComposeEmailModal from './ComposeEmailModal';

const FOLDERS = [
    { id: 'inbox', label: 'Inbox', icon: Mail },
    { id: 'sent', label: 'Sent', icon: Send },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'trash', label: 'Trash', icon: Trash2 },
];

interface ZohoMailViewProps {
    userId: string;
}

interface ZohoEmail {
    messageId: string;
    subject: string;
    fromAddress: string;
    toAddress: string;
    receivedTime: string;
    summary: string;
    content?: string;
    flagged?: boolean;
}

const ZohoMailView: React.FC<ZohoMailViewProps> = ({ userId }) => {
    const [activeFolder, setActiveFolder] = useState('inbox');
    const [emails, setEmails] = useState<ZohoEmail[]>([]);
    const [selected, setSelected] = useState<ZohoEmail | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingEmail, setLoadingEmail] = useState(false);
    const [replyBody, setReplyBody] = useState('');
    const [sending, setSending] = useState(false);
    const [accountEmail, setAccountEmail] = useState('');
    const [isOutreachOpen, setIsOutreachOpen] = useState(false);
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [aiReplyGenerating, setAiReplyGenerating] = useState(false);
    const [aiReplyDrafting, setAiReplyDrafting] = useState(false);
    const [composeDefaults, setComposeDefaults] = useState({ to: '', subject: '', body: '' });

    const fetchEmails = async (folder: string = activeFolder) => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token || !userId) {
                toast.error('Not authenticated');
                return;
            }

            // Use the existing /api/zoho/messages route (takes userId + folderId query params)
            const res = await fetch(`/api/zoho/messages?userId=${userId}&folderId=${folder}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to load Zoho messages');
            }

            const data = await res.json();
            // Map from the existing route's format: {id, subject, from, to, date, snippet}
            const mapped = (data.messages || []).map((m: any) => ({
                messageId: m.id || m.messageId,
                subject: m.subject,
                fromAddress: m.from || m.fromAddress,
                toAddress: m.to || m.toAddress,
                receivedTime: m.date || m.receivedTime,
                summary: m.snippet || m.summary || '',
            }));
            setEmails(mapped);
            if (data.accountEmail) setAccountEmail(data.accountEmail);
        } catch (err: any) {
            console.error('ZohoMailView fetch error:', err);
            toast.error(err.message || 'Could not load Zoho Mail');
            setEmails([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userId) fetchEmails(activeFolder);
    }, [userId, activeFolder]);

    const handleSelectEmail = async (email: ZohoEmail) => {
        setSelected(email);
        setReplyBody('');
        if (!email.content) {
            setLoadingEmail(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) return;

                const res = await fetch(`/api/zoho/messages?userId=${userId}&messageId=${email.messageId}`, {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.message && data.message.content) {
                        setSelected({ ...email, content: data.message.content });
                        // Update the email in the list as well to cache it
                        setEmails(prev => prev.map(e =>
                            e.messageId === email.messageId ? { ...e, content: data.message.content } : e
                        ));
                    }
                }
            } catch (err) {
                console.error('Failed to fetch full email content:', err);
            } finally {
                setLoadingEmail(false);
            }
        }
    };

    const handleSendReply = async () => {
        if (!replyBody.trim() || !selected) return;
        setSending(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            // Use existing /api/zoho/messages POST route (userId, to, subject, content)
            const res = await fetch('/api/zoho/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    userId,
                    to: selected.fromAddress,
                    subject: `Re: ${selected.subject}`,
                    content: replyBody,
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to send reply');
            }

            toast.success('Reply sent via Zoho Mail');
            setReplyBody('');
            setAiReplyDrafting(false);
        } catch (err: any) {
            toast.error(err.message || 'Failed to send');
        } finally {
            setSending(false);
        }
    };

    const handleAiReplyGenerate = async () => {
        if (!selected) return;
        setAiReplyGenerating(true);
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Reply to this email from "${selected.fromAddress}" with subject "${selected.subject}".
                    Email Content: "${selected.content || selected.summary}"
                    
                    Instructions for the reply: "Draft a professional and helpful response that addresses the points in the user's email."
                    Return only the reply text, no subject or JSON.`,
                    systemPrompt: "You are an expert customer relations assistant. You write concise, empathetic, and professional email replies."
                })
            });

            if (!res.ok) throw new Error('AI failed to generate reply');
            const data = await res.json();
            setReplyBody(data.text);
            toast.success('AI Draft ready');
            setAiReplyDrafting(true);
        } catch (err) {
            toast.error('AI Reply assistance failed');
        } finally {
            setAiReplyGenerating(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex h-[calc(100vh-120px)] min-h-[600px] w-full bg-slate-950 border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative"
        >
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/2 to-indigo-500/2 pointer-events-none" />

            {/* Icon sidebar */}
            <div className="w-16 sm:w-20 border-r border-white/5 flex flex-col items-center py-8 gap-6 bg-slate-900/40 backdrop-blur-xl relative z-10">
                {/* Primary Actions */}
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOutreachOpen(true)}
                    title="AI Bulk Outreach"
                    className="p-3.5 rounded-2xl bg-[#f5d400] text-slate-950 shadow-lg shadow-yellow-500/20 transition-all mb-1"
                >
                    <Sparkles className="w-5 h-5 fill-current" />
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsComposeOpen(true)}
                    title="Compose New Email"
                    className="p-3.5 rounded-2xl bg-slate-800/50 border border-white/10 text-white hover:border-[#f5d400]/40 transition-all mb-4"
                >
                    <Plus className="w-5 h-5" />
                </motion.button>

                <div className="w-10 h-[1px] bg-white/5 mb-2" />

                <div className="flex flex-col gap-4">
                    {FOLDERS.map(({ id, icon: Icon, label }) => (
                        <motion.button
                            key={id}
                            whileHover={{ x: 2 }}
                            onClick={() => { setActiveFolder(id); setSelected(null); }}
                            title={label}
                            className={`group relative p-3 rounded-2xl transition-all ${activeFolder === id
                                ? 'bg-white/10 text-[#f5d400] shadow-inner'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <Icon className={`w-5 h-5 group-active:scale-90 transition-transform ${activeFolder === id ? 'stroke-[2.5px]' : ''}`} />
                            {activeFolder === id && (
                                <motion.div
                                    layoutId="activeFolderDot"
                                    className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-4 bg-[#f5d400] rounded-full shadow-[0_0_8px_#f5d400]"
                                />
                            )}
                            <span className="absolute left-full ml-4 px-2.5 py-1.5 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0 z-50 pointer-events-none whitespace-nowrap font-black uppercase tracking-widest shadow-2xl border border-white/10 backdrop-blur-xl">
                                {label}
                            </span>
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* Thread list */}
            <div className={`w-full md:w-80 lg:w-96 border-r border-white/5 flex flex-col bg-slate-900/20 backdrop-blur-sm z-10 ${selected ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-black text-xs uppercase tracking-widest">{activeFolder}</h3>
                        {accountEmail && (
                            <p className="text-[10px] text-[#f5d400]/80 mt-1 truncate font-mono">{accountEmail}</p>
                        )}
                    </div>
                    <motion.button
                        whileHover={{ rotate: 180 }}
                        transition={{ duration: 0.5, ease: "anticipate" }}
                        onClick={() => fetchEmails(activeFolder)}
                        disabled={loading}
                        className="p-2.5 text-slate-500 hover:text-teal-400 bg-white/5 hover:bg-teal-500/10 rounded-xl transition-all border border-transparent hover:border-teal-500/20"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </motion.button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="p-4 rounded-2xl bg-white/2 border border-white/5 animate-pulse h-24" />
                        ))
                    ) : emails.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-600 px-6">
                            <div className="w-16 h-16 bg-white/2 rounded-full flex items-center justify-center mb-4 border border-white/5">
                                <Mail className="w-8 h-8 opacity-20" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest">No signals in channel</p>
                        </div>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {emails.map((email, idx) => (
                                <motion.div
                                    key={email.messageId}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                >
                                    <button
                                        onClick={() => handleSelectEmail(email)}
                                        className={`w-full text-left p-4 rounded-2xl transition-all border group relative ${selected?.messageId === email.messageId
                                            ? 'bg-teal-500/10 border-teal-500/30 shadow-lg shadow-teal-500/5'
                                            : 'border-transparent hover:bg-white/5 hover:border-white/10'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-black text-[#f5d400] truncate max-w-[150px] uppercase tracking-widest">
                                                {email.fromAddress?.split('<')[0].trim() || 'Unidentified'}
                                            </span>
                                            <span className="text-[9px] text-slate-500 font-mono">
                                                {email.receivedTime ? new Date(Number(email.receivedTime)).toLocaleDateString() : ''}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-100 truncate group-hover:text-white transition-colors mb-1.5 leading-tight">
                                            {email.subject || '(NO SUBJECT)'}
                                        </h4>
                                        <p className="text-[11px] text-slate-500 line-clamp-2 opacity-80 group-hover:opacity-100 transition-opacity leading-relaxed font-medium">
                                            {email.summary}
                                        </p>
                                    </button>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </div>

            {/* Email content area */}
            <div className={`flex-1 flex flex-col bg-slate-950/80 backdrop-blur-md relative z-10 ${!selected ? 'hidden md:flex' : 'flex'}`}>
                <AnimatePresence mode="wait">
                    {selected ? (
                        <motion.div
                            key={selected.messageId}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                            className="flex-1 flex flex-col h-full overflow-hidden"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-white/5 flex items-center gap-4 bg-white/2">
                                <button
                                    onClick={() => setSelected(null)}
                                    className="md:hidden p-2 text-slate-400 hover:text-white bg-white/5 rounded-xl transition-all"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-black text-white truncate tracking-tight uppercase leading-tight">{selected.subject || '(NO SUBJECT)'}</h3>
                                    <div className="flex items-center gap-3 mt-2">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#f5d400]/10 border border-[#f5d400]/20">
                                            <div className="w-1 h-1 rounded-full bg-[#f5d400] animate-pulse" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-[#f5d400]">Quantum Link</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-mono truncate">{selected.fromAddress}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            setComposeDefaults({
                                                to: selected.fromAddress,
                                                subject: `Re: ${selected.subject}`,
                                                body: `\n\n--- Original Signal ---\nFrom: ${selected.fromAddress}\nSubject: ${selected.subject}\n\n${(selected.content || selected.summary || '').replace(/<[^>]*>/g, '')}`
                                            });
                                            setIsComposeOpen(true);
                                        }}
                                        className="hidden sm:flex items-center gap-2 h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/10"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        Advanced Draft
                                    </motion.button>
                                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                                        <button className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all" title="Archive"><Archive className="w-4 h-4" /></button>
                                        <button className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                        <button className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"><MoreVertical className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-8 sm:p-12 custom-scrollbar selection:bg-[#f5d400]/30">
                                {loadingEmail ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-4">
                                        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin" />
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest animate-pulse">Decrypting transmission...</p>
                                    </div>
                                ) : (
                                    <div className="max-w-4xl mx-auto space-y-10">
                                        <div className="flex items-center gap-5 p-4 bg-white/2 rounded-2xl border border-white/5">
                                            <div className="w-14 h-14 rounded-2xl bg-[#f5d400]/10 flex items-center justify-center border border-[#f5d400]/20 shadow-inner">
                                                <UserIcon className="w-7 h-7 text-[#f5d400]" />
                                            </div>
                                            <div>
                                                <p className="text-white font-black text-sm uppercase tracking-tight">{selected.fromAddress?.split('<')[0].trim() || 'Undefined Sender'}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <p className="text-[10px] text-slate-500 font-mono">{selected.fromAddress}</p>
                                                    <div className="w-1 h-1 rounded-full bg-slate-700" />
                                                    <p className="text-[10px] text-slate-500 font-mono">
                                                        {selected.receivedTime ? new Date(Number(selected.receivedTime)).toLocaleString() : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div
                                            className="prose prose-invert prose-slate max-w-none text-slate-300 text-[15px] leading-relaxed font-medium transition-all"
                                            dangerouslySetInnerHTML={{ __html: selected.content || selected.summary || '' }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Reply box */}
                            <div className="p-8 pt-0">
                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[2rem] p-4 focus-within:border-teal-500/50 transition-all shadow-2xl relative"
                                >
                                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 mb-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-2 h-2 rounded-full bg-teal-500 shadow-[0_0_8px_#14b8a6]" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Response Terminal</span>
                                        </div>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={handleAiReplyGenerate}
                                            disabled={aiReplyGenerating}
                                            className="h-9 px-4 text-[10px] font-black text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 uppercase tracking-widest flex items-center gap-2 rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                                        >
                                            {aiReplyGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                                            {aiReplyGenerating ? 'AI PROCESSING...' : 'AI ASSIST REPLI'}
                                        </motion.button>
                                    </div>
                                    <textarea
                                        value={replyBody}
                                        onChange={e => setReplyBody(e.target.value)}
                                        placeholder="Initiate communication..."
                                        className="w-full bg-transparent border-none focus:ring-0 text-slate-200 text-sm min-h-[120px] p-4 resize-none placeholder:text-slate-600 font-medium"
                                    />
                                    <div className="flex items-center justify-end p-2 mt-2">
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={handleSendReply}
                                            disabled={sending || !replyBody.trim()}
                                            className="flex items-center gap-2.5 px-8 py-3 bg-[#f5d400] hover:bg-[#ffe100] disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-yellow-500/10"
                                        >
                                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 stroke-[2.5px]" />}
                                            Transmit Message
                                        </motion.button>
                                    </div>
                                </motion.div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center"
                        >
                            <div className="bg-slate-900/30 backdrop-blur-xl p-16 rounded-[4rem] border border-white/5 relative group">
                                <div className="absolute inset-0 bg-teal-500/5 rounded-[4rem] blur-3xl group-hover:bg-teal-500/10 transition-colors" />
                                <div className="relative z-10 w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center border border-white/10 mb-8 mx-auto shadow-2xl">
                                    <Mail className="w-10 h-10 text-[#f5d400] opacity-40 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <h3 className="relative z-10 text-2xl font-black text-white mb-3 tracking-tight uppercase">Channel Standby</h3>
                                <p className="relative z-10 max-w-sm text-xs text-slate-500 leading-relaxed font-mono uppercase tracking-widest opacity-60">
                                    Select a cryptographic signal from the terminal to begin synchronization.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Modals */}
            <AIOutreachModal
                isOpen={isOutreachOpen}
                onClose={() => setIsOutreachOpen(false)}
                userId={userId}
            />
            <ComposeEmailModal
                isOpen={isComposeOpen}
                onClose={() => {
                    setIsComposeOpen(false);
                    setComposeDefaults({ to: '', subject: '', body: '' });
                }}
                userId={userId}
                initialTo={composeDefaults.to}
                initialSubject={composeDefaults.subject}
                initialBody={composeDefaults.body}
            />
        </motion.div>
    );
};

export default ZohoMailView;
