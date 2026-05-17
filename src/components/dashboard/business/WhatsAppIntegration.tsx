'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Plus, Trash2, Loader2, Save, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';

export default function WhatsAppIntegration() {
    const { user } = useAuth();
    const { currentTenant } = useTenant();
    
    const [integrations, setIntegrations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [showAddForm, setShowAddForm] = useState(false);
    const [newIntegration, setNewIntegration] = useState({
        alias: '',
        wabaId: '',
        apiToken: ''
    });

    useEffect(() => {
        if (currentTenant?.id) {
            fetchIntegrations();
        }
    }, [currentTenant?.id]);

    const fetchIntegrations = async () => {
        if (!currentTenant?.id) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/integrations/whatsapp?tenantId=${currentTenant.id}`);
            const data = await res.json();
            if (data.success) {
                setIntegrations(data.integrations || []);
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            console.error('Failed to fetch WhatsApp integrations', err);
            toast.error('Failed to load WhatsApp integrations');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddIntegration = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTenant?.id) return;
        if (!newIntegration.wabaId || !newIntegration.apiToken || !newIntegration.alias) {
            toast.error('Please fill out all fields.');
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch('/api/integrations/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant.id,
                    alias: newIntegration.alias,
                    wabaId: newIntegration.wabaId,
                    apiToken: newIntegration.apiToken
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('WhatsApp API connected successfully!');
                setIntegrations([data.integration, ...integrations]);
                setNewIntegration({ alias: '', wabaId: '', apiToken: '' });
                setShowAddForm(false);
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            console.error('Failed to add WhatsApp integration', err);
            toast.error(err.message || 'Failed to add integration');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!currentTenant?.id) return;
        if (!confirm('Are you sure you want to remove this WhatsApp connection?')) return;
        
        try {
            const res = await fetch(`/api/integrations/whatsapp?tenantId=${currentTenant.id}&id=${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                toast.success('WhatsApp connection removed.');
                setIntegrations(integrations.filter(i => i.id !== id));
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to remove integration');
        }
    };

    if (isLoading) {
        return (
            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-teal-400 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Loading WhatsApp integrations...</p>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/5 bg-slate-900/60 overflow-hidden"
        >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                        <MessageCircle className="w-6 h-6 text-teal-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">WhatsApp Green API</h2>
                        <p className="text-sm text-slate-400">Manage multiple WhatsApp connections for omnichannel outreach.</p>
                    </div>
                </div>
                <Button 
                    variant="outline" 
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="border-slate-700 hover:bg-slate-800 text-teal-400"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Account
                </Button>
            </div>

            <AnimatePresence>
                {showAddForm && (
                    <motion.form 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        onSubmit={handleAddIntegration} 
                        className="p-6 space-y-4 border-b border-white/5 bg-slate-800/30 overflow-hidden"
                    >
                        <h3 className="text-sm font-bold text-white mb-2">Connect New Green API Instance</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Account Alias</label>
                                <input
                                    type="text"
                                    value={newIntegration.alias}
                                    onChange={(e) => setNewIntegration({ ...newIntegration, alias: e.target.value })}
                                    placeholder="e.g. Main Support"
                                    className="w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-2 text-sm text-white outline-none focus:border-teal-500/40"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Instance ID</label>
                                <input
                                    type="text"
                                    value={newIntegration.wabaId}
                                    onChange={(e) => setNewIntegration({ ...newIntegration, wabaId: e.target.value })}
                                    placeholder="123456789"
                                    className="w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-2 text-sm text-white outline-none focus:border-teal-500/40"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">API Token</label>
                                <input
                                    type="password"
                                    value={newIntegration.apiToken}
                                    onChange={(e) => setNewIntegration({ ...newIntegration, apiToken: e.target.value })}
                                    placeholder="••••••••••••••••"
                                    className="w-full rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-2 text-sm text-white outline-none focus:border-teal-500/40"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <Button 
                                type="submit" 
                                disabled={isSaving}
                                className="bg-teal-600 hover:bg-teal-500 text-white font-bold"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                Connect Instance
                            </Button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            <div className="p-6">
                {integrations.length === 0 ? (
                    <div className="text-center py-8">
                        <MessageCircle className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-400">No WhatsApp accounts connected yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {integrations.map(integration => (
                            <div key={integration.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-teal-500/10 rounded-full flex items-center justify-center border border-teal-500/20">
                                        <MessageCircle className="w-5 h-5 text-teal-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white">{integration.metadata?.alias || 'WhatsApp Instance'}</h4>
                                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                                            <span>ID: {integration.waba_id}</span>
                                            <span className="w-1 h-1 bg-slate-600 rounded-full" />
                                            <span className="text-teal-400 flex items-center gap-1">
                                                <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" /> Active
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <button 
                                        onClick={() => handleDelete(integration.id)}
                                        className="text-slate-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-500/10"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
