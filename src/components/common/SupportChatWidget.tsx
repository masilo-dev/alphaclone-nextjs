'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageSquare,
    X,
    Send,
    Bot,
    Loader2,
    Mail,
    ExternalLink,
    ChevronDown,
    HelpCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';

const ComposeEmailModal = dynamic(
    () => import('@/components/dashboard/business/ComposeEmailModal'),
    { ssr: false }
);

// --- Types ---

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    escalate?: boolean;
}

interface EmailDraftState {
    to: string;
    subject: string;
    body: string;
}

// --- Constants ---

const ESCALATION_SIGNAL = 'ESCALATE_TO_HUMAN';
const SUPPORT_EMAIL = 'support@alphaclone.tech';

const QUICK_QUESTIONS = [
    'What does AlphaClone replace?',
    'How do I send an invoice?',
    'How do I connect my email?',
    'How do I use the AI assistant?',
    'What are the pricing plans?',
];

// --- Helpers ---

function buildSupportEmailDraft(lastUserMessage: string): EmailDraftState {
    return {
        to: SUPPORT_EMAIL,
        subject: 'Support Request',
        body: `Hello AlphaClone Support,\n\nI need assistance with the following:\n\n${lastUserMessage}\n\nThank you.`,
    };
}

function detectEscalation(text: string): boolean {
    return (
        text.includes(ESCALATION_SIGNAL) ||
        /\b(human|speak to someone|real person|contact support|support team|file a (?:bug|ticket)|billing issue)\b/i.test(text)
    );
}

// --- Component ---

export default function SupportChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '0',
            role: 'assistant',
            content:
                "Hello! I'm Bonnie, your AlphaClone support assistant. I can answer questions about the platform, help you get started, or write emails for you. What can I help with today?",
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [composeDraft, setComposeDraft] = useState<EmailDraftState | null>(null);
    const [lastUserMessage, setLastUserMessage] = useState('');

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) setUserId(data.user.id);
        });
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const sendMessage = useCallback(
        async (text: string) => {
            if (!text.trim() || isLoading) return;

            const userMsg: Message = {
                id: Date.now().toString(),
                role: 'user',
                content: text.trim(),
            };

            setLastUserMessage(text.trim());
            setMessages((prev) => [...prev, userMsg]);
            setInput('');
            setIsLoading(true);

            try {
                const history = messages.map((m) => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    text: m.content,
                }));

                const res = await fetch('/api/alpha/support', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text.trim(), history }),
                });

                const data = await res.json();
                const rawReply: string =
                    data.reply || 'I had trouble connecting. Please try again or email us directly.';

                const shouldEscalate = detectEscalation(rawReply);
                const displayReply = rawReply.replace(ESCALATION_SIGNAL, '').trim();

                const assistantMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: displayReply,
                    escalate: shouldEscalate,
                };
                setMessages((prev) => [...prev, assistantMsg]);
            } catch {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content:
                            'I could not reach my knowledge base right now. You can email us directly at support@alphaclone.tech.',
                    },
                ]);
            } finally {
                setIsLoading(false);
            }
        },
        [isLoading, messages]
    );

    const handleEscalate = useCallback(() => {
        setComposeDraft(buildSupportEmailDraft(lastUserMessage));
    }, [lastUserMessage]);

    const handleMailtoFallback = useCallback(() => {
        const subject = encodeURIComponent('Support Request');
        const body = encodeURIComponent(
            `Hello AlphaClone Support,\n\nI need help with:\n\n${lastUserMessage}\n\nThank you.`
        );
        window.open(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`, '_blank');
    }, [lastUserMessage]);

    return (
        <>
            {/* Widget */}
            <div className="fixed bottom-6 right-6 z-[9000] flex flex-col items-end gap-3">
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            key="panel"
                            initial={{ opacity: 0, y: 16, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 16, scale: 0.97 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className="w-[360px] md:w-[400px] rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl shadow-black/40 overflow-hidden flex flex-col"
                            style={{ maxHeight: '600px' }}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-700 to-indigo-600 shrink-0">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                                        <Bot className="h-4 w-4 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-white leading-none">Bonnie</p>
                                        <p className="text-[10px] text-indigo-200 mt-0.5">AlphaClone Support</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-white/70 hover:text-white transition-colors"
                                    aria-label="Close support chat"
                                >
                                    <ChevronDown className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Quick questions — show only on first open with no user messages */}
                            {messages.filter((m) => m.role === 'user').length === 0 && (
                                <div className="px-3 pt-3 pb-1 flex flex-wrap gap-1.5 shrink-0">
                                    {QUICK_QUESTIONS.map((q) => (
                                        <button
                                            key={q}
                                            onClick={() => sendMessage(q)}
                                            className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:bg-indigo-700 hover:border-indigo-600 hover:text-white transition-colors"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Messages */}
                            <div
                                ref={scrollRef}
                                className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0"
                            >
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                                                msg.role === 'user'
                                                    ? 'bg-indigo-600 text-white rounded-br-none'
                                                    : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-none'
                                            }`}
                                        >
                                            {msg.content}
                                            {msg.escalate && (
                                                <div className="mt-2.5 pt-2.5 border-t border-slate-600/50">
                                                    <p className="text-[11px] text-slate-400 mb-1.5">
                                                        Reach our support team:
                                                    </p>
                                                    {userId ? (
                                                        <button
                                                            onClick={handleEscalate}
                                                            className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                                                        >
                                                            <Mail className="h-3 w-3" />
                                                            Draft support email
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={handleMailtoFallback}
                                                            className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                                                        >
                                                            <ExternalLink className="h-3 w-3" />
                                                            Email support
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                                            <span className="text-xs text-slate-400">Bonnie is thinking...</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Input */}
                            <div className="px-3 pb-3 pt-2 border-t border-slate-800 shrink-0">
                                <div className="flex gap-2">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
                                        placeholder="Ask a question or describe what you need..."
                                        className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                                    />
                                    <button
                                        onClick={() => sendMessage(input)}
                                        disabled={!input.trim() || isLoading}
                                        className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:bg-slate-700 text-white rounded-xl transition-colors"
                                    >
                                        <Send className="h-4 w-4" />
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-600 mt-1.5 text-center">
                                    Powered by AlphaClone AI
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Toggle button */}
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsOpen((v) => !v)}
                    aria-label={isOpen ? 'Close support chat' : 'Open support chat'}
                    className={`relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-black/30 transition-colors ${
                        isOpen
                            ? 'bg-slate-700 text-white'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                >
                    <AnimatePresence mode="wait" initial={false}>
                        {isOpen ? (
                            <motion.span
                                key="close"
                                initial={{ rotate: -90, opacity: 0 }}
                                animate={{ rotate: 0, opacity: 1 }}
                                exit={{ rotate: 90, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                            >
                                <X className="h-6 w-6" />
                            </motion.span>
                        ) : (
                            <motion.span
                                key="open"
                                initial={{ rotate: 90, opacity: 0 }}
                                animate={{ rotate: 0, opacity: 1 }}
                                exit={{ rotate: -90, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                            >
                                <HelpCircle className="h-6 w-6" />
                            </motion.span>
                        )}
                    </AnimatePresence>
                    {/* Unread indicator */}
                    {!isOpen && (
                        <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-slate-900" />
                    )}
                </motion.button>
            </div>

            {/* Email compose modal — only for authenticated users */}
            {composeDraft && userId && (
                <ComposeEmailModal
                    isOpen={true}
                    onClose={() => setComposeDraft(null)}
                    userId={userId}
                    initialTo={composeDraft.to}
                    initialSubject={composeDraft.subject}
                    initialBody={composeDraft.body}
                />
            )}
        </>
    );
}
