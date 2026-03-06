'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Loader2 } from 'lucide-react';
import { Button } from '../../ui/UIComponents';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';

interface ComposeEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({ isOpen, onClose, userId }) => {
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);

    const handleSend = async () => {
        if (!to || !subject || !body) {
            toast.error('All fields are required');
            return;
        }

        setSending(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();

            const res = await fetch('/api/zoho/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    userId,
                    to,
                    subject,
                    content: body.replace(/\n/g, '<br/>')
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to send message');
            }

            toast.success('Email sent via Zoho Mail');
            onClose();
            setTo('');
            setSubject('');
            setBody('');
        } catch (err: any) {
            toast.error(err.message || 'Failed to send');
        } finally {
            setSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Send className="w-4 h-4 text-[#f5d400]" />
                        Compose Email
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest block mb-2 px-1">Recipient</label>
                        <input
                            type="email"
                            value={to}
                            onChange={e => setTo(e.target.value)}
                            placeholder="email@example.com"
                            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-[#f5d400]/40 outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest block mb-2 px-1">Subject</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            placeholder="Enter subject line..."
                            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-[#f5d400]/40 outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest block mb-2 px-1">Message Content</label>
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            placeholder="Write your email here..."
                            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-4 text-sm text-white focus:border-[#f5d400]/40 outline-none transition-all min-h-[200px] resize-none"
                        />
                    </div>
                </div>

                <div className="p-6 pt-0 flex justify-end">
                    <Button
                        onClick={handleSend}
                        disabled={sending}
                        className="bg-[#f5d400] hover:bg-[#ffe100] text-slate-950 px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
                    >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Send Email
                    </Button>
                </div>
            </motion.div>
        </div>
    );
};

export default ComposeEmailModal;
