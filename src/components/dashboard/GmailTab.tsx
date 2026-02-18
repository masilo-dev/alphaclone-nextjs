import React, { useState, useEffect, useRef } from 'react';
import { Mail, Search, Filter, RefreshCw, Send, Trash2, Inbox, Star, Archive, AlertCircle, Sparkles, ChevronDown, Menu, ArrowLeft, Users, X } from 'lucide-react';
import { gmailService, GmailMessage } from '../../services/gmailService';
import unifiedAIService from '../../services/unifiedAIService';
import { useAuth } from '../../contexts/AuthContext';
import { leadService, Lead } from '../../services/leadService';
import { businessClientService, BusinessClient } from '../../services/businessClientService';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';

interface ContactOption {
    id: string;
    name: string;
    email: string;
    type: 'lead' | 'client';
    industry?: string;
    notes?: string;
    businessName?: string;
}

const GmailTab: React.FC = () => {
    const { user } = useAuth();
    const [threads, setThreads] = useState<GmailMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);

    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [conversation, setConversation] = useState<GmailMessage[]>([]);
    const [loadingConversation, setLoadingConversation] = useState(false);

    const [isConnected, setIsConnected] = useState(false);
    const [activeFolder, setActiveFolder] = useState('inbox');

    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [composeData, setComposeData] = useState({ to: '', subject: '', body: '', threadId: undefined as string | undefined });

    const [showAIPrompt, setShowAIPrompt] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const [showMobileSidebar, setShowMobileSidebar] = useState(false);

    // CRM Contact Picker state
    const [contacts, setContacts] = useState<ContactOption[]>([]);
    const [contactSearch, setContactSearch] = useState('');
    const [showContactPicker, setShowContactPicker] = useState(false);
    const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const contactPickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (user) {
            checkAndLoad();
        }
    }, [user, activeFolder]);

    // Close contact picker on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (contactPickerRef.current && !contactPickerRef.current.contains(e.target as Node)) {
                setShowContactPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const checkAndLoad = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const connected = await gmailService.checkIntegration(user.id);
            setIsConnected(connected);
            if (connected) {
                const labelMap: Record<string, string[]> = {
                    'inbox': ['INBOX'],
                    'starred': ['STARRED'],
                    'sent': ['SENT'],
                    'trash': ['TRASH'],
                    'archive': []
                };
                const labels = labelMap[activeFolder] || ['INBOX'];
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

            if (composeData.threadId) {
                const msgs = await gmailService.getThread(user.id, composeData.threadId);
                setConversation(msgs);
            } else {
                checkAndLoad();
            }

            setComposeData({ to: '', subject: '', body: '', threadId: undefined });
            setSelectedContact(null);
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
            to: lastMsg.from || '',
            subject: lastMsg.subject || '',
            body: '',
            threadId: selectedThreadId || undefined
        });
        setIsComposeOpen(true);
    };

    // Load CRM contacts when compose opens
    const openCompose = async (initial?: Partial<typeof composeData>) => {
        setComposeData({ to: '', subject: '', body: '', threadId: undefined, ...initial });
        setSelectedContact(null);
        setContactSearch('');
        setIsComposeOpen(true);

        if (contacts.length === 0) {
            setLoadingContacts(true);
            try {
                const allContacts: ContactOption[] = [];

                // Fetch CRM clients
                if (user) {
                    const { clients } = await businessClientService.getClients(
                        // tenantId from user metadata or fallback
                        (user as any).tenantId || user.id,
                        1, 100
                    );
                    clients.forEach(c => {
                        if (c.email) {
                            allContacts.push({
                                id: c.id,
                                name: c.name,
                                email: c.email,
                                type: 'client',
                                industry: c.industry,
                                businessName: c.name,
                            });
                        }
                    });
                }

                // Fetch leads
                const { leads } = await leadService.getLeads();
                leads.forEach(l => {
                    if (l.email) {
                        allContacts.push({
                            id: l.id,
                            name: l.businessName,
                            email: l.email,
                            type: 'lead',
                            industry: l.industry,
                            notes: l.notes,
                            businessName: l.businessName,
                        });
                    }
                });

                setContacts(allContacts);
            } catch (err) {
                console.error('Failed to load contacts:', err);
            } finally {
                setLoadingContacts(false);
            }
        }
    };

    const handleSelectContact = (contact: ContactOption) => {
        setSelectedContact(contact);
        setComposeData(prev => ({ ...prev, to: contact.email }));
        setShowContactPicker(false);
        setContactSearch('');
    };

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(contactSearch.toLowerCase())
    );

    const handleAIGenerate = async () => {
        if (!aiPrompt.trim()) return;

        setIsGenerating(true);
        try {
            // Build context-aware prompt if a contact is selected
            let fullPrompt = `Write a professional email with the following instructions: ${aiPrompt}. Keep it concise and professional. Return ONLY the email body text.`;

            if (selectedContact) {
                fullPrompt = `Write a professional email targeted to the following contact:
- Name/Business: ${selectedContact.businessName || selectedContact.name}
- Email: ${selectedContact.email}
${selectedContact.industry ? `- Industry: ${selectedContact.industry}` : ''}
${selectedContact.notes ? `- Notes/Context: ${selectedContact.notes}` : ''}
- Contact Type: ${selectedContact.type === 'lead' ? 'Potential Lead' : 'Existing Client'}

Instructions: ${aiPrompt}

Keep it concise, professional, and personalized to their business context. Return ONLY the email body text.`;
            }

            const result = await unifiedAIService.generateText(fullPrompt);

            if (result.text) {
                setComposeData(prev => ({ ...prev, body: result.text || '' }));
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
            <div className="w-full h-full overflow-y-auto flex flex-col items-center justify-start sm:justify-center py-8 px-4 sm:px-6 text-center">
                <div className="w-full max-w-sm sm:max-w-md mx-auto flex flex-col items-center">
                    <div className="w-14 h-14 sm:w-20 sm:h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4 sm:mb-6">
                        <Mail className="w-7 h-7 sm:w-10 sm:h-10 text-slate-500" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3">Gmail Not Connected</h2>
                    <p className="text-slate-400 text-sm sm:text-base mb-5 sm:mb-7">
                        Connect your Gmail account to read and send emails directly from AlphaClone.
                    </p>

                    <div className="w-full text-left bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 mb-4 space-y-3 sm:space-y-4">
                        <h3 className="text-white font-bold text-xs sm:text-sm uppercase tracking-widest mb-3 sm:mb-4 flex items-center gap-2">
                            <span className="w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center text-slate-900 text-xs font-black shrink-0">!</span>
                            How to Connect Gmail
                        </h3>
                        {[
                            'Go to <b>Settings</b> from the left sidebar menu.',
                            'Find the <b>Integrations</b> section and press <b class="text-teal-400">Connect Gmail</b>.',
                            'A Google sign-in window will open — <b>give access</b> to your Gmail account.',
                            'After giving access, you will be <b>automatically logged out</b> — you will need to <b>log back in manually</b>. This confirms you are the owner of the account.',
                            'Once logged back in, return to the <b>Gmail</b> tab — your inbox will be ready!',
                        ].map((step, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <span className="w-6 h-6 bg-teal-500/20 text-teal-400 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                                <p className="text-slate-300 text-xs sm:text-sm" dangerouslySetInnerHTML={{ __html: step }} />
                            </div>
                        ))}
                    </div>

                    <div className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-3 sm:p-4 text-left">
                        <p className="text-xs text-slate-500 leading-relaxed">
                            <span className="text-slate-400 font-bold">🔒 Privacy Notice:</span> AlphaClone does <span className="font-bold text-slate-300">not</span> delete or modify your Gmail data. To delete a conversation, please do so directly in your <span className="font-bold text-slate-300">Gmail app</span>.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-full flex flex-col min-h-0">
            <div className="flex flex-1 min-h-0 bg-slate-950 rounded-3xl border border-slate-900 overflow-hidden">
                {/* Mobile Sidebar Overlay */}
                {showMobileSidebar && (
                    <div
                        className="fixed inset-0 bg-black/50 z-40 md:hidden"
                        onClick={() => setShowMobileSidebar(false)}
                    />
                )}

                {/* Sidebar */}
                <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-950 border-r border-slate-900 flex flex-col p-4 space-y-2 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="flex justify-between items-center md:hidden mb-4 px-2">
                        <span className="font-bold text-white">Mailbox</span>
                        <button onClick={() => setShowMobileSidebar(false)} className="text-slate-400">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            openCompose();
                            setShowMobileSidebar(false);
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
                            onClick={() => {
                                setActiveFolder(item.id);
                                setShowMobileSidebar(false);
                            }}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${activeFolder === item.id ? 'bg-slate-900 text-teal-400 font-bold' : 'text-slate-500 hover:bg-slate-900/50 hover:text-slate-300'
                                }`}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </button>
                    ))}
                </div>

                {/* Thread List */}
                <div className={`w-full md:w-96 border-r border-slate-900 flex flex-col min-h-0 ${selectedThreadId ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-bottom border-slate-900 flex gap-2">
                        <button
                            onClick={() => setShowMobileSidebar(true)}
                            className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search mail..."
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-teal-500/50 transition-all text-white"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto message-list-scrollbar overscroll-contain touch-pan-y ios-scroll">
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
                <div className={`flex-1 flex flex-col bg-slate-950 min-h-0 ${!selectedThreadId ? 'hidden md:flex' : 'flex'}`}>
                    {selectedThreadId ? (
                        <>
                            {/* Header */}
                            <div className="p-4 border-b border-slate-900 flex justify-between items-center bg-slate-900/30">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setSelectedThreadId(null)}
                                        className="md:hidden p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                    <div>
                                        <h1 className="text-lg font-bold text-white mb-1 line-clamp-1">
                                            {conversation[0]?.subject || 'Conversation'}
                                        </h1>
                                        <div className="text-xs text-slate-500 gap-2 flex">
                                            <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                                                {activeFolder.toUpperCase()}
                                            </span>
                                        </div>
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
                            <div className="flex-1 overflow-y-auto bg-slate-100/5 flex flex-col p-4 space-y-4 overscroll-contain touch-pan-y" style={{ minHeight: 0 }}>
                                {loadingConversation ? (
                                    <div className="flex justify-center p-12">
                                        <RefreshCw className="w-8 h-8 animate-spin text-teal-500" />
                                    </div>
                                ) : (
                                    conversation.map((msg, idx) => (
                                        <div key={msg.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200 flex-shrink-0">
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
                                                className="p-4 text-slate-800 prose prose-sm max-w-none overflow-x-auto"
                                                dangerouslySetInnerHTML={{
                                                    __html: DOMPurify.sanitize(msg.body || '')
                                                }}
                                            />
                                        </div>
                                    ))
                                )}

                                {!loadingConversation && conversation.length > 0 && (
                                    <button
                                        onClick={openReply}
                                        className="flex items-center gap-2 text-slate-400 hover:text-teal-400 p-4 border border-dashed border-slate-800 rounded-xl justify-center transition-all hover:bg-slate-900/30 group flex-shrink-0"
                                    >
                                        <Send className="w-4 h-4 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
                                        <span>Click here to Reply</span>
                                    </button>
                                )}

                                {!loadingConversation && conversation.length > 0 && (
                                    <div className="flex-shrink-0 bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-center">
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            🔒 <span className="font-bold text-slate-400">AlphaClone does not delete your data.</span> To delete a conversation, please go to your <span className="font-bold text-slate-300">Gmail app</span> and delete it there.
                                        </p>
                                    </div>
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

                {/* Compose Modal */}
                {isComposeOpen && (
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 rounded-t-2xl">
                                <h3 className="text-white font-bold flex items-center gap-2">
                                    <Send className="w-4 h-4 text-teal-500" />
                                    {composeData.threadId ? 'Reply to Conversation' : 'New Message'}
                                </h3>
                                <button onClick={() => { setIsComposeOpen(false); setSelectedContact(null); }} className="text-slate-500 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                                {!composeData.threadId && (
                                    <>
                                        {/* CRM Contact Picker */}
                                        <div className="relative" ref={contactPickerRef}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Users className="w-3 h-3" />
                                                    To
                                                </label>
                                                <button
                                                    onClick={() => setShowContactPicker(prev => !prev)}
                                                    className="text-xs text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20 transition-colors"
                                                >
                                                    <Users className="w-3 h-3" />
                                                    {selectedContact ? 'Change Contact' : 'Pick from CRM'}
                                                </button>
                                                {selectedContact && (
                                                    <button
                                                        onClick={() => { setSelectedContact(null); setComposeData(prev => ({ ...prev, to: '' })); }}
                                                        className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Selected contact badge */}
                                            {selectedContact && (
                                                <div className="flex items-center gap-2 mb-2 bg-teal-500/10 border border-teal-500/20 rounded-lg px-3 py-2">
                                                    <div className="w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center text-slate-900 text-xs font-black">
                                                        {selectedContact.name.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-white truncate">{selectedContact.name}</p>
                                                        <p className="text-xs text-slate-400 truncate">{selectedContact.email}</p>
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedContact.type === 'lead' ? 'bg-amber-500/20 text-amber-400' : 'bg-teal-500/20 text-teal-400'}`}>
                                                        {selectedContact.type === 'lead' ? 'LEAD' : 'CLIENT'}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Contact picker dropdown */}
                                            {showContactPicker && (
                                                <div className="absolute top-full left-0 right-0 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl mt-1 overflow-hidden">
                                                    <div className="p-2 border-b border-slate-800">
                                                        <div className="relative">
                                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                                            <input
                                                                type="text"
                                                                placeholder="Search contacts..."
                                                                value={contactSearch}
                                                                onChange={e => setContactSearch(e.target.value)}
                                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 pl-8 pr-3 text-sm text-white focus:outline-none focus:border-teal-500/50"
                                                                autoFocus
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="max-h-52 overflow-y-auto">
                                                        {loadingContacts ? (
                                                            <div className="p-4 text-center">
                                                                <RefreshCw className="w-4 h-4 animate-spin text-teal-500 mx-auto" />
                                                            </div>
                                                        ) : filteredContacts.length === 0 ? (
                                                            <div className="p-4 text-center text-slate-500 text-sm">
                                                                {contacts.length === 0 ? 'No contacts with email found in CRM' : 'No matches found'}
                                                            </div>
                                                        ) : (
                                                            filteredContacts.map(contact => (
                                                                <button
                                                                    key={contact.id}
                                                                    onClick={() => handleSelectContact(contact)}
                                                                    className="w-full text-left px-3 py-2.5 hover:bg-slate-800 transition-colors flex items-center gap-3 border-b border-slate-800/50 last:border-0"
                                                                >
                                                                    <div className="w-7 h-7 bg-slate-700 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                                        {contact.name.charAt(0)}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-semibold text-white truncate">{contact.name}</p>
                                                                        <p className="text-xs text-slate-400 truncate">{contact.email}</p>
                                                                    </div>
                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${contact.type === 'lead' ? 'bg-amber-500/20 text-amber-400' : 'bg-teal-500/20 text-teal-400'}`}>
                                                                        {contact.type === 'lead' ? 'LEAD' : 'CLIENT'}
                                                                    </span>
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <input
                                                type="text"
                                                placeholder="To (email address)"
                                                value={composeData.to}
                                                onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-teal-500/50 transition-all"
                                            />
                                        </div>

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
                                    {selectedContact && (
                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-teal-500 rounded-full inline-block" />
                                            AI will target <span className="text-teal-400 font-semibold">{selectedContact.name}</span>
                                        </span>
                                    )}
                                </div>

                                {showAIPrompt && (
                                    <div className="bg-slate-950/50 p-4 rounded-xl border border-teal-500/20 space-y-3">
                                        {selectedContact && (
                                            <div className="text-xs text-slate-400 bg-teal-500/5 border border-teal-500/10 rounded-lg p-2.5">
                                                <span className="text-teal-400 font-bold">AI Context:</span> Targeting <span className="text-white font-semibold">{selectedContact.businessName || selectedContact.name}</span>
                                                {selectedContact.industry && <span className="text-slate-400"> · {selectedContact.industry}</span>}
                                            </div>
                                        )}
                                        <label className="text-xs font-bold text-teal-400 block">Tell AI what to write:</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={aiPrompt}
                                                onChange={(e) => setAiPrompt(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAIGenerate()}
                                                placeholder={selectedContact ? `e.g., Introduce our services to ${selectedContact.name}...` : 'e.g., Polite refusal...'}
                                                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500/50"
                                            />
                                            <button
                                                onClick={handleAIGenerate}
                                                disabled={isGenerating || !aiPrompt.trim()}
                                                className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    onClick={() => { setIsComposeOpen(false); setSelectedContact(null); }}
                                    className="px-4 py-2 text-slate-400 hover:text-white font-medium text-sm transition-colors"
                                >
                                    Discard
                                </button>
                                <button
                                    onClick={handleSendEmail}
                                    disabled={sending || !composeData.body}
                                    className="px-6 py-2 bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {sending ? 'Sending...' : 'Send Message'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GmailTab;
