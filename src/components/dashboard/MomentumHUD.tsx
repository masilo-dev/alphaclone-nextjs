import React from 'react';
import { Zap, Flame, Target, TrendingUp, ArrowUpRight, Activity, Award, Gift, Star, Rocket } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MomentumHUDProps {
    score: number; // 0-100
    streak: number;
    activity24h: number;
    newLeads: number;
    className?: string;
    variant?: 'full' | 'global';
    actionsCompleted?: number;
    rewardsUnlocked?: number;
    nextReward?: string;
}

export const MomentumHUD: React.FC<MomentumHUDProps> = ({
    score = 0,
    streak = 0,
    activity24h = 0,
    newLeads = 0,
    actionsCompleted = 0,
    rewardsUnlocked = 0,
    nextReward = 'Complete 5 more actions',
    className,
    variant = 'full'
}) => {
    // Determine level name based on score
    const getLevel = (s: number) => {
        if (s >= 90) return { name: 'Hyperdrive', color: 'text-indigo-400', bg: 'bg-indigo-500/10' };
        if (s >= 70) return { name: 'Momentum', color: 'text-teal-400', bg: 'bg-teal-500/10' };
        if (s >= 40) return { name: 'Active', color: 'text-amber-400', bg: 'bg-amber-500/10' };
        return { name: 'Stalled', color: 'text-slate-400', bg: 'bg-slate-500/10' };
    };

    const level = getLevel(score);

    if (variant === 'global') {
        return (
            <div className={cn(
                "flex items-center gap-4 bg-slate-950/40 backdrop-blur-md border border-white/5 rounded-full px-4 py-1.5 transition-all hover:border-teal-500/30 group",
                className
            )}>
                {/* Score */}
                <div className="flex items-center gap-2">
                    <div className="relative w-8 h-8">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="16" cy="16" r="14" fill="transparent" stroke="currentColor" strokeWidth="2.5" className="text-slate-800" />
                            <motion.circle cx="16" cy="16" r="14" fill="transparent" stroke="currentColor" strokeWidth="2.5" strokeDasharray={88} initial={{ strokeDashoffset: 88 }} animate={{ strokeDashoffset: 88 - (88 * score) / 100 }} className="text-teal-500" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[9px] font-black text-white">{score}</span>
                        </div>
                    </div>
                </div>

                {/* Streak */}
                <div className="flex items-center gap-1.5 border-l border-white/10 pl-4 h-5">
                    <Flame className={cn("w-3.5 h-3.5", streak > 0 ? "text-orange-500 animate-pulse" : "text-slate-600")} />
                    <span className="text-[11px] font-black text-white tracking-widest">{streak}D</span>
                </div>

                {/* Status indicator */}
                <div className="flex items-center gap-2 border-l border-white/10 pl-4 h-5">
                    <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border border-white/5", level.bg, level.color)}>
                        {level.name}
                    </div>
                </div>
                
                {/* Action Engine Status */}
                <motion.div 
                    animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.8)]"
                />
            </div>
        );
    }

    return (
        <div className={cn(
            "relative overflow-hidden bg-slate-950/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6",
            "before:absolute before:inset-0 before:bg-gradient-to-br before:from-teal-500/5 before:to-transparent before:pointer-events-none",
            className
        )}>
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
                
                {/* 1. Momentum Circular Gauge */}
                <div className="relative flex-shrink-0 w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle
                            cx="64"
                            cy="64"
                            r="58"
                            fill="transparent"
                            stroke="currentColor"
                            strokeWidth="8"
                            className="text-slate-800"
                        />
                        <motion.circle
                            cx="64"
                            cy="64"
                            r="58"
                            fill="transparent"
                            stroke="currentColor"
                            strokeWidth="8"
                            strokeDasharray={364.4}
                            initial={{ strokeDashoffset: 364.4 }}
                            animate={{ strokeDashoffset: 364.4 - (364.4 * score) / 100 }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className="text-teal-500 drop-shadow-[0_0_8px_rgba(20,184,166,0.5)]"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-black text-white tracking-tighter italic">{score}%</span>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Momentum</span>
                    </div>
                </div>

                {/* 2. Action & Rewards Stats */}
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6 w-full">
                    
                    {/* Actions Completed */}
                    <div className="space-y-1.5 px-4 border-l border-white/5">
                        <div className="flex items-center gap-2">
                            <Rocket className="w-4 h-4 text-teal-400" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Actions</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-white italic">{actionsCompleted}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase bg-white/5 px-2 rounded tracking-widest">Done</span>
                        </div>
                        <div className="text-[9px] font-black text-teal-500/80 uppercase tracking-tighter">
                            TODAY
                        </div>
                    </div>

                    {/* Rewards Unlocked */}
                    <div className="space-y-1.5 px-4 border-l border-white/5">
                        <div className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-amber-400" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Rewards</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-white italic">{rewardsUnlocked}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase bg-white/5 px-2 rounded tracking-widest">Won</span>
                        </div>
                        <div className="text-[9px] font-black text-amber-500/80 uppercase tracking-tighter">
                            UNLOCKED
                        </div>
                    </div>

                    {/* Streak */}
                    <div className="space-y-1.5 px-4 border-l border-white/5">
                        <div className="flex items-center gap-2">
                            <Flame className={cn("w-4 h-4", streak > 0 ? "text-orange-500 animate-pulse" : "text-slate-600")} />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Streak</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-white italic">{streak}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase bg-white/5 px-2 rounded tracking-widest">Days</span>
                        </div>
                        <div className="text-[9px] font-black text-teal-500 uppercase tracking-tighter flex items-center gap-1">
                            {streak > 0 ? 'KEEP IT ALIVE' : 'START NOW'}
                        </div>
                    </div>

                    {/* Level & Next Reward */}
                    <div className="col-span-2 flex flex-col justify-center items-end text-right border-l border-white/5 px-4">
                        <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/5 mb-2 shadow-lg", level.bg, level.color)}>
                            <Zap className="w-3 h-3 fill-current" />
                            {level.name} MODE
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] text-slate-400 font-bold max-w-[180px] leading-tight uppercase tracking-tighter">
                                {score >= 70 ? 'CRITICAL MOMENTUM ACHIEVED. DO NOT STOP.' : 'FEED THE SYSTEM. START THE SEQUENCE.'}
                            </p>
                            <p className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                                <Gift className="w-3 h-3" />
                                {nextReward}
                            </p>
                        </div>
                    </div>

                </div>

            </div>
            
            {/* HUD Scanline Effect */}
            <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-teal-500/30 to-transparent shadow-[0_0_20px_rgba(20,184,166,0.3)]" />
        </div>
    );
};
