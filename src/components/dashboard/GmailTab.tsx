import React, { useState, useEffect } from 'react';
import { Mail, Search, Filter, RefreshCw, Send, Trash2, Inbox, Star, Archive, AlertCircle, Sparkles, ChevronDown } from 'lucide-react'; // Added ChevronDown
import { gmailService, GmailMessage } from '../../services/gmailService';
import { generateText } from '../../services/unifiedAIService';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';

const GmailTab: React.FC = () => {
    const { user } = useAuth();
    const [threads, setThreads] = useState<GmailMessage[]>([]); // List of thread summaries
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);

    // Conversation View
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [conversation, setConversation] = useState<GmailMessage[]>([]); // Full messages in thread
    const [loadingConversation, setLoadingConversation] = useState(false);

    const [isConnected, setIsConnected] = useState(false);
    const [activeFolder, setActiveFolder] = useState('inbox');

    // Compose State
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [composeData, setComposeData] = useState({ to: '', subject: '', body: '', threadId: undefined as string | undefined });

    // AI Assistant State
    const [showAIPrompt, setShowAIPrompt] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (user) {
            checkAndLoad();
        }
    }, [user, activeFolder]); // Reload when folder changes

    const checkAndLoad = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const connected = await gmailService.checkIntegration(user.id);
            setIsConnected(connected);
            if (connected) {
                // Map logical folders to Gmail labels
                const labelMap: Record<string, string[]> = {
                    'inbox': ['INBOX'],
                    'starred': ['STARRED'],
                    'sent': ['SENT'],
                    'trash': ['TRASH'],
                    'archive': [] // Archive is just 'no label', but typically we search 'minus inbox'. Gmail API requires explicit labels or searches.
                    // For simplicity, 'Archive' behavior in Gmail means removing 'INBOX'. 
                    // Viewing 'All Mail' is usually how you see archived stuff.
                };

                // Special case for archive: search everything but trash? Or just 'All Mail'? 'All Mail' is usually [].
                // Let's use internal logic or default 'INBOX'.
                let labels = labelMap[activeFolder] || ['INBOX'];
                if (activeFolder === 'archive') {
                    // Fetching 'All Mail' isn't a simple label usually, but 'in:archive' isn't an invalid search query.
                    // For now, let's just stick to 'INBOX' for the default load if map misses, or maybe handle this better later.
                    // Actually, 'archive' usually means user wants to see things NOT in inbox.
                    // Let's just load INBOX for 'inbox' and handle others if simple.
                }

                const { threads: newThreads, nextPageToken: token } = await gmailService.listThreads(user.id, 20, undefined, labels);
                setThreads(newThreads);
                setNextPageToken(token);
                setSelectedThreadId(null);
                setConversation([]);
            }
        } catch (err: any) {
            console.error('Initial load error:', err);
            toast.error('Failed to load Gmail threads');
        } finally {
            setLoading(false);
        }
    };

    const loadMore = async () => {
        if (!user || !nextPageToken) return;
        setLoadingMore(true);
        try {
            const { threads: newThreads, nextPageToken: token } = await gmailService.listThreads(user.id, 20, nextPageToken);
            setThreads(prev => [...prev, ...newThreads]);
            setNextPageToken(token);
        } catch (err) {
            toast.error('Failed to load more threads');
        } finally {
            setLoadingMore(false);
        }
    };

    const handleSelectThread = async (threadId: string) => {
        if (!user) return;
        setSelectedThreadId(threadId);
        setLoadingConversation(true);
        try {
            const msgs = await gmailService.getThread(user.id, threadId);
            setConversation(msgs);

            // Auto-scroll to bottom?
        } catch (err) {
            toast.error('Failed to load conversation');
        } finally {
            setLoadingConversation(false);
        }
    };

    const handleAction = async (action: 'archive' | 'trash') => {
        if (!user || !selectedThreadId) return;
        try {
            if (action === 'archive') {
                await gmailService.modifyThread(user.id, selectedThreadId, [], ['INBOX']);
                toast.success('Archived');
            } else if (action === 'trash') {
                await gmailService.modifyThread(user.id, selectedThreadId, ['TRASH'], []);
                toast.success('Moved to Trash');
            }
            // Remove from list
            setThreads(prev => prev.filter(t => t.id !== selectedThreadId));
            setSelectedThreadId(null);
            setConversation([]);
        } catch (err) {
            toast.error('Action failed');
        }
    };

    const handleSendEmail = async () => {
        if (!user || (!composeData.to && !composeData.threadId) || (!composeData.subject && !composeData.threadId)) return;

        setSending(true);
        try {
            await gmailService.sendMessage(user.id, composeData.to, composeData.subject, composeData.body, composeData.threadId);
            toast.success('Email sent successfully');
            setIsComposeOpen(false);

            // If replying, refresh conversation
            if (composeData.threadId) {
                const msgs = await gmailService.getThread(user.id, composeData.threadId);
                setConversation(msgs);
            } else {
                checkAndLoad(); // Refresh list if new thread
            }

            setComposeData({ to: '', subject: '', body: '', threadId: undefined });
        } catch (err) {
            console.error('Send error:', err);
            toast.error('Failed to send email');
        } finally {
            setSending(false);
        }
    };

    const openReply = () => {
        if (!conversation.length) return;
        const lastMsg = conversation[conversation.length - 1];
        setComposeData({
            to: lastMsg.from || '', // Parse email better in real app
            subject: lastMsg.subject || '', // Subject usually ignored in reply payload but kept for state
            body: '',
            threadId: selectedThreadId || undefined
        });
        setIsComposeOpen(true);
    };

    const handleAIGenerate = async () => {
        if (!aiPrompt.trim()) return;

        setIsGenerating(true);
        try {
            const result = await generateText(
                `Write a professional email with the following instructions: ${aiPrompt}. 
                 Keep it concise and professional. Return ONLY the email body text.`
            );

            if (result.text) {
                setComposeData(prev => ({
                    ...prev,
                    body: result.text || ''
                }));
                toast.success('Draft generated');
                setShowAIPrompt(false);
                setAiPrompt('');
            } else {
                toast.error('Failed to generate draft');
            }
        } catch (err) {
            console.error('AI Generate error:', err);
            toast.error('AI generation failed');
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isConnected && !loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <Mail className="w-10 h-10 text-slate-500" />
                </div>
                <h2 className="text-2xl font-bold mb-4">Gmail Not Connected</h2>
                <p className="text-slate-400 max-w-md mb-8">
                    Connect your individual Gmail account in Settings to read and send emails directly from AlphaClone.
                </p>
                <button
                    onClick={() => window.location.href = '/dashboard/settings'}
                    className="px-8 py-3 bg-teal-500 hover:bg-teal-600 text-slate-900 font-black tracking-widest uppercase rounded-xl transition-all"
                >
                    GO TO SETTINGS
                </button>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-slate-950 rounded-3xl border border-slate-900 overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 border-r border-slate-900 flex flex-col p-4 space-y-2">
                <button
                    onClick={() => {
                        setComposeData({ to: '', subject: '', body: '', threadId: undefined });
                        setIsComposeOpen(true);
                    }}
                    className="flex items-center gap-3 px-4 py-3 bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold rounded-xl mb-6 transition-all"
                >
                    <Send className="w-4 h-4" />
                    Compose
                </button>

                {[
                    { id: 'inbox', icon: Inbox, label: 'Inbox' },
                    { id: 'starred', icon: Star, label: 'Starred' },
                    { id: 'sent', icon: Send, label: 'Sent' },
                    { id: 'trash', icon: Trash2, label: 'Trash' },
                ].map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveFolder(item.id)}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${activeFolder === item.id ? 'bg-slate-900 text-teal-400 font-bold' : 'text-slate-500 hover:bg-slate-900/50 hover:text-slate-300'
                            }`}
                    >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                    </button>
                ))}
            </div>

            {/* Thread List */}
            <div className={`w-96 border-r border-slate-900 flex flex-col ${selectedThreadId ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-bottom border-slate-900">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search mail..."
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-teal-500/50 transition-all text-white"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto message-list-scrollbar">
                    {loading && threads.length === 0 ? (
                        <div className="p-8 text-center">
                            <RefreshCw className="w-6 h-6 animate-spin text-teal-500 mx-auto" />
                        </div>
                    ) : threads.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 italic text-sm">
                            No conversations found.
                        </div>
                    ) : (
                        <>
                            {threads.map((thread) => (
                                <button
                                    key={thread.id}
                                    onClick={() => handleSelectThread(thread.id)}
                                    className={`w-full text-left p-4 border-b border-slate-900/50 transition-all hover:bg-slate-900/30 ${selectedThreadId === thread.id ? 'bg-slate-900/50 border-l-2 border-l-teal-500' : ''
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`font-bold text-sm text-slate-200 truncate pr-2 ${selectedThreadId === thread.id ? 'text-teal-400' : ''}`}>
                                            {thread.from?.split('<')[0] || thread.from}
                                            {thread.messageCount && thread.messageCount > 1 && (
                                                <span className="text-slate-500 text-xs font-normal ml-1">({thread.messageCount})</span>
                                            )}
                                        </span>
                                        <span className="text-[10px] text-slate-500 shrink-0">
                                            {thread.date ? new Date(thread.date).toLocaleDateString() : ''}
                                        </span>
                                    </div>
                                    <div className="text-xs font-semibold text-slate-300 mb-1 truncate">
                                        {thread.subject}
                                    </div>
                                    <div className="text-xs text-slate-500 line-clamp-2">
                                        {thread.snippet}
                                    </div>
                                </button>
                            ))}
                            {nextPageToken && (
                                <button
                                    onClick={loadMore}
                                    disabled={loadingMore}
                                    className="w-full p-4 text-sm text-center text-teal-500 hover:text-teal-400 font-medium hover:bg-slate-900/30 transition-all flex items-center justify-center gap-2"
                                >
                                    {loadingMore ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                                    Load More
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Conversation Content */}
            <div className="flex-1 flex flex-col bg-slate-950">
                {selectedThreadId ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-slate-900 flex justify-between items-center bg-slate-900/30">
                            <div>
                                <h1 className="text-lg font-bold text-white mb-1">
                                    {conversation[0]?.subject || 'Conversation'}
                                </h1>
                                <div className="text-xs text-slate-500 gap-2 flex">
                                    <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                                        {activeFolder.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2 text-slate-500">
                                <button onClick={() => handleAction('archive')} className="p-2 hover:bg-slate-900 rounded-lg transition-all text-slate-400 hover:text-white" title="Archive">
                                    <Archive className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleAction('trash')} className="p-2 hover:bg-slate-900 rounded-lg transition-all text-red-400/50 hover:text-red-400" title="Delete">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto bg-slate-100/5 flex flex-col p-4 space-y-4">
                            {loadingConversation ? (
                                <div className="flex justify-center p-12">
                                    <RefreshCw className="w-8 h-8 animate-spin text-teal-500" />
                                </div>
                            ) : (
                                conversation.map((msg, idx) => (
                                    <div key={msg.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
                                        <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                                    {msg.from?.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-700">{msg.from?.split('<')[0]}</span>
                                                    <span className="text-[10px] text-slate-400">{new Date(msg.date!).toLocaleString()}</span>
                                                </div>
                                            </div>
                                            {idx === conversation.length - 1 && (
                                                <button onClick={openReply} className="text-xs text-teal-600 font-bold hover:underline">
                                                    Reply
                                                </button>
                                            )}
                                        </div>
                                        <div
                                            className="p-4 text-slate-800 prose prose-sm max-w-none"
                                            dangerouslySetInnerHTML={{
                                                __html: DOMPurify.sanitize(msg.body || '')
                                            }}
                                        />
                                    </div>
                                ))
                            )}

                            {/* Quick Reply Button at Bottom */}
                            {!loadingConversation && conversation.length > 0 && (
                                <button
                                    onClick={openReply}
                                    className="flex items-center gap-2 text-slate-400 hover:text-teal-400 p-4 border border-dashed border-slate-800 rounded-xl justify-center transition-all hover:bg-slate-900/30 group"
                                >
                                    <Send className="w-4 h-4 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
                                    <span>Click here to Reply</span>
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
                        <div className="w-16 h-16 bg-slate-900/50 rounded-full flex items-center justify-center mb-4">
                            <Mail className="w-8 h-8 opacity-20" />
                        </div>
                        <p>Select a conversation to read</p>
                    </div>
                )}
            </div>

            {/* Compose Modal (Shared for New & Reply) */}
            {isComposeOpen && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 rounded-t-2xl">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Send className="w-4 h-4 text-teal-500" />
                                {composeData.threadId ? 'Reply to Conversation' : 'New Message'}
                            </h3>
                            <button onClick={() => setIsComposeOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                            {!composeData.threadId && (
                                <>
                                    <input
                                        type="text"
                                        placeholder="To"
                                        value={composeData.to}
                                        onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-teal-500/50 transition-all"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Subject"
                                        value={composeData.subject}
                                        onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-teal-500/50 transition-all font-medium"
                                    />
                                </>
                            )}
                            {composeData.threadId && (
                                <div className="text-sm text-slate-400 bg-slate-950 p-3 rounded border border-slate-800">
                                    Replying to: <span className="text-white font-bold">{conversation[0]?.subject}</span>
                                </div>
                            )}

                            {/* AI Assistant */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowAIPrompt(!showAIPrompt)}
                                    className="flex items-center gap-2 text-xs font-bold text-teal-400 hover:text-teal-300 transition-colors bg-teal-500/10 px-3 py-1.5 rounded-lg border border-teal-500/20"
                                >
                                    <Sparkles className="w-3 h-3" />
                                    {showAIPrompt ? 'Close AI Assistant' : 'Write with AI'}
                                </button>
                            </div>

                            {showAIPrompt && (
                                <div className="bg-slate-950/50 p-4 rounded-xl border border-teal-500/20 space-y-3">
                                    <label className="text-xs font-bold text-teal-400 block">Tell AI what to write:</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={aiPrompt}
                                            onChange={(e) => setAiPrompt(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAIGenerate()}
                                            placeholder="e.g., Polite refusal..."
                                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
                                        />
                                        <button
                                            onClick={handleAIGenerate}
                                            disabled={isGenerating || !aiPrompt.trim()}
                                            className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 type-button"
                                        >
                                            {isGenerating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                            Generate
                                        </button>
                                    </div>
                                </div>
                            )}

                            <textarea
                                placeholder="Message body..."
                                value={composeData.body}
                                onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                                className="w-full h-64 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-slate-300 focus:outline-none focus:border-teal-500/50 transition-all font-mono text-sm leading-relaxed resize-none"
                            />
                        </div>
                        <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50 rounded-b-2xl">
                            <button
                                onClick={() => setIsComposeOpen(false)}
                                className="px-4 py-2 text-slate-400 hover:text-white font-medium text-sm transition-colors type-button"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleSendEmail}
                                disabled={sending || !composeData.body}
                                className="px-6 py-2 bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 type-button"
                            >
                                {sending ? 'Sending...' : 'Send Message'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GmailTab;
