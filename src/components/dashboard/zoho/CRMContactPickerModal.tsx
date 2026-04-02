'use client';

import React, { useState, useEffect } from 'react';
import { Search, X, Loader2, Mail, Briefcase, MapPin, Building2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { leadService, Lead } from '@/services/leadService';

interface CRMContactPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectContact: (email: string, name: string) => void;
}

export default function CRMContactPickerModal({ isOpen, onClose, onSelectContact }: CRMContactPickerModalProps) {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchLeads();
        }
    }, [isOpen]);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const { leads, error } = await leadService.getLeads();
            if (error) throw new Error(error);
            setLeads(leads || []);
        } catch (err) {
            console.error('Failed to fetch CRM contacts:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredLeads = leads.filter(l => 
        l.email && (
            (l.businessName?.toLowerCase().includes(query.toLowerCase())) ||
            (l.email?.toLowerCase().includes(query.toLowerCase())) ||
            (l.industry?.toLowerCase().includes(query.toLowerCase()))
        )
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm"
            />
            
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-2xl bg-gray-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600/20 rounded-xl text-blue-400">
                            <Mail size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight">Select CRM Contact</h2>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Pick a recipient from your leads directory</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-white/5">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center text-gray-500 group-focus-within:text-blue-400 transition-colors pointer-events-none">
                            <Search size={18} />
                        </div>
                        <input 
                            type="text"
                            placeholder="Search by name, email, or industry..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="w-full bg-gray-950/50 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 focus:outline-none transition-all placeholder:text-gray-700 font-medium"
                        />
                    </div>
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                            <Loader2 size={32} className="animate-spin text-blue-500" />
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-400">Loading Directory...</p>
                        </div>
                    ) : filteredLeads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center opacity-40 italic">
                            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mb-3 text-gray-500">
                                <Search size={24} />
                            </div>
                            <p className="text-sm text-gray-400">No contacts found with an email address.</p>
                        </div>
                    ) : (
                        filteredLeads.map(lead => (
                            <button 
                                key={lead.id}
                                onClick={() => {
                                    onSelectContact(lead.email as string, lead.businessName);
                                    onClose();
                                }}
                                className="w-full text-left bg-gray-950/40 border border-white/5 rounded-2xl p-4 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group relative overflow-hidden flex items-center justify-between"
                            >
                                <div className="space-y-1">
                                    <h3 className="font-bold text-white text-base group-hover:text-blue-200 transition-colors">{lead.businessName}</h3>
                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                        <div className="flex items-center gap-1.5 font-medium">
                                            <Mail size={12} className="text-blue-400/50" />
                                            {lead.email}
                                        </div>
                                        {lead.industry && (
                                            <div className="flex items-center gap-1 font-medium">
                                                <Briefcase size={12} className="text-gray-600" />
                                                {lead.industry}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="p-2 rounded-xl bg-gray-800/50 text-gray-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                    <CheckCircle2 size={18} />
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </motion.div>
        </div>
    );
}
