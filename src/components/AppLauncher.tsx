'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import LoginModal from './auth/LoginModal';
import { APP_NAME, APP_SHORT_NAME, APP_TAGLINE } from '@/constants';
import {
  MessageSquare,
  Video,
  LayoutDashboard,
  Settings,
  Briefcase,
  Users,
  Calendar,
  Search,
  Battery,
  Wifi,
  Signal,
  Command,
  ChevronRight,
} from 'lucide-react';

interface AppLauncherProps {
  onLogin: () => void;
}

const APPS = [
  { name: 'CRM', icon: Users, color: 'bg-orange-500' },
  { name: 'Mail', icon: MessageSquare, color: 'bg-green-500' },
  { name: 'Calls', icon: Video, color: 'bg-purple-500' },
  { name: 'Clients', icon: Users, color: 'bg-blue-500' },
  { name: 'Tasks', icon: Briefcase, color: 'bg-rose-500' },
  { name: 'Calendar', icon: Calendar, color: 'bg-indigo-500' },
  { name: 'Home', icon: LayoutDashboard, color: 'bg-cyan-500' },
  { name: 'Settings', icon: Settings, color: 'bg-slate-500' },
];

const DOCK_APPS = [
  { name: 'Home', icon: LayoutDashboard, color: 'bg-blue-600' },
  { name: 'Mail', icon: MessageSquare, color: 'bg-green-600' },
  { name: 'Calls', icon: Video, color: 'bg-indigo-600' },
  { name: 'CRM', icon: Users, color: 'bg-orange-600' },
];

export default function AppLauncher({ onLogin }: AppLauncherProps) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [showSpotlight, setShowSpotlight] = useState(false);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAppClick = () => {
    setIsLoginOpen(true);
  };

  const formattedTime = currentTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '';
  const formattedDate = currentTime?.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) || '';

  return (
    <div className="fixed inset-0 bg-[#000814] text-white px-4 py-8 flex flex-col supports-[height:100dvh]:h-[100dvh] overflow-hidden select-none overscroll-behavior-none touch-action-manipulation">
      {/* Background - System Aesthetic */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#000814] via-[#0a1628] to-[#000814]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-500/5 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
      </div>

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLogin={onLogin}
      />

      {/* Top Status Bar (Native Feel) */}
      <div className="relative z-20 flex justify-between items-center px-4 sm:px-6 pt-2 pb-2 text-[11px] sm:text-[12px] font-bold tracking-tight">
        <div className="flex items-center gap-2 backdrop-blur-md bg-white/5 px-2 sm:px-3 py-1 rounded-full border border-white/10 tracking-[0.04em] truncate max-w-[55%]">
          <Image src="/logo.png" alt="" width={18} height={18} className="rounded-md shrink-0" />
          <span className="truncate">{APP_SHORT_NAME}</span>
        </div>
<<<<<<< HEAD
        <div className="flex items-center gap-2 sm:gap-3">
          <Signal className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <Wifi className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <div className="flex items-center gap-0.5 sm:gap-1">
            <span className="text-[10px] sm:text-xs">88%</span>
            <Battery className="w-3 h-3 sm:w-4 sm:h-4 rotate-90" />
=======
        <div className="flex items-center gap-3">
          <Signal className="w-3.5 h-3.5" />
          <Wifi className="w-3.5 h-3.5" />
          <div className="flex items-center gap-1">
            <span className="text-xs">88%</span>
            <Battery className="w-4 h-4 rotate-90" />
>>>>>>> origin/main
          </div>
        </div>
      </div>

      {/* Main OS Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center pt-10 sm:pt-16 will-change-transform overscroll-behavior-none touch-action-manipulation">
        {/* Time & Date Display */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center mb-12 will-change-transform"
          style={{ WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' }}
        >
          <h1 className="text-7xl sm:text-8xl font-thin tracking-tighter drop-shadow-2xl">
            {formattedTime}
          </h1>
          <p className="text-sm sm:text-base font-medium text-teal-400/90 mt-2 drop-shadow-lg tracking-wide text-center px-4">
            {APP_TAGLINE}
          </p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-xs text-slate-500 mb-6"
        >
          {formattedDate}
        </motion.p>

        {/* Spotlight Search Trigger */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-sm px-6 mb-12"
        >
          <div 
            onClick={() => setShowSpotlight(true)}
            className="w-full h-10 bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl flex items-center justify-center gap-2 text-white/50 cursor-pointer hover:bg-white/15 transition-all group"
          >
            <Search className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">Search systems</span>
            <div className="hidden sm:flex items-center gap-1 ml-4 py-0.5 px-2 bg-white/5 rounded border border-white/10">
              <Command className="w-2.5 h-2.5" />
              <span className="text-xs">K</span>
            </div>
          </div>
        </motion.div>

        {/* App Grid */}
        <div className="w-full max-w-xs sm:max-w-sm md:max-w-md px-4 sm:px-6 grid grid-cols-4 gap-x-2 sm:gap-x-4 gap-y-8 sm:gap-y-10 content-visibility-auto">
          {APPS.map((app, index) => (
            <motion.div
              key={app.name}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.04 + 0.6 }}
              className="flex flex-col items-center gap-1.5 cursor-pointer group touch-action-manipulation will-change-transform"
              onClick={handleAppClick}
              style={{ WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' }}
            >
              <div 
                className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 ${app.color} rounded-[1rem] sm:rounded-[1.2rem] flex items-center justify-center shadow-xl transition-all active:scale-90 group-hover:scale-105 group-hover:shadow-2xl relative overflow-hidden will-change-transform`}
                style={{ WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' }}
              >
                {/* Glass Reflection Fade */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none" />
                <app.icon className="w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white drop-shadow-md z-10" />
              </div>
<<<<<<< HEAD
              <span className="text-[10px] sm:text-xs md:text-[12px] font-bold text-white/90 drop-shadow-md text-center truncate max-w-full">
=======
              <span className="text-xs sm:text-[12px] font-bold text-white/90 drop-shadow-md text-center">
>>>>>>> origin/main
                {app.name}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Dock Area */}
      <div className="relative z-10 w-fit mx-auto mb-6 px-3 sm:px-4 py-2 sm:py-3 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl flex items-center gap-3 sm:gap-4 md:gap-6 animate-in slide-in-from-bottom-10 fade-in duration-1000 will-change-transform">
        {DOCK_APPS.map((app, index) => (
          <motion.div
            key={`dock-${app.name}`}
            whileHover={{ y: -10, scale: 1.1 }}
            className={`w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 ${app.color} rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg cursor-pointer ring-1 ring-white/20 will-change-transform`}
            onClick={handleAppClick}
            style={{ WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden' }}
          >
             <app.icon className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" />
          </motion.div>
        ))}
      </div>

      {/* Home Indicator */}
      <div className="relative z-10 flex justify-center pb-2">
        <div className="w-1/3 max-w-[140px] h-1 bg-white/30 rounded-full" />
      </div>

      {/* Spotlight Overlay */}
      <AnimatePresence>
        {showSpotlight && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-xl flex flex-col items-center pt-20 px-6"
            onClick={() => setShowSpotlight(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: -20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-xl bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center p-4 border-b border-white/10">
                <Search className="w-5 h-5 text-white/40 mr-3" />
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Type to launch systems..." 
                  className="bg-transparent border-none outline-none flex-1 text-lg placeholder:text-white/20"
                />
              </div>
              <div className="p-4 flex flex-col gap-2">
                <p className="text-xs uppercase tracking-widest text-white/30 font-bold mb-1">Quick Actions</p>
<<<<<<< HEAD
                {['Open CRM', 'Check mail', 'Start a call', 'View clients'].map((action) => (
=======
                {['Launch Dashboard', 'Start Meeting', 'Open Support', 'View Invoices'].map((action) => (
>>>>>>> origin/main
                   <div key={action} className="p-3 hover:bg-white/5 rounded-xl cursor-pointer flex items-center justify-between group transition-colors">
                     <span className="text-sm font-medium">{action}</span>
                     <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
                   </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


