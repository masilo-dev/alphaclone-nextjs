'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
    MessageSquare, Send, Inbox, Search, Loader2, 
    ArrowLeft, Menu, X, Sparkles, User, RefreshCcw,
    Circle, CheckCircle2, ShieldCheck, Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { generateMessengerReply } from '@/services/unifiedAIService';
import toast from 'react-hot-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Conversation {
    id: string;
    sender_id: string;
    page_id: string;
    last_message_at: string;
    last_message_preview: string;
    is_read: boolean;
    metadata: any;
    contact_id?: string;
    contacts?: {
        full_name?: string;
        email?: string;
    };
}

interface Message {
    id: string;
    text: string;
    sender_id: string;
    sender_type: 'user' | 'page';
    created_at: string;
}

function isExpectedRealtimeCloseError(error: unknown): boolean {
    if (!error) return false;
    const msg = error instanceof Error ? error.message : String(error);
    return msg.includes('WebSocket is closed before the connection is established');
}

function cleanupChannelsByTopic(topic: string) {
    const existing = supabase.getChannels().filter((channel: RealtimeChannel) => channel.topic === topic);
    existing.forEach((channel: RealtimeChannel) => {
        channel.unsubscribe();
        void supabase.removeChannel(channel).catch((error: unknown) => {
            if (!isExpectedRealtimeCloseError(error)) {
                console.warn('[Messenger] stale channel cleanup failed:', error);
            }
        });
    });
}

export default function MessengerInbox() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [msgLoading, setMsgLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [aiGenerating, setAiGenerating] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const selectedConversationRef = useRef<string | null>(null);

    useEffect(() => {
        selectedConversationRef.current = selectedConversation;
    }, [selectedConversation]);

    useEffect(() => {
        fetchConversations();
        const channelName = 'messenger_updates';

        // Prevent duplicate subscriptions during fast remounts or HMR.
        cleanupChannelsByTopic(channelName);
        
        // Subscribe to real-time updates
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes' as any, 
                { event: '*', schema: 'public', table: 'messenger_conversations' }, 
                () => { fetchConversations(); }
            )
            .on(
                'postgres_changes' as any, 
                { event: 'INSERT', schema: 'public', table: 'messenger_messages' }, 
                (payload: any) => {
                    const newMsg = payload.new;
                    if (selectedConversationRef.current && newMsg && newMsg.conversation_id === selectedConversationRef.current) {
                        setMessages(prev => [...prev, newMsg as Message]);
                    }
                }
            )
            .subscribe((status: string) => {
                if (status === 'CHANNEL_ERROR') {
                    console.warn('[Messenger] realtime subscription unavailable');
                }
            });

        return () => {
            channel.unsubscribe();
            supabase.removeChannel(channel).catch((error: unknown) => {
                if (!isExpectedRealtimeCloseError(error)) {
                    console.warn('[Messenger] realtime cleanup failed:', error);
                }
            });
        };
    }, []);

    useEffect(() => {
        if (selectedConversation) {
            fetchMessages(selectedConversation);
            markAsRead(selectedConversation);
        }
    }, [selectedConversation]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchConversations = async () => {
        try {
            const { data, error } = await supabase
                .from('messenger_conversations')
                .select('*')
                .order('last_message_at', { ascending: false });

            if (error) throw error;
            const rows = (data || []) as Conversation[];
            const contactIds = rows
                .map((c) => c.contact_id)
                .filter((id): id is string => Boolean(id));

            if (contactIds.length === 0) {
                setConversations(rows);
                return;
            }

            const { data: contactsData } = await supabase
                .from('contacts')
                .select('id, full_name, email')
                .in('id', contactIds);

            const contactMap = new Map<string, { full_name?: string; email?: string }>();
            (contactsData || []).forEach((c: any) => {
                contactMap.set(c.id, { full_name: c.full_name, email: c.email });
            });

            setConversations(
                rows.map((c) => ({
                    ...c,
                    contacts: c.contact_id ? contactMap.get(c.contact_id) : undefined,
                }))
            );
        } catch (err) {
            console.error('Error fetching conversations:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (convId: string) => {
        setMsgLoading(true);
        try {
            const { data, error } = await supabase
                .from('messenger_messages')
                .select('*')
                .eq('conversation_id', convId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);
        } catch (err) {
            console.error('Error fetching messages:', err);
        } finally {
            setMsgLoading(false);
        }
    };

    const markAsRead = async (convId: string) => {
        await supabase
            .from('messenger_conversations')
            .update({ is_read: true })
            .eq('id', convId);
    };

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!replyText.trim() || !selectedConversation || sending) return;

        setSending(true);
        const textToSend = replyText;
        setReplyText('');

        try {
            const res = await fetch('/api/facebook/messenger/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId: selectedConversation,
                    text: textToSend,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to send message');
            }
            
            // The message will be added via real-time subscription
        } catch (err: any) {
            toast.error(err.message);
            setReplyText(textToSend);
        } finally {
            setSending(false);
        }
    };

    const handleAiSuggest = async () => {
        if (messages.length === 0) return;
        
        const lastUserMsg = [...messages].reverse().find(m => m.sender_type === 'user');
        if (!lastUserMsg) {
            toast.error('No customer message found to reply to.');
            return;
        }

        setAiGenerating(true);
        try {
            const suggestion = await generateMessengerReply(
                lastUserMsg.text, 
                'Professional, helpful assistant for AlphaClone platform.'
            );
            setReplyText(suggestion);
            toast.success('AI suggestion generated!');
        } catch (err) {
            toast.error('AI generation failed.');
        } finally {
            setAiGenerating(false);
        }
    };

    const filteredConversations = conversations.filter(c => 
        (c.contacts?.full_name || c.sender_id).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const activeConv = conversations.find(c => c.id === selectedConversation);

    return (
        <div className="flex flex-col bg-gray-950 text-gray-100 rounded-3xl border border-white/5 overflow-hidden shadow-2xl h-[calc(100vh-160px)] min-h-[600px] relative">
            <div className="flex flex-1 overflow-hidden">
                {/* Conversation Sidebar */}
                <div className={`
                    ${isMobileMenuOpen ? 'fixed inset-0 z-50 bg-gray-950 w-72 border-r border-white/10 shadow-2xl shadow-blue-500/10' : 'hidden lg:flex'} 
                    w-80 flex-col bg-gray-900/20 backdrop-blur-3xl shrink-0 transition-all duration-300 border-r border-white/5
                `}>
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600/10 rounded-xl text-blue-400">
                                <MessageSquare size={20} />
                            </div>
                            <span className="font-bold text-gray-200 tracking-tight text-lg">Messenger Suite</span>
                        </div>
                        <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-4 px-6 border-b border-white/5">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors pointer-events-none" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search conversations..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-3 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 focus:outline-none transition-all placeholder:text-gray-600 text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {loading ? (
                            <div className="space-y-2 p-2">
                                {[1,2,3,4].map(i => (
                                    <div key={i} className="w-full h-20 bg-white/5 rounded-2xl animate-pulse" />
                                ))}
                            </div>
                        ) : filteredConversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-600 opacity-60 text-center px-6">
                                <Inbox size={40} className="mb-4 opacity-20" />
                                <p className="text-sm font-semibold">No conversations</p>
                                <p className="text-[10px] uppercase tracking-widest mt-1">Inbox is empty</p>
                            </div>
                        ) : (
                            filteredConversations.map(conv => (
                                <button
                                    key={conv.id}
                                    onClick={() => {
                                        setSelectedConversation(conv.id);
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className={`w-full text-left p-4 rounded-2xl transition-all group flex flex-col gap-1.5 relative ${selectedConversation === conv.id ? 'bg-blue-600/10 border border-blue-500/20 shadow-lg' : 'hover:bg-white/5 border border-transparent'}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <div className="w-10 h-10 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center text-gray-400 font-bold border border-white/5 group-hover:border-blue-500/30 transition-all">
                                                {conv.contacts?.full_name?.charAt(0) || <User size={18} />}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className={`font-bold text-sm truncate max-w-[140px] ${!conv.is_read ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                                                    {conv.contacts?.full_name || `Customer ${conv.sender_id.substring(0, 4)}`}
                                                </h3>
                                                <div className="flex items-center gap-1">
                                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Active</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-[9px] font-black text-gray-600 uppercase">
                                            {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className={`text-xs truncate ${!conv.is_read ? 'text-blue-200 font-semibold' : 'text-gray-500 group-hover:text-gray-400'}`}>
                                        {conv.last_message_preview}
                                    </p>
                                    
                                    {!conv.is_read && (
                                        <div className="absolute right-4 bottom-4 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col bg-gray-950/40 relative">
                    {selectedConversation ? (
                        <>
                            <div className="p-4 border-b border-white/5 flex items-center justify-between sticky top-0 bg-gray-950/60 backdrop-blur-3xl z-20">
                                <div className="flex items-center gap-4">
                                    <button onClick={() => setSelectedConversation(null)} className="lg:hidden p-2 text-gray-400 hover:text-white rounded-xl">
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center text-white font-black shadow-lg">
                                            {activeConv?.contacts?.full_name?.charAt(0) || 'C'}
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-white tracking-tight">{activeConv?.contacts?.full_name || `Customer ${activeConv?.sender_id}`}</h2>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-blue-400 font-black uppercase tracking-[0.1em]">Facebook Messenger</span>
                                                {activeConv?.contact_id && (
                                                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded-md border border-green-500/20">
                                                        <CheckCircle2 size={10} />
                                                        <span className="text-[8px] font-black uppercase">CRM Linked</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="p-2.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all" title="Link to Contact">
                                        <LinkIcon size={18} />
                                    </button>
                                    <button className="p-2.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all" title="Refresh">
                                        <RefreshCcw size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                                {msgLoading ? (
                                    <div className="flex flex-col items-center justify-center py-40 gap-3 opacity-20">
                                        <Loader2 className="animate-spin text-blue-500" size={32} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Loading Analytics</span>
                                    </div>
                                ) : (
                                    <>
                                        {messages.map((msg, i) => {
                                            const isMe = msg.sender_type === 'page';
                                            return (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    key={msg.id}
                                                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                                                >
                                                    <div className={`max-w-[70%] p-4 rounded-2xl text-sm ${
                                                        isMe 
                                                        ? 'bg-blue-600 text-white rounded-br-none shadow-lg shadow-blue-600/20' 
                                                        : 'bg-white/5 text-gray-200 border border-white/5 rounded-bl-none'
                                                    }`}>
                                                        <p className="leading-relaxed">{msg.text}</p>
                                                        <div className={`text-[8px] mt-2 font-black uppercase tracking-widest ${isMe ? 'text-blue-200' : 'text-gray-500'}`}>
                                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                        <div ref={messagesEndRef} />
                                    </>
                                )}
                            </div>

                            <div className="p-4 border-t border-white/5 bg-gray-950/60 backdrop-blur-3xl">
                                <div className="max-w-4xl mx-auto space-y-4">
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={handleAiSuggest}
                                            disabled={aiGenerating || msgLoading}
                                            className="flex items-center gap-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white px-4 py-2 rounded-xl border border-indigo-600/20 transition-all font-black uppercase tracking-widest text-[9px] disabled:opacity-50"
                                        >
                                            {aiGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            <span>Smart Reply</span>
                                        </button>
                                    </div>

                                    <form onSubmit={handleSend} className="relative flex gap-2">
                                        <input 
                                            type="text" 
                                            placeholder="Write a message..."
                                            value={replyText}
                                            onChange={e => setReplyText(e.target.value)}
                                            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500/30 focus:outline-none transition-all text-sm pr-16"
                                        />
                                        <button 
                                            disabled={sending || !replyText.trim()}
                                            className="bg-blue-600 hover:bg-blue-500 p-4 rounded-2xl text-white shadow-xl shadow-blue-600/20 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center shrink-0"
                                        >
                                            {sending ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-600 p-12 text-center">
                            <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
                                <MessageSquare size={40} className="text-gray-700" />
                            </div>
                            <h3 className="text-xl font-black text-gray-400 uppercase tracking-widest mb-2">Messenger Command</h3>
                            <p className="text-xs text-gray-600 max-w-xs leading-relaxed uppercase tracking-tighter">Choose a customer thread to engage at scale with AI-assisted messaging.</p>
                            
                            <div className="mt-12 p-6 bg-blue-600/5 rounded-2xl border border-blue-500/10 max-w-sm">
                                <div className="flex items-center gap-2 mb-3 text-blue-400">
                                    <ShieldCheck size={16} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Enterprise Shield</span>
                                </div>
                                <p className="text-[10px] text-gray-500 text-left leading-relaxed font-bold uppercase tracking-wide">
                                    Communication is end-to-end reliable. 
                                    Responses are tracked within the AlphaClone CRM for 360-degree customer intelligence.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
            `}</style>
        </div>
    );
}
