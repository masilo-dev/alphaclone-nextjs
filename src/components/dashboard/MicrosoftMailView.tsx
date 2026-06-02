'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mail,
    Search,
    RefreshCw,
    Trash2,
    Star,
    ArrowLeft,
    Send,
    MoreVertical,
    CheckCircle2,
    Clock,
    User as UserIcon,
    Sparkles,
    BrainCircuit,
    Wand2,
    FileText
} from 'lucide-react';
import { EmailBody } from '../common/EmailBody';
import { Button, Badge } from '../ui/UIComponents';
import { microsoftGraphService } from '@/services/microsoftGraphService';
import { UnifiedEmailService } from '@/services/email/UnifiedEmailService';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const LABELS = [
    { id: 'inbox', label: 'Inbox', Icon: Mail },
    { id: 'sent', label: 'Sent', Icon: Send },
    { id: 'drafts', label: 'Drafts', Icon: FileText },
    { id: 'trash', label: 'Trash', Icon: Trash2 },
];

const CATEGORY_FILTERS = [
    { id: 'all', label: 'All', color: 'bg-slate-600' },
    { id: 'urgent', label: 'Urgent', color: 'bg-red-500' },
    { id: 'follow-up', label: 'Follow-up', color: 'bg-orange-500' },
    { id: 'newsletter', label: 'Newsletter', color: 'bg-blue-500' },
    { id: 'normal', label: 'Normal', color: 'bg-slate-500' },
];

interface MicrosoftMailViewProps {
    userId: string;
}

interface OutlookMessage {
    id: string;
    threadId: string;
    subject: string;
    from: string;
    to: string[];
    body: string;
    snippet: string;
    receivedAt: string;
    isRead: boolean;
    hasAttachments: boolean;
    webLink?: string;
    category?: string;
}

export const MicrosoftMailView: React.FC<MicrosoftMailViewProps> = ({ userId }) => {
    const [messages, setMessages] = useState<OutlookMessage[]>([]);
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [threadMessages, setThreadMessages] = useState<OutlookMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isThreadLoading, setIsThreadLoading] = useState(false);
    const [replyBody, setReplyBody] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [activeLabel, setActiveLabel] = useState('inbox');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [threadSummary, setThreadSummary] = useState<string | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const cleanEmailBody = (html?: string) => {
        if (!html) return '';
        return html.replace(/src="cid:[^"]+"/g, 'src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" style="display:none;"');
    };

    const fetchMessages = async (folder: string = activeLabel) => {
        setIsLoading(true);
        try {
            const fetched = await microsoftGraphService.getFolderMessages(folder, 25);
            // Apply category heuristics for demo and clean UX
            const enriched = fetched.map((msg: any) => {
                let category = 'normal';
                const subjectLower = (msg.subject || '').toLowerCase();
                const snippetLower = (msg.snippet || '').toLowerCase();
                if (subjectLower.includes('urgent') || subjectLower.includes('action required') || subjectLower.includes('important')) {
                    category = 'urgent';
                } else if (subjectLower.includes('follow up') || snippetLower.includes('follow-up') || subjectLower.includes('re:')) {
                    category = 'follow-up';
                } else if (subjectLower.includes('newsletter') || subjectLower.includes('digest') || snippetLower.includes('subscribe')) {
                    category = 'newsletter';
                }
                return { ...msg, category };
            });
            setMessages(enriched);
        } catch (err: any) {
            console.error('Failed to fetch Outlook messages:', err);
            toast.error(err.message || 'Failed to load Outlook emails');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredMessages = messages.filter(msg => {
        const matchesCategory = categoryFilter === 'all' || msg.category === categoryFilter;
        const matchesSearch = searchQuery.trim() === '' || 
            (msg.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (msg.from || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (msg.snippet || '').toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    useEffect(() => {
        fetchMessages(activeLabel);
    }, [userId, activeLabel]);

    const handleThreadSelect = async (message: OutlookMessage) => {
        setSelectedThreadId(message.threadId || message.id);
        setIsThreadLoading(true);
        try {
            let conversationMsgs: OutlookMessage[] = [];
            if (message.threadId) {
                try {
                    conversationMsgs = await microsoftGraphService.getConversationMessages(message.threadId);
                } catch (err) {
                    console.warn('Could not fetch full conversation list, falling back to single message:', err);
                    conversationMsgs = [message];
                }
            }

            if (conversationMsgs.length === 0) {
                // If not conversation found or failed, fetch full details for the specific message
                const detailed = await microsoftGraphService.getMessage(message.id);
                conversationMsgs = [{ ...message, ...detailed }];
            }

            // Enrich conversation messages with categories
            const enriched = conversationMsgs.map(msg => ({
                ...msg,
                category: message.category
            }));

            setThreadMessages(enriched);
            setThreadSummary(null);

            if (enriched.length >= 2) {
                handleSummarize(message.threadId || message.id, enriched);
            }
        } catch (err: any) {
            console.error('Failed to load email thread:', err);
            toast.error('Failed to load email conversation details');
        } finally {
            setIsThreadLoading(false);
        }
    };

    const handleSummarize = async (threadId: string, messagesList: any[]) => {
        setIsSummarizing(true);
        try {
            const res = await UnifiedEmailService.summarizeThread(threadId, messagesList);
            if (res.success) {
                setThreadSummary(res.summary);
            }
        } catch (err) {
            console.error('Summarization failed:', err);
        } finally {
            setIsSummarizing(false);
        }
    };

    const handleAIDraft = async () => {
        if (!selectedThreadId || threadMessages.length === 0) return;
        setIsSending(true);
        const toastId = toast.loading('AI drafting response...', { id: 'ai-draft' });
        try {
            const lastMsg = threadMessages[threadMessages.length - 1];
            const context = threadSummary ? `Summary: ${threadSummary}` : `Subject: ${lastMsg.subject}`;
            const res = await UnifiedEmailService.generateDraft(lastMsg.id, 'outlook', context);
            if (res.success) {
                setReplyBody(res.result);
                toast.success('AI draft generated', { id: 'ai-draft' });
            } else {
                toast.error('AI draft failed', { id: 'ai-draft' });
            }
        } catch (err) {
            toast.error('AI draft failed', { id: 'ai-draft' });
        } finally {
            setIsSending(false);
        }
    };

    const handleSendReply = async () => {
        if (!replyBody.trim() || !selectedThreadId || threadMessages.length === 0) return;
        setIsSending(true);
        try {
            const lastMessage = threadMessages[threadMessages.length - 1];
            
            // Call the reply API
            await microsoftGraphService.replyToMessage(lastMessage.id, replyBody);
            setReplyBody('');
            toast.success('Reply sent successfully!');
            
            // Reload thread
            if (lastMessage.threadId) {
                const refreshed = await microsoftGraphService.getConversationMessages(lastMessage.threadId);
                setThreadMessages(refreshed);
            } else {
                const refreshed = await microsoftGraphService.getMessage(lastMessage.id);
                setThreadMessages([refreshed]);
            }
        } catch (err: any) {
            console.error('Failed to send reply:', err);
            toast.error(err.message || 'Failed to send reply via Outlook');
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
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'text-slate-500 hover:text-white hover:bg-slate-900'
                            }`}
                        title={label}
                    >
                        <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                        <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none whitespace-nowrap font-bold uppercase tracking-widest">
                            {label}
                        </span>
                    </button>
                ))}
            </div>

            {/* Sidebar: Message List */}
            <div className={`w-full md:w-80 lg:w-96 border-r border-slate-800 flex flex-col ${selectedThreadId ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        {(() => {
                            const current = LABELS.find(l => l.id === activeLabel);
                            const Icon = current?.Icon || Mail;
                            return <Icon className="w-5 h-5 text-blue-400" />;
                        })()}
                        {LABELS.find(l => l.id === activeLabel)?.label || 'Inbox'}
                    </h3>
                    <Button variant="outline" size="sm" onClick={() => fetchMessages(activeLabel)} isLoading={isLoading} className="h-8 w-8 p-0">
                        <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                </div>

                {/* Search Bar */}
                <div className="p-3 border-b border-slate-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search mail..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                </div>

                {/* Category Filter Chips */}
                <div className="p-3 border-b border-slate-800 flex gap-2 overflow-x-auto custom-scrollbar">
                    {CATEGORY_FILTERS.map((filter) => (
                        <button
                            key={filter.id}
                            onClick={() => setCategoryFilter(filter.id)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                                categoryFilter === filter.id
                                    ? `${filter.color} text-white shadow-lg`
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                            }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="p-4 rounded-xl border border-transparent bg-slate-900/40 animate-pulse h-24 mb-2" />
                        ))
                    ) : filteredMessages.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <Mail className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="text-sm">No emails found in {LABELS.find(l => l.id === activeLabel)?.label}</p>
                        </div>
                    ) : (
                        filteredMessages.map((msg) => {
                            const category = msg.category || 'normal';
                            const categoryInfo = CATEGORY_FILTERS.find(f => f.id === category) || CATEGORY_FILTERS[4];
                            return (
                                <button
                                    key={msg.id}
                                    onClick={() => handleThreadSelect(msg)}
                                    className={`w-full text-left p-4 rounded-xl transition-all border ${
                                        selectedThreadId === (msg.threadId || msg.id)
                                            ? 'bg-blue-500/10 border-blue-500/50 shadow-lg shadow-blue-500/5'
                                            : 'border-transparent hover:bg-slate-900 hover:border-slate-800'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-blue-400 truncate max-w-[140px] uppercase tracking-wider">
                                            {activeLabel === 'sent'
                                                ? (msg.subject?.slice(0, 15) || 'Sent Message')
                                                : (msg.from?.split('@')[0].split('<')[0].replace(/[".]/g, ' ').trim() || 'Unknown')}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {category !== 'normal' && (
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${categoryInfo.color} text-white`}>
                                                    {categoryInfo.label}
                                                </span>
                                            )}
                                            <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                                {msg.receivedAt ? formatDistanceToNow(new Date(msg.receivedAt), { addSuffix: true }) : ''}
                                            </span>
                                        </div>
                                    </div>
                                    <h4 className="text-sm font-bold text-white truncate mb-1">
                                        {msg.subject || '(No Subject)'}
                                    </h4>
                                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed opacity-70">
                                        {msg.snippet}
                                    </p>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Main Content: Conversation View */}
            <div className={`flex-1 flex flex-col bg-slate-950 ${!selectedThreadId ? 'hidden md:flex' : 'flex'}`}>
                {selectedThreadId ? (
                    <>
                        {/* Thread Header */}
                        <div className="p-4 border-b border-slate-800 flex items-center gap-4 bg-slate-950/50 backdrop-blur-sm">
                            <Button variant="outline" size="sm" onClick={handleBackToList} className="md:hidden">
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-white font-bold truncate">
                                    {threadMessages[0]?.subject || 'Loading conversation...'}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="blue" className="text-xs px-1.5 py-0">OUTLOOK</Badge>
                                    <span className="text-xs text-slate-500">{threadMessages.length} messages</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handleSummarize(selectedThreadId, threadMessages)}
                                    isLoading={isSummarizing}
                                    className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10 h-8"
                                >
                                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                                    Summarize
                                </Button>
                                {threadMessages[0]?.webLink && (
                                    <a
                                        href={threadMessages[0].webLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-400 hover:text-blue-300 font-bold px-3 py-1.5 border border-blue-500/20 hover:bg-blue-500/10 rounded-xl transition-all"
                                    >
                                        View in Outlook
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* AI Summary Banner */}
                        <AnimatePresence>
                            {threadSummary && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-6 bg-violet-600/10 border-b border-violet-500/20 relative">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center shrink-0 border border-violet-500/30">
                                                <BrainCircuit className="w-5 h-5 text-violet-400" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-xs font-black text-violet-400 uppercase tracking-widest mb-2">Nexus Thread Intelligence</h4>
                                                <p className="text-sm text-slate-200 leading-relaxed italic">
                                                    "{threadSummary}"
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Messages List */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-12 custom-scrollbar bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900/10">
                            {isThreadLoading ? (
                                <div className="flex flex-col items-center justify-center h-full gap-4">
                                    <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
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
                                                <UserIcon className="w-6 h-6 text-blue-400" />
                                            </div>
                                            <div className="flex-1 rounded-2xl p-0 transition-all">
                                                <div className="flex justify-between items-center mb-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-base font-bold text-white tracking-wide">{msg.from}</span>
                                                        <span className="text-xs text-slate-500 uppercase tracking-widest mt-0.5">
                                                            {msg.receivedAt ? new Date(msg.receivedAt).toLocaleString() : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="mt-4">
                                                    <EmailBody content={cleanEmailBody(msg.body)} />
                                                </div>
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
                        {activeLabel !== 'sent' && (
                            <div className="p-6 pt-0 mt-auto">
                                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-2 focus-within:border-blue-500/50 transition-all shadow-xl">
                                    <textarea
                                        value={replyBody}
                                        onChange={(e) => setReplyBody(e.target.value)}
                                        placeholder="Type your response..."
                                        className="w-full bg-transparent border-none focus:ring-0 text-white text-sm min-h-[100px] p-3 resize-none custom-scrollbar outline-none"
                                    />
                                    <div className="flex items-center justify-between p-2 border-t border-slate-900 mt-2">
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={handleAIDraft}
                                                disabled={isSending}
                                                className="bg-violet-600/10 border-violet-600/30 text-violet-400 hover:bg-violet-600/20 font-bold"
                                            >
                                                <Wand2 className="w-3.5 h-3.5 mr-2" />
                                                AI Draft
                                            </Button>
                                        </div>
                                        <Button
                                            onClick={handleSendReply}
                                            disabled={isSending || !replyBody.trim()}
                                            isLoading={isSending}
                                            className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white"
                                        >
                                            <Send className="w-4 h-4 mr-2" /> Send Reply
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-slate-900/50 p-12 rounded-[3rem] border border-slate-800/50 backdrop-blur-3xl"
                        >
                            <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center border border-blue-500/20 mb-6 mx-auto">
                                <Mail className="w-10 h-10 text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Select an email to review</h3>
                            <p className="max-w-xs text-sm text-slate-500 leading-relaxed">
                                Review and compose Outlook messages directly from your AlphaClone dashboard.
                            </p>
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
};
