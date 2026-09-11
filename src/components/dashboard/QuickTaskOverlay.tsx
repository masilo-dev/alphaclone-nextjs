'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Calendar, Flag, User as UserIcon, X, Check, Loader2, Sparkles } from 'lucide-react';
import { taskService } from '../../services/taskService';
import { toast } from 'react-hot-toast';

interface QuickTaskOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

export const QuickTaskOverlay: React.FC<QuickTaskOverlayProps> = ({ isOpen, onClose, userId }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
    const [dueDate, setDueDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTitle('');
            setDescription('');
            setPriority('medium');
            setDueDate('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!title.trim()) return;

        setIsSubmitting(true);
        try {
            const { error } = await taskService.createTask(userId, {
                title: title.trim(),
                description: description.trim(),
                priority,
                dueDate: dueDate || undefined,
                status: 'todo'
            });

            if (error) throw new Error(error);

            toast.success('Objective captured successfully');
            onClose();
        } catch (err: any) {
            toast.error(err.message || 'Neural capture failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            handleSubmit();
        }
        if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-[20vh] px-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="w-full max-w-xl bg-slate-900 border border-teal-500/20 rounded-3xl shadow-2xl overflow-hidden relative"
                    >
                        {/* Shimmer Border */}
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-teal-500/50 to-transparent animate-shimmer" />

                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-teal-500/10 rounded-lg">
                                        <Zap className="w-4 h-4 text-teal-400" />
                                    </div>
                                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Quick Neural Capture</h2>
                                </div>
                                <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
                                <div className="space-y-1">
                                    <input
                                        ref={inputRef}
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="What needs to be done?"
                                        className="w-full bg-transparent border-none focus:ring-0 text-xl font-bold text-white placeholder-slate-600 p-0"
                                    />
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Add details (optional)..."
                                        rows={2}
                                        className="w-full bg-transparent border-none focus:ring-0 text-sm text-slate-400 placeholder-slate-700 p-0 resize-none"
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/5">
                                    {/* Priority Picker */}
                                    <div className="flex items-center gap-1 bg-slate-950/50 p-1 rounded-xl border border-white/5">
                                        {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setPriority(p)}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                                    priority === p 
                                                    ? 'bg-teal-500 text-slate-950' 
                                                    : 'text-slate-500 hover:text-slate-300'
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Due Date */}
                                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-950/50 rounded-xl border border-white/5 group hover:border-teal-500/30 transition-all">
                                        <Calendar className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400" />
                                        <input
                                            type="date"
                                            value={dueDate}
                                            onChange={(e) => setDueDate(e.target.value)}
                                            className="bg-transparent border-none focus:ring-0 text-[10px] font-black uppercase tracking-widest text-slate-400 placeholder-slate-700 p-0 cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                            <span className="px-1.5 py-0.5 bg-slate-950 rounded border border-white/5">ESC</span>
                                            <span>Close</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                            <span className="px-1.5 py-0.5 bg-slate-950 rounded border border-white/5">⌘ + ENTER</span>
                                            <span>Capture</span>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !title.trim()}
                                        className={`px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${
                                            !title.trim() 
                                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                                            : 'bg-teal-500 text-slate-950 hover:bg-teal-400 shadow-lg shadow-teal-500/20'
                                        }`}
                                    >
                                        {isSubmitting ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Sparkles className="w-3.5 h-3.5" />
                                        )}
                                        Capture
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
