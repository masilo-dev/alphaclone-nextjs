'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, Wand2, Check, ChevronDown, Plus, Users, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../../ui/UIComponents';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { businessClientService } from '../../../services/businessClientService';
import { integrationsService, IntegrationConfig } from '../../../services/integrationsService';
import { useTenant } from '../../../contexts/TenantContext';
import { ClientEmailContextPicker } from '../common/ClientEmailContextPicker';
import { isValidEmail } from '@/lib/email/isValidEmail';
import DeliveryProviderIndicator from '@/components/shared/DeliveryProviderIndicator';
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

export type ContactOption = {
    id: string;
    name: string;
    email: string;
    source: 'client' | 'lead' | 'contact';
};

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
    /** Gmail-style composer docked inside the active workspace instead of a page takeover. */
    presentation?: 'modal' | 'dock';
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
    presentation = 'modal',
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
    const [selectedLength, setSelectedLength] = useState<'short' | 'medium' | 'long'>('short');
    const [from, setFrom] = useState('');
    const [clients, setClients] = useState<any[]>([]);
    const [allContacts, setAllContacts] = useState<ContactOption[]>([]);
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
            // Load business_clients, leads, and CRM contacts for the contact picker
            Promise.all([
                businessClientService.getClients(currentTenant.id),
                supabase.from('leads').select('id, business_name, contact_name, email').eq('tenant_id', currentTenant.id).limit(200),
                supabase.from('contacts').select('id, first_name, last_name, email').eq('tenant_id', currentTenant.id).is('deleted_at', null).limit(200),
            ]).then(([{ clients: fetchedClients }, leadsRes, contactsRes]) => {
                setClients(fetchedClients || []);

                const list: ContactOption[] = [];
                const seen = new Set<string>();

                const push = (item: ContactOption) => {
                    const em = item.email.trim().toLowerCase();
                    if (!em.includes('@') || seen.has(em)) return;
                    seen.add(em);
                    list.push({ ...item, email: em });
                };

                for (const c of fetchedClients || []) {
                    if (c.email) push({ id: c.id, name: c.name || 'Client', email: c.email, source: 'client' });
                }
                for (const l of leadsRes.data || []) {
                    const em = String(l.email || (Array.isArray(l.emails) ? l.emails[0] : '') || '').trim();
                    if (em) push({ id: l.id, name: l.contact_name || l.business_name || 'Lead', email: em, source: 'lead' });
                }
                for (const cnt of contactsRes.data || []) {
                    const em = String(cnt.email || (Array.isArray(cnt.emails) ? cnt.emails[0] : '') || '').trim();
                    const fn = [cnt.first_name, cnt.last_name].filter(Boolean).join(' ') || 'Contact';
                    if (em) push({ id: cnt.id, name: fn, email: em, source: 'contact' });
                }

                setAllContacts(list);
            }).catch(() => {});

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

    const filteredContacts = React.useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return allContacts;
        return allContacts.filter(
            (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
        );
    }, [allContacts, searchQuery]);

    const toggleRecipientContact = (email: string) => {
        const existing = parseRecipientList(to);
        const lower = email.toLowerCase();
        if (existing.some(e => e.toLowerCase() === lower)) {
            setTo(existing.filter(e => e.toLowerCase() !== lower).join(', '));
        } else {
            setTo(existing.length > 0 ? `${existing.join(', ')}, ${email}` : email);
        }
    };

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

    const LENGTH_OPTIONS: Array<{ id: typeof selectedLength; label: string; minWords: number; targetWords: number }> = [
        { id: 'short',  label: 'Short (≥100 words)',  minWords: 100, targetWords: 130 },
        { id: 'medium', label: 'Medium (≥200 words)', minWords: 200, targetWords: 240 },
        { id: 'long',   label: 'Long (≥350 words)',   minWords: 350, targetWords: 420 },
    ];

    const currentLengthCfg = LENGTH_OPTIONS.find(opt => opt.id === selectedLength) || LENGTH_OPTIONS[0];

    const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

    const padBodyToWordMinimum = (text: string, minWords: number): string => {
        if (!text) return text;
        const base = text.trim();
        const initialCount = wordCount(base);
        if (initialCount >= minWords) return base;
        const needed = minWords - initialCount;
        const expansionSentences = [
            'I have found that being clear and specific up front saves everyone time down the line.',
            'If you need any additional materials, data points, or supporting documents to help evaluate this, I can put those together quickly.',
            'We have seen this pattern work well for teams in similar situations, and the feedback has been consistently positive.',
            'It is less about adding volume and more about making sure the full picture is easy to follow the first time through.',
            'You should feel free to reply with the one next step that makes sense on your end, and we can go from there.',
            'If a quick 15-minute conversation would be easier than email, I am happy to slot that in at a time that works for you.',
            'Nothing here is urgent, but a short response in the next couple of days would help keep momentum going in the right direction.',
            'I would rather explain one extra detail now than have a detail unclear later when it matters.',
            'You can expect follow-up to stay focused — once we agree on the shape of the next step, we will not keep circling back unnecessarily.',
            'If anything I wrote sounds off for how you usually work, let me know and we will adjust accordingly.',
        ];
        let expanded = base;
        let idx = 0;
        while (wordCount(expanded) < minWords && idx < expansionSentences.length * 3) {
            const s = expansionSentences[idx % expansionSentences.length];
            expanded = /[.!?]["']?$/.test(expanded)
                ? `${expanded} ${s}`
                : `${expanded}. ${s}`;
            idx += 1;
        }
        const trimmed = expanded.trim();
        return /[.!?]["']?$/.test(trimmed) ? trimmed : `${trimmed}.`;
    };

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
            const { minWords, targetWords, label } = currentLengthCfg;
            const promptWithContext =
                `Write a ${selectedTone} email based on these instructions: "${aiPrompt}".
                Recipient context: ${to ? `Writing to ${to}` : 'General business contact'}.
                STRICT LENGTH RULE: The email body MUST contain NO LESS THAN ${minWords} actual words. Target length is ${targetWords} words. Short, one-line emails are rejected.
                Length filter guidance: write enough full sentences so that the final body counts at least ${minWords} words, ideally ${targetWords} (${label}).
                Return your response as a JSON object with 'subject' and 'body' fields.
                Style: ${selectedTone}.
                Be professional, warm, and thorough. If the user's instruction was short, expand naturally into a full message that gives context, explains the why, outlines the offer or ask, and proposes the next step.
                Do not invent greetings, openings, or sign-offs unless the user instructions ask for them. Don't add any other text outside the JSON.
                DO NOT deliver a body that is under ${minWords} words.`;

            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: promptWithContext,
                    systemPrompt: `You are an expert business email assistant. You respond only with valid JSON. Never auto-add greetings like Hello/Hi/Dear unless explicitly requested. HARD RULE: The "body" field must contain AT LEAST ${minWords} natural English words, preferably ${targetWords}. Never produce an email shorter than that — it will be thrown away by our length filter. Prefer longer, fuller messages that actually explain the context and the next step.`
                })
            });

            if (!res.ok) throw new Error('AI generation failed');
            const data = await res.json();

            try {
                const cleanedText = data.text.replace(/```json|```/g, '').trim();
                const parsed = JSON.parse(cleanedText);
                setSubject(parsed.subject || '');
                const rawBody = String(parsed.body || '');
                const padded = padBodyToWordMinimum(rawBody, minWords);
                setBody(padded);
                const actualWords = wordCount(padded);
                toast.success(`Draft generated! ${actualWords} words (≥${minWords})`);
            } catch (parseError) {
                const rawBody = String(data.text || '');
                const padded = padBodyToWordMinimum(rawBody, minWords);
                setBody(padded);
                const actualWords = wordCount(padded);
                toast.success(`Draft ready (body only, ${actualWords} words ≥${minWords})`);
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
                <div className={presentation === 'dock'
                    ? 'fixed inset-0 z-[200] pointer-events-none flex items-end justify-end p-2 md:p-4'
                    : 'fixed inset-0 z-[200] flex items-center justify-center p-4'}>
                    {presentation === 'modal' ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="absolute inset-0 bg-slate-950/90 backdrop-blur-md pointer-events-auto"
                        />
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs pointer-events-auto"
                        />
                    )}

                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 12 }}
                        className={`relative w-full bg-slate-950 border border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col z-[210] ${
                            presentation === 'dock'
                                ? 'pointer-events-auto max-w-[560px] max-h-[calc(100%-0.5rem)] rounded-xl'
                                : 'max-w-xl max-h-[min(82vh,640px)] rounded-2xl'
                        }`}
                    >
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shrink-0">
                                    <Send className="w-4 h-4 text-teal-400" />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-sm font-bold text-white truncate">Compose Email</h2>
                                    <p className="text-[10px] text-slate-500 truncate">{selectedProvider?.name || 'Workspace provider'}</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

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
                                        <div className="flex flex-wrap items-center justify-between gap-2">
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
                                            <p className="text-[10px] uppercase tracking-widest text-slate-500">Length filter</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {LENGTH_OPTIONS.map(opt => {
                                                    const active = selectedLength === opt.id;
                                                    return (
                                                        <button
                                                            key={opt.id}
                                                            type="button"
                                                            onClick={() => setSelectedLength(opt.id)}
                                                            className={[
                                                                'px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border',
                                                                active
                                                                    ? 'bg-violet-500 text-white border-violet-400 shadow-[0_0_0_1px_rgba(139,92,246,0.25)]'
                                                                    : 'bg-slate-950/50 text-slate-500 border-white/5 hover:border-white/10',
                                                            ].join(' ')}
                                                            title={`Minimum ${opt.minWords} words`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                value={aiPrompt}
                                                onChange={e => setAiPrompt(e.target.value)}
                                                placeholder="What should AI write? (no auto greeting)"
                                                className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-teal-500/50 outline-none"
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
                                        <p className="text-[10px] text-slate-500">
                                            <span className="font-semibold text-violet-300">Rule:</span> AI emails always expand to at least{' '}
                                            <span className="font-bold text-white">{currentLengthCfg.minWords} words</span>.
                                            Short messages get ignored — a padded natural tone is applied automatically if needed.
                                        </p>
                                    </div>
                                ) : null}
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {providerOptions.some((p) => p.connected) && (
                                    <DeliveryProviderIndicator
                                        value={deliveryProvider}
                                        onChange={setDeliveryProvider}
                                        providers={providerOptions}
                                    />
                                )}

                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1.5">From</label>
                                    <input
                                        type="text"
                                        value={from}
                                        onChange={e => setFrom(e.target.value)}
                                        placeholder="sender@yourdomain.com"
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-teal-500/40 outline-none"
                                    />
                                </div>

                                <div className="relative" ref={dropdownRef}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">To</label>
                                        <button
                                            type="button"
                                            onClick={() => setShowContactDropdown((prev) => !prev)}
                                            className="text-[10px] font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1 bg-teal-500/10 hover:bg-teal-500/20 px-2 py-0.5 rounded-full transition-all"
                                        >
                                            <Users className="w-3 h-3" />
                                            Select from contacts ({allContacts.length})
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={to}
                                            onChange={e => {
                                                setTo(e.target.value);
                                                setSearchQuery(e.target.value);
                                                setShowContactDropdown(true);
                                            }}
                                            onFocus={() => setShowContactDropdown(true)}
                                            placeholder="Type email or click Select from contacts…"
                                            className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-3 py-2.5 pr-16 text-sm text-white focus:border-teal-500/40 outline-none"
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowCcBcc(!showCcBcc)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 hover:text-teal-400"
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
                                                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1">CC</label>
                                                    <input
                                                        type="text"
                                                        value={cc}
                                                        onChange={e => setCc(e.target.value)}
                                                        className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-teal-500/40 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1">BCC</label>
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
                                        {showContactDropdown && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -6 }}
                                                className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-[130] max-h-56 overflow-y-auto p-1.5 space-y-0.5"
                                            >
                                                <div className="p-1.5 border-b border-white/5 flex items-center justify-between">
                                                    <p className="text-[10px] font-bold uppercase text-slate-400">Pick recipients ({filteredContacts.length})</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowContactDropdown(false)}
                                                        className="text-[10px] text-slate-500 hover:text-white"
                                                    >
                                                        Close ✕
                                                    </button>
                                                </div>
                                                {filteredContacts.length > 0 ? (
                                                    filteredContacts.slice(0, 15).map(c => {
                                                        const isSelected = toRecipients.some(tr => tr.toLowerCase() === c.email.toLowerCase());
                                                        return (
                                                            <button
                                                                key={`${c.source}-${c.id}`}
                                                                type="button"
                                                                onClick={() => toggleRecipientContact(c.email)}
                                                                className={`w-full text-left p-2 rounded-lg transition-all flex items-center justify-between ${
                                                                    isSelected ? 'bg-teal-500/15 border border-teal-500/30' : 'hover:bg-white/5 border border-transparent'
                                                                }`}
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-xs font-semibold text-white truncate">{c.name}</span>
                                                                        <span className="text-[9px] font-bold uppercase px-1 py-0.2 rounded bg-white/10 text-slate-400">
                                                                            {c.source}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[11px] text-slate-400 truncate">{c.email}</p>
                                                                </div>
                                                                {isSelected && <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />}
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <p className="p-3 text-center text-xs text-slate-500">No contacts or leads found</p>
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
                                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1.5">Subject</label>
                                    <input
                                        type="text"
                                        value={subject}
                                        onChange={e => setSubject(e.target.value)}
                                        placeholder="Subject"
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-teal-500/40 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-1.5">Message</label>
                                    <div className="rounded-xl border border-white/10 overflow-hidden bg-slate-950/50 [&_.ql-toolbar]:border-white/10 [&_.ql-toolbar]:bg-slate-900/80 [&_.ql-container]:border-white/10 [&_.ql-editor]:min-h-[180px] [&_.ql-editor]:max-h-[320px] [&_.ql-editor]:text-sm [&_.ql-editor]:text-white [&_.ql-stroke]:stroke-slate-400 [&_.ql-picker]:text-slate-300">
                                        <ReactQuill
                                            theme="snow"
                                            value={body}
                                            onChange={setBody}
                                            modules={COMPOSE_QUILL_MODULES}
                                            placeholder="Type your message…"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between mt-1.5 px-1">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                                            <span className="font-bold text-slate-300 tabular-nums">{wordCount(String(body || ''))}</span> words
                                        </p>
                                        <div className="flex items-center gap-1.5 text-[10px]">
                                            {wordCount(String(body || '')) >= currentLengthCfg.minWords ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5">
                                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                                    ≥{currentLengthCfg.minWords} words met
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5">
                                                    <AlertTriangle className="w-2.5 h-2.5" />
                                                    {currentLengthCfg.minWords - wordCount(String(body || ''))} more to reach ≥{currentLengthCfg.minWords}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Attachments</label>
                                        <button 
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading}
                                            className="text-[10px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1"
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
                                                className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-300"
                                            >
                                                <span className="truncate max-w-[120px]">{att.name}</span>
                                                <button type="button" onClick={() => removeAttachment(att.id)} className="text-slate-500 hover:text-red-400">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between gap-2 shrink-0">
                            <p className="text-[10px] text-slate-600 truncate">
                                {autoSaveStatus === 'saving' && 'Saving…'}
                                {autoSaveStatus === 'saved' && 'Draft saved'}
                                {autoSaveStatus === 'idle' && 'Ready'}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-3 py-2 text-slate-400 hover:text-white text-xs font-bold"
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
                                    className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50"
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
