import React, { useState, useEffect } from 'react';
import { Shield, Clock, User, Globe, Hash, CheckCircle, AlertTriangle, FileText, Download, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { esignatureComplianceService } from '../../services/esignatureComplianceService';

interface AuditLogProps {
    contractId: string;
    contractTitle: string;
}

interface AuditEvent {
    id: string;
    action: string;
    actor_name: string;
    actor_email: string;
    actor_role: string;
    ip_address: string;
    user_agent: string;
    created_at: string;
    details: any;
}

interface SignatureEvent {
    id: string;
    event_type: string;
    signer_name: string;
    signer_email: string;
    signer_ip: string;
    tamper_seal: string;
    content_hash_at_signing: string;
    timestamp: string;
}

export const ContractAuditLog: React.FC<AuditLogProps> = ({ contractId, contractTitle }) => {
    const [auditTrail, setAuditTrail] = useState<AuditEvent[]>([]);
    const [sigEvents, setSigEvents] = useState<SignatureEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'trail' | 'signatures'>('trail');

    useEffect(() => {
        fetchAuditData();
    }, [contractId]);

    const fetchAuditData = async () => {
        setLoading(true);
        try {
            const [trailRes, sigRes] = await Promise.all([
                supabase
                    .from('contract_audit_trail')
                    .select('*')
                    .eq('contract_id', contractId)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('signature_events')
                    .select('*')
                    .eq('contract_id', contractId)
                    .order('timestamp', { ascending: false })
            ]);

            if (trailRes.data) setAuditTrail(trailRes.data);
            if (sigRes.data) setSigEvents(sigRes.data);
        } catch (error) {
            console.error('Failed to fetch audit data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getActionColor = (action: string) => {
        if (action.includes('created')) return 'text-blue-400';
        if (action.includes('signed')) return 'text-teal-400';
        if (action.includes('viewed') || action.includes('opened')) return 'text-slate-400';
        if (action.includes('modified')) return 'text-amber-400';
        if (action.includes('voided') || action.includes('declined')) return 'text-red-400';
        return 'text-white';
    };

    const getActionIcon = (action: string) => {
        if (action.includes('signed')) return <CheckCircle className="w-4 h-4" />;
        if (action.includes('viewed') || action.includes('opened')) return <Globe className="w-4 h-4" />;
        if (action.includes('modified')) return <Clock className="w-4 h-4" />;
        return <FileText className="w-4 h-4" />;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center">
                            <Shield className="w-6 h-6 text-teal-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Compliance Audit Trail</h2>
                            <p className="text-slate-400 text-sm">{contractTitle}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-teal-500/10 rounded-full border border-teal-500/20">
                        <Lock className="w-3.5 h-3.5 text-teal-400" />
                        <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">ESIGN COMPLIANT</span>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-800">
                    <button
                        onClick={() => setActiveTab('trail')}
                        className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 ${activeTab === 'trail' ? 'border-teal-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        History Log
                    </button>
                    <button
                        onClick={() => setActiveTab('signatures')}
                        className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 ${activeTab === 'signatures' ? 'border-teal-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        Tamper Seals
                    </button>
                </div>

                <div className="mt-6">
                    {activeTab === 'trail' ? (
                        <div className="space-y-4">
                            {auditTrail.length === 0 ? (
                                <p className="text-center py-10 text-slate-500 italic">No audit events recorded yet.</p>
                            ) : (
                                auditTrail.map((event) => (
                                    <div key={event.id} className="flex gap-4 p-4 bg-slate-800/40 rounded-xl border border-slate-800/60 hover:border-slate-700 transition-all">
                                        <div className={`mt-1 shrink-0 ${getActionColor(event.action)}`}>
                                            {getActionIcon(event.action)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-bold text-white uppercase tracking-tight">{event.action.replace(/_/g, ' ')}</p>
                                                <p className="text-[10px] text-slate-500 font-mono">{format(new Date(event.created_at), 'MMM d, HH:mm:ss')}</p>
                                            </div>
                                            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-xs">
                                                <div className="flex items-center gap-2 text-slate-400">
                                                    <User className="w-3.5 h-3.5" />
                                                    <span className="truncate">{event.actor_name} ({event.actor_role})</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-slate-400">
                                                    <Globe className="w-3.5 h-3.5" />
                                                    <span>{event.ip_address}</span>
                                                </div>
                                            </div>
                                            {event.details && Object.keys(event.details).length > 0 && (
                                                <div className="mt-2 p-2 bg-slate-900/50 rounded-lg text-[10px] font-mono text-slate-500 overflow-x-auto">
                                                    {JSON.stringify(event.details)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {sigEvents.length === 0 ? (
                                <p className="text-center py-10 text-slate-500 italic">No signature events recorded yet.</p>
                            ) : (
                                sigEvents.map((event) => (
                                    <div key={event.id} className="p-5 bg-slate-900 border border-teal-900/30 rounded-xl space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-teal-400">
                                                <CheckCircle className="w-4 h-4" />
                                                <span className="text-sm font-bold uppercase tracking-wider">Verified Signature</span>
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-mono">{format(new Date(event.timestamp), 'MMM d, yyyy HH:mm:ss')}</span>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Signer</label>
                                                <div className="text-sm text-white font-medium">{event.signer_name}</div>
                                                <div className="text-xs text-slate-500">{event.signer_email}</div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Location</label>
                                                <div className="text-sm text-white font-medium">IP: {event.signer_ip}</div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div>
                                                <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                                                    <Hash className="w-3 h-3" /> Content Hash at Signing
                                                </label>
                                                <div className="p-2 bg-slate-950 rounded border border-slate-800 text-[10px] font-mono text-slate-400 break-all leading-relaxed">
                                                    {event.content_hash_at_signing}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="flex items-center gap-1.5 text-[10px] font-bold text-teal-500/70 uppercase tracking-widest mb-1">
                                                    <Lock className="w-3 h-3" /> Tamper-Proof Cryptographic Seal
                                                </label>
                                                <div className="p-2 bg-teal-950/20 rounded border border-teal-500/20 text-[10px] font-mono text-teal-400 break-all leading-relaxed">
                                                    {event.tamper_seal}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Verification Notice */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex gap-4">
                <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
                <div className="space-y-1">
                    <h4 className="text-sm font-bold text-amber-200">Integrity Verification Notice</h4>
                    <p className="text-xs text-amber-200/60 leading-relaxed">
                        The tamper seals shown above are generated using SHA-256 cryptographic hashing at the exact moment of signature. 
                        Any modification to the contract content after this point will invalidate the document integrity verification.
                    </p>
                </div>
            </div>
        </div>
    );
};
