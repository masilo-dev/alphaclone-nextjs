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
        <div className="fixed right-0 top-0 bottom-24 w-80 bg-slate-900/95 backdrop-blur-xl border-l border-slate-700/50 z-40 flex flex-col shadow-[-8px_0_30px_rgba(0,0,0,0.5)] animate-in slide-in-from-right-8 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-slate-800/30">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-teal-500/10 rounded-lg">
                        <MessageCircle className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                        <h3 className="text-white text-sm font-semibold tracking-wide">Meeting Chat</h3>
                        <span className="text-[11px] text-slate-400">{messages.length} {messages.length === 1 ? 'message' : 'messages'}</span>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
                    title="Close chat"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 opacity-60">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                            <MessageCircle className="w-8 h-8" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-slate-300">No messages yet</p>
                            <p className="text-xs">Start the conversation</p>
                        </div>
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const showAvatar = !msg.isLocal;
                        const showsTime = index === 0 || msg.timestamp.getTime() - messages[index - 1].timestamp.getTime() > 60000;

                        return (
                            <div
                                key={msg.id}
                                className={`flex w-full ${msg.isLocal ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 fade-in duration-200`}
                            >
                                {!msg.isLocal && (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mr-2 border border-slate-700 mt-0.5 shadow-sm">
                                        <span className="text-white text-[10px] font-bold">
                                            {(msg.userName?.[0] || 'G').toUpperCase()}
                                        </span>
                                    </div>
                                )}

                                <div className={`flex flex-col max-w-[75%] ${msg.isLocal ? 'items-end' : 'items-start'}`}>
                                    {!msg.isLocal && (
                                        <span className="text-[11px] font-medium text-slate-400 mb-1 ml-1">
                                            {msg.userName}
                                        </span>
                                    )}

                                    <div
                                        className={`px-4 py-2.5 shadow-sm ${msg.isLocal
                                                ? 'bg-teal-600 text-white rounded-2xl rounded-tr-sm'
                                                : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-2xl rounded-tl-sm'
                                            }`}
                                    >
                                        <p className="text-[13px] leading-relaxed break-words">{msg.message}</p>
                                    </div>

                                    {showsTime && (
                                        <p className="text-[10px] text-slate-500 mt-1 mx-1 font-medium">
                                            {msg.timestamp.toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-4 border-t border-slate-700/50 bg-slate-800/30 backdrop-blur-md">
                <div className="flex items-end space-x-2 bg-slate-900 border border-slate-700/50 rounded-xl p-1 shadow-inner focus-within:border-teal-500/50 focus-within:ring-1 focus-within:ring-teal-500/50 transition-all">
                    <textarea
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type your message..."
                        className="flex-1 bg-transparent text-white px-3 py-2 text-[13px] resize-none focus:outline-none max-h-24 min-h-[40px] scrollbar-hide"
                        rows={1}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputMessage.trim()}
                        className={`p-2.5 m-0.5 rounded-lg transition-all ${inputMessage.trim()
                                ? 'bg-teal-500 hover:bg-teal-400 text-white shadow-md'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                        title="Send message"
                    >
                        <Send className="w-4 h-4 ml-0.5" />
                    </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 text-center">Press <kbd className="bg-slate-800 px-1 py-0.5 rounded border border-slate-700">Enter</kbd> to send</p>
            </div>
        </div>
    );
};

export default MeetingChat;
