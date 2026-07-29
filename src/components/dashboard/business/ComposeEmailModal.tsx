'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, Wand2, Check, ChevronDown, Plus } from 'lucide-react';
import { Button } from '../../ui/UIComponents';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { businessClientService } from '../../../services/businessClientService';
import { integrationsService, IntegrationConfig } from '../../../services/integrationsService';
import { useTenant } from '../../../contexts/TenantContext';
import { ClientEmailContextPicker } from '../common/ClientEmailContextPicker';
import { isValidEmail } from '@/lib/email/isValidEmail';
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

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
import 'react-quill-new/dist/quill.snow.css';

const COMPOSE_QUILL_MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};

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
    const [showAiAssist, setShowAiAssist] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [generating, setGenerating] = useState(false);
    const [selectedTone, setSelectedTone] = useState('professional');
    const [from, setFrom] = useState('');
    const [clients, setClients] = useState<any[]>([]);
    const [availableProviders, setAvailableProviders] = useState<IntegrationConfig[]>([]);
<<<<<<< HEAD
    const [deliveryProvider, setDeliveryProvider] = useState<DeliveryEmailProvider>('auto');
    const [workspaceDefault, setWorkspaceDefault] = useState<DeliveryEmailProvider>('auto');
    const [providerOptions, setProviderOptions] = useState<
        Array<{ id: DeliveryEmailProvider; label: string; connected: boolean; native?: boolean; campaigns?: boolean }>
    >([]);
=======
>>>>>>> origin/main
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
            setShowAiAssist(false);
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

<<<<<<< HEAD
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
=======
            // Fetch available email integrations
            integrationsService.getUserIntegrations(userId).then(({ integrations }) => {
                const emailTypes = ['gmail', 'sendgrid', 'resend', 'brevo', 'zoho'];
                const filtered = integrations.filter(i => i.enabled && emailTypes.includes(i.type));
                setAvailableProviders(filtered);
                
                // Set default provider (prefer Zoho, then Brevo, then Resend, then SendGrid, then Gmail, otherwise first one)
                const zoho = filtered.find(p => p.type === 'zoho');
                const brevo = filtered.find(p => p.type === 'brevo');
                const resend = filtered.find(p => p.type === 'resend');
                const sendgrid = filtered.find(p => p.type === 'sendgrid');
                const gmail = filtered.find(p => p.type === 'gmail');
                setSelectedProvider(zoho || brevo || resend || sendgrid || gmail || filtered[0] || null);
>>>>>>> origin/main
            });

            // Fetch user's email for the fallback From field
            const fetchUser = async () => {
                const { data } = await supabase.auth.getUser();
                if (data?.user?.email) setFrom(data.user.email);
            };
            fetchUser();
        }
<<<<<<< HEAD
    }, [isOpen, currentTenant?.id, userId, preferredProvider]);
=======
    }, [isOpen, currentTenant?.id, userId]);
>>>>>>> origin/main

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
<<<<<<< HEAD

    React.useEffect(() => {
        if (deliveryProvider === 'auto') return;
        const match = availableProviders.find((p) => p.type === deliveryProvider);
        if (match) setSelectedProvider(match);
    }, [deliveryProvider, availableProviders]);
=======
>>>>>>> origin/main

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
                    Be professional and concise. Do not invent greetings, openings, or sign-offs unless the user instructions ask for them. Don't add any other text outside the JSON.`,
                    systemPrompt: "You are an expert business email assistant. You respond only with valid JSON. Never auto-add greetings like Hello/Hi/Dear unless explicitly requested."
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
<<<<<<< HEAD
            const connectedIds = providerOptions.filter((p) => p.connected).map((p) => p.id);
            const resolvedType =
                deliveryProvider === 'auto'
                    ? resolveAutoProvider(connectedIds, workspaceDefault)
                    : deliveryProvider;
            const sendProvider = resolvedType === 'auto' ? selectedProvider?.type : resolvedType;
=======
            // Use unified email sending API
            const res = await fetch('/api/email/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to,
                    cc: cc || undefined,
                    bcc: bcc || undefined,
                    subject,
                    text: body,
                    tenantId: currentTenant?.id,
                    userId: userId,
                    from: from || undefined,
                    provider: selectedProvider?.type || 'gmail',
                    attachments: attachments.length > 0 ? attachments.map(att => ({
                        filename: att.name,
                        data: att.data,
                        mimeType: getMimeType(att.name),
                    })) : undefined,
                })
            });
>>>>>>> origin/main

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

<<<<<<< HEAD
            toast.success(
                `${allRecipients.length === 1 ? 'Email' : `${allRecipients.length} emails`} sent via ${String(sendProvider || selectedProvider?.type || 'platform').toUpperCase()}`
            );
            if (currentTenant?.id) clearLocalComposeDraft(currentTenant.id, userId);
=======
            toast.success(`Email sent via ${selectedProvider?.name || 'Provider'}`);
>>>>>>> origin/main
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
                        initial={{ opacity: 0, scale: 0.98, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 12 }}
                        className="relative w-full max-w-xl max-h-[min(82vh,640px)] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-[120]"
                    >
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shrink-0">
                                    <Send className="w-4 h-4 text-teal-400" />
                                </div>
<<<<<<< HEAD
                                <div className="min-w-0">
                                    <h2 className="text-sm font-bold text-white truncate">Compose Email</h2>
                                    <p className="text-[10px] text-slate-500 truncate">{selectedProvider?.name || 'Workspace provider'}</p>
=======
                                <div>
                                    <h2 className="text-base font-black text-white uppercase tracking-tight">Compose Email</h2>
                                    <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">{selectedProvider?.name || 'Unified'} · AI Assistant</p>
>>>>>>> origin/main
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

<<<<<<< HEAD
                        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3 custom-scrollbar">
                            <div className="rounded-xl border border-white/10 bg-slate-950/40 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowAiAssist((v) => !v)}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
                                >
                                    <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-teal-400">
                                        <Wand2 className="w-3.5 h-3.5" /> Write with AI (optional)
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showAiAssist ? 'rotate-180' : ''}`} />
                                </button>
                                {showAiAssist ? (
                                    <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
                                        <div className="flex flex-wrap gap-1.5">
                                            {TONES.map(tone => (
                                                <button
                                                    key={tone.id}
                                                    type="button"
                                                    onClick={() => setSelectedTone(tone.id)}
                                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${selectedTone === tone.id
                                                        ? 'bg-teal-500 text-white border-teal-400'
                                                        : 'bg-slate-950/50 text-slate-500 border-white/5 hover:border-white/10'
                                                        }`}
                                                >
                                                    {tone.label}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                value={aiPrompt}
                                                onChange={e => setAiPrompt(e.target.value)}
                                                placeholder="What should AI write? (no auto greeting)"
                                                className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-teal-500/50 outline-none"
=======
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
>>>>>>> origin/main
                                                onKeyDown={e => e.key === 'Enter' && handleAIGenerate()}
                                            />
                                            <Button
                                                onClick={handleAIGenerate}
                                                disabled={generating || !aiPrompt.trim()}
                                                className="h-auto bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 rounded-xl shrink-0"
                                            >
                                                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Write'}
                                            </Button>
                                        </div>
<<<<<<< HEAD
=======
                                        <Button
                                            onClick={handleAIGenerate}
                                            disabled={generating || !aiPrompt.trim()}
                                            className="h-auto bg-teal-600 hover:bg-teal-500 text-white text-xs font-black uppercase tracking-widest px-5 rounded-2xl shrink-0 shadow-xl shadow-teal-600/20"
                                        >
                                            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Write with AI'}
                                        </Button>
>>>>>>> origin/main
                                    </div>
                                ) : null}
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {providerOptions.some((p) => p.connected) && (
                                    <EmailProviderSelector
                                        value={deliveryProvider}
                                        onChange={setDeliveryProvider}
                                        providers={providerOptions}
                                        compact
                                    />
                                )}

<<<<<<< HEAD
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1.5">From</label>
                                    <input
                                        type="text"
                                        value={from}
                                        onChange={e => setFrom(e.target.value)}
                                        placeholder="sender@yourdomain.com"
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-teal-500/40 outline-none"
                                    />
=======
                            <div className="grid grid-cols-1 gap-6">
                                {/* PROVIDER SELECTION */}
                                {availableProviders.length > 0 && (
                                    <div>
                                        <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block mb-3 px-1">Email Provider</label>
                                        <div className="flex flex-wrap gap-2">
                                            {availableProviders.map(provider => (
                                                <button
                                                    key={provider.id}
                                                    onClick={() => setSelectedProvider(provider)}
                                                    className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border ${selectedProvider?.id === provider.id
                                                        ? 'bg-teal-600 text-white border-teal-500 shadow-lg shadow-teal-500/20'
                                                        : 'bg-slate-950/50 text-slate-500 border-white/5 hover:border-white/10'
                                                        }`}
                                                >
                                                    {provider.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
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
                                    <p className="mt-2 px-1 text-xs text-slate-500 font-mono uppercase tracking-wider">Note: Ensure this address is verified with your selected provider.</p>
>>>>>>> origin/main
                                </div>

                                <div className="relative" ref={dropdownRef}>
<<<<<<< HEAD
                                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1.5">To</label>
                                    <div className="relative">
=======
                                    <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block mb-3 px-1">Recipient</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-white/5 rounded-lg group-focus-within:bg-teal-500/10 transition-colors">
                                            <User className="w-3.5 h-3.5 text-slate-500 group-focus-within:text-teal-400" />
                                        </div>
>>>>>>> origin/main
                                        <input
                                            type="text"
                                            value={to}
                                            onChange={e => {
                                                setTo(e.target.value);
                                                setSearchQuery(e.target.value);
                                                setShowContactDropdown(true);
                                            }}
                                            onFocus={() => setShowContactDropdown(true)}
                                            placeholder="email@client.com"
                                            className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-3 py-2.5 pr-16 text-sm text-white focus:border-teal-500/40 outline-none"
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowCcBcc(!showCcBcc)}
<<<<<<< HEAD
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 hover:text-teal-400"
=======
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500 hover:text-teal-400 transition-colors"
>>>>>>> origin/main
                                        >
                                            {showCcBcc ? 'HIDE' : 'CC/BCC'}
                                        </button>
                                    </div>

                                    <AnimatePresence>
                                        {showCcBcc && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="grid grid-cols-2 gap-2 overflow-hidden mt-2"
                                            >
                                                <div>
<<<<<<< HEAD
                                                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1">CC</label>
=======
                                                    <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block mb-2 px-1">CC</label>
>>>>>>> origin/main
                                                    <input
                                                        type="text"
                                                        value={cc}
                                                        onChange={e => setCc(e.target.value)}
                                                        className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-teal-500/40 outline-none"
                                                    />
                                                </div>
                                                <div>
<<<<<<< HEAD
                                                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1">BCC</label>
=======
                                                    <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block mb-2 px-1">BCC</label>
>>>>>>> origin/main
                                                    <input
                                                        type="text"
                                                        value={bcc}
                                                        onChange={e => setBcc(e.target.value)}
                                                        className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-teal-500/40 outline-none"
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    
                                    <AnimatePresence>
                                        {showContactDropdown && (searchQuery.length > 0 || filteredClients.length > 0) && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -6 }}
                                                className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-[130] max-h-44 overflow-y-auto p-1.5"
                                            >
<<<<<<< HEAD
=======
                                                <div className="px-3 py-2 border-b border-white/5 mb-2 flex items-center justify-between">
                                                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Matched Contacts</span>
                                                    <span className="text-xs font-mono text-teal-400">{filteredClients.length} found</span>
                                                </div>
>>>>>>> origin/main
                                                {filteredClients.length > 0 ? (
                                                    filteredClients.slice(0, 8).map(client => (
                                                        <button
                                                            key={client.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setTo(client.email);
                                                                setShowContactDropdown(false);
                                                            }}
                                                            className="w-full text-left p-2.5 rounded-lg hover:bg-white/5 transition-all flex items-center justify-between"
                                                        >
<<<<<<< HEAD
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium text-slate-200 truncate">{client.name}</p>
                                                                <p className="text-xs text-slate-500 truncate">{client.email}</p>
=======
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-inner">
                                                                    <span className="text-xs font-black text-teal-400">{client.name?.charAt(0)}</span>
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{client.name}</p>
                                                                    <p className="text-xs text-slate-500 font-mono">{client.email}</p>
                                                                </div>
>>>>>>> origin/main
                                                            </div>
                                                            {to === client.email && <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />}
                                                        </button>
                                                    ))
                                                ) : (
<<<<<<< HEAD
                                                    <p className="p-3 text-center text-xs text-slate-600">No matches</p>
=======
                                                    <div className="p-8 text-center">
                                                        <Search className="w-8 h-8 mx-auto mb-3 text-slate-700 opacity-20" />
                                                        <p className="text-xs font-black uppercase tracking-widest text-slate-600">No contact matching "{searchQuery}"</p>
                                                    </div>
>>>>>>> origin/main
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {matchedClient && (
                                    <ClientEmailContextPicker
                                        tenantId={currentTenant?.id}
                                        clientId={matchedClient.id}
                                        email={matchedClient.email}
                                        onInsert={(text) => setBody((prev) => `${prev}${text}`)}
                                    />
                                )}

                                <div>
<<<<<<< HEAD
                                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1.5">Subject</label>
=======
                                    <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block mb-3 px-1">Subject</label>
>>>>>>> origin/main
                                    <input
                                        type="text"
                                        value={subject}
                                        onChange={e => setSubject(e.target.value)}
                                        placeholder="Subject"
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-teal-500/40 outline-none"
                                    />
                                </div>

                                <div>
<<<<<<< HEAD
                                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1.5">Message</label>
                                    <div className="rounded-xl border border-white/10 overflow-hidden bg-slate-950/50 [&_.ql-toolbar]:border-white/10 [&_.ql-toolbar]:bg-slate-900/80 [&_.ql-container]:border-white/10 [&_.ql-editor]:min-h-[180px] [&_.ql-editor]:max-h-[320px] [&_.ql-editor]:text-sm [&_.ql-editor]:text-white [&_.ql-stroke]:stroke-slate-400 [&_.ql-picker]:text-slate-300">
                                        <ReactQuill
                                            theme="snow"
=======
                                    <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em] block mb-3 px-1">Message Body</label>
                                    <div className="relative">
                                        <textarea
>>>>>>> origin/main
                                            value={body}
                                            onChange={setBody}
                                            modules={COMPOSE_QUILL_MODULES}
                                            placeholder="Type your message…"
                                        />
<<<<<<< HEAD
=======
                                        <div className="absolute bottom-4 right-4 text-xs font-mono text-slate-600 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5">
                                            SYNS: {body.length} CHARS
                                        </div>
>>>>>>> origin/main
                                    </div>
                                </div>

                                <div>
<<<<<<< HEAD
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Attachments</label>
=======
                                    <div className="flex items-center justify-between mb-3 px-1">
                                        <label className="text-xs text-slate-500 uppercase font-black tracking-[0.2em]">Payload Attachments</label>
>>>>>>> origin/main
                                        <button 
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading}
<<<<<<< HEAD
                                            className="text-[10px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1"
=======
                                            className="text-xs font-black text-teal-400 uppercase tracking-widest flex items-center gap-1.5 hover:opacity-80 transition-opacity"
>>>>>>> origin/main
                                        >
                                            {uploading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />}
                                            {uploading ? 'Uploading…' : 'Attach'}
                                        </button>
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            onChange={handleFileUpload}
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {attachments.map(att => (
                                            <div 
                                                key={att.id}
<<<<<<< HEAD
                                                className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-300"
=======
                                                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-300 group/att hover:border-teal-500/30 transition-all"
>>>>>>> origin/main
                                            >
                                                <span className="truncate max-w-[120px]">{att.name}</span>
                                                <button type="button" onClick={() => removeAttachment(att.id)} className="text-slate-500 hover:text-red-400">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
<<<<<<< HEAD
=======
                                        {attachments.length === 0 && (
                                            <div className="w-full py-4 border border-dashed border-white/5 rounded-2xl flex items-center justify-center">
                                                <p className="text-xs text-slate-700 font-black uppercase tracking-widest">No local files attached</p>
                                            </div>
                                        )}
>>>>>>> origin/main
                                    </div>
                                </div>
                            </div>
                        </div>

<<<<<<< HEAD
                        <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between gap-2 shrink-0">
                            <p className="text-[10px] text-slate-600 truncate">
                                {autoSaveStatus === 'saving' && 'Saving…'}
                                {autoSaveStatus === 'saved' && 'Draft saved'}
                                {autoSaveStatus === 'idle' && 'Ready'}
                            </p>
                            <div className="flex items-center gap-2">
=======
                        {/* Footer */}
                        <div className="p-8 border-t border-white/5 bg-white/2 flex items-center justify-between">
                            <div className="text-xs font-black text-slate-600 uppercase tracking-[0.2em] hidden sm:block">
                                Encrypted Transmission Status: READY
                            </div>
                            <div className="flex items-center gap-4 w-full sm:w-auto">
>>>>>>> origin/main
                                <button
                                    type="button"
                                    onClick={onClose}
<<<<<<< HEAD
                                    className="px-3 py-2 text-slate-400 hover:text-white text-xs font-bold"
=======
                                    className="flex-1 sm:flex-none px-8 py-3.5 text-slate-400 hover:text-white font-black text-xs uppercase tracking-widest transition-all"
>>>>>>> origin/main
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveDraft}
                                    disabled={savingDraft || !body.trim()}
                                    className="px-3 py-2 rounded-xl border border-white/10 text-slate-300 text-xs font-bold disabled:opacity-40"
                                >
                                    {savingDraft ? 'Saving…' : 'Draft'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSend}
                                    disabled={sending}
<<<<<<< HEAD
                                    className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50"
=======
                                    className="flex-1 sm:flex-none bg-teal-600 hover:bg-teal-500 text-white px-10 py-3.5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl shadow-teal-900/10 disabled:opacity-50 disabled:grayscale"
>>>>>>> origin/main
                                >
                                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                    {sending ? 'Sending…' : 'Send'}
                                </button>
                            </div>
                        </div>
                    </motion.div >
                </div >
            )}
        </AnimatePresence>
    );
};

export default ComposeEmailModal;
<<<<<<< HEAD
=======


>>>>>>> origin/main
