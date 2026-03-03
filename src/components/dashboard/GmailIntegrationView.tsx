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

    const fetchThreads = async () => {
        setIsLoading(true);
        try {
            const { threads: fetchedThreads } = await gmailService.listThreads(userId);
            setThreads(fetchedThreads);
        } catch (err: any) {
            console.error('Failed to fetch Gmail threads:', err);
            toast.error(err.message || 'Failed to load inbox');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchThreads();
    }, [userId]);

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
        if (!replyBody.trim() || !selectedThreadId || threadMessages.length === 0) return;

        setIsSending(true);
        const lastMsg = threadMessages[threadMessages.length - 1];
        try {
            await gmailService.sendMessage(
                userId,
                lastMsg.from || '',
                `Re: ${lastMsg.subject || 'No Subject'}`,
                replyBody,
                selectedThreadId
            );
            toast.success('Message sent');
            setReplyBody('');
            // Refresh thread
            const updatedMessages = await gmailService.getThread(userId, selectedThreadId);
            setThreadMessages(updatedMessages);
        } catch (err: any) {
            console.error('Failed to send reply:', err);
            toast.error('Failed to send message');
        } finally {
            setIsSending(false);
        }
    };

    const handleBackToList = () => {
        setSelectedThreadId(null);
        setThreadMessages([]);
    };

    return (
        <div className="flex h-[calc(100vh-280px)] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Sidebar: Thread List */}
            <div className={`w-full md:w-80 lg:w-96 border-r border-slate-800 flex flex-col ${selectedThreadId ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <Mail className="w-5 h-5 text-teal-400" /> Inbox
                    </h3>
                    <Button variant="secondary" size="sm" onClick={fetchThreads} isLoading={isLoading}>
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
                            <p className="text-sm">No emails found in INBOX</p>
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
                                        {thread.from?.split('<')[0].trim() || 'Unknown'}
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

            {/* Main Content: Conversation View */}
            <div className={`flex-1 flex flex-col bg-slate-900/20 ${!selectedThreadId ? 'hidden md:flex' : 'flex'}`}>
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

                        {/* Messages List */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            {isThreadLoading ? (
                                <div className="flex flex-col items-center justify-center h-full gap-4">
                                    <div className="w-10 h-10 border-2 border-teal-500/20 border-t-teal-500 rounded-full animate-spin"></div>
                                    <p className="text-xs text-slate-400 animate-pulse uppercase tracking-[0.2em]">Decompressing Neural Thread...</p>
                                </div>
                            ) : (
                                threadMessages.map((msg, idx) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="relative group gap-4 flex flex-col"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-950">
                                                <UserIcon className="w-5 h-5 text-slate-500" />
                                            </div>
                                            <div className="flex-1 group-hover:bg-slate-900/50 rounded-2xl p-4 transition-all -m-4">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-sm font-bold text-white">{msg.from}</span>
                                                    <span className="text-[10px] text-slate-500">{msg.date}</span>
                                                </div>
                                                <div
                                                    className="text-sm text-slate-300 leading-relaxed gmail-body-content"
                                                    dangerouslySetInnerHTML={{ __html: msg.body || msg.snippet }}
                                                />
                                            </div>
                                        </div>
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
