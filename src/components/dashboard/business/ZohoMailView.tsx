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
    ExternalLink
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { Button, Badge } from '../../ui/UIComponents';
import toast from 'react-hot-toast';

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
        } catch (err: any) {
            toast.error(err.message || 'Failed to send');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-120px)] min-h-[600px] w-full bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Icon sidebar */}
            <div className="w-16 sm:w-20 border-r border-slate-800 flex flex-col items-center py-6 gap-5 bg-slate-950/50">
                {FOLDERS.map(({ id, icon: Icon, label }) => (
                    <button
                        key={id}
                        onClick={() => { setActiveFolder(id); setSelected(null); }}
                        title={label}
                        className={`group relative p-3 rounded-2xl transition-all ${activeFolder === id
                            ? 'bg-[#f5d400] text-slate-900 shadow-lg shadow-yellow-500/20'
                            : 'text-slate-500 hover:text-white hover:bg-slate-900'
                            }`}
                    >
                        <Icon className="w-5 h-5" />
                        <span className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none whitespace-nowrap font-bold uppercase tracking-widest">
                            {label}
                        </span>
                    </button>
                ))}
            </div>

            {/* Thread list */}
            <div className={`w-full md:w-80 lg:w-96 border-r border-slate-800 flex flex-col ${selected ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                    <div>
                        <h3 className="text-white font-bold text-sm capitalize">{activeFolder}</h3>
                        {accountEmail && (
                            <p className="text-[10px] text-[#f5d400] mt-0.5 truncate">{accountEmail}</p>
                        )}
                    </div>
                    <button
                        onClick={() => fetchEmails(activeFolder)}
                        disabled={loading}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="p-4 rounded-xl bg-slate-900/40 animate-pulse h-20 mb-2" />
                        ))
                    ) : emails.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <Mail className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="text-sm">No emails in {activeFolder}</p>
                        </div>
                    ) : (
                        emails.map(email => (
                            <button
                                key={email.messageId}
                                onClick={() => handleSelectEmail(email)}
                                className={`w-full text-left p-4 rounded-xl transition-all border ${selected?.messageId === email.messageId
                                    ? 'bg-[#f5d400]/10 border-[#f5d400]/40'
                                    : 'border-transparent hover:bg-slate-900 hover:border-slate-800'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-xs font-bold text-[#f5d400] truncate max-w-[140px] uppercase tracking-wider">
                                        {email.fromAddress?.split('<')[0].trim() || 'Unknown'}
                                    </span>
                                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                        {email.receivedTime ? new Date(Number(email.receivedTime)).toLocaleDateString() : ''}
                                    </span>
                                </div>
                                <h4 className="text-sm font-bold text-white truncate mb-1">
                                    {email.subject || '(No Subject)'}
                                </h4>
                                <p className="text-xs text-slate-400 line-clamp-2 opacity-70">
                                    {email.summary}
                                </p>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Email content */}
            <div className={`flex-1 flex flex-col bg-slate-950 ${!selected ? 'hidden md:flex' : 'flex'}`}>
                {selected ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-950/50">
                            <button
                                onClick={() => setSelected(null)}
                                className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-white font-bold truncate">{selected.subject || '(No Subject)'}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="neutral" className="text-[10px] px-1.5 py-0 bg-[#f5d400]/10 text-[#f5d400] border-[#f5d400]/20">ZOHO</Badge>
                                    <span className="text-[10px] text-slate-500">{selected.fromAddress}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button className="p-2 text-slate-400 hover:text-white transition-colors"><Archive className="w-4 h-4" /></button>
                                <button className="p-2 text-slate-400 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                <button className="p-2 text-slate-400 hover:text-white transition-colors"><MoreVertical className="w-4 h-4" /></button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                            {loadingEmail ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3">
                                    <Loader2 className="w-8 h-8 animate-spin text-[#f5d400]" />
                                    <p className="text-xs text-slate-400 animate-pulse">Loading email...</p>
                                </div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-6"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-[#f5d400]/10 flex items-center justify-center border border-[#f5d400]/20">
                                            <UserIcon className="w-6 h-6 text-[#f5d400]" />
                                        </div>
                                        <div>
                                            <p className="text-white font-bold">{selected.fromAddress}</p>
                                            <p className="text-xs text-slate-500">
                                                to {selected.toAddress} · {selected.receivedTime ? new Date(Number(selected.receivedTime)).toLocaleString() : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div
                                        className="prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed"
                                        dangerouslySetInnerHTML={{ __html: selected.content || selected.summary || '' }}
                                    />
                                </motion.div>
                            )}
                        </div>

                        {/* Reply box */}
                        <div className="p-6 pt-0">
                            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-2 focus-within:border-[#f5d400]/40 transition-all shadow-xl">
                                <textarea
                                    value={replyBody}
                                    onChange={e => setReplyBody(e.target.value)}
                                    placeholder="Type your reply..."
                                    className="w-full bg-transparent border-none focus:ring-0 text-white text-sm min-h-[90px] p-3 resize-none"
                                />
                                <div className="flex items-center justify-end p-2 border-t border-slate-900 mt-2">
                                    <button
                                        onClick={handleSendReply}
                                        disabled={sending || !replyBody.trim()}
                                        className="flex items-center gap-2 px-5 py-2 bg-[#f5d400] hover:bg-[#e6c700] disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 rounded-xl font-bold text-sm transition-all"
                                    >
                                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        Send Reply
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-slate-900/50 p-12 rounded-[3rem] border border-slate-800/50"
                        >
                            <div className="w-20 h-20 bg-[#f5d400]/10 rounded-3xl flex items-center justify-center border border-[#f5d400]/20 mb-6 mx-auto">
                                <Mail className="w-10 h-10 text-[#f5d400]" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Select an email</h3>
                            <p className="max-w-xs text-sm text-slate-500 leading-relaxed">
                                Manage your Zoho Mail conversations directly from AlphaClone.
                            </p>
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ZohoMailView;
