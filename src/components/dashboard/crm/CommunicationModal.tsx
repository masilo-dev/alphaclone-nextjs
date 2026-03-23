'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mail, Send, X, Loader2, CheckCircle2, User, Search, Users, ChevronDown } from 'lucide-react';
import { Button, Input, Modal } from '../../ui/UIComponents';
import { BusinessClient, businessClientService } from '../../../services/businessClientService';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';

interface CommunicationModalProps {
    client?: BusinessClient;       // Optional – pre-selected client
    user: any;
    onClose: () => void;
    onSent: () => void;
}

export const CommunicationModal: React.FC<CommunicationModalProps> = ({ client: initialClient, user, onClose, onSent }) => {
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [provider, setProvider] = useState<'gmail' | null>(null);
    const [loadingProvider, setLoadingProvider] = useState(true);

    // Contact picker state
    const [selectedClient, setSelectedClient] = useState<BusinessClient | null>(initialClient || null);
    const [contacts, setContacts] = useState<BusinessClient[]>([]);
    const [contactSearch, setContactSearch] = useState('');
    const [showPicker, setShowPicker] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(contactSearch.toLowerCase())
    );

    // Load client contacts
    useEffect(() => {
        const load = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const uid = user?.id || session?.user?.id;
                if (!uid) return;
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('tenant_id')
                    .eq('id', uid)
                    .single();
                if (!profile?.tenant_id) return;
                const { clients } = await businessClientService.getClients(profile.tenant_id, 1, 100);
                setContacts(clients.filter(c => !!c.email));
            } catch (e) {
                console.warn('Could not load contacts:', e);
            }
        };
        load();
    }, [user?.id]);

    // Close picker on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setShowPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Check connected email provider
    useEffect(() => {
        const checkConnections = async () => {
            setLoadingProvider(true);
            try {

                const { data: integrations } = await supabase
                    .from('integrations')
                    .select('type')
                    .eq('user_id', user.id);
                const gmailConnected = integrations?.some((i: any) => i.type === 'gmail');
                setProvider(gmailConnected ? 'gmail' : null);
            } catch (err) {
                console.error("Failed to check provider:", err);
            } finally {
                setLoadingProvider(false);
            }
        };
        checkConnections();
    }, [user.id]);

    const handleSend = async () => {
        if (!selectedClient?.email) {
            toast.error("Please select a client with a valid email.");
            return;
        }
        if (!subject.trim() || !body.trim()) {
            toast.error("Subject and message body cannot be empty.");
            return;
        }
        if (!provider) {
            toast.error("No email provider connected. Please connect Gmail in settings.");
            return;
        }

        setIsSending(true);
        try {
            if (provider === 'gmail') {
                toast.success("Message drafting enabled. Active Gmail sending arriving in next sync.");
                onSent();
            }
        } catch (err) {
            toast.error("Network error while sending email.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Send Email" maxWidth="max-w-2xl">
            <div className="space-y-6">
                {/* Recipient selector */}
                <div ref={pickerRef}>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Recipient</label>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => { setContactSearch(''); setShowPicker(v => !v); }}
                            className="w-full flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-teal-500/50 transition-colors text-left"
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${selectedClient ? 'bg-teal-600/30 border border-teal-500/30' : 'bg-slate-700 border border-slate-600'}`}>
                                {selectedClient ? <User className="w-4 h-4 text-teal-400" /> : <Users className="w-4 h-4 text-slate-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                {selectedClient ? (
                                    <>
                                        <p className="text-white font-medium text-sm truncate">{selectedClient.name}</p>
                                        <p className="text-slate-400 text-xs truncate">{selectedClient.email}</p>
                                    </>
                                ) : (
                                    <p className="text-slate-400 text-sm">Select a client from your directory...</p>
                                )}
                            </div>
                            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${showPicker ? 'rotate-180' : ''}`} />
                        </button>

                        {showPicker && (
                            <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
                                <div className="p-2 border-b border-slate-700">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                        <input
                                            autoFocus
                                            type="text"
                                            value={contactSearch}
                                            onChange={(e) => setContactSearch(e.target.value)}
                                            placeholder="Search clients..."
                                            className="w-full bg-slate-900 text-white text-xs rounded-lg pl-8 pr-3 py-2 outline-none border border-slate-700 focus:border-teal-500/50 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="max-h-52 overflow-y-auto">
                                    {filteredContacts.length === 0 ? (
                                        <p className="text-slate-500 text-xs text-center py-4">No clients with email found</p>
                                    ) : filteredContacts.map(contact => (
                                        <button
                                            key={contact.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedClient(contact);
                                                setShowPicker(false);
                                                setContactSearch('');
                                            }}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-700 transition-colors ${selectedClient?.id === contact.id ? 'bg-teal-500/10' : ''}`}
                                        >
                                            <div className="w-7 h-7 rounded-full bg-teal-600/20 border border-teal-500/20 flex items-center justify-center shrink-0">
                                                <User className="w-3.5 h-3.5 text-teal-400" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-white text-xs font-medium truncate">{contact.name}</p>
                                                <p className="text-slate-400 text-[10px] truncate">{contact.email}</p>
                                            </div>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${
                                                contact.salesStage === 'customer' ? 'bg-emerald-500/20 text-emerald-400' :
                                                contact.salesStage === 'lead' ? 'bg-amber-500/20 text-amber-400' :
                                                'bg-sky-500/20 text-sky-400'
                                            }`}>{contact.salesStage}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    {selectedClient && !selectedClient.email && (
                        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                            This client has no email address. Please update their profile.
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <Input
                        label="Subject Line"
                        placeholder="Project Update / Introduction"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        disabled={!selectedClient?.email || loadingProvider}
                    />

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-300">Message</label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Type your message here..."
                            disabled={!selectedClient?.email || loadingProvider}
                            className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 transition-colors min-h-[200px] resize-none"
                        />
                    </div>
                </div>

                <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
                    <div className="text-slate-500 text-xs flex items-center gap-2">
                        {loadingProvider ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Detecting provider...</>
                        ) : provider ? (
                            <><CheckCircle2 className="w-3 h-3 text-teal-500" /> Using Gmail to send securely</>
                        ) : (
                            <><span className="text-amber-500">⚠ No provider connected. Emails cannot be sent.</span></>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <Button variant="ghost" onClick={onClose} disabled={isSending}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSend}
                            disabled={isSending || loadingProvider || !selectedClient?.email || !provider}
                            icon={isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold"
                        >
                            {isSending ? 'Sending...' : 'Send Message'}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
