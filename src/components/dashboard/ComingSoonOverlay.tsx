import React from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';

interface ComingSoonOverlayProps {
    title?: string;
    description?: string;
    children: React.ReactNode;
}

const ComingSoonOverlay: React.FC<ComingSoonOverlayProps> = ({ 
    title = "Feature Coming Soon", 
    description = "We're currently perfecting this experience for the AlphaClone platform. Check back soon for the full release.",
    children 
}) => {
    return (
        <div className="relative w-full h-full min-h-[400px]">
            {/* Blurry Content Container */}
            <div className="filter blur-[8px] pointer-events-none select-none opacity-40">
                {children}
            </div>

            {/* Overlay */}
            <div className="absolute inset-0 z-10 flex items-center justify-center p-6 text-center">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="max-w-md p-8 rounded-3xl bg-slate-900/40 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50"
                >
                    <div className="w-16 h-16 bg-teal-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-teal-500/20">
                        <Lock className="w-8 h-8 text-teal-400" />
                    </div>
                    
                    <h3 className="text-2xl font-black text-white mb-3 tracking-tight uppercase">
                        {title}
                    </h3>
                    
                    <p className="text-slate-400 text-sm leading-relaxed mb-8">
                        {description}
                    </p>
                    
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-black uppercase tracking-widest">
                        <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                        Alpha Development Phase
                    </div>
                </motion.div>
            </div>
            
            {/* Disable Clicks Overlay */}
            <div className="absolute inset-0 z-20" />
        </div>
    );
};

export default ComingSoonOverlay;

export default ComingSoonOverlay;
