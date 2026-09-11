'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, XCircle, BarChart, ExternalLink } from 'lucide-react';
import { AuditResult } from '@/services/auditService';

interface LeadAuditReportProps {
    audit: AuditResult;
    onClose: () => void;
}

export const LeadAuditReport: React.FC<LeadAuditReportProps> = ({ audit, onClose }) => {
    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-emerald-400';
        if (score >= 70) return 'text-amber-400';
        return 'text-rose-400';
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                    <div className="flex items-center gap-3">
                        <BarChart className="w-6 h-6 text-blue-400" />
                        <div>
                            <h2 className="text-xl font-bold text-white">Lead Generation Audit</h2>
                            <p className="text-sm text-gray-400">Comparing Sales Agent output vs. Raw Maps API JSON</p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className={`text-3xl font-black ${getScoreColor(audit.accuracyScore)}`}>
                            {audit.accuracyScore}%
                        </span>
                        <span className="text-xs uppercase tracking-wider text-gray-500 font-bold">Accuracy Score</span>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {audit.flags.length === 0 ? (
                        <div className="text-center py-12">
                            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-medium text-white mb-2">Perfect Accuracy!</h3>
                            <p className="text-gray-400">No discrepancies found between the Sales Agent and the Maps API.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-4">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                <span className="text-sm font-medium text-gray-300">
                                    Found {audit.flags.length} discrepancies in {audit.totalLeads} leads
                                </span>
                            </div>

                            {audit.flags.map((flag, idx) => (
                                <div
                                    key={idx}
                                    className={`p-4 rounded-xl border ${flag.type === 'CRITICAL HALLUCINATION'
                                            ? 'bg-rose-500/5 border-rose-500/20'
                                            : 'bg-amber-500/5 border-amber-500/20'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        {flag.type === 'CRITICAL HALLUCINATION' ? (
                                            <XCircle className="w-5 h-5 text-rose-500 mt-0.5" />
                                        ) : (
                                            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                                        )}
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-white tracking-tight">{flag.businessName}</h4>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${flag.type === 'CRITICAL HALLUCINATION' ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'
                                                    }`}>
                                                    {flag.type}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-400 leading-relaxed font-medium">
                                                {flag.reason}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 bg-white/5 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-6 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition-all active:scale-95"
                    >
                        Close Audit
                    </button>
                    <button
                        className="flex-1 py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        Export PDF Report
                        <ExternalLink className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

