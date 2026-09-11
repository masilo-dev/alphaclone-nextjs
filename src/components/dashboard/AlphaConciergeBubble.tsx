'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, User, Bot, HelpCircle } from 'lucide-react';

export const AlphaConciergeBubble: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
        { role: 'assistant', content: "Hello! I'm your Alpha Concierge. How can I help you navigate the platform today?" }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input.trim();
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setInput('');
        setIsTyping(true);

        try {
            // This would normally call /api/alpha/chat or similar with agentRole: 'support'
            const response = await fetch('/api/alpha/support', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg })
            });
            
            const data = await response.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.reply || "I'm checking that for you..." }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: "I'm having a bit of trouble connecting to my brain. Try again in a second?" }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="mb-4 w-80 md:w-96 overflow-hidden rounded-2xl border border-white/20 bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-indigo-500/20"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 p-4">
                            <div className="flex items-center space-x-2 text-white">
                                <Bot size={20} className="animate-pulse" />
                                <span className="font-semibold">Bonnie (Alpha Support)</span>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="h-96 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                        msg.role === 'user' 
                                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                                            : 'bg-white/10 text-slate-100 rounded-tl-none border border-white/5'
                                    }`}>
                                        <p className="text-sm">{msg.content}</p>
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white/10 rounded-2xl px-4 py-2 rounded-tl-none animate-pulse">
                                        <div className="flex space-x-1">
                                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-white/10 bg-black/20">
                            <div className="flex space-x-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="Ask me anything..."
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button 
                                    onClick={handleSend}
                                    className="bg-indigo-600 p-2 rounded-xl text-white hover:bg-indigo-500 transition-colors"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-colors ${
                    isOpen ? 'bg-slate-800 text-white' : 'bg-indigo-600 text-white'
                }`}
            >
                {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
                {!isOpen && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold">
                        1
                    </span>
                )}
            </motion.button>
        </div>
    );
};

