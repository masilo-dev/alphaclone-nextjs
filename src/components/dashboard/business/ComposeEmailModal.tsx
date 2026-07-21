'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AIOutputDisclaimer from '@/components/ai/AIOutputDisclaimer';
import { X, Send, Loader2, Sparkles, Wand2, User, Search, Check, ChevronDown, Plus } from 'lucide-react';
import { Button } from '../../ui/UIComponents';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { businessClientService } from '../../../services/businessClientService';
import { integrationsService, IntegrationConfig } from '../../../services/integrationsService';
import { useTenant } from '../../../contexts/TenantContext';
import { getMimeType } from '../../../utils/mimeTypes';
import { ClientEmailContextPicker } from '../common/ClientEmailContextPicker';
import EmailLeadInsightPanel from '../inbox/EmailLeadInsightPanel';
import { isValidEmail, validateEmailField } from '@/lib/email/isValidEmail';
import EmailProviderSelector from '@/components/shared/EmailProviderSelector';
import {
  normalizeDeliveryProvider,
  resolveAutoProvider,
  type DeliveryEmailProvider,
} from '@/lib/email/emailProviderOptions';
import {
  clearLocalComposeDraft,
  loadLocalComposeDraft,
  saveLocalComposeDraft,
} from '@/lib/email/composeDraftStorage';

function parseRecipientList(value: string): string[] {
    return value
        .split(/[,\n;]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}

export type EmailComposerProps = {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    initialTo?: string;
    initialSubject?: string;
    initialBody?: string;
    /** Skip CRM recipient gate — for inbox replies and direct sends */
    skipCrmGate?: boolean;
    entityType?: 'invoice' | 'contract' | 'document' | 'lead' | 'client' | 'direct';
    entityId?: string;
    attachments?: Array<{ id: string; name: string; size: number; data?: string }>;
    preferredProvider?: DeliveryEmailProvider;
};

interface ComposeEmailModalProps extends EmailComposerProps {}

const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({
    isOpen,
    onClose,
    userId,
    initialTo = '',
    initialSubject = '',
    initialBody = '',
    skipCrmGate = false,
    entityType = 'direct',
    entityId,
    preferredProvider,
}) => {
    const { currentTenant } = useTenant();
    const [to, setTo] = useState(initialTo);
    const [cc, setCc] = useState('');
    const [bcc, setBcc] = useState('');
    const [showCcBcc, setShowCcBcc] = useState(false);
    const [subject, setSubject] = useState(initialSubject);
    const [body, setBody] = useState(initialBody);
    const [attachments, setAttachments] = useState<{ id: string, name: string, size: number, data?: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const [sending, setSending] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [generating, setGenerating] = useState(false);
    const [selectedTone, setSelectedTone] = useState('professional');
    const [from, setFrom] = useState('');
    const [clients, setClients] = useState<any[]>([]);
    const [availableProviders, setAvailableProviders] = useState<IntegrationConfig[]>([]);
    const [deliveryProvider, setDeliveryProvider] = useState<DeliveryEmailProvider>('auto');
    const [workspaceDefault, setWorkspaceDefault] = useState<DeliveryEmailProvider>('auto');
    const [providerOptions, setProviderOptions] = useState<
        Array<{ id: DeliveryEmailProvider; label: string; connected: boolean; native?: boolean; campaigns?: boolean }>
    >([]);
    const [selectedProvider, setSelectedProvider] = useState<IntegrationConfig | null>(null);
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [savingDraft, setSavingDraft] = useState(false);
    const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (isOpen) {
            setTo(initialTo);
            setSubject(initialSubject);
            setBody(initialBody);
            setSearchQuery('');
            setAiPrompt('');
            setAutoSaveStatus('idle');

            if (!initialTo && !initialSubject && !initialBody && currentTenant?.id) {
                const stored = loadLocalComposeDraft(currentTenant.id, userId);
                if (stored) {
                    setTo(stored.to);
                    setCc(stored.cc);
                    setBcc(stored.bcc);
                    setSubject(stored.subject);
                    setBody(stored.body);
                    setDeliveryProvider(stored.deliveryProvider);
                }
            }
        }
    }, [isOpen, initialTo, initialSubject, initialBody, currentTenant?.id, userId]);

    React.useEffect(() => {
        if (isOpen && currentTenant?.id) {
            businessClientService.getClients(currentTenant.id).then(({ clients }) => {
                setClients(clients || []);
            });

            // Fetch available email integrations (including Microsoft 365 via status API)
            Promise.all([
                integrationsService.getUserIntegrations(userId),
                fetch(`/api/integrations/status?tenantId=${encodeURIComponent(currentTenant.id)}`).then((r) => r.json().catch(() => ({}))),
                fetch(`/api/settings/email-provider?tenantId=${encodeURIComponent(currentTenant.id)}`).then((r) => r.json().catch(() => ({}))),
            ]).then(([{ integrations }, statusData, providerSettings]) => {
                const emailTypes = ['microsoft', 'sendgrid', 'resend', 'brevo', 'zoho', 'gmail'];
                const filtered = integrations.filter(i => i.enabled && emailTypes.includes(i.type));

                const statusList = Array.isArray(statusData?.integrations) ? statusData.integrations : [];
                const msStatus = statusList.find((i: { type?: string; connected?: boolean }) => i.type === 'microsoft' && i.connected);
                if (msStatus && !filtered.some((p) => p.type === 'microsoft')) {
                    filtered.unshift({
                        id: 'microsoft-connection',
                        type: 'microsoft',
                        name: 'Microsoft 365',
                        enabled: true,
                        userId,
                        createdAt: new Date().toISOString(),
                        config: { fromEmail: (msStatus as { email?: string }).email || '' },
                    });
                }

                setAvailableProviders(filtered);
                const connectedList = (providerSettings.connectedProviders || []) as typeof providerOptions;
                setProviderOptions(connectedList);

                const tenantDefault = normalizeDeliveryProvider(providerSettings.defaultProvider);
                const preferredDefault =
                    preferredProvider && connectedList.some((p) => p.id === preferredProvider && p.connected)
                        ? preferredProvider
                        : tenantDefault;
                setWorkspaceDefault(tenantDefault);
                setDeliveryProvider(preferredDefault);

                const connectedIds = connectedList.filter((p) => p.connected).map((p) => p.id);
                const resolved = resolveAutoProvider(connectedIds, preferredDefault);
                const pickType = preferredDefault === 'auto' ? resolved : preferredDefault;
                const match = filtered.find((p) => p.type === pickType);
                setSelectedProvider(match || filtered[0] || null);
            });

            // Fetch user's email for the fallback From field
            const fetchUser = async () => {
                const { data } = await supabase.auth.getUser();
                if (data?.user?.email) setFrom(data.user.email);
            };
            fetchUser();
        }
    }, [isOpen, currentTenant?.id, userId, preferredProvider]);

    // Update 'From' field when provider changes
    React.useEffect(() => {
        if (selectedProvider) {
            const config = selectedProvider.config;
            const providerFrom = config.fromEmail || config.from_email || config.senderEmail;
            if (providerFrom) {
                setFrom(providerFrom);
            }
        }
    }, [selectedProvider]);

    React.useEffect(() => {
        if (deliveryProvider === 'auto') return;
        const match = availableProviders.find((p) => p.type === deliveryProvider);
        if (match) setSelectedProvider(match);
    }, [deliveryProvider, availableProviders]);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowContactDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    React.useEffect(() => {
        if (!isOpen || !currentTenant?.id) return;
        if (!to && !subject && !body) return;

        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
            setAutoSaveStatus('saving');
            saveLocalComposeDraft(currentTenant.id, userId, {
                to,
                cc,
                bcc,
                subject,
                body,
                deliveryProvider,
            });
            setAutoSaveStatus('saved');
        }, 1500);

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [isOpen, currentTenant?.id, userId, to, cc, bcc, subject, body, deliveryProvider]);

    const filteredClients = clients.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const matchedClient = React.useMemo(() => {
        const normalized = parseRecipientList(to)[0]?.toLowerCase() || '';
        if (!normalized) return null;
        return clients.find((client) => client.email?.toLowerCase() === normalized) || null;
    }, [clients, to]);

    const toRecipients = React.useMemo(() => parseRecipientList(to), [to]);
    const ccRecipients = React.useMemo(() => parseRecipientList(cc), [cc]);
    const bccRecipients = React.useMemo(() => parseRecipientList(bcc), [bcc]);
    const allRecipients = React.useMemo(
        () => Array.from(new Set([...toRecipients, ...ccRecipients, ...bccRecipients])),
        [toRecipients, ccRecipients, bccRecipients]
    );

    const TONES = [
        { id: 'professional', label: 'Professional' },
        { id: 'friendly', label: 'Friendly' },
        { id: 'direct', label: 'Direct' },
        { id: 'creative', label: 'Creative' },
    ];

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        try {
            const newAttachments: { id: string, name: string, size: number, data: string }[] = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                // Keep attachments within the smallest common provider limit.
                if (file.size > 25 * 1024 * 1024) {
                    toast.error(`${file.name} exceeds 25MB limit`);
                    continue;
                }

                // Read file as base64
                const base64Data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const result = reader.result as string;
                        // Remove data URL prefix to get pure base64
                        const base64 = result.split(',')[1];
                        resolve(base64);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                newAttachments.push({
                    id: `${Date.now()}-${i}`,
                    name: file.name,
                    size: file.size,
                    data: base64Data,
                });
            }

            setAttachments(prev => [...prev, ...newAttachments]);
            toast.success(`${newAttachments.length} file(s) attached`);
        } catch (error) {
            console.error('File upload error:', error);
            toast.error('Failed to attach files');
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const removeAttachment = (id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
    };

    const handleAIGenerate = async () => {
        if (!aiPrompt.trim()) {
            toast.error('Please describe what you want the AI to write');
            return;
        }

        setGenerating(true);
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Write a ${selectedTone} email based on these instructions: "${aiPrompt}". 
                    Recipient context: ${to ? `Writing to ${to}` : 'General business contact'}.
                    Return your response as a JSON object with 'subject' and 'body' fields. 
                    Style: ${selectedTone}.
                    Be professional and concise. Don't add any other text outside the JSON.`,
                    systemPrompt: "You are an expert business email assistant. You respond only with valid JSON focusing on high-conversion outreach."
                })
            });

            if (!res.ok) throw new Error('AI generation failed');
            const data = await res.json();

            try {
                const cleanedText = data.text.replace(/```json|```/g, '').trim();
                const parsed = JSON.parse(cleanedText);
                setSubject(parsed.subject || '');
                setBody(parsed.body || '');
                toast.success('Draft generated!');
            } catch (parseError) {
                setBody(data.text);
                toast.success('Draft ready (body only)');
            }
        } catch (err) {
            toast.error('Failed to generate draft');
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveDraft = async () => {
        if (!currentTenant?.id) {
            toast.error('No active workspace selected.');
            return;
        }
        if (!body.trim()) {
            toast.error('Add some message text before saving a draft.');
            return;
        }

        setSavingDraft(true);
        try {
            saveLocalComposeDraft(currentTenant.id, userId, {
                to,
                cc,
                bcc,
                subject,
                body,
                deliveryProvider,
            });

            const connectedIds = providerOptions.filter((p) => p.connected).map((p) => p.id);
            const resolvedType =
                deliveryProvider === 'auto'
                    ? resolveAutoProvider(connectedIds, workspaceDefault)
                    : deliveryProvider;

            if (resolvedType === 'microsoft' || resolvedType === 'zoho') {
                const res = await fetch('/api/email/drafts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tenantId: currentTenant.id,
                        to,
                        cc,
                        bcc,
                        subject,
                        body,
                        deliveryProvider: resolvedType,
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'Failed to save draft to mailbox');
                toast.success(data.note || `Draft saved to ${resolvedType}`);
            } else {
                toast.success('Draft saved on this device. Pick Microsoft or Zoho to sync to your mailbox drafts folder.');
            }
            setAutoSaveStatus('saved');
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to save draft');
        } finally {
            setSavingDraft(false);
        }
    };

    const handleSend = async () => {
        if (toRecipients.length === 0) {
            toast.error('Add at least one recipient.');
            return;
        }
        for (const email of allRecipients) {
            if (!isValidEmail(email)) {
                toast.error(`Invalid email address: ${email}`);
                return;
            }
        }
        if (!subject.trim()) {
            toast.error('Subject is required');
            return;
        }
        if (!body.trim()) {
            toast.error('Message body is required');
            return;
        }

        if (!currentTenant?.id) {
            toast.error('No active workspace selected.');
            return;
        }

        setSending(true);
        try {
            const connectedIds = providerOptions.filter((p) => p.connected).map((p) => p.id);
            const resolvedType =
                deliveryProvider === 'auto'
                    ? resolveAutoProvider(connectedIds, workspaceDefault)
                    : deliveryProvider;
            const sendProvider = resolvedType === 'auto' ? selectedProvider?.type : resolvedType;

            for (const recipient of allRecipients) {
                const clientMatch = clients.find((client) => client.email?.toLowerCase() === recipient.toLowerCase());
                const res = await fetch('/api/outreach/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tenantId: currentTenant.id,
                        leadEmail: recipient,
                        leadName: clientMatch?.name,
                        subject,
                        body,
                        pitchAngle: 'direct_message',
                        autoSend: true,
                        consentGranted: true,
                        confidenceScore: 100,
                        directSend: skipCrmGate,
                        skipCrmGate,
                        entityType,
                        entityId,
                        deliveryProviders: sendProvider ? [sendProvider] : undefined,
                        preferredProvider: sendProvider,
                        balanceByDailyLimit: false,
                    }),
                });

                const result = await res.json().catch(() => ({}));
                if (!res.ok || !result.success) {
                    throw new Error(result.error || `Email to ${recipient} could not be sent. Check your email provider settings.`);
                }
                if (result.status === 'queued') {
                    throw new Error(`Email to ${recipient} was queued for approval instead of sending. Check AI Agents or retry.`);
                }
            }

            toast.success(
                `${allRecipients.length === 1 ? 'Email' : `${allRecipients.length} emails`} sent via ${String(sendProvider || selectedProvider?.type || 'platform').toUpperCase()}`
            );
            if (currentTenant?.id) clearLocalComposeDraft(currentTenant.id, userId);
            onClose();
            setTo('');
            setCc('');
            setBcc('');
            setSubject('');
            setBody('');
            setAttachments([]);
        } catch (err: any) {
            toast.error(err.message || 'Failed to send');
        } finally {
            setSending(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col z-[120]"
                    >
                        {/* Header */}
                        <div className="p-6 sm:p-8 border-b border-white/5 flex items-center justify-between bg-white/2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
                                    <Send className="w-5 h-5 text-teal-400" />
                                </div>
                                <div>
                                    <h2 className="text-base font-black text-white uppercase tracking-tight">Compose Email</h2>
                                    <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">{selectedProvider?.name || 'Unified'} · AI Assistant</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-3 text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-2xl transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">
                            {/* AI POWERED DRAFTING SECTION */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="bg-gradient-to-br from-teal-500/10 to-slate-500/10 border border-teal-500/20 rounded-3xl p-6 relative overflow-hidden group"
                            >
                                <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Sparkles className="w-24 h-24 text-teal-400" />
                                </div>

                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-2 bg-teal-500 rounded-lg">
                                        <Wand2 className="w-3 h-3 text-white" />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-[0.2em] text-teal-400">AI Assistant</span>
                                </div>

                                <div className="space-y-4 relative z-10">
                                    <div className="flex flex-wrap gap-2">
                                        {TONES.map(tone => (
                                            <button
                                                key={tone.id}
                                                onClick={() => setSelectedTone(tone.id)}
                                                className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${selectedTone === tone.id
                                                    ? 'bg-teal-500 text-white border-teal-400 shadow-lg shadow-teal-500/20'
                                                    : 'bg-slate-950/50 text-slate-500 border-white/5 hover:border-white/10'
                                                    }`}
                                            >
                                                {tone.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex gap-3">
                                        <div className="relative flex-1">
                                            <input
                                                value={aiPrompt}
                                                onChange={e => setAiPrompt(e.target.value)}
                                                placeholder="Instruction: e.g. 'Draft a follow-up about the proposal...'"
                                                className="w-full bg-slate-950/80 border border-white/10 rounded-2xl px-5 py-3.5 text-xs text-white placeholder:text-slate-600 focus:border-teal-500/50 outline-none transition-all"
                                                onKeyDown={e => e.key === 'Enter' && handleAIGenerate()}
                                            />
                                        </div>
                                        <Button
                                            onClick={handleAIGenerate}
                                            disabled={generating || !aiPrompt.trim()}
                                            className="h-auto bg-teal-600 hover:bg-teal-500 text-white text-xs font-black uppercase tracking-widest px-5 rounded-2xl shrink-0 shadow-xl shadow-teal-600/20"
                                        >
                                            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Write with AI'}
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>

                            <div className="grid grid-cols-1 gap-6">
                                {providerOptions.some((p) => p.connected) && (
                                    <EmailProviderSelector
                                        value={deliveryProvider}
                                        onChange={setDeliveryProvider}
                                        providers={providerOptions}
                                        compact
                                    />
                                )}

                                {/* FROM: SENDER */}
                                <div>
                                    <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block mb-3 px-1">Sender Address</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-white/5 rounded-lg group-focus-within:bg-teal-500/10 transition-colors">
                                            <User className="w-3.5 h-3.5 text-slate-500 group-focus-within:text-teal-400" />
                                        </div>
                                        <input
                                            type="text"
                                            value={from}
                                            onChange={e => setFrom(e.target.value)}
                                            placeholder="sender@yourdomain.com"
                                            className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-12 py-4 text-sm text-white focus:border-teal-500/40 outline-none transition-all shadow-inner placeholder:text-slate-700"
                                        />
                                    </div>
                                    <p className="mt-2 px-1 text-xs text-slate-500 font-mono uppercase tracking-wider">
                                        Sending via {selectedProvider?.name || 'workspace provider'} as {from || 'your connected address'}.
                                    </p>
                                </div>

                                {/* TO: RECIPIENT */}
                                <div className="relative" ref={dropdownRef}>
                                    <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block mb-3 px-1">Recipients</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-white/5 rounded-lg group-focus-within:bg-teal-500/10 transition-colors">
                                            <User className="w-3.5 h-3.5 text-slate-500 group-focus-within:text-teal-400" />
                                        </div>
                                        <input
                                            type="text"
                                            value={to}
                                            onChange={e => {
                                                setTo(e.target.value);
                                                setSearchQuery(e.target.value);
                                                setShowContactDropdown(true);
                                            }}
                                            onFocus={() => setShowContactDropdown(true)}
                                            placeholder="Add one or more emails, separated by commas..."
                                            className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-12 py-4 text-sm text-white focus:border-teal-500/40 outline-none transition-all shadow-inner placeholder:text-slate-700"
                                        />
                                        <button 
                                            onClick={() => setShowCcBcc(!showCcBcc)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500 hover:text-teal-400 transition-colors"
                                        >
                                            {showCcBcc ? 'HIDE CC' : 'CC/BCC'}
                                        </button>
                                    </div>

                                    {/* CC / BCC FIELDS */}
                                    <AnimatePresence>
                                        {showCcBcc && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="grid grid-cols-2 gap-4 overflow-hidden mt-4"
                                            >
                                                <div>
                                                    <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block mb-2 px-1">CC</label>
                                                    <input
                                                        type="text"
                                                        value={cc}
                                                        onChange={e => setCc(e.target.value)}
                                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:border-teal-500/40 outline-none transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block mb-2 px-1">BCC</label>
                                                    <input
                                                        type="text"
                                                        value={bcc}
                                                        onChange={e => setBcc(e.target.value)}
                                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:border-teal-500/40 outline-none transition-all"
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    
                                    <AnimatePresence>
                                        {showContactDropdown && (searchQuery.length > 0 || filteredClients.length > 0) && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                                                className="absolute left-0 right-0 top-full mt-3 bg-slate-900 border border-white/10 rounded-3xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.8)] z-[130] max-h-72 overflow-y-auto p-2 backdrop-blur-2xl"
                                            >
                                                <div className="px-3 py-2 border-b border-white/5 mb-2 flex items-center justify-between">
                                                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Matched Contacts</span>
                                                    <span className="text-xs font-mono text-teal-400">{filteredClients.length} found</span>
                                                </div>
                                                {filteredClients.length > 0 ? (
                                                    filteredClients.map(client => (
                                                        <button
                                                            key={client.id}
                                                            onClick={() => {
                                                                setTo(client.email);
                                                                setShowContactDropdown(false);
                                                            }}
                                                            className="w-full text-left p-3.5 rounded-2xl hover:bg-white/5 transition-all group flex items-center justify-between border border-transparent hover:border-white/5 mb-1"
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner">
                                                                    <span className="text-xs font-black text-teal-400">{client.name?.charAt(0)}</span>
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{client.name}</p>
                                                                    <p className="text-xs text-slate-500 font-mono">{client.email}</p>
                                                                </div>
                                                            </div>
                                                            {to === client.email && (
                                                                <div className="w-6 h-6 rounded-full bg-teal-500/20 flex items-center justify-center border border-teal-500/30">
                                                                    <Check className="w-3.5 h-3.5 text-teal-400" />
                                                                </div>
                                                            )}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="p-8 text-center">
                                                        <Search className="w-8 h-8 mx-auto mb-3 text-slate-700 opacity-20" />
                                                        <p className="text-xs font-black uppercase tracking-widest text-slate-600">No contact matching "{searchQuery}"</p>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {allRecipients.length > 0 && (
                                        <div className="mt-3 rounded-xl border border-white/5 bg-slate-950/40 p-3 space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Recipient Review</p>
                                                <p className="text-[11px] text-teal-300 font-semibold">
                                                    {toRecipients.length} to / {ccRecipients.length} cc / {bccRecipients.length} bcc
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {allRecipients.map((recipient) => (
                                                    <span
                                                        key={recipient}
                                                        className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300"
                                                    >
                                                        {recipient}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {toRecipients.length === 1 && to.includes('@') && (
                                        <div className="mt-3">
                                            <EmailLeadInsightPanel from={toRecipients[0]} subject={subject} compact />
                                        </div>
                                    )}
                                </div>

                                {matchedClient && (
                                    <ClientEmailContextPicker
                                        tenantId={currentTenant?.id}
                                        clientId={matchedClient.id}
                                        email={matchedClient.email}
                                        onInsert={(text) => setBody((prev) => `${prev}${text}`)}
                                    />
                                )}

                                {/* SUBJECT */}
                                <div>
                                    <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block mb-3 px-1">Subject</label>
                                    <input
                                        type="text"
                                        value={subject}
                                        onChange={e => setSubject(e.target.value)}
                                        placeholder="Identification handle..."
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-teal-500/40 outline-none transition-all shadow-inner placeholder:text-slate-700"
                                    />
                                </div>

                                {/* MESSAGE BODY */}
                                <div>
                                    <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block mb-3 px-1">Message Body</label>
                                    <div className="relative">
                                        <textarea
                                            value={body}
                                            onChange={e => setBody(e.target.value)}
                                            placeholder="Begin data transmission..."
                                            className="w-full bg-slate-950/50 border border-white/10 rounded-[2rem] px-6 py-6 text-sm text-white focus:border-teal-500/40 outline-none transition-all min-h-[200px] resize-none shadow-inner placeholder:text-slate-700 font-medium leading-relaxed custom-scrollbar"
                                        />
                                        <div className="absolute bottom-4 right-4 text-xs font-mono text-slate-600 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5">
                                            SYNS: {body.length} CHARS
                                        </div>
                                    </div>
                                </div>

                                {/* ATTACHMENTS */}
                                <div>
                                    <div className="flex items-center justify-between mb-3 px-1">
                                        <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em]">Payload Attachments</label>
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading}
                                            className="text-xs font-black text-teal-400 uppercase tracking-widest flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                                        >
                                            {uploading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}
                                            {uploading ? 'Uploading...' : 'Attach File'}
                                        </button>
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            onChange={handleFileUpload}
                                        />
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-2">
                                        {attachments.map(att => (
                                            <div 
                                                key={att.id}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-300 group/att hover:border-teal-500/30 transition-all"
                                            >
                                                <span className="truncate max-w-[150px]">{att.name}</span>
                                                <button 
                                                    onClick={() => removeAttachment(att.id)}
                                                    className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover/att:opacity-100 transition-all"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                        {attachments.length === 0 && (
                                            <div className="w-full py-4 border border-dashed border-white/5 rounded-2xl flex items-center justify-center">
                                                <p className="text-xs text-slate-700 font-black uppercase tracking-widest">No local files attached</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-8 border-t border-white/5 bg-white/2 flex items-center justify-between gap-4 flex-wrap">
                            <div className="text-xs font-black text-slate-600 uppercase tracking-[0.2em]">
                                {autoSaveStatus === 'saving' && 'Saving draft…'}
                                {autoSaveStatus === 'saved' && 'Draft saved locally'}
                                {autoSaveStatus === 'idle' && 'Encrypted Transmission Status: READY'}
                            </div>
                            <div className="hidden sm:block max-w-[320px]">
                                <AIOutputDisclaimer type="email" />
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <button
                                    onClick={onClose}
                                    className="flex-1 sm:flex-none px-6 py-3.5 text-slate-400 hover:text-white font-black text-xs uppercase tracking-widest transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveDraft}
                                    disabled={savingDraft || !body.trim()}
                                    className="flex-1 sm:flex-none px-6 py-3.5 rounded-2xl border border-white/10 text-slate-300 hover:text-white font-black text-xs uppercase tracking-widest transition-all disabled:opacity-40"
                                >
                                    {savingDraft ? 'Saving…' : 'Save Draft'}
                                </button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleSend}
                                    disabled={sending}
                                    className="flex-1 sm:flex-none bg-teal-600 hover:bg-teal-500 text-white px-10 py-3.5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl shadow-teal-900/10 disabled:opacity-50 disabled:grayscale"
                                >
                                    {sending ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 stroke-[2.5px]" />}
                                    {sending ? 'Sending...' : 'Send Now'}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div >
                </div >
            )}
        </AnimatePresence>
    );
};

export default ComposeEmailModal;
