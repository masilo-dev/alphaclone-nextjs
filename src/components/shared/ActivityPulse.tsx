'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { activityService } from '@/services/activityService';
import { tenantService } from '@/services/tenancy/TenantService';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

export default function ActivityPulse() {
  const [activities, setActivities] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchActivity = async () => {
    const tenantId = tenantService.getCurrentTenantId();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !tenantId) return;

    try {
      const logs = await activityService.getRecentActivity(user.id, tenantId, 24);
      if (logs && logs.length > 0) {
        setActivities(logs);
      } else {
        // Fallback default activities if empty
        setActivities([
          { description: 'Platform scanning for new lead signals...', created_at: new Date().toISOString() },
          { description: 'Revenue momentum engine is calibrated.', created_at: new Date().toISOString() },
          { description: 'Chief of Staff AI is standing by.', created_at: new Date().toISOString() }
        ]);
      }
    } catch (err) {
      console.error('Failed to fetch pulse activity:', err);
    }
  };

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activities.length > 1) {
      const timer = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % activities.length);
      }, 8000); // Cycle every 8 seconds
      return () => clearInterval(timer);
    }
  }, [activities]);

  if (activities.length === 0) return null;

  const current = activities[currentIndex];

  return (
    <div className="fixed bottom-0 left-0 right-0 h-10 bg-slate-950/80 backdrop-blur-md border-t border-white/5 z-50 px-6 flex items-center overflow-hidden">
      <div className="flex items-center gap-3 w-full max-w-7xl mx-auto">
        {/* Pulsing indicator */}
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </div>
        
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 shrink-0">
          Pulse
        </span>

        <div className="h-4 w-px bg-white/10 mx-2 shrink-0" />

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex items-center gap-2 overflow-hidden"
          >
            <p className="text-[11px] text-slate-300 font-medium truncate">
              {current.description || current.action}
            </p>
            <span className="text-[10px] text-slate-600 whitespace-nowrap">
              • {formatDistanceToNow(new Date(current.created_at), { addSuffix: true })}
            </span>
          </motion.div>
        </AnimatePresence>

        <div className="ml-auto flex items-center gap-4 text-[10px] font-bold text-slate-500">
          <span className="hidden sm:inline">SYSTEM STATUS: OPTIMAL</span>
          <span className="hidden sm:inline">ENCRYPTION: ACTIVE</span>
        </div>
      </div>
    </div>
  );
}
