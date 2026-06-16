'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Trash2,
    Link as LinkIcon,
    Search,
    Users,
    Plug2,
    Unplug
} from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface HubSpotContact {
    id: string;
    properties: {
        firstname?: string;
        lastname?: string;
        email?: string;
        phone?: string;
        company?: string;
        [key: string]: any;
    };
}

interface HubspotIntegrationProps {
    onClose?: () => void;
}

export default function HubspotIntegration({ onClose }: HubspotIntegrationProps) {
    const { user } = useAuth();
    const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('loading');
    const [contacts, setContacts] = useState<HubSpotContact[]>([]);
    const [isLoadingContacts, setIsLoadingContacts] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDeletingIntegration, setIsDeletingIntegration] = useState(false);
    const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
    const [query, setQuery] = useState('');

    const filteredContacts = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return contacts;
        return contacts.filter((contact) => {
            const fullName = `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim().toLowerCase();
            return (
                fullName.includes(q) ||
                (contact.properties.email || '').toLowerCase().includes(q) ||
                (contact.properties.company || '').toLowerCase().includes(q)
            );
        });
    }, [contacts, query]);

    useEffect(() => {
        if (user?.id) {
            void checkIntegrationStatus();
        }
    }, [user?.id]);

    const checkIntegrationStatus = async () => {
        if (!user?.id) return;

        setStatus('loading');
        try {
            const { data, error } = await supabase
                .from('integrations')
                .select('id, enabled')
                .eq('user_id', user.id)
                .eq('type', 'hubspot')
                .maybeSingle();

            if (error) throw error;

            if (data?.enabled) {
                setStatus('connected');
                await fetchContacts();
            } else {
                setStatus('idle');
                setContacts([]);
            }
        } catch (err) {
            console.error('Error checking HubSpot status:', err);
            setStatus('error');
        }
    };

    const handleConnect = () => {
        if (!user?.id) return;
        window.location.href = `/api/auth/hubspot/connect?userId=${user.id}`;
    };

    const fetchContacts = async () => {
        if (!user?.id) return;

        setIsLoadingContacts(true);
        try {
            const response = await fetch(`/api/hubspot/sync?userId=${user.id}`);
            if (!response.ok) {
                console.warn('HubSpot API not available, showing empty state');
                setContacts([]);
                return;
            }
            const data = await response.json();

            setContacts(data.contacts || []);
        } catch (err: any) {
            console.error('Error fetching HubSpot contacts:', err);
            setContacts([]);
        } finally {
            setIsLoadingContacts(false);
        }
    };

    const handleSync = async () => {
        if (!user?.id) return;

        setIsSyncing(true);
        try {
            const response = await fetch('/api/hubspot/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to refresh HubSpot contacts');
            }

            setContacts(data.contacts || []);
            toast.success('HubSpot contacts refreshed.');
        } catch (err: any) {
            console.error('Error syncing HubSpot contacts:', err);
            toast.error(err.message || 'Failed to refresh contacts');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDeleteIntegration = async () => {
        if (!user?.id) return;

        setIsDeletingIntegration(true);
        try {
            const { error } = await supabase
                .from('integrations')
                .delete()
                .eq('user_id', user.id)
                .eq('type', 'hubspot');

            if (error) throw error;

            setStatus('idle');
            setContacts([]);
            toast.success('HubSpot disconnected.');
        } catch (err: any) {
            console.error('Error deleting HubSpot integration:', err);
            toast.error(err.message || 'Failed to disconnect HubSpot');
        } finally {
            setIsDeletingIntegration(false);
        }
    };

    const handleDeleteContact = async (id: string) => {
        if (!user?.id) return;

        setDeletingContactId(id);
        try {
            const response = await fetch(`/api/hubspot/delete?userId=${user.id}&contactId=${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete contact');
            }

            setContacts((prev) => prev.filter((contact) => contact.id !== id));
            toast.success('HubSpot contact deleted.');
        } catch (err: any) {
            console.error('Error deleting HubSpot contact:', err);
            toast.error(err.message || 'Failed to delete contact');
        } finally {
            setDeletingContactId(null);
        }
    };

    if (status === 'loading') {
        return (
            <div className="max-w-4xl rounded-2xl border border-white/5 bg-slate-900/60 p-5 text-center">
                <RefreshCw className="w-5 h-5 animate-spin text-orange-400 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Checking HubSpot connection...</p>
            </div>
        );
    }

    if (status !== 'connected') {
        return (
            <div className="max-w-4xl rounded-2xl border border-white/5 bg-slate-900/60 p-5">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                        <Plug2 className="w-5 h-5 text-orange-400" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-base font-bold text-white">HubSpot CRM</h2>
                        <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                            Sync HubSpot contacts into AlphaClone and manage them from one workspace.
                        </p>
                        {status === 'error' && (
                            <div className="mt-3 flex items-center gap-2 text-amber-400 text-sm">
                                <AlertCircle className="w-4 h-4" />
                                Unable to verify the current HubSpot connection.
                            </div>
                        )}
                        <div className="mt-4">
                            <Button onClick={handleConnect} className="bg-orange-500 hover:bg-orange-400 text-slate-950 font-semibold">
                                <LinkIcon className="w-4 h-4 mr-2" />
                                Connect HubSpot
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl rounded-2xl border border-white/5 bg-slate-900/60 overflow-hidden"
        >
            <div className="border-b border-white/5 p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold text-white">HubSpot CRM</h2>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                Connected
                            </span>
                        </div>
                        <p className="text-sm text-slate-400">View and refresh HubSpot contacts inside AlphaClone.</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <Button
                        variant="outline"
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="border-slate-700 text-white hover:bg-slate-800"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                        Refresh Contacts
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleDeleteIntegration}
                        disabled={isDeletingIntegration}
                        className="border-slate-700 text-rose-300 hover:bg-rose-500/10"
                    >
                        <Unplug className="w-4 h-4 mr-2" />
                        Disconnect
                    </Button>
                </div>
            </div>

            <div className="p-4">
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search contacts by name, email, or company..."
                        className="w-full rounded-xl border border-slate-800 bg-slate-950/50 pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-orange-500/40"
                    />
                </div>

                {isLoadingContacts ? (
                    <div className="py-10 text-center">
                        <RefreshCw className="w-5 h-5 animate-spin text-orange-400 mx-auto mb-3" />
                        <p className="text-sm text-slate-400">Loading HubSpot contacts...</p>
                    </div>
                ) : filteredContacts.length === 0 ? (
                    <div className="py-10 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
                        <p className="text-sm">No HubSpot contacts found.</p>
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[24rem] overflow-y-auto pr-1">
                        {filteredContacts.map((contact) => {
                            const fullName = `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim() || 'Unnamed Contact';
                            return (
                                <div
                                    key={contact.id}
                                    className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                                >
                                    <div className="min-w-0">
                                        <p className="font-semibold text-white truncate">{fullName}</p>
                                        <div className="text-sm text-slate-400 flex flex-col gap-1 mt-1">
                                            <span className="truncate">{contact.properties.email || 'No email'}</span>
                                            {contact.properties.company && <span className="truncate">{contact.properties.company}</span>}
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={() => handleDeleteContact(contact.id)}
                                        disabled={deletingContactId === contact.id}
                                        className="border-slate-700 text-rose-300 hover:bg-rose-500/10"
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        {deletingContactId === contact.id ? 'Deleting...' : 'Delete'}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
