'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, AlertCircle, Trophy, Target, Coffee, ChevronRight } from 'lucide-react';
import unifiedAIService from '@/services/unifiedAIService';
import { supabase } from '@/lib/supabase';
import { tenantService } from '@/services/tenancy/TenantService';

interface BriefContent {
  greeting: string;
  alerts: string[];
  wins: string[];
  focus: string;
  closing: string;
}

const CACHE_KEY = 'daily_brief_last_shown';

export default function DailyBrief() {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<BriefContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkEligibility();
  }, []);

  const checkEligibility = () => {
    const lastShown = localStorage.getItem(CACHE_KEY);
    const today = new Date().toDateString();
    
    if (lastShown !== today) {
      fetchBrief();
    }
  };

  const fetchBrief = async () => {
    setIsLoading(true);
    const tenantId = tenantService.getCurrentTenantId();
    
    try {
      // Gather some context for the AI
      const { data: leads } = await supabase.from('leads').select('business_name').limit(3);
      const { data: invoices } = await supabase.from('business_invoices').select('total, status').eq('status', 'overdue');
      
      const context = {
        overdueCount: invoices?.length || 0,
        recentLeads: leads?.map((l: any) => l.business_name) || [],
      };

      const prompt = `You are a world-class Chief of Staff. Based on this business data: ${JSON.stringify(context)}, generate a punchy 5-minute daily brief. 
      Respond ONLY with a JSON object: 
      {
        "greeting": "A high-energy morning greeting",
        "alerts": ["List of 1-2 critical things to fix or watch"],
        "wins": ["List of 1-2 small recent wins or positive signals"],
        "focus": "The single most important objective for today",
        "closing": "A motivating one-liner"
      }`;

      const aiResponse = await unifiedAIService.generateText(prompt);
      const response = aiResponse.text || '';
      const jsonStr = response.match(/\{[\s\S]*\}/)?.[0] || response;
      const data = JSON.parse(jsonStr);
      
      setContent(data);
      setIsOpen(true);
      localStorage.setItem(CACHE_KEY, new Date().toDateString());
    } catch (err) {
      console.error('Failed to generate daily brief:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !content) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="mb-8 relative z-40"
      >
        <div className="bg-slate-900 border border-blue-500/30 rounded-2xl overflow-hidden shadow-2xl shadow-blue-500/10">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 px-6 py-4 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Coffee className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">Your 5-Minute Brief</h2>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <p className="text-xl font-medium text-slate-200 mb-2 leading-tight">
                  {content.greeting}
                </p>
                <div className="h-1 w-12 bg-blue-500 rounded-full" />
              </div>

              {/* Today's Focus Card */}
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 text-blue-400 uppercase text-[10px] font-black tracking-widest">
                  <Target className="w-3 h-3" />
                  Today's Main Objective
                </div>
                <p className="text-lg font-bold text-white leading-snug">
                  {content.focus}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Alerts & Wins */}
              <div className="space-y-4">
                {content.alerts.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Immediate Attention</p>
                    {content.alerts.map((alert, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm text-red-400 bg-red-500/5 p-2 rounded-lg border border-red-500/10">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>{alert}</p>
                      </div>
                    ))}
                  </div>
                )}

                {content.wins.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Positive Momentum</p>
                    {content.wins.map((win, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm text-green-400 bg-green-500/5 p-2 rounded-lg border border-green-500/10">
                        <Trophy className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>{win}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-white/5">
                <p className="text-sm italic text-slate-400 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  {content.closing}
                </p>
              </div>
            </div>
          </div>
          
          {/* Footer Action */}
          <div className="bg-slate-900/50 px-6 py-3 border-t border-white/5 flex justify-end">
            <button 
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 group"
            >
              Let's go to work
              <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
