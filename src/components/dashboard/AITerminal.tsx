'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Cpu, Search, Mail, LineChart } from 'lucide-react';

const TASKS = [
    { icon: Search, text: "Scanning target market for Polish SaaS founders...", color: "teal" },
    { icon: Cpu, text: "AI Brain enqueued: Identifying pain points from public filings...", color: "blue" },
    { icon: Mail, text: "Drafting 50 personalized hyper-outreach sequences...", color: "purple" },
    { icon: LineChart, text: "Analyzing performance: 22% expected conversion lift.", color: "teal" }
];

const AITerminal = () => {
    const [currentTask, setCurrentTask] = useState(0);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    setCurrentTask(curr => (curr + 1) % TASKS.length);
                    return 0;
                }
                return prev + 2;
            });
        }, 50);
        return () => clearInterval(interval);
    }, []);

    const activeTask = TASKS[currentTask];

    return (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl font-mono text-sm max-w-xl w-full mx-auto">
            {/* Header */}
            <div className="bg-slate-900/80 px-4 py-2 flex items-center justify-between border-b border-slate-800">
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                </div>
                <div className="flex items-center gap-2 text-slate-500 text-[10px] uppercase tracking-widest font-bold">
                    <Terminal className="w-3 h-3" />
                    Growth OS v2.0
                </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentTask}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="space-y-4"
                    >
                        <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-lg bg-${activeTask.color}-500/10 border border-${activeTask.color}-500/20`}>
                                <activeTask.icon className={`w-5 h-5 text-${activeTask.color}-400`} />
                            </div>
                            <div className="space-y-1">
                                <div className="text-slate-400 text-xs uppercase tracking-tighter">Current Operation</div>
                                <div className="text-white text-base leading-tight">{activeTask.text}</div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                                <span>Processing...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                                <motion.div
                                    className={`h-full bg-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.5)]`}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ ease: "linear" }}
                                />
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Log Lines */}
                <div className="space-y-2 pt-4 border-t border-slate-900">
                    <div className="flex gap-2 text-[11px]">
                        <span className="text-teal-500">[AUTH]</span>
                        <span className="text-slate-500">Secure tunnel established to alpha_cluster_01</span>
                    </div>
                    <div className="flex gap-2 text-[11px]">
                        <span className="text-blue-500">[DATA]</span>
                        <span className="text-slate-400">Memory usage: 14.2GB / 64GB optimized</span>
                    </div>
                    <div className="flex gap-2 text-[11px]">
                        <span className="text-purple-500">[AI]</span>
                        <span className="text-slate-200 animate-pulse">Waiting for next command...</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AITerminal;
