import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { DailyCall } from '@daily-co/daily-js';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface Message {
    id: string;
    sender_id?: string;
    sender_name: string;
    message: string;
    created_at: string;
}

interface MeetingChatProps {
    callObject: DailyCall | null;
    currentUser: { id: string; name: string };
    callId?: string; // Database ID for persistence
}

export const MeetingChat: React.FC<MeetingChatProps> = ({ callObject, currentUser, callId }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false);

    // 1. Fetch initial history and subscribe to changes
    useEffect(() => {
        if (!callId) return;

        setLoading(true);

        // Fetch existing messages
        const fetchHistory = async () => {
            const { data, error } = await supabase
                .from('meeting_chat_messages')
                .select('*')
                .eq('video_call_id', callId)
                .order('created_at', { ascending: true });

            if (!error && data) {
                setMessages(data);
            }
            setLoading(false);
        };

        fetchHistory();

        // Subscribe to new messages
        const channel = supabase
            .channel(`chat:${callId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'meeting_chat_messages',
                filter: `video_call_id=eq.${callId}`
            }, (payload) => {
                const newMessage = payload.new as Message;

                // Avoid duplicate if we were the sender (local optimistic update might exist)
                // We'll rely on state update from subscription + optimistc filtering
                setMessages(prev => {
                    if (prev.some(m => m.id === newMessage.id)) return prev;
                    return [...prev, newMessage];
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [callId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async () => {
        if (!inputMessage.trim()) return;

        // Prepare payload
        const newMessagePayload = {
            video_call_id: callId,
            sender_id: currentUser.id,
            sender_name: currentUser.name,
            message: inputMessage.trim(),
        };

        if (!callId) {
            toast.error('Chat unavailable (No Call ID)');
            return;
        }

        // Send to Supabase
        const { error } = await supabase
            .from('meeting_chat_messages')
            .insert(newMessagePayload);

        if (error) {
            console.error('Failed to send message:', error);
            toast.error('Failed to send message');
            return;
        }

        // We clear input immediately. 
        // The subscription will add the message to the list.
        setInputMessage('');
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800">
            {/* Header */}
            <div className="p-4 border-b border-slate-800">
                <h3 className="font-bold text-white">Meeting Chat</h3>
                <p className="text-xs text-slate-400 mt-1">{messages.length} messages</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {messages.length === 0 ? (
                    <div className="text-center text-slate-500 mt-8">
                        <p className="text-sm">No messages yet</p>
                        <p className="text-xs mt-1">Start the conversation!</p>
                    </div>
                ) : (
                    messages.map(msg => {
                        const isMe = msg.sender_id === currentUser.id;
                        return (
                            <div
                                key={msg.id}
                                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                            >
                                <div className="text-xs text-slate-400 mb-1">{msg.sender_name}</div>
                                <div
                                    className={`px-3 py-2 rounded-lg max-w-[80%] break-words ${isMe
                                            ? 'bg-teal-600 text-white'
                                            : 'bg-slate-800 text-slate-200'
                                        }`}
                                >
                                    {msg.message}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-800">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={callId ? "Type a message..." : "Chat unavailable"}
                        disabled={!callId || loading}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!inputMessage.trim() || !callId || loading}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                        <Send className="w-5 h-5 text-white" />
                    </button>
                </div>
            </div>
        </div>
    );
};
