import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageCircle } from 'lucide-react';
import { User } from '../../../types';

export interface ChatMessage {
    id: string;
    userName: string;
    userId: string;
    message: string;
    timestamp: Date;
    isLocal: boolean;
}

interface MeetingChatProps {
    user: User;
    isOpen: boolean;
    onClose: () => void;
    onSendMessage: (message: string) => void;
    messages: ChatMessage[];
}

/**
 * In-Meeting Chat Component
 * Real-time chat during video calls
 */
const MeetingChat: React.FC<MeetingChatProps> = ({
    user,
    isOpen,
    onClose,
    onSendMessage,
    messages
}) => {
    const [inputMessage, setInputMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!inputMessage.trim()) return;

        onSendMessage(inputMessage.trim());
        setInputMessage('');
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed right-0 top-0 bottom-24 w-80 bg-gray-900/95 backdrop-blur-lg border-l border-gray-800 z-40 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <div className="flex items-center space-x-2">
                    <MessageCircle className="w-5 h-5 text-teal-400" />
                    <h3 className="text-white text-lg font-semibold">Chat</h3>
                    <span className="text-xs text-gray-400">({messages.length})</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    title="Close chat"
                >
                    <X className="w-5 h-5 text-gray-400" />
                </button>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-8">
                        <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No messages yet</p>
                        <p className="text-xs">Start the conversation!</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.isLocal ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[75%] rounded-lg p-3 ${
                                    msg.isLocal
                                        ? 'bg-teal-500 text-white'
                                        : 'bg-gray-800 text-gray-100'
                                }`}
                            >
                                {!msg.isLocal && (
                                    <p className="text-xs font-medium text-gray-400 mb-1">
                                        {msg.userName}
                                    </p>
                                )}
                                <p className="text-sm break-words">{msg.message}</p>
                                <p className="text-xs opacity-70 mt-1">
                                    {msg.timestamp.toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-4 border-t border-gray-800">
                <div className="flex items-end space-x-2">
                    <textarea
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type a message..."
                        className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 max-h-24"
                        rows={2}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputMessage.trim()}
                        className="p-3 bg-teal-500 hover:bg-teal-600 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors"
                        title="Send message"
                    >
                        <Send className="w-5 h-5 text-white" />
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Press Enter to send, Shift+Enter for new line</p>
            </div>
        </div>
    );
};

export default MeetingChat;
