import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { messageService } from '../../../services/messageService';
import toast from 'react-hot-toast';
import {
    Send,
    Paperclip,
    Search,
    MoreVertical,
    ArrowLeft,
    Bot
} from 'lucide-react';

interface MessagesPageProps {
    user: User;
}

const MessagesPage: React.FC<MessagesPageProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const [conversations, setConversations] = useState<any[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (currentTenant) {
            loadConversations();
        }
    }, [currentTenant]);

    useEffect(() => {
        if (selectedConversation) {
            loadMessages(selectedConversation.id);
        }
    }, [selectedConversation]);

    const loadConversations = async () => {
        setLoading(true);
        // Load conversations from messageService
        const isAdmin = user.role === 'admin' || user.role === 'tenant_admin';
        const { messages: allMessages } = await messageService.getMessages(user.id, isAdmin);

        // Group by conversation (simplified)
        const convos = allMessages.slice(0, 5).map((msg, idx) => ({
            id: `conv-${idx}`,
            name: msg.senderName || 'Unknown',
            lastMessage: msg.text,
            unread: !msg.readAt,
            timestamp: msg.timestamp
        }));

        setConversations(convos);
        if (convos.length > 0) {
            setSelectedConversation(convos[0]);
        }
        setLoading(false);
    };

    const loadMessages = async (conversationId: string) => {
        // Load messages for conversation
        const isAdmin = user.role === 'admin' || user.role === 'tenant_admin';
        const { messages: msgs } = await messageService.getMessages(user.id, isAdmin);
        setMessages(msgs.slice(0, 10));
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;

        await messageService.sendMessage(
            user.id,
            user.name,
            user.role === 'admin' || user.role === 'tenant_admin' ? 'model' : 'user',
            newMessage,
            'recipient-id' // In production, get from conversation
        );

        setNewMessage('');
        loadMessages(selectedConversation.id);
    };

    const [autoPilotEnabled, setAutoPilotEnabled] = useState(false);

    // Watch for new messages to trigger Auto-Pilot
    useEffect(() => {
        if (!autoPilotEnabled || !messages.length) return;

        const lastMessage = messages[messages.length - 1]; // Messages are likely loaded via loadMessages which might be reverse order or not. 
        // Logic check: Messages from `loadMessages` are slice(0, 10).
        // Messages in state `messages` are sorted? 
        // Existing code: `setMessages(msgs.slice(0, 10));` ... `msgs` comes from `messageService.getMessages` ... which does `.reverse()`. 
        // So `messages[messages.length - 1]` is the NEWEST message.

        // If newest message is from USER and we haven't replied yet (naive check: last message is user)
        if (lastMessage.senderId !== user.id && lastMessage.senderId !== 'ai-agent' && lastMessage.role === 'user') {
            const replyId = `reply-to-${lastMessage.id}`;
            // Prevent duplicate replies loop - in real app use DB 'replied' flag or local Set
            const alreadyReplied = sessionStorage.getItem(replyId);

            if (!alreadyReplied) {
                console.log('🤖 Auto-Pilot Triggered for:', lastMessage.text);
                sessionStorage.setItem(replyId, 'processing');

                // Trigger AI
                messageService.processIncomingMessage(
                    currentTenant?.id || '',
                    lastMessage,
                    selectedConversation?.name || 'Client'
                ).then(({ autoReply }) => {
                    if (autoReply) {
                        toast.success('AI Auto-Replied to client');
                        // Add to local state immediately
                        setMessages(prev => [...prev, autoReply]);
                        sessionStorage.setItem(replyId, 'done');
                    }
                });
            }
        }
    }, [messages, autoPilotEnabled, user.id, currentTenant, selectedConversation]);

    if (loading) {
        return <div className="flex items-center justify-center h-full"><div className="text-slate-400">Loading messages...</div></div>;
    }

    return (
        <div className="h-full flex md:gap-4 relative">
            {/* Conversations List */}
            <div className={`w-full md:w-80 bg-slate-900/50 border border-slate-800 rounded-2xl flex-col ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/30 rounded-t-2xl">
                    <h3 className="font-bold text-white">Messages</h3>
                    {/* Auto-Pilot Toggle */}
                    <button
                        onClick={() => {
                            const newState = !autoPilotEnabled;
                            setAutoPilotEnabled(newState);
                            toast(newState ? "AI Auto-Pilot ACTIVATED 🤖" : "AI Auto-Pilot Deactivated", { icon: newState ? '🟢' : '⚪️' });
                        }}
                        className={`flex items-center gap-2 text-[10px] uppercase font-bold px-3 py-1.5 rounded-full border transition-all ${autoPilotEnabled
                            ? 'bg-teal-500/20 text-teal-400 border-teal-500/50 shadow-lg shadow-teal-500/10'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                            }`}
                    >
                        <Bot className={`w-3 h-3 ${autoPilotEnabled ? 'animate-pulse' : ''}`} />
                        {autoPilotEnabled ? 'Auto-Pilot ON' : 'Auto-Pilot OFF'}
                    </button>
                </div>

                <div className="p-4 pt-2 border-b border-slate-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search messages..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:border-teal-500 text-sm transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {conversations.map(conv => (
                        <div
                            key={conv.id}
                            onClick={() => setSelectedConversation(conv)}
                            className={`p-4 border-b border-slate-800 cursor-pointer transition-colors ${selectedConversation?.id === conv.id
                                ? 'bg-teal-500/10 border-l-4 border-l-teal-500'
                                : 'hover:bg-slate-800/50'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-violet-600 flex items-center justify-center font-bold flex-shrink-0">
                                    {conv.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="font-medium text-sm truncate">{conv.name}</h4>
                                        {conv.unread && (
                                            <div className="w-2 h-2 bg-teal-500 rounded-full" />
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 truncate">{conv.lastMessage}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Messages Area - Mobile Only (when active) OR Desktop */}
            <div className={`flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl flex-col ${selectedConversation ? 'flex' : 'hidden md:flex'}`}>
                {selectedConversation ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setSelectedConversation(null)}
                                    className="md:hidden p-2 -ml-2 hover:bg-slate-800 rounded-full transition-colors"
                                >
                                    <ArrowLeft className="w-5 h-5 text-slate-400" />
                                </button>
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-violet-600 flex items-center justify-center font-bold">
                                    {selectedConversation.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-semibold">{selectedConversation.name}</h3>
                                    <p className="text-xs text-slate-400">Online</p>
                                </div>
                            </div>
                            <button className="p-2 hover:bg-slate-800 rounded">
                                <MoreVertical className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-md px-5 py-3 rounded-2xl ${msg.senderId === user.id
                                            ? 'bg-teal-500 text-white rounded-br-none'
                                            : 'bg-slate-800 text-slate-100 rounded-bl-none'
                                            }`}
                                    >
                                        <p className="text-sm">{msg.text}</p>
                                        <p className="text-xs opacity-70 mt-1">
                                            {new Date(msg.timestamp).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-slate-800">
                            <div className="flex items-center gap-3">
                                <button className="p-2 hover:bg-slate-800 rounded">
                                    <Paperclip className="w-5 h-5 text-slate-400" />
                                </button>
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Type a message..."
                                    className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:border-teal-500 transition-all"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    className="p-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400">
                        Select a conversation to start messaging
                    </div>
                )}
            </div>
        </div >
    );
};

export default MessagesPage;
