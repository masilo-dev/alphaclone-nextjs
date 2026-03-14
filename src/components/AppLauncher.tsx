'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '@/types';
import LoginModal from './auth/LoginModal';
import {
  MessageSquare,
  Video,
  LayoutDashboard,
  BrainCircuit,
  Settings,
  Briefcase,
  Users,
  Calendar,
  Search,
  Battery,
  Wifi,
  Signal,
  Command,
} from 'lucide-react';

interface AppLauncherProps {
  onLogin: () => void;
}

const APPS = [
  { name: 'Messages', icon: MessageSquare, color: 'bg-green-500' },
  { name: 'Meetings', icon: Video, color: 'bg-purple-500' },
  { name: 'AI Assistant', icon: BrainCircuit, color: 'bg-teal-500' },
  { name: 'CRM', icon: Users, color: 'bg-orange-500' },
  { name: 'Projects', icon: Briefcase, color: 'bg-rose-500' },
  { name: 'Calendar', icon: Calendar, color: 'bg-indigo-500' },
  { name: 'Network', icon: LayoutDashboard, color: 'bg-blue-500' },
  { name: 'Settings', icon: Settings, color: 'bg-slate-500' },
];

const DOCK_APPS = [
  { name: 'Home', icon: LayoutDashboard, color: 'bg-blue-600' },
  { name: 'Chat', icon: MessageSquare, color: 'bg-green-600' },
  { name: 'Join', icon: Video, color: 'bg-indigo-600' },
  { name: 'Brain', icon: BrainCircuit, color: 'bg-teal-600' },
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
    <div className="fixed inset-0 bg-[#000814] text-white px-4 py-8 flex flex-col supports-[height:100dvh]:h-[100dvh] overflow-hidden select-none">
      {/* Background Video - System Aesthetic */}
      <div className="absolute inset-0 z-0">
        <video 
          autoPlay 
          loop 
          muted 
          playsInline
          className="w-full h-full object-cover opacity-70"
          src="https://cdn.pixabay.com/video/2021/09/01/87134-596489437_large.mp4" // Sleek abstract network particles
        />
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#000814] via-transparent to-[#000814]/80" />
      </div>

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLogin={onLogin}
      />

      {/* Top Status Bar (Native Feel) */}
      <div className="relative z-20 flex justify-between items-center px-6 pt-2 pb-2 text-[12px] font-bold tracking-tight">
        <div className="flex items-center gap-1.5 backdrop-blur-md bg-white/5 px-3 py-1 rounded-full border border-white/10 uppercase tracking-[0.1em]">
          AlphaClone 1.0.5
        </div>
        <div className="flex items-center gap-3">
          <Signal className="w-3.5 h-3.5" />
          <Wifi className="w-3.5 h-3.5" />
          <div className="flex items-center gap-1">
            <span className="text-[10px]">88%</span>
            <Battery className="w-4 h-4 rotate-90" />
          </div>
        </div>
      </div>

      {/* Main OS Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center pt-10 sm:pt-16">
        {/* Time & Date Display */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center mb-12"
        >
          <h1 className="text-7xl sm:text-8xl font-thin tracking-tighter drop-shadow-2xl">
            {formattedTime}
          </h1>
          <p className="text-lg sm:text-xl font-medium text-teal-400 mt-2 drop-shadow-lg tracking-wide">
            {formattedDate}
          </p>
        </motion.div>

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
            <span className="text-sm font-medium">Search Systems</span>
            <div className="hidden sm:flex items-center gap-1 ml-4 py-0.5 px-2 bg-white/5 rounded border border-white/10">
              <Command className="w-2.5 h-2.5" />
              <span className="text-[10px]">K</span>
            </div>
          </div>
        </motion.div>

        {/* App Grid */}
        <div className="w-full max-w-sm sm:max-w-md px-6 grid grid-cols-4 gap-x-4 gap-y-10 sm:gap-x-8">
          {APPS.map((app, index) => (
            <motion.div
              key={app.name}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.04 + 0.6 }}
              className="flex flex-col items-center gap-1.5 cursor-pointer group"
              onClick={handleAppClick}
            >
              <div 
                className={`w-14 h-14 sm:w-16 sm:h-16 ${app.color} rounded-[1.2rem] flex items-center justify-center shadow-xl transition-all active:scale-90 group-hover:scale-105 group-hover:shadow-2xl relative overflow-hidden`}
              >
                {/* Glass Reflection Fade */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent pointer-events-none" />
                <app.icon className="w-7 h-7 sm:w-8 sm:h-8 text-white drop-shadow-md z-10" />
              </div>
              <span className="text-[10px] sm:text-[12px] font-bold text-white/90 drop-shadow-md text-center">
                {app.name}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Dock Area */}
      <div className="relative z-10 w-fit mx-auto mb-6 px-4 py-3 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl flex items-center gap-4 sm:gap-6 animate-in slide-in-from-bottom-10 fade-in duration-1000">
        {DOCK_APPS.map((app, index) => (
          <motion.div
            key={`dock-${app.name}`}
            whileHover={{ y: -10, scale: 1.1 }}
            className={`w-14 h-14 sm:w-16 sm:h-16 ${app.color} rounded-2xl flex items-center justify-center shadow-lg cursor-pointer ring-1 ring-white/20`}
            onClick={handleAppClick}
          >
             <app.icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
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
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl flex flex-col items-center pt-20 px-6"
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
                <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold mb-1">Quick Actions</p>
                {['Launch Dashboard', 'Start Meeting', 'Open Support', 'View Invoices'].map((action) => (
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

