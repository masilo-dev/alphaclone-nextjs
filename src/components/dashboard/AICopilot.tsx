'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Minus, Maximize2, Sparkles, Loader2, MessageSquare } from 'lucide-react';
import { chatWithAI } from '@/services/unifiedAIService';
import { Button, Card } from '@/components/ui/UIComponents';
import toast from 'react-hot-toast';

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
}

export const AICopilot: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'model', text: 'Hello! I am your AlphaClone AI Copilot. How can I help you manage your business today?' }
    ]);
    const [inputText, setInputText] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen, isMinimized]);

    const handleSendMessage = async () => {
        if (!inputText.trim() || isThinking) return;

        const userMessage = inputText.trim();
        const newMsg: Message = { id: Date.now().toString(), role: 'user', text: userMessage };

        setMessages(prev => [...prev, newMsg]);
        setInputText('');
        setIsThinking(true);

        try {
            const history = messages.map(m => ({
                role: m.role,
                text: m.text
            }));

            const { text } = await chatWithAI(history, userMessage);

            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: text || 'I encountered an issue. Please try again.'
            }]);
        } catch (error) {
            console.error('Copilot Chat Error:', error);
            toast.error('AI Assistant is currently unavailable');
        } finally {
            setIsThinking(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 p-4 bg-teal-600 hover:bg-teal-500 text-white rounded-full shadow-2xl shadow-teal-900/40 transition-all hover:scale-110 active:scale-95 group z-50 flex items-center justify-center animate-bounce-subtle"
            >
                <Bot className="w-6 h-6" />
                <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out group-hover:ml-2 font-medium">
                    Ask AI
                </span>
            </button>
        );
    }

    return (
        <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${isMinimized ? 'w-16 h-16' : 'w-[350px] sm:w-[400px] h-[500px] sm:h-[600px]'}`}>
            <Card className="flex flex-col h-full bg-slate-900 border-teal-500/30 shadow-2xl overflow-hidden p-0">
                {/* Header */}
                <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-teal-500/10 rounded-lg">
                            <Bot className="w-5 h-5 text-teal-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">AI Copilot</h3>
                            <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-[10px] text-slate-400">Online</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setIsMinimized(!isMinimized)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {!isMinimized && (
                    <>
                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user'
                                        ? 'bg-teal-600 text-white rounded-tr-none shadow-lg'
                                        : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                                        }`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            {isThinking && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-700 flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
                                        <span className="text-xs text-slate-400 italic">Thinking...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-slate-950 border-t border-slate-800">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Ask me anything..."
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!inputText.trim() || isThinking}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:bg-slate-700 text-white rounded-lg transition-all"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="mt-2 text-[10px] text-center text-slate-500 flex items-center justify-center gap-1">
                                <Sparkles className="w-3 h-3 text-teal-500/50" />
                                Powered by AlphaClone AI Intelligence
                            </p>
                        </div>
                    </>
                )}
            </Card>
        </div>
    );
};
