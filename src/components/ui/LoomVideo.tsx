'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';

interface LoomVideoProps {
  videoId: string;
  title?: string;
  className?: string;
}

/**
 * LoomVideo Component: A high-performance, lazy-loaded Loom embed.
 * Uses a placeholder to prevent initial JS overhead and improve PageSpeed.
 */
const LoomVideo: React.FC<LoomVideoProps> = ({ videoId, title = "AlphaClone Demo", className = "" }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl ${className}`}>
      {!isLoaded ? (
        <div 
          className="group relative h-full w-full cursor-pointer overflow-hidden"
          onClick={() => setIsLoaded(true)}
        >
          {/* Placeholder Background with Cinematic Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.15)_0%,transparent_70%)] opacity-50" />
             <div className="text-center z-10">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-teal-500 shadow-[0_0_30px_rgba(20,184,166,0.4)] border border-teal-400"
                >
                  <Play className="h-8 w-8 text-slate-950 fill-slate-950 ml-1" />
                </motion.div>
                <p className="mt-6 text-xs font-black uppercase tracking-[0.3em] text-teal-400/80 drop-shadow-lg">
                  Watch Platform Briefing
                </p>
             </div>
          </div>
          
          {/* Glassmorphic Overlay on Hover */}
          <div className="absolute inset-0 bg-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          {/* Subtle Film Grain (matching site aesthetic) */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
          />
        </div>
      ) : (
        <iframe
          src={`https://www.loom.com/embed/${videoId}?hide_owner=true&hide_share=true&hide_title=true&hide_embed_top_bar=true&autoplay=1`}
          frameBorder="0"
          className="absolute inset-0 h-full w-full"
          title={title}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      )}
    </div>
  );
};

export default LoomVideo;
