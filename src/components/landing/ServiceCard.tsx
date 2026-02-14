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
        showExtra?: React.ReactNode;
    };
    index: number;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, index }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <motion.div
            key={service.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="bg-slate-950/60 rounded-[2.5rem] p-8 border border-slate-800/50 hover:border-teal-500/30 transition-all backdrop-blur-md relative overflow-hidden group flex flex-col h-fit"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="flex items-center gap-4 mb-8">
                <div className={`w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg border border-slate-800 group-hover:scale-110 transition-transform`}>
                    <service.icon className="w-7 h-7 text-teal-400" />
                </div>
                <h3 className="text-2xl font-bold text-white leading-tight">{service.title}</h3>
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
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Specifications</div>
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
                className="w-full mt-4 flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-teal-500/50 text-sm font-bold text-slate-300 hover:text-white transition-all group/btn"
            >
                {expanded ? 'Collapse Details' : 'View Full Specifications'}
                <motion.span animate={{ rotate: expanded ? 180 : 0 }} className="text-teal-400 group-hover/btn:scale-125 transition-transform">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </motion.span>
            </button>
        </motion.div>
    );
};
