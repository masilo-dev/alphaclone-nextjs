'use client';

import React, { useState } from 'react';
import { Shield, Flame, Trophy, Star, ChevronDown, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Badge { id: string; name: string; icon: string; earned: boolean; earnedAt?: string; description: string; }
interface LeaderboardEntry { rank: number; name: string; xp: number; isMe?: boolean; }

const BADGES: Badge[] = [
  { id: '1', name: 'First Deal', icon: '🤝', earned: true, earnedAt: '2024-12-01', description: 'Closed your first deal' },
  { id: '2', name: 'Speed Demon', icon: '⚡', earned: true, earnedAt: '2025-01-10', description: 'Completed 10 tasks in one day' },
  { id: '3', name: 'Streak Master', icon: '🔥', earned: true, earnedAt: '2025-02-05', description: '30-day login streak' },
  { id: '4', name: 'Pipeline Pro', icon: '🏆', earned: false, description: 'Close 50 deals' },
  { id: '5', name: 'AI Whisperer', icon: '🤖', earned: false, description: 'Run 100 AI playbooks' },
  { id: '6', name: 'Social King', icon: '👑', earned: false, description: 'Reach 10k followers via Social module' },
  { id: '7', name: 'Invoice Hero', icon: '💰', earned: true, earnedAt: '2025-03-20', description: 'Sent 25 invoices' },
  { id: '8', name: 'Connector', icon: '🌐', earned: false, description: 'Add 500 contacts' },
];

const XP_HISTORY = [
  { action: 'Closed deal with Acme Corp', xp: 150, time: '2h ago' },
  { action: 'Completed 5 tasks', xp: 50, time: '5h ago' },
  { action: 'Sent invoice to TechCo', xp: 25, time: 'Yesterday' },
  { action: 'Daily login streak bonus', xp: 10, time: 'Yesterday' },
  { action: 'Added 10 new leads', xp: 40, time: '2 days ago' },
];

const GLOBAL_LB: LeaderboardEntry[] = [
  { rank: 1, name: 'Jordan Kim', xp: 12400 },
  { rank: 2, name: 'Alex Rivera', xp: 11200 },
  { rank: 3, name: 'Sam Chen', xp: 9800 },
  { rank: 4, name: 'Taylor Brooks', xp: 8500 },
  { rank: 5, name: 'You', xp: 7200, isMe: true },
];

const rankStyle = (rank: number) =>
  rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-amber-600' : 'text-slate-500';

const GamificationTab: React.FC = () => {
  const [lbTab, setLbTab] = useState<'global' | 'workspace'>('global');
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  const totalXP = 7200;
  const level = Math.floor(totalXP / 1000) + 1;
  const xpInLevel = totalXP % 1000;
  const xpToNext = 1000 - xpInLevel;
  const streak = 14;
  const rank = 5;

  return (
    <div className="overflow-y-auto pb-24 space-y-5 px-4 pt-4">

      {/* Profile Header */}
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="relative">
          <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-2xl font-black text-white">A</div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center justify-center">
            <div className="w-12 h-12 relative">
              <Shield className="w-full h-full text-purple-500" />
              <span className="absolute inset-0 flex items-center justify-center text-[14px] font-black text-white">{level}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 text-center">
          <div className="text-[20px] font-bold text-white">Alpha User</div>
          <div className="text-[13px] text-slate-500 mt-0.5">Level {level} · {totalXP.toLocaleString()} XP total</div>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-2">
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }} animate={{ width: `${(xpInLevel / 1000) * 100}%` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
          />
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="text-slate-400">{xpInLevel} XP</span>
          <span className="text-slate-500 opacity-55">{xpToNext} XP to Level {level + 1}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total XP', value: totalXP.toLocaleString(), color: 'text-purple-400' },
          { label: 'Streak', value: `${streak} 🔥`, color: 'text-orange-400' },
          { label: 'Global Rank', value: `#${rank}`, color: 'text-teal-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-white/5 rounded-2xl p-3 text-center">
            <div className={`text-[22px] font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 opacity-55">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Badges */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-black uppercase tracking-wider text-slate-400">Badges Earned</span>
          <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full">{BADGES.filter(b => b.earned).length}/{BADGES.length}</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {BADGES.map(badge => (
            <button key={badge.id} onClick={() => badge.earned && setSelectedBadge(badge)} className="flex flex-col items-center gap-1.5">
              <div className={`w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xl border-2 ${badge.earned ? 'border-purple-500/30' : 'border-transparent'} ${!badge.earned ? 'grayscale opacity-30' : ''}`}>
                {badge.icon}
              </div>
              <span className="text-[10px] text-slate-400 text-center leading-tight">{badge.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* XP History */}
      <div>
        <span className="text-[13px] font-black uppercase tracking-wider text-slate-400 block mb-3">XP History</span>
        <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
          {XP_HISTORY.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-3">
                <Clock className="w-6 h-6 text-slate-500" />
              </div>
              <p className="text-slate-400 text-sm">No XP history yet. Complete tasks to earn XP!</p>
            </div>
          ) : (
            XP_HISTORY.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 text-[15px] text-slate-300">{item.action}</span>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <span className="text-[13px] font-bold text-emerald-400">+{item.xp} XP</span>
                  <span className="text-[11px] text-slate-500 opacity-55">{item.time}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-black uppercase tracking-wider text-slate-400">Leaderboard</span>
          <div className="flex bg-slate-800 rounded-xl p-0.5">
            {(['global', 'workspace'] as const).map(t => (
              <button key={t} onClick={() => setLbTab(t)} className={`px-3 py-1 rounded-lg text-[12px] font-bold capitalize transition-all ${lbTab === t ? 'bg-purple-600 text-white' : 'text-slate-400'}`}>{t}</button>
            ))}
          </div>
        </div>
        <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
          {GLOBAL_LB.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-3">
                <Trophy className="w-6 h-6 text-slate-500" />
              </div>
              <p className="text-slate-400 text-sm">No leaderboard data yet. Start earning XP to appear here!</p>
            </div>
          ) : (
            GLOBAL_LB.map(entry => (
              <div key={entry.rank} className={`flex items-center gap-3 px-4 py-3 ${entry.isMe ? 'bg-purple-500/10' : ''}`}>
                <span className={`text-[20px] font-black w-8 flex-shrink-0 ${rankStyle(entry.rank)}`}>{entry.rank}</span>
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0">
                  {entry.name[0]}
                </div>
                <span className={`flex-1 text-[15px] font-bold ${entry.isMe ? 'text-purple-300' : 'text-white'}`}>{entry.name}</span>
                <span className="text-[13px] text-slate-400 font-mono">{entry.xp.toLocaleString()} XP</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Badge Detail Sheet */}
      <AnimatePresence>
        {selectedBadge && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex flex-col">
            <div className="flex-1 bg-black/60" onClick={() => setSelectedBadge(null)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="bg-slate-900 border-t border-white/10 rounded-t-3xl p-6 text-center space-y-3">
              <div className="flex justify-center pt-1 pb-3"><div className="w-10 h-1 bg-slate-700 rounded-full" /></div>
              <div className="text-5xl">{selectedBadge.icon}</div>
              <h3 className="text-[20px] font-bold text-white">{selectedBadge.name}</h3>
              <p className="text-[15px] text-slate-400">{selectedBadge.description}</p>
              {selectedBadge.earnedAt && <p className="text-[13px] text-slate-500 opacity-55">Earned {new Date(selectedBadge.earnedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GamificationTab;
