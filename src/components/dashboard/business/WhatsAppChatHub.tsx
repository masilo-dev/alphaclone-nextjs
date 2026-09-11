'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    MessageCircle, Send, Search, Loader2, User, Sparkles, 
    Check, CheckCheck, ShieldCheck, Phone, Globe, Bot, Settings,
    Smartphone, MessageSquare, Facebook
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { generateMessengerReply } from '@/services/unifiedAIService';
import toast from 'react-hot-toast';
import EmptyState, { EmptyStateFromPreset } from '@/components/ui/EmptyState';
import { WORKSPACE } from '@/constants/design';

interface WhatsAppMessage {
    id: string;
    body: string;
    direction: 'inbound' | 'outbound';
    phone_number: string;
    contact_id: string | null;
    status: string;
    message_type: string;
    created_at: string;
    received_at: string | null;
    sent_at: string | null;
}

interface ChatThread {
    phone: string;
    contactName: string;
    lastMessage: string;
    timestamp: string;
    unreadCount: number;
    messages: WhatsAppMessage[];
}

export default function WhatsAppChatHub() {
    const { currentTenant } = useTenant();
    const [threads, setThreads] = useState<ChatThread[]>([]);
    const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [aiGenerating, setAiGenerating] = useState(false);
    const [metaConnected, setMetaConnected] = useState(false);

    // Chatbot settings toggle
    const [chatbotEnabled, setChatbotEnabled] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);

    const [fbLeadQuery, setFbLeadQuery] = useState('');
    const [fbLeadResults, setFbLeadResults] = useState<any[]>([]);
    const [searchingFbLeads, setSearchingFbLeads] = useState(false);
    const [showFbSearch, setShowFbSearch] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const threadsRef = useRef<ChatThread[]>([]);

    // Store threads in ref to access inside real-time listener
    useEffect(() => {
        threadsRef.current = threads;
    }, [threads]);

    // Scroll to bottom when selected thread changes or messages load
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [selectedPhone, threads]);

    // Fetch integrations and chatbot settings on load
    useEffect(() => {
        if (currentTenant?.id) {
            fetchIntegrations();
            fetchChatbotSettings();
        }
    }, [currentTenant?.id]);

    const fetchIntegrations = async () => {
        try {
            const [integrationRes, statusRes] = await Promise.all([
                fetch(`/api/integrations/whatsapp?tenantId=${currentTenant?.id}`),
                fetch(`/api/integrations/whatsapp/status?tenantId=${encodeURIComponent(currentTenant?.id || '')}`),
            ]);
            const data = await integrationRes.json().catch(() => ({}));
            const status = await statusRes.json().catch(() => ({}));
            setMetaConnected(!!status?.sendConfigured || (data?.success && data?.integrations?.length > 0));
        } catch (err) {
            console.error('Failed to fetch WhatsApp status', err);
            setMetaConnected(false);
        }
    };

    const fetchChatbotSettings = async () => {
        try {
            if (!currentTenant?.id) return;
            const response = await fetch(`/api/tenant/${currentTenant.id}/whatsapp-chatbot`, { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Failed to load chatbot settings');
            setChatbotEnabled(Boolean(payload.chatbotEnabled));
        } catch (err) {
            console.error('Failed to fetch chatbot settings', err);
        }
    };

    const handleToggleChatbot = async () => {
        if (!currentTenant?.id) return;
        setSavingSettings(true);
        try {
            const nextState = !chatbotEnabled;
            const response = await fetch(`/api/tenant/${currentTenant.id}/whatsapp-chatbot`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatbot_enabled: nextState }) });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Failed to update chatbot settings');
            setChatbotEnabled(Boolean(payload.chatbotEnabled));
            toast.success(`AI Chatbot Auto-Reply ${nextState ? 'Enabled' : 'Disabled'}`);
        } catch (err) {
            toast.error('Failed to update chatbot settings');
        } finally {
            setSavingSettings(false);
        }
    };

    const handleFacebookLeadSearch = async () => {
        if (!currentTenant?.id) return;
        setSearchingFbLeads(true);
        try {
            const res = await fetch(
                `/api/facebook/leads/search?tenantId=${encodeURIComponent(currentTenant.id)}&q=${encodeURIComponent(fbLeadQuery.trim())}`
            );
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Search failed');
            setFbLeadResults([...(data.local || []), ...(data.graph || [])]);
            toast.success(`Found ${data.total || 0} Facebook lead(s)`);
        } catch (err: any) {
            toast.error(err.message || 'Facebook lead search failed');
        } finally {
            setSearchingFbLeads(false);
        }
    };

    const startWhatsAppFromLead = (lead: any) => {
        const phone = String(lead.phone || '').replace(/[^0-9]/g, '');
        if (!phone) {
            toast.error('This Facebook lead has no phone number for WhatsApp.');
            return;
        }
        setSelectedPhone(phone);
        const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.company || 'there';
        setReplyText(`Hi ${name}, thanks for connecting via Facebook. How can I help you today?`);
        setShowFbSearch(false);
    };

    // Load messages and group into threads
    useEffect(() => {
        if (!currentTenant?.id) return;

        fetchWhatsAppMessages();

        // Setup real-time listener for standalone WhatsApp messages
        const channel = supabase.channel(`whatsapp_live_chats_${currentTenant.id}`)
            .on(
                'postgres_changes' as any,
                { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `tenant_id=eq.${currentTenant.id}` },
                (payload: any) => {
                    const newMsg = payload.new as WhatsAppMessage;

                    // Locate thread phone number
                    const targetPhone = newMsg.phone_number;
                    if (!targetPhone) return;

                    setThreads(prev => {
                        const existingIndex = prev.findIndex(t => t.phone === targetPhone);
                        
                        if (existingIndex > -1) {
                            const updatedThreads = [...prev];
                            const thread = updatedThreads[existingIndex];
                            
                            // Prevent duplicates
                            if (thread.messages.some(m => m.id === newMsg.id)) return prev;

                            thread.messages = [...thread.messages, newMsg].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                            thread.lastMessage = newMsg.body;
                            thread.timestamp = newMsg.created_at;
                            
                            if (newMsg.direction === 'inbound' && selectedPhone !== targetPhone) {
                                thread.unreadCount += 1;
                            }

                            // Move thread to top
                            updatedThreads.splice(existingIndex, 1);
                            return [thread, ...updatedThreads];
                        } else {
                            // New thread
                            const newThread: ChatThread = {
                                phone: targetPhone,
                                contactName: `+${targetPhone}`,
                                lastMessage: newMsg.body,
                                timestamp: newMsg.created_at,
                                unreadCount: newMsg.direction === 'inbound' ? 1 : 0,
                                messages: [newMsg]
                            };
                            return [newThread, ...prev];
                        }
                    });
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [currentTenant?.id, selectedPhone]);

    const fetchWhatsAppMessages = async () => {
        if (!currentTenant?.id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('whatsapp_messages')
                .select('*')
                .eq('tenant_id', currentTenant.id)
                .order('created_at', { ascending: true });

            if (error) throw error;

            const msgs = (data || []) as WhatsAppMessage[];
            
            // Fetch contacts to map names
            const { data: contacts } = await supabase
                .from('contacts')
                .select('id, full_name, phone, mobile')
                .eq('tenant_id', currentTenant.id);

            const contactMap = new Map<string, string>();
            (contacts || []).forEach((c: any) => {
                const cleanPhone = (c.phone || c.mobile || '').replace(/[^0-9]/g, '');
                if (cleanPhone) {
                    contactMap.set(cleanPhone, c.full_name);
                }
            });

            // Group into threads
            const threadMap = new Map<string, WhatsAppMessage[]>();
            msgs.forEach(m => {
                const phone = m.phone_number;
                if (!phone) return;
                const cleanKey = phone.replace(/[^0-9]/g, '');
                if (!threadMap.has(cleanKey)) {
                    threadMap.set(cleanKey, []);
                }
                threadMap.get(cleanKey)?.push(m);
            });

            const loadedThreads: ChatThread[] = [];
            threadMap.forEach((messages, phone) => {
                const lastMsg = messages[messages.length - 1];
                loadedThreads.push({
                    phone: phone,
                    contactName: contactMap.get(phone) || `+${phone}`,
                    lastMessage: lastMsg?.body || '',
                    timestamp: lastMsg?.created_at || new Date().toISOString(),
                    unreadCount: 0, // Simplified on load
                    messages: messages
                });
            });

            // Sort threads by last message timestamp
            loadedThreads.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            setThreads(loadedThreads);
            if (loadedThreads.length > 0 && !selectedPhone) {
                setSelectedPhone(loadedThreads[0].phone);
            }
        } catch (err) {
            console.error('Failed to load WhatsApp messages', err);
            toast.error('Failed to load chats');
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!replyText.trim() || !selectedPhone || !currentTenant?.id || sending) return;

        if (!metaConnected) {
            toast.error('WhatsApp is not configured. Add credentials under Integration Settings.');
            return;
        }

        setSending(true);
        const textToSend = replyText;
        setReplyText('');

        try {
            const res = await fetch('/api/integrations/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant.id,
                    phone: selectedPhone,
                    message: textToSend,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to send message');
            }
            
            toast.success('Message sent');
        } catch (err: any) {
            toast.error(err.message || 'Failed to send message');
            setReplyText(textToSend);
        } finally {
            setSending(false);
        }
    };

    const handleAiSuggest = async () => {
        const activeThread = threads.find(t => t.phone === selectedPhone);
        if (!activeThread || activeThread.messages.length === 0) return;

        const lastInbound = [...activeThread.messages].reverse().find(m => m.direction === 'inbound');
        const contextMessage = lastInbound || [...activeThread.messages].reverse()[0];
        if (!contextMessage) {
            toast.error('No messages in this thread yet. Send a first message, then use AI suggest.');
            return;
        }

        setAiGenerating(true);
        try {
            const suggestion = await generateMessengerReply(
                lastInbound ? lastInbound.body : contextMessage.body,
                'Helpful, strategic business executive. Speak in WhatsApp style: concise, short, using bullet points or simple structure, highly actionable.'
            );
            setReplyText(suggestion);
            toast.success('AI suggest reply ready!');
        } catch (err) {
            toast.error('AI suggestion failed to generate.');
        } finally {
            setAiGenerating(false);
        }
    };

    const activeThread = useMemo(() => threads.find(t => t.phone === selectedPhone), [threads, selectedPhone]);

    const filteredThreads = useMemo(() => {
        return threads.filter(t => 
            t.contactName.toLowerCase().includes(searchTerm.toLowerCase()) || 
            t.phone.includes(searchTerm)
        );
    }, [threads, searchTerm]);

    if (loading && threads.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
                <p className="text-sm text-slate-400">Syncing WhatsApp chats...</p>
            </div>
        );
    }

    return (
        <div className={`relative grid h-[680px] grid-cols-1 overflow-hidden lg:grid-cols-12 ${WORKSPACE.panel.base} rounded-lg shadow-none`}>
            
            {/* Sidebar Columns (Left side) */}
            <div className="lg:col-span-4 flex h-full flex-col border-r border-[var(--ws-border)] bg-slate-900/10">
                
                {/* Search Bar */}
                <div className="p-4 border-b border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white flex items-center gap-2 text-sm tracking-wide">
                            <MessageCircle className="w-5 h-5 text-emerald-400" /> WhatsApp Live Chat
                        </h3>
                        {/* Auto Outreach Toggle */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleToggleChatbot}
                                disabled={savingSettings}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                                    chatbotEnabled 
                                    ? 'text-emerald-400 bg-emerald-500/5 border-emerald-500/20' 
                                    : 'text-slate-400 bg-slate-800 border-slate-700'
                                }`}
                                title="Toggle AI Chatbot Auto-Reply"
                            >
                                <Bot className="w-3.5 h-3.5" />
                                {chatbotEnabled ? 'AI Active' : 'AI Offline'}
                            </button>
                        </div>
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400 transition-colors pointer-events-none" size={15} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search chats or phone..."
                            className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none focus:border-teal-500/40 transition-all placeholder:text-slate-600"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowFbSearch((prev) => !prev)}
                        className="w-full text-left text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 flex items-center gap-1.5"
                    >
                        <Facebook className="w-3.5 h-3.5" />
                        {showFbSearch ? 'Hide Facebook lead search' : 'Search Facebook leads'}
                    </button>

                    {showFbSearch && (
                        <div className="space-y-2 p-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={fbLeadQuery}
                                    onChange={(e) => setFbLeadQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleFacebookLeadSearch()}
                                    placeholder="Name, email, campaign..."
                                    className="flex-1 px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white"
                                />
                                <button
                                    type="button"
                                    onClick={handleFacebookLeadSearch}
                                    disabled={searchingFbLeads}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white disabled:opacity-50"
                                >
                                    {searchingFbLeads ? '…' : 'Find'}
                                </button>
                            </div>
                            {fbLeadResults.slice(0, 5).map((lead, idx) => (
                                <button
                                    key={lead.id || lead.lead_id || idx}
                                    type="button"
                                    onClick={() => startWhatsAppFromLead(lead)}
                                    className="w-full text-left p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-emerald-500/30"
                                >
                                    <p className="text-xs font-semibold text-white truncate">
                                        {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.full_name || lead.company || 'Lead'}
                                    </p>
                                    <p className="text-[10px] text-slate-500 truncate">
                                        {lead.phone || lead.email || lead.campaign_name || 'Tap to start WhatsApp'}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Thread list */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
                    {threads.length === 0 ? (
                        <EmptyStateFromPreset moduleId="messages" className="py-16" />
                    ) : filteredThreads.length === 0 ? (
                        <EmptyState
                            icon={MessageCircle}
                            title="No conversations found"
                            description="Try a different search term."
                            className="py-16"
                        />
                    ) : (
                        filteredThreads.map(thread => {
                            const isSelected = thread.phone === selectedPhone;
                            return (
                                <button
                                    key={thread.phone}
                                    onClick={() => setSelectedPhone(thread.phone)}
                                    className={`relative flex w-full items-center justify-between gap-3 rounded-lg border p-3.5 text-left transition-all ${
                                        isSelected 
                                        ? 'bg-emerald-600/10 border-emerald-500/20' 
                                        : 'hover:bg-slate-800/40 border-transparent'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-sm font-bold text-emerald-400">
                                            {thread.contactName.charAt(0) === '+' ? <Phone className="w-4 h-4 text-emerald-400" /> : thread.contactName.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-xs text-white truncate">{thread.contactName}</h4>
                                            <p className="text-[11px] text-slate-500 truncate mt-1">{thread.lastMessage}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                                        <span className="text-[10px] font-black text-slate-600 uppercase">
                                            {new Date(thread.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {thread.unreadCount > 0 && (
                                            <span className="w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[9px] font-black">
                                                {thread.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Chat Body (Right side) */}
            <div className="lg:col-span-8 flex flex-col bg-slate-950/20 h-full relative">
                {activeThread ? (
                    <>
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-[var(--ws-border)] bg-slate-900/30 p-4 backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 font-bold text-emerald-400">
                                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-white tracking-wide">{activeThread.contactName}</h4>
                                    <div className="text-[10px] flex items-center gap-1.5 font-bold uppercase tracking-wider mt-0.5">
                                        {metaConnected ? (
                                            <>
                                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                                <span className="text-emerald-400">WhatsApp connected</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                                                <span className="text-amber-400">Not configured — set up in Integrations</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 rounded-lg border border-[var(--ws-border)] bg-slate-900 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Secure Encryption
                            </div>
                        </div>

                        {/* Message list */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin flex flex-col">
                            {activeThread.messages.map((msg) => {
                                const isMe = msg.direction === 'outbound';
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full`}>
                                        <div className={`max-w-[70%] rounded-lg border p-3.5 text-xs transition-all ${
                                            isMe 
                                            ? 'bg-emerald-950/60 text-emerald-50 border-emerald-500/20 rounded-br-none' 
                                            : 'bg-slate-900 border-slate-800 text-slate-200 rounded-bl-none'
                                        }`}>
                                            <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                                            <div className="flex items-center justify-end gap-1.5 mt-2">
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {isMe && (
                                                    <span className="text-emerald-400 shrink-0">
                                                        {['delivered', 'read'].includes(msg.status) ? <CheckCheck className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5 text-slate-500" />}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Footer */}
                        <div className="space-y-3 border-t border-[var(--ws-border)] bg-slate-900/30 p-4 backdrop-blur-md">
                            {!metaConnected && (
                                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                                    Outbound WhatsApp is not configured for this workspace. Connect Meta Cloud API credentials in Integration Settings before sending messages.
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={handleAiSuggest}
                                    disabled={aiGenerating}
                                    className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-gradient-to-r from-emerald-600/10 to-teal-600/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />}
                                    AI Assist Copilot Draft
                                </button>
                            </div>

                            <form onSubmit={handleSend} className="flex gap-2">
                                <input
                                    type="text"
                                    value={replyText}
                                    onChange={e => setReplyText(e.target.value)}
                                    placeholder={metaConnected ? 'Type a WhatsApp message...' : 'Configure WhatsApp to send messages'}
                                    disabled={!metaConnected}
                                    className="flex-1 rounded-lg border border-[var(--ws-border)] bg-slate-900 px-4 py-3 text-xs text-white outline-none transition-all placeholder:text-slate-600 focus:border-emerald-500/40 disabled:opacity-50"
                                />
                                <button
                                    type="submit"
                                    disabled={sending || !replyText.trim() || !metaConnected}
                                    className="flex shrink-0 items-center justify-center rounded-lg bg-emerald-600 p-3 text-white transition-all active:scale-95 hover:bg-emerald-500 disabled:scale-100 disabled:opacity-50"
                                >
                                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <EmptyState
                        icon={MessageCircle}
                        title="WhatsApp live chat hub"
                        description="Select an active customer conversation on the left to start viewing messages and chatting in real time."
                        className="max-w-md py-12"
                    />
                )}
            </div>
        </div>
    );
}
