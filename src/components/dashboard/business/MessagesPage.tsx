import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { messageService } from '../../../services/messageService';
import {
    Send,
    Paperclip,
    Search,
    MoreVertical
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
        const { messages: allMessages } = await messageService.getMessages(user.id, user.role);

        // Group by conversation (simplified)
        const convos = allMessages.slice(0, 5).map((msg, idx) => ({
            id: `conv-${idx}`,
            name: msg.senderName || 'Unknown',
            lastMessage: msg.content,
            unread: msg.status === 'unread',
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
        const { messages: msgs } = await messageService.getMessages(user.id, user.role);
        setMessages(msgs.slice(0, 10));
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;

        await messageService.sendMessage({
            senderId: user.id,
            senderName: user.name,
            receiverId: 'recipient-id', // In production, get from conversation
            content: newMessage,
            type: 'text'
        });

        setNewMessage('');
        loadMessages(selectedConversation.id);
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full"><div className="text-slate-400">Loading messages...</div></div>;
    }

    return (
        <div className="h-full flex gap-4">
            {/* Conversations List */}
            <div className="w-80 bg-slate-900/50 border border-slate-800 rounded-xl flex flex-col">
                <div className="p-4 border-b border-slate-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search messages..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500 text-sm"
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

            {/* Messages Area */}
            <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-xl flex flex-col">
                {selectedConversation ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
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
                                        className={`max-w-md px-4 py-2 rounded-lg ${msg.senderId === user.id
                                                ? 'bg-teal-500 text-white'
                                                : 'bg-slate-800 text-slate-100'
                                            }`}
                                    >
                                        <p className="text-sm">{msg.content}</p>
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
                                    className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
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
        </div>
    );
};

export default MessagesPage;
