'use client';

import React, { useState } from 'react';
import { 
    Search, Sparkles, UserPlus, Send, X, Loader2, 
    CheckCircle2, Globe, Building2, MapPin, Briefcase, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { leadService, Lead } from '@/services/leadService';
import { generateEmailReply, generateText } from '@/services/unifiedAIService';
import { integrationsService, IntegrationConfig } from '@/services/integrationsService';
import { useAuth } from '@/contexts/AuthContext';

interface LeadOutreachModalProps {
    isOpen: boolean;
    onClose: () => void;
    onEmailDrafted: (data: { to: string; subject: string; body: string; provider?: string }) => void;
}

export default function LeadOutreachModal({ isOpen, onClose, onEmailDrafted }: LeadOutreachModalProps) {
    const { user } = useAuth();
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<Partial<Lead>[]>([]);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [syncedIds, setSyncedIds] = useState<Set<string>>(new Set());
    const [availableProviders, setAvailableProviders] = useState<IntegrationConfig[]>([]);
    const [selectedProvider, setSelectedProvider] = useState<IntegrationConfig | null>(null);

    React.useEffect(() => {
        if (isOpen && user?.id) {
            integrationsService.getUserIntegrations(user.id).then(({ integrations }) => {
                const emailTypes = ['zoho', 'brevo', 'resend', 'sendgrid', 'gmail'];
                const filtered = integrations.filter(i => i.enabled && emailTypes.includes(i.type));
                setAvailableProviders(filtered);
                
                // Default to Zoho if available, else first one
                const zoho = filtered.find(p => p.type === 'zoho');
                setSelectedProvider(zoho || filtered[0] || null);
            });
        }
    }, [isOpen, user?.id]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query) return;
        setSearching(true);
        try {
            const prompt = `You are a B2B lead generation assistant. Generate 4 realistic potential business leads matching this search criteria: "${query}".

Return ONLY a valid JSON array with no markdown, no explanation, no code blocks. Each object must have:
- id: unique string like "ai_1", "ai_2", etc.
- businessName: company name
- industry: industry/sector
- location: city, state/country
- email: realistic contact email
- website: domain only (no https://)
- notes: 1-2 sentences about why they're a good fit

Example: [{"id":"ai_1","businessName":"Acme Corp","industry":"SaaS","location":"Austin, TX","email":"hello@acme.com","website":"acme.com","notes":"Rapidly growing SaaS startup."}]`;

            const { text } = await generateText(prompt, 800);
            if (text) {
                // Robust parsing: extract JSON from markdown code blocks if present
                let jsonStr = text.trim();
                const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (match) {
                    jsonStr = match[1];
                }
                
                try {
                    const parsed: Partial<Lead>[] = JSON.parse(jsonStr);
                    setResults(parsed);
                } catch (parseErr) {
                    console.error('Failed to parse AI leads JSON:', parseErr, 'Raw text:', text);
                    // Fallback: try to find anything that looks like an array
                    const arrayMatch = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
                    if (arrayMatch) {
                        setResults(JSON.parse(arrayMatch[0]));
                    } else {
                        throw parseErr;
                    }
                }
            }
        } catch (err) {
            console.error('AI lead search failed:', err);
            setResults([]);
        } finally {
            setSearching(false);
        }
    };

    const handleSyncAndEngage = async (lead: Partial<Lead>) => {
        setSyncing(lead.id || null);
        try {
            // 1. Sync to NativeDB & Zoho CRM (handled by leadService.addLead internally)
            const { lead: newLead, error } = await leadService.addLead({
                ...lead,
                source: 'AI Growth Agent',
                stage: 'lead'
            });

            if (error) throw new Error(error);

            // 2. Generate AI Outreach Draft
            const prompt = `Draft a compelling cold outreach email to ${lead.businessName}. They are in the ${lead.industry} industry and are ${lead.notes}. Focus on how AlphaClone can solve their specific pain points.`;
            const draft = await generateEmailReply("", prompt);

            setSyncedIds(prev => new Set(prev).add(lead.id!));
            
            // 3. Pass draft back to ZohoMailView to open in ComposeView
            onEmailDrafted({
                to: lead.email || '',
                subject: `Strategic Partnership Opportunity for ${lead.businessName}`,
                body: draft || '',
                provider: selectedProvider?.type
            });
            onClose();
        } catch (err) {
            console.error('Lead sync/outreach failed', err);
        } finally {
            setSyncing(null);
        }
    };

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
                className="relative w-full max-w-4xl bg-gray-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-gradient-to-r from-teal-600/10 to-teal-900/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-600/20 rounded-xl text-teal-400">
                            <Sparkles size={24} className="animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight">AI Growth Agent: Lead Discovery</h2>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-0.5">Identify and engage high-intent prospects instantly</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Provider Selection & Search Bar */}
                <div className="p-6 space-y-4">
                    {availableProviders.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {availableProviders.map(provider => (
                                <button
                                    key={provider.id}
                                    onClick={() => setSelectedProvider(provider)}
                                    className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border ${selectedProvider?.id === provider.id
                                        ? 'bg-teal-600 text-white border-teal-500 shadow-lg shadow-teal-500/20'
                                        : 'bg-gray-950/50 text-gray-500 border-white/5 hover:border-white/10'
                                        }`}
                                >
                                    {provider.name}
                                </button>
                            ))}
                        </div>
                    )}
                    
                    <form onSubmit={handleSearch} className="relative group">
                        <div className="absolute inset-y-0 left-5 flex items-center text-gray-500 group-focus-within:text-teal-400 transition-colors pointer-events-none">
                            <Search size={20} />
                        </div>
                        <input 
                            type="text"
                            placeholder="Identify companies in [Industry] located in [Location]..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="w-full bg-gray-950/50 border border-white/5 rounded-2xl pl-14 pr-32 py-5 text-lg focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 focus:outline-none transition-all placeholder:text-gray-700 font-medium"
                        />
                        <button 
                            type="submit"
                            disabled={searching || !query}
                            className="absolute right-3 top-1/2 -translate-y-1/2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center gap-2"
                        >
                            {searching ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                            <span>Discovery</span>
                        </button>
                    </form>
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-0 space-y-4 custom-scrollbar">
                    {searching ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                            <div className="relative">
                                <Loader2 size={48} className="animate-spin text-teal-500" />
                                <Sparkles size={20} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-teal-400 animate-pulse" />
                            </div>
                            <p className="text-xs font-black uppercase tracking-[0.3em] text-teal-400">Scanning High-Intent Signals...</p>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center opacity-30 italic">
                            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                <Globe size={32} />
                            </div>
                            <p className="text-sm">Initiate a global intelligence search to uncover potential leads.</p>
                        </div>
                    ) : (
                        results.map(lead => (
                            <motion.div 
                                key={lead.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gray-950/40 border border-white/5 rounded-2xl p-5 hover:border-teal-500/30 transition-all group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 blur-3xl rounded-full" />
                                
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                                    <div className="space-y-3 flex-1">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg flex items-center justify-center border border-white/5 text-gray-400 font-bold">
                                                {lead.businessName?.charAt(0)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-lg">{lead.businessName}</h3>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <div className="flex items-center gap-1 text-xs font-bold text-teal-400 uppercase tracking-widest">
                                                        <Briefcase size={10} />
                                                        <span>{lead.industry}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                                        <MapPin size={10} />
                                                        <span>{lead.location}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-400 leading-relaxed font-medium">{lead.notes}</p>
                                    </div>

                                    <div className="flex md:flex-col gap-2 shrink-0">
                                        {syncedIds.has(lead.id!) ? (
                                            <div className="flex items-center justify-center gap-2 bg-green-500/10 text-green-400 px-6 py-2.5 rounded-xl border border-green-500/20 font-black text-xs uppercase tracking-widest">
                                                <CheckCircle2 size={14} />
                                                <span>Fully Synced</span>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => handleSyncAndEngage(lead)}
                                                disabled={!!syncing}
                                                className="bg-white hover:bg-gray-100 text-black px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 overflow-hidden flex items-center justify-center gap-2"
                                            >
                                                {syncing === lead.id ? (
                                                    <>
                                                        <Loader2 size={14} className="animate-spin text-teal-600" />
                                                        <span>Syncing CRM...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Zap size={14} className="text-yellow-500" />
                                                        <span>Automated Outreach</span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                        <button className="bg-gray-800/50 hover:bg-gray-800 text-gray-400 px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest border border-white/5 transition-all">
                                            Quick View
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>

                {/* Footer Info */}
                <div className="p-4 bg-gray-950/80 border-t border-white/5 flex items-center justify-between px-8">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-widest">
                        <CheckCircle2 size={14} className="text-teal-500" />
                        <span>Connected to Zoho CRM & AlphaClone Native Storage</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Credits: Unlimited</span>
                    </div>
                </div>
            </motion.div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
}

