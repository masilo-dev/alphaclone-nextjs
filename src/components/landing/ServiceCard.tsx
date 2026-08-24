import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

interface ServiceCardProps {
    service: {
        id: string;
        icon: any;
        title: string;
        summary: string;
        details: string[];
        /** @deprecated Use gradient instead — no external CDN needed */
        image?: string;
        gradient?: string;
        accentColor?: string;
        showExtra?: React.ReactNode;
    };
    index: number;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, index }) => {
    const [expanded, setExpanded] = useState(false);

    // Safety check for service object
    if (!service) return null;

    // Default gradient per card if none provided
    const gradient = service.gradient || 'from-teal-900/60 via-slate-900 to-slate-950';
    const accent = service.accentColor || 'text-teal-400';

    return (
        <motion.div
            key={service.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.2, duration: 0.9, ease: 'easeOut' }}
            className="bg-slate-950/40 rounded-[2.5rem] border border-slate-800/50 hover:border-teal-500/30 transition-all backdrop-blur-md relative overflow-hidden group flex flex-col h-full"
        >
            {/* Top Gradient Container — no external image needed */}
            <div className={`relative h-48 w-full overflow-hidden bg-gradient-to-br ${gradient}`}>
                {/* Subtle animated radial glow */}
                <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity duration-700">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-teal-500 blur-3xl" />
                </div>
                {/* Large faded icon as background art */}
                <div className="absolute inset-0 flex items-center justify-center opacity-10 group-hover:opacity-20 transition-opacity duration-700">
                    <service.icon className="w-32 h-32 text-white" />
                </div>
                {/* Bottom fade overlay */}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950 to-transparent z-10" />
                {/* Floating Icon Badge */}
                <div className="absolute bottom-4 left-6 z-20 w-12 h-12 bg-slate-900/80 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10 shadow-2xl group-hover:scale-110 transition-transform">
                    <service.icon className={`w-6 h-6 ${accent}`} />
                </div>
            </div>

            <div className="p-8 pt-6 flex flex-col flex-1">
                <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-2xl font-bold text-white leading-tight">{service.title}</h3>
                        </div>
                    </div>
                </div>

            <p className="text-slate-400 text-sm mb-6 leading-relaxed flex-1">
                {service.summary}
            </p>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="pt-6 border-t border-slate-800/50 mt-2 space-y-4">
                            <div className="text-xs text-slate-500 font-bold uppercase tracking-widest">Specifications</div>
                            <ul className="space-y-3 pb-4">
                                {service.details.map((detail, idx) => (
                                    <li key={idx} className="flex items-start text-sm text-slate-300">
                                        <CheckCircle2 className="w-4 h-4 text-teal-400 mr-2 flex-shrink-0 mt-0.5" />
                                        <span>{detail}</span>
                                    </li>
                                ))}
                            </ul>
                            {service.showExtra && (
                                <div className="mb-4 pt-4">
                                    <React.Suspense fallback={<div className="h-40 bg-slate-900 animate-pulse rounded-xl" />}>
                                        {service.showExtra}
                                    </React.Suspense>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full mt-4 flex items-center justify-center gap-2 py-4 rounded-2xl border border-slate-800 text-sm font-bold text-slate-300 transition-all button-fill-hover group/btn"
            >
                <span className="relative z-10 flex items-center gap-2">
                    {expanded ? 'Collapse Details' : 'View Full Specifications'}
                    <motion.span animate={{ rotate: expanded ? 180 : 0 }} className="text-teal-400 group-hover/btn:scale-125 transition-transform">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </motion.span>
                </span>
            </button>
            </div>
        </motion.div>
    );
};
