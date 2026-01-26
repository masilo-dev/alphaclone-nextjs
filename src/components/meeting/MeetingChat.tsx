import React, { useState, useEffect, useRef } from 'react';
import { Send, Smile } from 'lucide-react';
import { DailyCall } from '@daily-co/daily-js';

interface Message {
    id: string;
    sender: string;
    senderName: string;
    message: string;
    timestamp: number;
}

interface MeetingChatProps {
    callObject: DailyCall | null;
    currentUser: { id: string; name: string };
}

export const MeetingChat: React.FC<MeetingChatProps> = ({ callObject, currentUser }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!callObject) return;

        const handleAppMessage = (event: any) => {
            const newMessage: Message = {
                id: Date.now().toString() + Math.random(),
                sender: event.fromId,
                senderName: event.data.senderName,
                message: event.data.message,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, newMessage]);
        };

        callObject.on('app-message', handleAppMessage);

        return () => {
            callObject.off('app-message', handleAppMessage);
        };
    }, [callObject]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = () => {
        if (!inputMessage.trim() || !callObject) return;

        callObject.sendAppMessage({
            message: inputMessage,
            senderName: currentUser.name
        }, '*');

        // Add own message to list
        const newMessage: Message = {
            id: Date.now().toString() + Math.random(),
            sender: currentUser.id,
            senderName: currentUser.name,
            message: inputMessage,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, newMessage]);
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
                    messages.map(msg => (
                        <div
                            key={msg.id}
                            className={`flex flex-col ${msg.sender === currentUser.id ? 'items-end' : 'items-start'}`}
                        >
                            <div className="text-xs text-slate-400 mb-1">{msg.senderName}</div>
                            <div
                                className={`px-3 py-2 rounded-lg max-w-[80%] break-words ${msg.sender === currentUser.id
                                    ? 'bg-teal-600 text-white'
                                    : 'bg-slate-800 text-slate-200'
                                    }`}
                            >
                                {msg.message}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    ))
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
                        placeholder="Type a message..."
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!inputMessage.trim()}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                        <Send className="w-5 h-5 text-white" />
                    </button>
                </div>
            </div>
        </div>
    );
};
