'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, RefreshCw, Send, Loader2, Sparkles } from 'lucide-react';
import { Lead } from '@/services/leadService';
import unifiedAIService from '@/services/unifiedAIService';
import { useToast } from '@/components/Toast';

interface GhostIntelligenceProps {
  lead: Lead;
  onAction?: () => void;
}

interface CachedInsight {
  text: string;
  timestamp: number;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export default function GhostIntelligence({ lead, onAction }: GhostIntelligenceProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const cacheKey = `ghost_intel_${lead.id}`;

  useEffect(() => {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { text, timestamp }: CachedInsight = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          setInsight(text);
          return;
        }
      } catch (e) {
        console.error('Failed to parse cached insight');
      }
    }
    generateInsight();
  }, [lead.id]);

  const generateInsight = async () => {
    setIsLoading(true);
    try {
      const prompt = `You are a sharp sales intelligence analyst. Based on this lead's data, generate one specific, punchy reason why the user should reach out to this lead THIS WEEK. Maximum 2 sentences. Be specific to their industry and situation. Sound like a smart colleague tipping them off, not a robot. Data: ${JSON.stringify(lead)}`;
      
      const response = await unifiedAIService.generateText(prompt);
      const text = (response.text || '').trim();
      
      setInsight(text);
      localStorage.setItem(cacheKey, JSON.stringify({
        text,
        timestamp: Date.now()
      }));
    } catch (err) {
      console.error('Ghost Intelligence failed:', err);
      // Fallback or silent fail
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    generateInsight();
  };

  if (!insight && !isLoading) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Ghost Intelligence</span>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={isLoading}
          className="p-1 text-slate-500 hover:text-blue-400 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-slate-900 to-purple-500/10 p-4 shadow-lg shadow-blue-500/5"
      >
        <div className="absolute top-0 right-0 p-2 opacity-10">
          <Zap className="w-12 h-12 text-blue-400" />
        </div>

        <div className="relative z-10">
          <p className="text-[11px] text-blue-400/70 font-medium mb-1">Why now:</p>
          
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div 
                key="loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2 py-1"
              >
                <div className="h-3 w-full bg-slate-800 animate-pulse rounded" />
                <div className="h-3 w-2/3 bg-slate-800 animate-pulse rounded" />
              </motion.div>
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                <p className="text-sm text-slate-200 leading-relaxed font-medium">
                  {insight}
                </p>
                
                <button 
                  onClick={onAction}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                  <Send className="w-3 h-3" />
                  Strike now
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
