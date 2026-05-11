'use client';

import React, { useState } from 'react';
import { 
    Sparkles, Send, Copy, RefreshCw, 
    Zap, Target, BarChart3, Quote,
    CheckCircle2, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { optimizeSalesMessage } from '@/services/unifiedAIService';
import toast from 'react-hot-toast';

export default function SalesCopywriter() {
    const [input, setInput] = useState('');
    const [context, setContext] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleOptimize = async () => {
        if (!input.trim()) {
            toast.error('Please paste a message first');
            return;
        }

        setLoading(true);
        try {
            const optimized = await optimizeSalesMessage(input, context);
            setResult(optimized);
            toast.success('Strategy generated!');
        } catch (err: any) {
            toast.error(err.message || 'Failed to optimize message');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        if (!result) return;
        // Extract the message body from the result
        const messageMatch = result.match(/### OPTIMIZED MESSAGE:\s*([\s\S]*?)(?=###|$)/);
        const textToCopy = messageMatch ? messageMatch[1].trim() : result;
        
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        toast.success('Optimized message copied!');
        setTimeout(() => setCopied(false), 2000);
    };

    const parseResult = (text: string) => {
        const sections = {
            message: text.match(/### OPTIMIZED MESSAGE:\s*([\s\S]*?)(?=###|$)/)?.[1]?.trim() || '',
            probability: text.match(/### RESPONSE PROBABILITY:\s*(.*?)(?=\n|###|$)/)?.[1]?.trim() || 'N/A',
            analysis: text.match(/### STRATEGY ANALYSIS:\s*([\s\S]*?)(?=###|$)/)?.[1]?.trim() || ''
        };
        return sections;
    };

    const parsed = result ? parseResult(result) : null;

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20">
                            <Target size={24} />
                        </div>
                        Sales Intelligence Workbench
                    </h1>
                    <p className="text-gray-500 mt-2 font-medium uppercase tracking-widest text-xs">
                        Convert any draft into the "Best Outreach Message Ever" using AI Psychology
                    </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 rounded-full border border-green-500/20 shadow-sm">
                    <Zap size={14} className="animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-wider">Conversion Engine Active</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Section */}
                <div className="space-y-6">
                    <div className="bg-gray-900/40 backdrop-blur-3xl border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                            <Quote size={120} />
                        </div>
                        
                        <label className="block text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <BarChart3 size={12} className="text-indigo-400" />
                            Original Draft or Copied Message
                        </label>
                        
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Paste the message you want to improve here..."
                            className="w-full h-64 bg-black/40 border border-white/5 rounded-2xl p-5 text-gray-200 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none transition-all resize-none placeholder:text-gray-700 leading-relaxed"
                        />

                        <div className="mt-6 space-y-4">
                            <label className="block text-xs font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Sparkles size={12} className="text-amber-400" />
                                Add Context (Industry, Pain Points, Recipient)
                            </label>
                            <input
                                type="text"
                                value={context}
                                onChange={(e) => setContext(e.target.value)}
                                placeholder="e.g. SaaS Founders, high churn rates, early morning outreach"
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-5 py-3 text-sm text-gray-300 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none transition-all placeholder:text-gray-700"
                            />
                        </div>

                        <button
                            onClick={handleOptimize}
                            disabled={loading || !input.trim()}
                            className="w-full mt-8 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-[0.15em] text-xs py-4 rounded-2xl transition-all shadow-xl shadow-indigo-600/20 active:scale-[0.98] flex items-center justify-center gap-3"
                        >
                            {loading ? (
                                <>
                                    <RefreshCw size={18} className="animate-spin" />
                                    Optimizing Sales Psychology...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={18} />
                                    Generate Best Outreach Version
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Output Section */}
                <div className="space-y-6">
                    <AnimatePresence mode="wait">
                        {parsed ? (
                            <motion.div
                                key="result"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                {/* Optimized Message */}
                                <div className="bg-indigo-600/5 backdrop-blur-3xl border border-indigo-500/20 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-indigo-500 rounded-lg text-white">
                                                <CheckCircle2 size={14} />
                                            </div>
                                            <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Optimized Version</span>
                                        </div>
                                        <button 
                                            onClick={handleCopy}
                                            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all flex items-center gap-2 text-xs font-bold uppercase"
                                        >
                                            {copied ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                                            {copied ? 'Copied' : 'Copy Message'}
                                        </button>
                                    </div>

                                    <div className="bg-black/60 rounded-2xl p-6 border border-white/5 shadow-inner">
                                        <p className="text-gray-200 leading-relaxed whitespace-pre-wrap selection:bg-indigo-500/30">
                                            {parsed.message}
                                        </p>
                                    </div>
                                </div>

                                {/* Response Probability */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-gray-900/60 border border-white/5 rounded-3xl p-6 shadow-xl">
                                        <span className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] block mb-3">Predicted Response</span>
                                        <div className="flex items-end gap-3">
                                            <span className="text-5xl font-black text-white leading-none">
                                                {parsed.probability}
                                            </span>
                                            <div className="mb-1">
                                                <div className="w-24 h-2 bg-white/5 rounded-full overflow-hidden">
                                                    <motion.div 
                                                        initial={{ width: 0 }}
                                                        animate={{ width: parsed.probability }}
                                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" 
                                                    />
                                                </div>
                                                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest mt-1 block">Conversion Potential</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gray-900/60 border border-white/5 rounded-3xl p-6 shadow-xl flex items-center justify-center text-center">
                                        <div className="space-y-1">
                                            <div className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Status</div>
                                            <div className="text-lg font-black text-green-500 uppercase tracking-tighter">High Intent</div>
                                            <div className="text-xs text-gray-600 font-bold uppercase">Ready for deployment</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Strategy Analysis */}
                                <div className="bg-gray-900/40 border border-white/5 rounded-3xl p-6 shadow-xl">
                                    <span className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] block mb-4">Strategy Analysis</span>
                                    <div className="text-xs text-gray-400 leading-relaxed space-y-3 whitespace-pre-wrap">
                                        {parsed.analysis}
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-white/5 rounded-[40px] opacity-20">
                                <BarChart3 size={64} className="mb-6 text-gray-600" />
                                <h3 className="text-xl font-black uppercase tracking-widest text-gray-500">Awaiting Intelligence</h3>
                                <p className="text-xs text-gray-600 mt-2 max-w-xs uppercase leading-relaxed font-bold tracking-tighter">
                                    Paste your draft on the left to see the Predicted Response Probability and Sales Psychology analysis.
                                </p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

