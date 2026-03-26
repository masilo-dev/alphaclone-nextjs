'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mail,
    Search,
    RefreshCw,
    Archive,
    Trash2,
    Star,
    ArrowLeft,
    Send,
    MoreVertical,
    CheckCircle2,
    Clock,
    User as UserIcon
} from 'lucide-react';
import { Button, Badge } from '../ui/UIComponents';
import { gmailService, GmailMessage } from '../../services/gmailService';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const LABELS = [
    { id: 'INBOX', label: 'Inbox', Icon: Mail },
    { id: 'SENT', label: 'Sent', Icon: Send },
    { id: 'TRASH', label: 'Trash', Icon: Trash2 },
    { id: 'STARRED', label: 'Starred', Icon: Star },
];

interface GmailIntegrationViewProps {
    userId: string;
}

export const GmailIntegrationView: React.FC<GmailIntegrationViewProps> = ({ userId }) => {
    const [threads, setThreads] = useState<GmailMessage[]>([]);
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [threadMessages, setThreadMessages] = useState<GmailMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isThreadLoading, setIsThreadLoading] = useState(false);
    const [replyBody, setReplyBody] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [activeLabel, setActiveLabel] = useState('INBOX');

    // Simplified content cleaner for "Coming Soon" phase
    const cleanEmailBody = (html?: string) => {
        if (!html) return '';
        // Replace broken cid: images with a clean placeholder to avoid "broken image" icons
        return html.replace(/src="cid:[^"]+"/g, 'src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" style="display:none;"');
    };

    const fetchThreads = async (labelId: string = activeLabel) => {
        setIsLoading(true);
        try {
            const { threads: fetchedThreads } = await gmailService.listThreads(userId, 20, undefined, [labelId]);
            setThreads(fetchedThreads);
        } catch (err: any) {
            console.error('Failed to fetch Gmail threads:', err);
            toast.error(err.message || 'Failed to load emails');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchThreads(activeLabel);
    }, [userId, activeLabel]);

    const handleThreadSelect = async (threadId: string) => {
        setSelectedThreadId(threadId);
        setIsThreadLoading(true);
        try {
            const messages = await gmailService.getThread(userId, threadId);
            setThreadMessages(messages);
        } catch (err: any) {
            console.error('Failed to fetch thread messages:', err);
            toast.error('Failed to load conversation');
        } finally {
            setIsThreadLoading(false);
        }
    };

    const handleSendReply = async () => {
        if (!replyBody.trim() || !selectedThreadId) return;
        setIsSending(true);
        try {
            const lastMessage = threadMessages[threadMessages.length - 1];
            const to = lastMessage?.from || '';
            const subject = lastMessage?.subject
                ? (lastMessage.subject.startsWith('Re:') ? lastMessage.subject : `Re: ${lastMessage.subject}`)
                : 'Re: (no subject)';
            await gmailService.sendMessage(userId, to, subject, replyBody, selectedThreadId);
            setReplyBody('');
            toast.success('Reply sent!');
            // Refresh thread
            const messages = await gmailService.getThread(userId, selectedThreadId);
            setThreadMessages(messages);
        } catch (err: any) {
            console.error('Failed to send reply:', err);
            toast.error(err.message || 'Failed to send reply');
        } finally {
            setIsSending(false);
        }
    };

    const handleBackToList = () => {
        setSelectedThreadId(null);
        setThreadMessages([]);
    };

    return (
        <div className="flex h-[calc(100vh-120px)] min-h-[600px] w-full bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Folder Sidebar */}
            <div className="w-16 sm:w-20 md:w-24 border-r border-slate-800 flex flex-col items-center py-6 gap-6 bg-slate-950/50">
                {LABELS.map(({ id, Icon, label }) => (
                    <button
                        key={id}
                        onClick={() => {
                            setActiveLabel(id);
                            setSelectedThreadId(null);
                        }}
                        className={`group relative p-3 rounded-2xl transition-all ${activeLabel === id
                            ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
                            : 'text-slate-500 hover:text-white hover:bg-slate-900'
                            }`}
                        title={label}
                    >
                        <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                        <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none whitespace-nowrap font-bold uppercase tracking-widest">
                            {label}
                        </span>
                    </button>
                ))}
            </div>

            {/* Sidebar: Thread List */}
            <div className={`w-full md:w-80 lg:w-96 border-r border-slate-800 flex flex-col ${selectedThreadId ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        {(() => {
                            const current = LABELS.find(l => l.id === activeLabel);
                            const Icon = current?.Icon || Mail;
                            return <Icon className="w-5 h-5 text-teal-400" />;
                        })()}
                        {LABELS.find(l => l.id === activeLabel)?.label || 'Inbox'}
                    </h3>
                    <Button variant="secondary" size="sm" onClick={() => fetchThreads(activeLabel)} isLoading={isLoading}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="p-4 rounded-xl border border-transparent bg-slate-900/40 animate-pulse h-24 mb-2" />
                        ))
                    ) : threads.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <Mail className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="text-sm">No emails found in {LABELS.find(l => l.id === activeLabel)?.label}</p>
                        </div>
                    ) : (
                        threads.map((thread) => (
                            <button
                                key={thread.threadId}
                                onClick={() => handleThreadSelect(thread.threadId)}
                                className={`w-full text-left p-4 rounded-xl transition-all border ${selectedThreadId === thread.threadId
                                    ? 'bg-teal-500/10 border-teal-500/50 shadow-lg shadow-teal-500/5'
                                    : 'border-transparent hover:bg-slate-900 hover:border-slate-800'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-xs font-bold text-teal-400 truncate max-w-[140px] uppercase tracking-wider">
                                        {activeLabel === 'SENT'
                                            ? (thread.subject?.slice(0, 15) || 'Sent Message')
                                            : (thread.from?.split('<')[0].trim() || 'Unknown')}
                                    </span>
                                    <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                        {thread.date ? formatDistanceToNow(new Date(thread.date), { addSuffix: true }) : ''}
                                    </span>
                                </div>
                                <h4 className="text-sm font-bold text-white truncate mb-1">
                                    {thread.subject || '(No Subject)'}
                                </h4>
                                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed opacity-70">
                                    {thread.snippet}
                                </p>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Main Content: Conversation View - Removed bg-slate-900/20 for "on top" feel */}
            <div className={`flex-1 flex flex-col bg-slate-950 ${!selectedThreadId ? 'hidden md:flex' : 'flex'}`}>
                {selectedThreadId ? (
                    <>
                        {/* Thread Header */}
                        <div className="p-4 border-b border-slate-800 flex items-center gap-4 bg-slate-950/50 backdrop-blur-sm">
                            <Button variant="secondary" size="sm" onClick={handleBackToList} className="md:hidden">
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-white font-bold truncate">
                                    {threadMessages[0]?.subject || 'Loading conversation...'}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="neutral" className="text-[10px] px-1.5 py-0">GMAIL</Badge>
                                    <span className="text-[10px] text-slate-500">{threadMessages.length} messages</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="p-2 text-slate-400 hover:text-white transition-colors"><Archive className="w-4 h-4" /></button>
                                <button className="p-2 text-slate-400 hover:text-white transition-colors"><Trash2 className="w-4 h-4" /></button>
                                <button className="p-2 text-slate-400 hover:text-white transition-colors"><MoreVertical className="w-4 h-4" /></button>
                            </div>
                        </div>

                        {/* Messages List - Increased padding and removed recessed backgrounds */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-12 custom-scrollbar bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900/10">
                            {isThreadLoading ? (
                                <div className="flex flex-col items-center justify-center h-full gap-4">
                                    <div className="w-10 h-10 border-2 border-teal-500/20 border-t-teal-500 rounded-full animate-spin"></div>
                                    <p className="text-xs text-slate-400 animate-pulse uppercase tracking-[0.2em]">Loading email thread...</p>
                                </div>
                            ) : (
                                threadMessages.map((msg, idx) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="relative flex flex-col"
                                    >
                                        <div className="flex items-start gap-6">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-950 shadow-xl ring-1 ring-white/5">
                                                <UserIcon className="w-6 h-6 text-teal-400" />
                                            </div>
                                            <div className="flex-1 rounded-2xl p-0 transition-all">
                                                <div className="flex justify-between items-center mb-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-base font-bold text-white tracking-wide">{msg.from}</span>
                                                        <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{msg.date}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button className="p-2 text-slate-500 hover:text-teal-400 transition-colors bg-slate-900/50 rounded-lg border border-slate-800"><Star className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                </div>
                                                <div
                                                    className="prose prose-invert max-w-none text-slate-200 text-[15px] leading-relaxed overflow-x-auto selection:bg-teal-500/30 font-medium"
                                                    dangerouslySetInnerHTML={{ __html: cleanEmailBody(msg.body) }}
                                                />
                                            </div>
                                        </div>
                                        {idx < threadMessages.length - 1 && (
                                            <div className="absolute left-6 top-16 bottom-[-32px] w-px bg-gradient-to-b from-slate-800 to-transparent opacity-30" />
                                        )}
                                    </motion.div>
                                ))
                            )}
                        </div>

                        {/* Reply Box */}
                        <div className="p-6 pt-0 mt-auto">
                            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-2 focus-within:border-teal-500/50 transition-all shadow-xl">
                                <textarea
                                    value={replyBody}
                                    onChange={(e) => setReplyBody(e.target.value)}
                                    placeholder="Type your response..."
                                    className="w-full bg-transparent border-none focus:ring-0 text-white text-sm min-h-[100px] p-3 resize-none custom-scrollbar"
                                />
                                <div className="flex items-center justify-between p-2 border-t border-slate-900 mt-2">
                                    <div className="flex items-center gap-2">
                                        <Button variant="secondary" size="sm" className="opacity-50 hover:opacity-100">AI Draft</Button>
                                    </div>
                                    <Button
                                        onClick={handleSendReply}
                                        disabled={isSending || !replyBody.trim()}
                                        isLoading={isSending}
                                        className="h-9 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950"
                                    >
                                        <Send className="w-4 h-4 mr-2" /> Send Reply
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-slate-900/50 p-12 rounded-[3rem] border border-slate-800/50 backdrop-blur-3xl"
                        >
                            <div className="w-20 h-20 bg-teal-500/10 rounded-3xl flex items-center justify-center border border-teal-500/20 mb-6 mx-auto">
                                <Mail className="w-10 h-10 text-teal-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Select a thread to review</h3>
                            <p className="max-w-xs text-sm text-slate-500 leading-relaxed">
                                Seamlessly manage your Gmail conversations directly from your AlphaClone dashboard.
                            </p>
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
};
