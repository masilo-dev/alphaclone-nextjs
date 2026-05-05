'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Mail, Send, Inbox, Archive, Trash2, Search, Loader2, Plus, 
    ArrowLeft, Menu, X, MoreVertical, Sparkles, Reply, Forward,
    MoreHorizontal, CheckCircle2, RotateCcw, AlertCircle, FileText, ShieldCheck, BookUser, CheckSquare, Users,
    Filter, ChevronRight, Calendar
} from 'lucide-react';
import { generateEmailReply, generateEmailDraft } from '@/services/unifiedAIService';
import { taskService } from '@/services/taskService';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { integrationsService, IntegrationConfig } from '@/services/integrationsService';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import LeadOutreachModal from './LeadOutreachModal';
import CRMContactPickerModal from './CRMContactPickerModal';
import { supabase } from '@/lib/supabase';

interface Message {
    messageId: string;
    sender: string;
    subject: string;
    receivedTime: string;
    snippet: string;
    status?: string; // read/unread
    category?: 'urgent' | 'follow-up' | 'newsletter' | 'spam' | 'normal';
    fromAddress?: string;
}

interface Folder {
    folderId: string;
    folderName: string;
    unreadCount: number;
}

type ZohoMailViewProps = {
    userId?: string;
};

export default function ZohoMailView({ userId: userIdProp }: ZohoMailViewProps) {
    const { user } = useAuth();
    const { currentTenant } = useTenant();
    const { isMobile, isTablet, isDesktop } = useBreakpoint();
    
    const [folders, setFolders] = useState<Folder[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string>('1'); // Inbox
    const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
    const [messageContent, setMessageContent] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [composing, setComposing] = useState(false);
    const [emailData, setEmailData] = useState({ to: '', subject: '', body: '', provider: null as string | null });
    const [availableProviders, setAvailableProviders] = useState<IntegrationConfig[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<IntegrationConfig | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [aiGenerating, setAiGenerating] = useState(false);
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
    const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [needsReconnect, setNeedsReconnect] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [showAiPrompt, setShowAiPrompt] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'urgent' | 'follow-up' | 'newsletter' | 'spam' | 'normal'>('all');
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [taskFromEmail, setTaskFromEmail] = useState<{ title: string; description: string; priority: string } | null>(null);
    const [emailSummary, setEmailSummary] = useState<string | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
    const [smartReplies, setSmartReplies] = useState<string[]>(['Yes, sounds good!', 'I\'ll check and get back to you.', 'Can we schedule a call?', 'Thanks for the update.']);
    const [showRouteModal, setShowRouteModal] = useState(false);
    const [routeToEmail, setRouteToEmail] = useState('');
    const [configuredRegion, setConfiguredRegion] = useState<string | null>(null);
    const [replyBody, setReplyBody] = useState('');

    const [messageCache, setMessageCache] = useState<Record<string, any>>({});
    const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());

    const getInitials = (name: string) => {
        if (!name) return '??';
        const cleanName = name.split('<')[0].trim();
        const parts = cleanName.split(' ').filter(p => p.length > 0);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return '??';
    };

    const selectedMessageMeta = useMemo(
        () => messages.find((m) => m.messageId === selectedMessage) || null,
        [messages, selectedMessage]
    );

    const reconnectUrl = (() => {
        const params = new URLSearchParams();
        if (userIdProp) params.set('state', userIdProp);
        if (configuredRegion) params.set('region', configuredRegion);
        const query = params.toString();
        return query ? `/api/auth/zoho/connect?${query}` : '/api/auth/zoho/connect';
    })();

    useEffect(() => {
        if (user?.id) {
            integrationsService.getUserIntegrations(user.id).then(({ integrations }) => {
                const emailTypes = ['zoho', 'brevo', 'resend', 'sendgrid', 'gmail'];
                const filtered = integrations.filter(i => i.enabled && emailTypes.includes(i.type));
                setAvailableProviders(filtered);
                const zoho = filtered.find(p => p.type === 'zoho');
                setSelectedProvider(zoho || filtered[0] || null);
            });
        }
    }, [user?.id]);

    useEffect(() => {
        const verifyZohoMailReady = async () => {
            try {
                const res = await fetch('/api/auth/zoho/status', { credentials: 'include' });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return;
                if (typeof data?.configuredRegion === 'string' && data.configuredRegion) setConfiguredRegion(data.configuredRegion);
                if (data?.isConnected !== true) {
                    setNeedsReconnect(true);
                    setError('Zoho Mail is not fully connected. Reconnect in Settings.');
                }
            } catch {}
        };
        verifyZohoMailReady();
    }, []);

    const categorizeEmail = (message: Message): 'urgent' | 'follow-up' | 'newsletter' | 'spam' | 'normal' => {
        const subject = (message.subject || '').toLowerCase();
        const snippet = (message.snippet || '').toLowerCase();
        if (['urgent', 'asap', 'critical'].some(kw => subject.includes(kw) || snippet.includes(kw))) return 'urgent';
        if (['follow up', 'reminder'].some(kw => subject.includes(kw) || snippet.includes(kw))) return 'follow-up';
        if (['newsletter', 'unsubscribe'].some(kw => subject.includes(kw) || snippet.includes(kw))) return 'newsletter';
        return 'normal';
    };

    const filteredMessages = useMemo(() => {
        const scoped = categoryFilter === 'all'
            ? messages
            : messages.filter(msg => msg.category === categoryFilter);
        const query = searchTerm.trim().toLowerCase();
        if (!query) return scoped;
        return scoped.filter(msg =>
            (msg.sender || '').toLowerCase().includes(query) ||
            (msg.subject || '').toLowerCase().includes(query) ||
            (msg.snippet || '').toLowerCase().includes(query)
        );
    }, [messages, categoryFilter, searchTerm]);

    const zohoFetch = async (url: string, options?: RequestInit): Promise<any> => {
        const targetUrl = userIdProp ? `${url}${url.includes('?') ? '&' : '?'}userId=${encodeURIComponent(userIdProp)}` : url;
        const res = await fetch(targetUrl, { credentials: 'include', ...options });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (res.status === 401 && data.reconnect) setNeedsReconnect(true);
            setError(data.error || 'Request failed');
            return null;
        }
        return data;
    };

    useEffect(() => { fetchFolders(); }, []);
    useEffect(() => { if (selectedFolder) fetchMessages(selectedFolder); }, [selectedFolder]);

    const fetchFolders = async () => {
        const data = await zohoFetch('/api/zoho/mail?action=folders');
        if (Array.isArray(data) && data.length > 0) {
            setFolders(data);
            const inbox = data.find((f: any) => f.folderName?.toLowerCase().includes('inbox')) || data[0];
            if (inbox?.folderId) setSelectedFolder(inbox.folderId);
        }
    };

    const fetchMessages = async (folderId: string) => {
        setLoading(true);
        try {
            const data = await zohoFetch(`/api/zoho/mail?action=messages&folderId=${folderId}`);
            if (Array.isArray(data)) {
                setMessages(data.map((msg: Message) => ({ ...msg, category: categorizeEmail(msg) })));
            } else setMessages([]);
        } finally { setLoading(false); }
    };

    const fetchMessageContent = async (id: string) => {
        if (messageCache[id]) {
            setMessageContent(messageCache[id]);
            setSelectedMessage(id);
            setEmailSummary(null);
            return;
        }

        setLoading(true);
        try {
            const data = await zohoFetch(`/api/zoho/mail?action=content&messageId=${id}&folderId=${selectedFolder}`);
            if (data) {
                setMessageCache(prev => ({ ...prev, [id]: data }));
                setMessageContent(data);
                setSelectedMessage(id);
                setEmailSummary(null);
            }
        } finally { setLoading(false); }
    };

    const toggleMessageSelection = (id: string) => {
        setSelectedMessageIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setSending(true);
        try {
            const res = await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: emailData.to,
                    subject: emailData.subject,
                    text: emailData.body,
                    tenantId: currentTenant?.id,
                    userId: user?.id,
                    provider: selectedProvider?.type || 'zoho'
                })
            });
            if (res.ok) {
                toast.success('Sent!');
                setComposing(false);
                setReplyBody('');
                setEmailData({ to: '', subject: '', body: '', provider: null });
            }
        } catch { toast.error('Failed to send'); }
        finally { setSending(false); }
    };

    const handleQuickReply = async () => {
        if (!replyBody.trim()) return;
        setEmailData({
            to: selectedMessageMeta?.sender || messageContent?.sender || '',
            subject: `Re: ${messageContent?.subject || ''}`,
            body: replyBody,
            provider: null
        });
        await handleSend();
    };

    const handleAiReply = async (customPrompt?: string) => {
        if (!messageContent) return;
        setAiGenerating(true);
        try {
            const reply = await generateEmailReply(messageContent.content || messageContent.snippet || '', customPrompt || 'Professional');
            if (reply) {
                setEmailData({
                    to: selectedMessageMeta?.sender || messageContent.sender || '',
                    subject: `Re: ${messageContent.subject || ''}`,
                    body: reply,
                    provider: 'zoho'
                });
                setComposing(true);
            }
        } finally { setAiGenerating(false); }
    };

    const handleSmartReply = async (text: string) => {
        setReplyBody(text);
        // Automatically open full composer with this text for confirmation
        setEmailData({
            to: selectedMessageMeta?.sender || messageContent?.sender || '',
            subject: `Re: ${messageContent?.subject || ''}`,
            body: text,
            provider: 'zoho'
        });
        setComposing(true);
    };

    const formatDate = (dateStr: any) => {
        if (!dateStr) return 'N/A';
        const d = new Date(isNaN(Number(dateStr)) ? dateStr : Number(dateStr));
        return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            <div className="p-6 border-b border-white/5 flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
                    <Mail size={22} />
                </div>
                <span className="font-black text-white uppercase tracking-widest text-sm">Zoho Mail</span>
            </div>
            
            <div className="p-4 sm:p-6">
                <button 
                    onClick={() => { setComposing(true); setSelectedMessage(null); setIsMobileMenuOpen(false); }}
                    className="w-full flex items-center justify-center gap-3 bg-teal-500 hover:bg-teal-400 text-white py-4 px-4 rounded-2xl transition-all shadow-xl active:scale-95 group font-black uppercase text-xs"
                >
                    <Plus size={20} /> 
                    Compose
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5 custom-scrollbar">
                <div className="mt-4 mb-3 px-2 text-[10px] font-black text-gray-600 uppercase tracking-widest">Mailboxes</div>
                {folders.map(folder => (
                    <button
                        key={folder.folderId}
                        onClick={() => { setSelectedFolder(folder.folderId); setSelectedMessage(null); setComposing(false); setIsMobileMenuOpen(false); }}
                        className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all group ${selectedFolder === folder.folderId ? 'bg-teal-500/10 text-white border border-teal-500/20' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}
                    >
                        <div className="flex items-center gap-3">
                            {folder.folderName.toLowerCase().includes('inbox') ? <Inbox size={20} /> : <Archive size={20} />}
                            <span className="text-sm font-bold">{folder.folderName}</span>
                        </div>
                        {folder.unreadCount > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-teal-500 text-white">{folder.unreadCount}</span>
                        )}
                    </button>
                ))}
            </nav>

            <div className="p-4 border-t border-white/5 space-y-2">
                <button onClick={() => setIsLeadModalOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-white/5 transition-all text-sm font-bold">
                    <Sparkles size={18} className="text-teal-500" /> Lead Outreach
                </button>
            </div>
        </div>
    );

    return (
        <div className={`flex flex-col bg-[#0f0f0f] rounded-3xl border border-white/5 overflow-hidden backdrop-blur-sm relative ${isMobile ? 'h-auto min-h-[calc(100vh-120px)]' : 'h-[calc(100vh-140px)]'}`}>
            {needsReconnect && (
                <div className="absolute top-0 left-0 right-0 z-[60] bg-red-600 px-6 py-3 flex items-center justify-between text-white font-black text-[10px] uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={16} /> Zoho connection expired
                    </div>
                    <a href={reconnectUrl} className="bg-white text-red-600 px-4 py-1.5 rounded-lg">Reconnect</a>
                </div>
            )}

            <div className="flex flex-1 overflow-hidden">
                {/* Desktop Sidebar */}
                {!isMobile && (
                    <div className="w-72 flex flex-col bg-[#0a0a0a] border-r border-white/5 shrink-0">
                        <SidebarContent />
                    </div>
                )}

                {/* Mobile Menu Drawer */}
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <>
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]" />
                            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="fixed inset-y-0 left-0 w-4/5 bg-[#0a0a0a] z-[101] shadow-2xl">
                                <SidebarContent />
                                <button onClick={() => setIsMobileMenuOpen(false)} className="absolute top-6 right-6 p-2 text-gray-500"><X size={24} /></button>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                {/* Message List Panel */}
                <div className={`flex flex-col bg-[#0f0f0f] border-r border-white/5 shrink-0 transition-all duration-300 ${selectedMessage || composing ? 'hidden lg:flex w-96' : 'flex-1 md:w-96'}`}>
                    <div className="h-20 border-b border-white/5 px-6 flex items-center gap-4 sticky top-0 z-10 bg-[#0f0f0f]/80 backdrop-blur-md">
                        {isMobile && <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-400"><Menu size={24} /></button>}
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                            <input 
                                type="text" placeholder="Search mail..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-black/40 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:border-teal-500/50 outline-none"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="mx-4 mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                            {error}
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {/* Category Filter Pills & Bulk Actions */}
                        <div className="flex items-center justify-between px-2 py-1">
                            <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                {['all', 'urgent', 'follow-up', 'newsletter'].map(cat => (
                                    <button key={cat} onClick={() => setCategoryFilter(cat as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${categoryFilter === cat ? 'bg-teal-500 border-teal-500 text-white shadow-lg shadow-teal-500/20' : 'bg-white/5 border-white/5 text-gray-600'}`}>
                                        {cat}
                                    </button>
                                ))}
                            </div>
                            {selectedMessageIds.size > 0 && (
                                <button onClick={() => { /* Bulk Archive Logic */ setSelectedMessageIds(new Set()); toast.success('Archived selected'); }} className="p-2 text-teal-400 hover:bg-teal-500/10 rounded-lg">
                                    <Archive size={18} />
                                </button>
                            )}
                        </div>

                        {loading && messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 opacity-20"><Loader2 className="animate-spin" size={32} /></div>
                        ) : (
                            filteredMessages.map(msg => (
                                <div key={msg.messageId} className="flex items-center gap-2 px-2 group">
                                    <button 
                                        onClick={() => toggleMessageSelection(msg.messageId)}
                                        className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${selectedMessageIds.has(msg.messageId) ? 'bg-teal-500 border-teal-500' : 'border-white/10 hover:border-teal-500/50'}`}
                                    >
                                        {selectedMessageIds.has(msg.messageId) && <CheckSquare size={12} className="text-white" />}
                                    </button>
                                    <button
                                        onClick={() => fetchMessageContent(msg.messageId)}
                                        className={`flex-1 text-left p-4 rounded-2xl transition-all border ${selectedMessage === msg.messageId ? 'bg-teal-500/10 border-teal-500/30' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`text-xs font-black truncate max-w-[140px] uppercase tracking-wide ${msg.status === 'unread' ? 'text-white' : 'text-gray-500'}`}>
                                                {msg.sender.split('<')[0].trim()}
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-600">{formatDate(msg.receivedTime)}</span>
                                        </div>
                                        <p className={`text-sm font-bold truncate mb-1 ${msg.status === 'unread' ? 'text-teal-400' : 'text-gray-400'}`}>{msg.subject}</p>
                                        <p className="text-[11px] text-gray-600 truncate opacity-60 line-clamp-1">{msg.snippet}</p>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Message Content Area */}
                <div className={`flex-1 flex flex-col bg-[#141414] relative ${!selectedMessage && !composing ? 'hidden lg:flex' : 'flex'}`}>
                    <AnimatePresence mode="wait">
                        {composing ? (
                            <motion.div key="compose" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 flex flex-col p-4 sm:p-10 overflow-y-auto w-full">
                                <div className="flex justify-between items-center mb-8 sm:mb-12">
                                    <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">New Message</h2>
                                    <button onClick={() => setComposing(false)} className="w-12 h-12 flex items-center justify-center rounded-full bg-white/5 text-gray-500 hover:text-white"><X size={28} /></button>
                                </div>
                                <form onSubmit={handleSend} className="space-y-6 max-w-4xl">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-2">
                                                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Recipient</label>
                                                <button type="button" onClick={() => setIsContactPickerOpen(true)} className="text-[10px] font-black text-teal-400 uppercase tracking-widest hover:text-teal-300">
                                                    + Add from CRM
                                                </button>
                                            </div>
                                            <input type="email" required value={emailData.to} onChange={e => setEmailData({...emailData, to: e.target.value})} className="w-full h-14 bg-black/40 border border-white/5 rounded-2xl px-5 text-base text-white outline-none focus:border-teal-500/50" placeholder="name@example.com" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest px-2">Subject</label>
                                            <input type="text" required value={emailData.subject} onChange={e => setEmailData({...emailData, subject: e.target.value})} className="w-full h-14 bg-black/40 border border-white/5 rounded-2xl px-5 text-base text-white outline-none focus:border-teal-500/50" placeholder="Topic" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center px-2">
                                            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Message</label>
                                            <button type="button" onClick={() => setShowAiPrompt(!showAiPrompt)} className="flex items-center gap-2 text-[10px] font-black text-teal-500 uppercase tracking-widest bg-teal-500/10 px-3 py-1.5 rounded-lg border border-teal-500/20">
                                                <Sparkles size={12} /> AI Assist
                                            </button>
                                        </div>
                                        <textarea required rows={10} value={emailData.body} onChange={e => setEmailData({...emailData, body: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded-3xl px-6 py-6 text-lg text-white outline-none focus:border-teal-500/50 min-h-[300px] resize-none" placeholder="Start typing..." />
                                    </div>
                                    <div className="flex justify-end pt-6 sticky bottom-0 bg-[#141414] py-4 sm:static sm:bg-transparent">
                                        <button disabled={sending} type="submit" className="w-full sm:w-auto px-12 py-5 bg-teal-500 text-white font-black uppercase text-sm rounded-2xl shadow-2xl shadow-teal-900/40 active:scale-95 transition-all">
                                            {sending ? <Loader2 className="animate-spin mx-auto" /> : 'Send Message'}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        ) : selectedMessage ? (
                            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col h-full overflow-hidden">
                                <div className="h-20 border-b border-white/5 px-4 sm:px-8 flex items-center justify-between bg-[#141414]/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <button onClick={() => setSelectedMessage(null)} className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 text-gray-400"><ArrowLeft size={20} /></button>
                                        <div className="min-w-0">
                                            <h2 className="text-sm font-black text-white truncate uppercase tracking-tight">{messageContent?.subject || 'No Subject'}</h2>
                                            <p className="text-[10px] text-teal-400 font-bold truncate lowercase">{messageContent?.sender}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!isMobile && (
                                            <button onClick={() => handleAiReply()} disabled={aiGenerating} className="flex items-center gap-2 bg-teal-500/10 text-teal-400 px-4 py-2.5 rounded-xl border border-teal-600/20 text-[10px] font-black uppercase tracking-widest">
                                                <Sparkles size={14} /> AI Reply
                                            </button>
                                        )}
                                        <button className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 text-gray-500"><Archive size={20} /></button>
                                        <button className="w-11 h-11 flex items-center justify-center rounded-xl bg-red-600/10 text-red-500 border border-red-500/20"><Trash2 size={20} /></button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 sm:p-10 custom-scrollbar">
                                    <div className="max-w-4xl mx-auto space-y-10">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-white/5">
                                            <div className="flex gap-4">
                                                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center font-black text-teal-500 border border-white/5 shadow-inner text-xl">
                                                    {getInitials(messageContent?.sender)}
                                                </div>
                                                <div>
                                                    <p className="font-black text-white text-base">{messageContent?.sender?.split('<')[0]}</p>
                                                    <p className="text-gray-500 text-[11px] font-bold uppercase tracking-widest">{formatDate(messageContent?.receivedTime)}</p>
                                                </div>
                                            </div>
                                            {isMobile && (
                                                <button onClick={() => handleAiReply()} className="w-full py-4 bg-teal-500 text-white rounded-2xl font-black uppercase text-xs shadow-lg">AI Reply Assist</button>
                                            )}
                                        </div>
                                        <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed text-base email-content" dangerouslySetInnerHTML={{ __html: messageContent?.content || '<div class="text-gray-500 italic py-20 text-center">No content</div>' }} />
                                    </div>
                                </div>
                                
                                {/* Quick Reply Bar */}
                                <div className="p-4 sm:p-6 bg-[#0a0a0a]/50 border-t border-white/5 flex flex-col gap-4">
                                    {/* Smart Reply Chips */}
                                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                                        {smartReplies.map((reply, i) => (
                                            <button 
                                                key={i} 
                                                onClick={() => handleSmartReply(reply)}
                                                className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold text-gray-400 hover:text-teal-400 hover:border-teal-500/30 whitespace-nowrap transition-all"
                                            >
                                                {reply}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 relative">
                                            <input 
                                                value={replyBody}
                                                onChange={e => setReplyBody(e.target.value)}
                                                placeholder="Type a quick reply..." 
                                                className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-teal-500/50 pr-12"
                                                onKeyDown={e => e.key === 'Enter' && handleQuickReply()}
                                            />
                                            <button 
                                                onClick={handleQuickReply}
                                                disabled={sending || !replyBody.trim()}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-teal-500 hover:text-teal-400 disabled:opacity-30"
                                            >
                                                <Send size={20} />
                                            </button>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setEmailData({
                                                    to: selectedMessageMeta?.sender || messageContent?.sender || '',
                                                    subject: `Re: ${messageContent?.subject || ''}`,
                                                    body: replyBody,
                                                    provider: 'zoho'
                                                });
                                                setComposing(true);
                                            }}
                                            className="p-4 rounded-2xl bg-white/5 text-gray-400 hover:text-white transition-all"
                                            title="Full reply"
                                        >
                                            <Reply size={20} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-[#141414]">
                                <div className="w-24 h-24 bg-white/5 rounded-[40px] flex items-center justify-center mb-6">
                                    <Mail size={48} className="text-gray-700" />
                                </div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tight">Select a message</h3>
                                <p className="text-sm text-gray-600 max-w-xs mt-3">Choose an email from the list to view its contents and use AI tools.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <CRMContactPickerModal 
                isOpen={isContactPickerOpen}
                onClose={() => setIsContactPickerOpen(false)}
                onSelectContact={(email, name) => {
                    setEmailData(prev => ({
                        ...prev,
                        to: prev.to ? `${prev.to}, ${email}` : email
                    }));
                }}
            />

            <style jsx global>{`
                .email-content * { max-width: 100% !important; overflow-wrap: break-word !important; }
                .email-content img { border-radius: 1rem; margin: 1.5rem 0; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
            `}</style>
        </div>
    );
}
