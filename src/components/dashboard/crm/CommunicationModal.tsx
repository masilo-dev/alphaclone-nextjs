'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Mail, Send, X, Loader2, CheckCircle2, User, Search, Users, ChevronDown, MailCheck, Sparkles } from 'lucide-react';
import { Button, Input } from '../../ui/UIComponents';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { BusinessClient, businessClientService } from '../../../services/businessClientService';
import { toast } from 'react-hot-toast';
import { useTenant } from '@/contexts/TenantContext';
import { ClientEmailContextPicker } from '../common/ClientEmailContextPicker';
import { EmailRecipient, toBusinessClientFromRecipient } from './emailRecipient';

type EmailProvider = 'microsoft' | 'zoho' | 'sendgrid' | 'resend' | 'brevo' | null;
type ProviderStatusMap = Record<Exclude<EmailProvider, null>, boolean>;

interface CommunicationModalProps {
    client?: BusinessClient;
    recipient?: EmailRecipient;
    prefilledSubject?: string;
    prefilledBody?: string;
    preferredProvider?: EmailProvider;
    lockRecipient?: boolean;
    user: any;
    onClose: () => void;
    onSent: () => void;
}

export const CommunicationModal: React.FC<CommunicationModalProps> = ({
    client,
    recipient,
    prefilledSubject,
    prefilledBody,
    preferredProvider,
    lockRecipient = false,
    user,
    onClose,
    onSent,
}) => {
    const { currentTenant } = useTenant();
    const [selectedClient, setSelectedClient] = useState<BusinessClient | null>(client || null);
    const [subject, setSubject] = useState(prefilledSubject || '');
    const [body, setBody] = useState(prefilledBody || '');
    const [isSending, setIsSending] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<EmailProvider>(null);
    const [loadingProvider, setLoadingProvider] = useState(false);
    const [providerStatus, setProviderStatus] = useState<ProviderStatusMap>({
        microsoft: false,
        zoho: false,
        sendgrid: false,
        resend: false,
        brevo: false,
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [clients, setClients] = useState<BusinessClient[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [contactSearch, setContactSearch] = useState('');
    const [showPicker, setShowPicker] = useState(false);
    const [aiGenerating, setAiGenerating] = useState(false);

    const [showPicker, setShowPicker] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);
    
    // Define available email providers
    const availableProviders: EmailProvider[] = ['microsoft', 'zoho', 'brevo', 'resend', 'sendgrid'];

    const providerLabels: Record<Exclude<EmailProvider, null>, string> = {
        sendgrid: 'SendGrid',
        resend: 'Resend',
        brevo: 'Brevo',
        microsoft: 'Microsoft 365',
        zoho: 'Zoho Mail',
    };

    useEffect(() => {
        if (client) {
            setSelectedClient(client);
            return;
        }
        if (recipient?.email && currentTenant?.id) {
            setSelectedClient(toBusinessClientFromRecipient(recipient, currentTenant.id));
        }
    }, [client, recipient, currentTenant?.id]);

    useEffect(() => {
        if (prefilledSubject) setSubject(prefilledSubject);
    }, [prefilledSubject]);

    useEffect(() => {
        if (prefilledBody) setBody(prefilledBody);
    }, [prefilledBody]);

    useEffect(() => {
        const loadClients = async () => {
            if (!currentTenant?.id) return;

            const { clients: loadedClients, error } = await businessClientService.getClients(currentTenant.id, 1, 100);
            if (error) {
                toast.error(error);
                return;
            }

            setClients(loadedClients.filter(item => !!item.email));
        };

        loadClients();
    }, [currentTenant?.id]);

    useEffect(() => {
        const loadProviderStatus = async () => {
            if (!currentTenant?.id) return;
            setLoadingProvider(true);
            try {
                const response = await fetch(`/api/integrations/status?tenantId=${encodeURIComponent(currentTenant.id)}`);
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Failed to load provider status');
                const integrations = Array.isArray(data.integrations) ? data.integrations : [];
                const next: ProviderStatusMap = {
                    microsoft: false,
                    zoho: false,
                    sendgrid: false,
                    resend: false,
                    brevo: false,
                };
                integrations.forEach((integration: any) => {
                    const type = String(integration.type || '').toLowerCase() as keyof ProviderStatusMap;
                    if (type in next) {
                        next[type] = Boolean(integration.connected);
                    }
                });
                setProviderStatus(next);
                setSelectedProvider((prev) => {
                    if (preferredProvider && next[preferredProvider]) return preferredProvider;
                    if (prev && next[prev as keyof ProviderStatusMap]) return prev;
                    const firstConnected = (availableProviders.find((provider) => provider && next[provider as keyof ProviderStatusMap]) || null) as EmailProvider;
                    return firstConnected;
                });
            } catch {
                setProviderStatus({
                    microsoft: false,
                    zoho: false,
                    sendgrid: false,
                    resend: false,
                    brevo: false,
                });
                setSelectedProvider(null);
            } finally {
                setLoadingProvider(false);
            }
        };

        loadProviderStatus();
    }, [currentTenant?.id, preferredProvider]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setShowPicker(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredContacts = useMemo(() => {
        const query = contactSearch.trim().toLowerCase();
        if (!query) return clients;

        return clients.filter(contact =>
            contact.name.toLowerCase().includes(query) ||
            (contact.email || '').toLowerCase().includes(query)
        );
    }, [clients, contactSearch]);

    const handleSend = async () => {
        if (!selectedClient?.email) {
            toast.error("Please select a client with a valid email.");
            return;
        }
        if (!subject.trim() || !body.trim()) {
            toast.error("Subject and message body cannot be empty.");
            return;
        }
        if (!selectedProvider) {
            toast.error("Choose a sending service first.");
            return;
        }
        if (!currentTenant?.id) {
            toast.error("No active workspace selected.");
            return;
        }

        setIsSending(true);
        try {
            const response = await fetch('/api/outreach/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant.id,
                    leadEmail: selectedClient.email,
                    leadName: selectedClient.name,
                    subject,
                    body,
                    pitchAngle: 'direct_message',
                    industry: selectedClient.industry || '',
                    score: 100,
                    autoSend: true,
                    consentGranted: true,
                    confidenceScore: 100,
                    deliveryProviders: [selectedProvider],
                    preferredProvider: selectedProvider,
                    balanceByDailyLimit: false,
                }),
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to send email');
            }
            if (result.status === 'queued') {
                throw new Error('Email was queued for approval instead of sending. Check AI Agents or retry with auto-send enabled.');
            }

            const { activityService } = await import('../../../services/activityService');
            await activityService.logActivity(user.id, 'Email Sent', { type: 'EXECUTE', to: selectedClient.email, subject, provider: result.provider || selectedProvider }, currentTenant.id);

            const sentVia = String(result.provider || selectedProvider).toUpperCase();
            toast.success(`Email sent successfully via ${sentVia}`);
            onSent();
        } catch (err: any) {
            console.error("Send error:", err);
            toast.error(err.message || "Network error while sending email.");
        } finally {
            setIsSending(false);
        }
    };

    const handleGenerateWithAI = async () => {
        if (!selectedClient) {
            toast.error('Select a client first.');
            return;
        }
        if (!subject.trim()) {
            toast.error('Enter a subject first.');
            return;
        }

        setAiGenerating(true);
        try {
            const prompt = `Write a professional client email in plain text.
Recipient: ${selectedClient.name}
Recipient industry: ${selectedClient.industry || 'Unknown'}
Subject: ${subject}
Context: ${selectedClient.description || 'No additional context'}
Current draft: ${body || 'No current draft'}
Rules: Do not invent greetings (Hello/Hi/Dear) or sign-offs unless the subject or current draft already uses them. Return valid JSON with keys "subject" and "body".`;

            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    systemPrompt: 'You are a professional business email assistant. Return JSON only. Never auto-add greetings unless explicitly present in the request.',
                }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data?.text) {
                throw new Error(data?.error || 'AI generation failed');
            }

            const cleaned = String(data.text).replace(/```json|```/g, '').trim();
            try {
                const parsed = JSON.parse(cleaned);
                if (parsed.subject) setSubject(String(parsed.subject));
                if (parsed.body) setBody(String(parsed.body));
            } catch {
                setBody(cleaned);
            }
            toast.success('AI draft generated.');
        } catch (err: any) {
            toast.error(err.message || 'Failed to generate AI draft.');
        } finally {
            setAiGenerating(false);
        }
    };

    return (
        <DetailDrawer
            open
            onOpenChange={(open) => { if (!open) onClose(); }}
            title="Send Email"
            size="default"
        >
            <div className="space-y-4">
                {/* Provider selector — always visible so Zoho/Microsoft compose starts clearly */}
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Send via</label>
                    <div className="flex flex-wrap gap-2 p-1 bg-slate-900/50 rounded-xl border border-slate-800">
                        {availableProviders.map((p) => {
                            if (!p) return null;
                            const connected = providerStatus[p];
                            return (
                            <button
                                key={p}
                                type="button"
                                onClick={() => {
                                    if (!connected) {
                                        toast.error(`Connect ${providerLabels[p]} in Settings → Integrations first.`);
                                        return;
                                    }
                                    setSelectedProvider(p);
                                }}
                                disabled={loadingProvider}
                                title={connected ? `Send with ${providerLabels[p]}` : `Connect ${providerLabels[p]} in Settings`}
                                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                                    selectedProvider === p && connected
                                    ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20' 
                                    : connected
                                        ? 'text-slate-300 hover:text-white border border-slate-700 hover:border-teal-500/40'
                                        : 'text-slate-600 bg-slate-900/30 cursor-not-allowed border border-slate-800'
                                }`}
                            >
                                <MailCheck className="w-3.5 h-3.5" />
                                {providerLabels[p]}
                                {!connected ? ' · Connect' : selectedProvider === p ? ' · Active' : ''}
                            </button>
                            );
                        })}
                    </div>
                    {!loadingProvider && !availableProviders.some((p) => p && providerStatus[p]) && (
                        <p className="text-xs text-amber-400">
                            No email provider connected. Go to Settings → Integrations and connect Microsoft 365 or Zoho Mail.
                        </p>
                    )}
                </div>

                {/* Recipient selector — hidden when locked to a deal/quote recipient */}
                {!recipient && (
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
                                                <p className="text-slate-400 text-xs truncate">{contact.email}</p>
                                            </div>
                                            <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium shrink-0 ${
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
                )}

                {recipient?.email && (
                    <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-3 flex items-center gap-3">
                        <Mail className="w-4 h-4 text-teal-400 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-white">{recipient.name}</p>
                            <p className="text-xs text-slate-400">{recipient.email}</p>
                        </div>
                    </div>
                )}

                {selectedClient && (
                    <ClientEmailContextPicker
                        tenantId={currentTenant?.id}
                        clientId={selectedClient.id}
                        email={selectedClient.email}
                        onInsert={(text) => setBody((prev) => `${prev}${text}`)}
                    />
                )}

                <div className="space-y-4">
                    <Input
                        label="Subject Line"
                        placeholder="Project Update / Introduction"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        disabled={!selectedClient?.email || loadingProvider}
                    />

                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-sm font-medium text-slate-300">Message</label>
                            <button
                                type="button"
                                onClick={handleGenerateWithAI}
                                disabled={aiGenerating || !selectedClient || loadingProvider}
                                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-teal-500/30 text-teal-300 hover:bg-teal-500/10 transition-all disabled:opacity-50"
                            >
                                {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                AI Draft
                            </button>
                        </div>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Type your message here..."
                            disabled={!selectedClient?.email || loadingProvider}
                            className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500 transition-colors h-[140px] max-h-[140px] resize-none overflow-y-auto"
                        />
                    </div>
                </div>

                <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
                    <div className="text-slate-500 text-xs flex items-center gap-2">
                        {loadingProvider ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Detecting provider...</>
                        ) : selectedProvider ? (
                            <><CheckCircle2 className="w-3 h-3 text-teal-500" /> Using {selectedProvider === 'microsoft' ? 'Microsoft 365' : selectedProvider === 'zoho' ? 'Zoho Mail' : selectedProvider === 'sendgrid' ? 'SendGrid' : selectedProvider === 'resend' ? 'Resend' : 'Brevo'} to send securely</>
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
                            disabled={isSending || loadingProvider || !selectedClient?.email || !selectedProvider}
                            icon={isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold"
                        >
                            {isSending ? 'Sending...' : 'Send Message'}
                        </Button>
                    </div>
                </div>
            </div>
        </DetailDrawer>
    );
};
