'use client';

import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
<<<<<<< HEAD
import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
=======
import { TrendingUp, TrendingDown, Minus, Info, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
>>>>>>> origin/main
import { useRevenueMomentum } from '@/hooks/useRevenueMomentum';

export default function RevenueMomentumCard() {
  const { score, trend, breakdown, nudge, isLoading } = useRevenueMomentum();
  const [displayScore, setDisplayScore] = useState(0);

  // Animation for the score number
  const springScore = useSpring(0, { stiffness: 40, damping: 20 });
  const roundedScore = useTransform(springScore, (latest) => Math.round(latest));

  useEffect(() => {
    springScore.set(score);
  }, [score, springScore]);

  useEffect(() => {
    return roundedScore.onChange((latest) => setDisplayScore(latest));
  }, [roundedScore]);

  const getStatusColor = (s: number) => {
    if (s >= 70) return 'text-green-400';
    if (s >= 40) return 'text-amber-400';
    return 'text-red-400';
  };

<<<<<<< HEAD
  const getStatusBorder = (s: number) => {
    if (s >= 70) return 'border-emerald-500/20';
    if (s >= 40) return 'border-amber-500/20';
    return 'border-rose-500/20';
=======
  const getStatusBg = (s: number) => {
    if (s >= 70) return 'bg-green-500/10 border-green-500/20';
    if (s >= 40) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-red-500/10 border-red-500/20';
>>>>>>> origin/main
  };

  if (isLoading) {
    return (
<<<<<<< HEAD
      <div className="ac-workspace-panel h-[180px] w-full rounded-lg animate-pulse" />
=======
      <div className="h-[180px] w-full rounded-2xl bg-slate-800/50 animate-pulse border border-slate-700" />
>>>>>>> origin/main
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
<<<<<<< HEAD
      className={`ac-workspace-panel relative overflow-hidden rounded-lg p-5 transition-all ${getStatusBorder(score)}`}
    >
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg bg-slate-950/50 border border-white/5 ${getStatusColor(score)}`}>
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Revenue Momentum</h3>
              <p className="text-xs text-slate-500 mt-0.5">Current sales pace and collection pressure</p>
            </div>
=======
      className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${getStatusBg(score)}`}
    >
      <div className="absolute top-0 right-0 p-4 opacity-5">
        <Zap className={`w-24 h-24 ${getStatusColor(score)}`} />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg bg-slate-900/50 ${getStatusColor(score)}`}>
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Revenue Momentum</h3>
>>>>>>> origin/main
          </div>
          <div className="flex items-center gap-1.5">
            {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-400" />}
            {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-400" />}
            {trend === 'flat' && <Minus className="w-4 h-4 text-slate-500" />}
            <span className={`text-xs font-bold uppercase ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-slate-500'}`}>
              {trend}
            </span>
          </div>
        </div>

        <div className="flex items-end gap-3 mb-4">
          <motion.span 
<<<<<<< HEAD
            className={`text-4xl md:text-5xl font-black tracking-tighter ${getStatusColor(score)}`}
=======
            className={`text-5xl font-black tracking-tighter ${getStatusColor(score)}`}
>>>>>>> origin/main
          >
            {displayScore}
          </motion.span>
          <div className="mb-2">
            <p className="text-[10px] text-slate-500 font-bold uppercase leading-none">Momentum</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase leading-none">Score</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Nudge Box */}
<<<<<<< HEAD
          <div className="rounded-lg bg-slate-950/45 p-3 border border-white/5">
            <p className="text-xs text-slate-300 leading-relaxed">
              {nudge}
=======
          <div className="bg-slate-900/40 rounded-xl p-3 border border-white/5">
            <p className="text-xs text-slate-300 leading-relaxed italic">
              "{nudge}"
>>>>>>> origin/main
            </p>
          </div>

          {/* Mini Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 font-medium mb-0.5">Leads</p>
              <p className="text-xs font-bold text-white">+{breakdown.leadsContacted}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 font-medium mb-0.5">Deals</p>
              <p className="text-xs font-bold text-white">+{breakdown.dealsAdvanced}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 font-medium mb-0.5">Invoices</p>
              <p className="text-xs font-bold text-white">+{breakdown.invoicesSent}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar Background */}
<<<<<<< HEAD
      <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-950/40">
=======
      <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-900/50">
>>>>>>> origin/main
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${
            score >= 70 ? 'bg-green-500' :
            score >= 40 ? 'bg-amber-500' :
            'bg-red-500'
          }`}
        />
      </div>
    </motion.div>
  );
}
