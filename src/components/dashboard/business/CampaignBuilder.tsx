'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DOMPurify from 'dompurify';
import {
    Mail, Send, Clock, Users, Eye, Plus, Trash2, Play, Pause,
    ChevronDown, ChevronUp, ChevronRight, Sparkles, Tag, FileText, CheckCircle2, Loader2, Upload, Search,
    History, X, ArrowLeft, Check, Database, Inbox, AlertCircle, Repeat, Layers, Languages, MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { emailCampaignService, EmailCampaign, EmailTemplate, MarketingContact } from '../../../services/emailCampaignService';
import { tenantService } from '../../../services/tenancy/TenantService';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { CAMPAIGN_LANGUAGE_OPTIONS, getCampaignLanguageInstruction, type CampaignLanguageMode } from '@/lib/languageUtils';
import EmailCampaignAnalytics from '../marketing/EmailCampaignAnalytics';
import SegmentBuilder from '../marketing/SegmentBuilder';
import DeliverabilityPanel from '../marketing/DeliverabilityPanel';
import { showActionNextSteps } from '../../common/showActionNextSteps';
import { BonnieModulePageShell } from '../bonnie/BonnieModulePageShell';
import {
    DELIVERY_PROVIDER_LABELS,
    resolveAutoProvider,
    type DeliveryEmailProvider,
} from '@/lib/email/emailProviderOptions';

const statusColors: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    scheduled: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    queued: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    sending: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    sent: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    paused: 'bg-slate-600/10 text-slate-500 border-slate-600/20',
    cancelled: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

async function describeCampaignFailure(campaignId: string, fallback: string | null | undefined) {
    const diag = await emailCampaignService.diagnoseCampaign(campaignId);
    const message = [...diag.issues, ...diag.warnings, fallback].filter(Boolean).join(' ');
    return message || fallback || 'Failed to send campaign';
}

// Plain-language <-> HTML helpers so non-technical users never see markup in simple mode.
const plainFromHtml = (html: string): string => {
    if (!html) return '';
    return html
        .replace(/<\s*br\s*\/?\s*>/gi, '\n')
        .replace(/<\/\s*(p|div|h[1-6]|li)\s*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

const htmlFromPlain = (text: string): string => {
    if (!text || !text.trim()) return '';
    const escape = (s: string) => s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return text
        .trim()
        .split(/\n{2,}/)
        .map(block => `<p style="margin:0 0 16px;line-height:1.6;">${escape(block).replace(/\n/g, '<br />')}</p>`)
        .join('\n');
};

const PERSONALIZATION_BUTTONS = [
    { label: 'First name', tag: '{{firstName}}' },
    { label: 'Last name', tag: '{{lastName}}' },
    { label: 'Full name', tag: '{{name}}' },
    { label: 'Email', tag: '{{email}}' },
    { label: 'Company', tag: '{{company}}' },
    { label: 'Your name', tag: '{{fromName}}' },
];

const PRESET_TEMPLATES = [
    {
        id: 'newsletter',
        title: 'Monthly Product Newsletter',
        subject: '🚀 What we built for you this month',
        html: `<h2>Hey {{firstName}},</h2><p>Here is a quick look at what our product team delivered last month to speed up your operations...</p>`
    },
    {
        id: 'outreach',
        title: 'Lead Outreach Pitch',
        subject: 'Quick question about {{company}} growth',
        html: `<h2>Hello {{firstName}},</h2><p>I noticed {{company}} has been expanding lately. We help organizations scale their workspace automation...</p>`
    },
    {
        id: 'promo',
        title: 'Re-engagement Special',
        subject: '🎁 We want to welcome you back!',
        html: `<h2>Dear {{firstName}},</h2><p>We missed you! Here is a special 25% off coupon code to welcome you back into the family...</p>`
    },
    {
        id: 'plain',
        title: 'Plain Text Draft',
        subject: 'Quick follow up',
        html: `<p>Hi {{firstName}}, just following up on our previous conversation. Let me know when you are free to chat.</p>`
    }
];

const QUICK_STARTS = [
    {
        id: 'announcement',
        label: 'Share an update',
        prompt: 'Write a friendly announcement email for existing contacts.',
        subject: 'A quick update from AlphaClone',
        bodyHtml: `<h2>Hello {{firstName}},</h2><p>I wanted to share a quick update with you and keep things simple.</p><p>If you have any questions, reply to this email and we’ll help.</p>`,
    },
    {
        id: 'followup',
        label: 'Follow up leads',
        prompt: 'Write a short follow-up email for warm leads who already know us.',
        subject: 'Just checking in',
        bodyHtml: `<h2>Hi {{firstName}},</h2><p>Just checking in to see if this is still a good time to chat about how we can help {{company}}.</p><p>If not, no problem - just let me know.</p>`,
    },
    {
        id: 'reengage',
        label: 'Re-engage contacts',
        prompt: 'Write a warm re-engagement email for contacts who have not replied in a while.',
        subject: 'Still interested in improving your workflow?',
        bodyHtml: `<h2>Hello {{firstName}},</h2><p>It has been a little while, and I wanted to reach out with something useful.</p><p>If you are still exploring better ways to run your business, I would be happy to help.</p>`,
    },
] as const;

const PROVIDER_DELIVERY_NOTES: Partial<Record<DeliveryEmailProvider, string>> = {
    zoho: 'Zoho Mail sends directly from the connected mailbox. This is AlphaClone direct delivery, not the separate Zoho Campaigns hub.',
    brevo: 'Brevo uses the connected API key and sender identity. Verify sender/domain settings in Brevo if delivery fails.',
    resend: 'Resend is best for fast transactional-style delivery. Make sure the sender domain or from address is verified.',
    sendgrid: 'SendGrid uses the connected API key and sender profile. Check sender authentication if opens are low or mail is blocked.',
    gmail: 'Gmail is not supported for bulk email campaigns in the direct provider path. Use Zoho, Brevo, SendGrid, or Resend.',
    microsoft: 'Microsoft delivery is supported for inbox-style sends, not bulk email campaigns. Use Zoho, Brevo, SendGrid, or Resend.',
};

// Providers supported by the email campaign sender path (`sendScheduledCampaignServer` + `sendEmail`).
const CAMPAIGN_SUPPORTED_EMAIL_PROVIDERS: DeliveryEmailProvider[] = ['zoho', 'brevo', 'sendgrid', 'resend'];

type ConnectedCampaignProvider = {
    id: DeliveryEmailProvider;
    label: string;
    connected: boolean;
    native?: boolean;
    campaigns?: boolean;
};

type SenderProfileState = {
    fromName: string;
    fromEmail: string;
    signature: string;
    defaultProvider?: string;
};

type ComposeAudit = {
    issues: string[];
    warnings: string[];
    info: string[];
};

const CampaignBuilder: React.FC<{ userId: string }> = ({ userId }) => {
    const router = useRouter();
    const { isMobile } = useBreakpoint();
    
    // View state: 'list' is main feed list, 'detail' is single detail view, 'compose' is wizard flow
    const [viewMode, setViewMode] = useState<'list' | 'detail' | 'compose'>('list');
    const [campaignMode, setCampaignMode] = useState<'simple' | 'advanced'>('simple');
    
    const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [contacts, setContacts] = useState<MarketingContact[]>([]);
    const [contactSearch, setContactSearch] = useState('');
    const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
    const [activeStep, setActiveStep] = useState(1); // 1 to 4 compose flow
    const [aiGenerating, setAiGenerating] = useState(false);
    const [recipientType, setRecipientType] = useState<'all' | 'specific' | 'few' | 'import' | null>(null);

    // Selected single campaign for detail mode
    const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
    const [selectedCampaignRecipients, setSelectedCampaignRecipients] = useState<Awaited<ReturnType<typeof emailCampaignService.getCampaignRecipients>>['recipients']>([]);
    const [loadingSelectedRecipients, setLoadingSelectedRecipients] = useState(false);

    // Form state
    const [form, setForm] = useState({
        name: '',
        subject: '',
        bodyHtml: '',
        fromName: 'AlphaClone Systems',
        fromEmail: '',
        scheduledAt: '',
        scheduleEnabled: false,
        skipPreviouslyContacted: true,
        selectedProviders: [] as string[],
        deliveryChannel: 'email' as 'email' | 'whatsapp' | 'both',
        balanceByDailyLimit: true,
        sendImmediately: false,
        languageMode: 'auto' as CampaignLanguageMode,
        abTestEnabled: false,
        subjectB: '',
        abSplitPercent: 50,
    });

    const sanitizedBodyHtml = useMemo(() => {
        const html = String(form.bodyHtml || '').trim();
        if (!html) return '';
        return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    }, [form.bodyHtml]);

    // Touch Swipe list tracking
    const [swipeState, setSwipeState] = useState<Record<string, number>>({});
    const [swipeActiveId, setSwipeActiveId] = useState<string | null>(null);
    const touchStartX = useRef<number>(0);

    const [pasteLeadsText, setPasteLeadsText] = useState('');
    const [importingLeads, setImportingLeads] = useState(false);
    const [campaignGoal, setCampaignGoal] = useState('');
    
    // AI Copilot State
    const [showCopilot, setShowCopilot] = useState(true);
    const [copilotMessages, setCopilotMessages] = useState<Array<{ sender: 'user' | 'assistant', text: string, suggestion?: any }>>([
        { sender: 'assistant', text: 'Hi! I am your AI Campaign Copilot. Tell me who you want to target (e.g. "healthcare leads"), what you want to write, or paste your leads directly here. I will configure the entire campaign!' }
    ]);
    const [copilotInput, setCopilotInput] = useState('');
    const [copilotLoading, setCopilotLoading] = useState(false);
    
    // HTML visual vs code tab editor
    const [editorTab, setEditorTab] = useState<'preview' | 'code'>('preview');
    const [senderProfile, setSenderProfile] = useState<SenderProfileState | null>(null);
    const [connectedProviders, setConnectedProviders] = useState<ConnectedCampaignProvider[]>([]);
    const [workspaceDefaultProvider, setWorkspaceDefaultProvider] = useState<DeliveryEmailProvider>('auto');
    const [campaignsProviderNote, setCampaignsProviderNote] = useState('');
    const [providerStateLoading, setProviderStateLoading] = useState(true);
    const [auditLoading, setAuditLoading] = useState(false);
    const [composeAudit, setComposeAudit] = useState<ComposeAudit>({ issues: [], warnings: [], info: [] });
    const [testEmailAddress, setTestEmailAddress] = useState('');
    const [sendingTestEmail, setSendingTestEmail] = useState(false);
    const [retryingFailedRecipients, setRetryingFailedRecipients] = useState(false);

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        const loadSender = async () => {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return;
            try {
                setProviderStateLoading(true);
                const [senderRes, providerRes] = await Promise.all([
                    fetch(`/api/email/sender-profile?tenantId=${encodeURIComponent(tenantId)}`),
                    fetch(`/api/settings/email-provider?tenantId=${encodeURIComponent(tenantId)}`),
                ]);
                const senderData = await senderRes.json().catch(() => ({}));
                const providerData = await providerRes.json().catch(() => ({}));
                if (senderData?.profile?.fromEmail || senderData?.profile?.fromName || senderData?.profile?.defaultProvider) {
                    setSenderProfile(senderData.profile);
                    setTestEmailAddress(String(senderData.profile.fromEmail || ''));
                    setForm((f) => ({
                        ...f,
                        fromName: senderData.profile.fromName || f.fromName,
                        fromEmail: senderData.profile.fromEmail || f.fromEmail,
                        selectedProviders: senderData.profile.defaultProvider
                            ? (CAMPAIGN_SUPPORTED_EMAIL_PROVIDERS.includes(senderData.profile.defaultProvider as any)
                                ? [senderData.profile.defaultProvider]
                                : f.selectedProviders)
                            : f.selectedProviders,
                    }));
                }
                if (providerRes.ok) {
                    const dp = providerData.defaultProvider || 'auto';
                    setWorkspaceDefaultProvider(CAMPAIGN_SUPPORTED_EMAIL_PROVIDERS.includes(dp as any) ? dp : 'auto');
                    const connected = Array.isArray(providerData.connectedProviders) ? providerData.connectedProviders : [];
                    setConnectedProviders(connected.filter((p: any) => CAMPAIGN_SUPPORTED_EMAIL_PROVIDERS.includes(p.id)));
                    setCampaignsProviderNote(String(providerData.campaignsNote || ''));
                }
            } catch {
                // Non-fatal
            } finally {
                setProviderStateLoading(false);
            }
        };
        loadSender();
    }, []);

    const resolvedProvider = useMemo<DeliveryEmailProvider>(() => {
        const selected = (form.selectedProviders[0] || '').trim();
        if (selected) {
            return CAMPAIGN_SUPPORTED_EMAIL_PROVIDERS.includes(selected as any) ? (selected as DeliveryEmailProvider) : 'auto';
        }
        const connectedIds = connectedProviders
            .filter((provider) => provider.connected)
            .map((provider) => provider.id);
        return resolveAutoProvider(connectedIds, workspaceDefaultProvider);
    }, [connectedProviders, form.selectedProviders, workspaceDefaultProvider]);

    const resolvedProviderMeta = useMemo(
        () => connectedProviders.find((provider) => provider.id === resolvedProvider) || null,
        [connectedProviders, resolvedProvider]
    );

    const buildComposeAudit = useMemo<ComposeAudit>(() => {
        const issues: string[] = [];
        const warnings: string[] = [];
        const info: string[] = [];

        const resolvedRecipients =
            recipientType === 'all'
                ? contacts
                : recipientType === 'import' || recipientType === 'few' || recipientType === 'specific'
                    ? contacts.filter((contact) => selectedContactIds.includes(contact.id))
                    : [];

        if (!form.name.trim()) issues.push('Add an internal campaign name.');
        if (!form.subject.trim()) issues.push('Add a subject line before launch.');
        if (!String(form.bodyHtml || '').trim()) issues.push('Write the email body before launch.');
        if (!recipientType) issues.push('Choose who should receive this campaign.');
        if (recipientType && resolvedRecipients.length === 0) issues.push('Add at least one recipient before launch.');
        if (!form.fromName.trim()) issues.push('Set a sender name.');
        if (!form.fromEmail.trim()) warnings.push('Sender email is empty in the builder. A provider default may be used, but it is safer to set one explicitly.');

        if (form.deliveryChannel === 'email' || form.deliveryChannel === 'both') {
            if (resolvedProvider === 'auto') {
                issues.push('No connected email provider is available for this workspace.');
            }
            if (resolvedProviderMeta && !resolvedProviderMeta.connected) {
                issues.push(`${resolvedProviderMeta.label} is selected but not connected for this workspace.`);
            }
            if (resolvedProviderMeta?.connected) {
                info.push(`Delivery provider ready: ${resolvedProviderMeta.label}.`);
            }
        }

        const connectedLabels = connectedProviders
            .filter((provider) => provider.connected)
            .map((provider) => provider.label);
        if (connectedLabels.length > 0) {
            info.push(`Connected email providers: ${connectedLabels.join(', ')}.`);
        } else {
            warnings.push('No email provider is connected yet for campaigns. Connect Brevo, Resend, SendGrid, or Zoho Mail in Settings.');
        }

        if (campaignsProviderNote) {
            info.push(campaignsProviderNote);
        }

        if (form.deliveryChannel !== 'email') {
            warnings.push('This campaign also uses WhatsApp delivery. Make sure recipients have phone numbers if you expect WhatsApp sends.');
        }

        return { issues, warnings, info };
    }, [
        campaignsProviderNote,
        connectedProviders,
        contacts,
        form.bodyHtml,
        form.deliveryChannel,
        form.fromEmail,
        form.fromName,
        form.name,
        form.subject,
        recipientType,
        resolvedProvider,
        resolvedProviderMeta,
        selectedContactIds,
    ]);

    useEffect(() => {
        setComposeAudit(buildComposeAudit);
    }, [buildComposeAudit]);

    const selectedCampaignDeliverySummary = useMemo(() => {
        if (!selectedCampaign || selectedCampaignRecipients.length === 0) return null;

        const providerCounts = new Map<string, number>();
        const failureReasons = new Map<string, number>();
        let sentCount = 0;
        let failedCount = 0;
        let unsubscribedCount = 0;
        let pendingCount = 0;

        for (const recipient of selectedCampaignRecipients) {
            const recipientMeta = (recipient.metadata || {}) as Record<string, unknown>;
            const provider = String(recipientMeta.provider || recipientMeta.whatsapp_provider || '').trim();
            if (provider) {
                providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
            }

            if (recipient.status === 'failed' || recipient.status === 'bounced') {
                failedCount += 1;
                const reason = String(recipient.errorMessage || recipient.bounceReason || 'Unknown failure').trim();
                failureReasons.set(reason, (failureReasons.get(reason) || 0) + 1);
            } else if (recipient.status === 'unsubscribed') {
                unsubscribedCount += 1;
            } else if (recipient.status === 'pending') {
                pendingCount += 1;
            } else {
                sentCount += 1;
            }
        }

        const topProvider =
            [...providerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'n/a';
        const topFailureReasons = [...failureReasons.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        return {
            topProvider,
            sentCount,
            failedCount,
            unsubscribedCount,
            pendingCount,
            topFailureReasons,
        };
    }, [selectedCampaign, selectedCampaignRecipients]);

    const refreshSelectedCampaignRecipients = async () => {
        if (!selectedCampaign) return;
        setLoadingSelectedRecipients(true);
        const { recipients } = await emailCampaignService.getCampaignRecipients(selectedCampaign.id);
        setSelectedCampaignRecipients(recipients);
        setLoadingSelectedRecipients(false);
    };

    const loadData = async () => {
        setLoading(true);
        const [campsResult, contactsResult] = await Promise.all([
            emailCampaignService.getCampaigns(),
            emailCampaignService.getMarketingContacts(),
        ]);
        if (!campsResult.error) setCampaigns(campsResult.campaigns);
        if (!contactsResult.error) setContacts(contactsResult.contacts);
        setLoading(false);
    };

    const handleImportLeads = async () => {
        if (!pasteLeadsText.trim()) return;
        setImportingLeads(true);
        try {
            const currentTenantId = tenantService.getCurrentTenantId();
            if (!currentTenantId) {
                toast.error('No active tenant found');
                return;
            }

            const lines = pasteLeadsText.split('\n').map(l => l.trim()).filter(Boolean);
            const csvRows = ['name,email'];
            lines.forEach(line => {
                if (line.includes(',')) {
                    const parts = line.split(',');
                    const name = parts[0].trim();
                    const email = parts[1].trim();
                    csvRows.push(`"${name}","${email}"`);
                } else if (line.includes('<') && line.includes('>')) {
                    const name = line.substring(0, line.indexOf('<')).trim();
                    const email = line.substring(line.indexOf('<') + 1, line.indexOf('>')).trim();
                    csvRows.push(`"${name}","${email}"`);
                } else {
                    csvRows.push(`"${line}","${line}"`);
                }
            });

            const csvContent = csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const file = new File([blob], 'imported_leads.csv', { type: 'text/csv' });
            
            const fd = new FormData();
            fd.append('file', file);
            fd.append('tenantId', currentTenantId);

            const res = await fetch('/api/email/campaigns/import-recipients', {
                method: 'POST',
                body: fd,
            });

            const payload = await res.json();
            if (!res.ok) {
                throw new Error(payload.error || 'Failed to import recipients');
            }

            toast.success(`Successfully imported ${payload.imported} contacts!`);
            setPasteLeadsText('');
            
            const contactsResult = await emailCampaignService.getMarketingContacts();
            if (!contactsResult.error) {
                setContacts(contactsResult.contacts);
                if (payload.contacts && payload.contacts.length > 0) {
                    const newIds = payload.contacts.map((c: any) => c.id);
                    setSelectedContactIds(newIds);
                }
            }
        } catch (err: any) {
            toast.error(err.message || 'Import failed');
        } finally {
            setImportingLeads(false);
        }
    };

    const handleCopilotSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!copilotInput.trim()) return;
        
        const userMsg = copilotInput.trim();
        setCopilotMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
        setCopilotInput('');
        setCopilotLoading(true);
        
        try {
            const tenantId = tenantService.getCurrentTenantId();
            const aiRes = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `You are a plain-language campaign assistant. Based on this request, return JSON only with keys: name, subject, html, recipientType (all|specific|import), leads (string[] emails if found in prompt).
User goal: ${campaignGoal || 'No goal provided'}
Request: ${userMsg}`,
                    tenantId,
                    mode: 'structured',
                }),
            });
            const aiData = await aiRes.json().catch(() => ({}));
            let suggestion = {
                name: 'AI Generated Outreach',
                subject: 'Quick question for you',
                html: `<h2>Hello {{firstName}},</h2><p>We help businesses like yours save time with an all-in-one operating system.</p>`,
                recipientType: 'all' as string,
                leads: [] as string[],
            };

            if (aiData?.text) {
                try {
                    const parsed = JSON.parse(aiData.text);
                    suggestion = { ...suggestion, ...parsed };
                } catch {
                    suggestion.subject = userMsg.slice(0, 80);
                    suggestion.html = `<p>${aiData.text}</p>`;
                }
            }

            const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
            const matches = userMsg.match(emailRegex);
            if (matches?.length) {
                suggestion.leads = matches;
                suggestion.recipientType = 'import';
            }

            setCopilotMessages((prev) => [...prev, {
                sender: 'assistant',
                text: `Campaign draft ready: **${suggestion.name}** — ${suggestion.subject}`,
                suggestion,
            }]);
            toast.success('AI campaign configuration ready!', { icon: '🤖' });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'AI copilot failed';
            setCopilotMessages((prev) => [...prev, { sender: 'assistant', text: message }]);
            toast.error(message);
        } finally {
            setCopilotLoading(false);
        }
    };

    const applyCopilotSuggestion = async (suggestion: any) => {
        setForm(f => ({
            ...f,
            name: suggestion.name,
            subject: suggestion.subject,
            bodyHtml: suggestion.html
        }));
        
        if (suggestion.recipientType) {
            setRecipientType(suggestion.recipientType);
            if (suggestion.recipientType === 'import' && suggestion.leads && suggestion.leads.length > 0) {
                setPasteLeadsText(suggestion.leads.join('\n'));
                toast.success('Applied configuration! Click "Process and Import Leads" in Step 2 to ingest.');
            } else {
                toast.success('Applied AI campaign configuration!');
            }
        }
    };

    const handleCreate = async () => {
        setAuditLoading(true);
        const currentAudit = buildComposeAudit;
        setComposeAudit(currentAudit);
        setAuditLoading(false);
        if (currentAudit.issues.length > 0) {
            toast.error(currentAudit.issues[0]);
            return;
        }
        if (!form.name || !form.subject || !form.bodyHtml) {
            toast.error('Name, subject, and message are required');
            return;
        }
        if (form.languageMode === 'ask') {
            toast.error('Choose a campaign language before launch, or switch language to Auto.');
            return;
        }
        if (form.abTestEnabled && !form.subjectB.trim()) {
            toast.error('Subject line B is required when A/B testing is enabled');
            return;
        }
        if (!recipientType) {
            toast.error('Choose who should receive the campaign');
            return;
        }

        const resolvedRecipients =
            recipientType === 'all'
                ? contacts
                : recipientType === 'import' || recipientType === 'few' || recipientType === 'specific'
                    ? contacts.filter((contact) => selectedContactIds.includes(contact.id))
                    : [];

        if (!resolvedRecipients.length) {
            toast.error('Add at least one recipient before launching the campaign');
            return;
        }

        const toastId = toast.loading('Creating campaign...');
        const { campaign, error } = await emailCampaignService.createCampaign(userId, {
            name: form.name,
            subject: form.subject,
            fromName: form.fromName,
            fromEmail: form.fromEmail || '',
            scheduledAt: form.scheduleEnabled && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
                metadata: { 
                bodyHtml: form.bodyHtml,
                provider: form.selectedProviders.find((p) => CAMPAIGN_SUPPORTED_EMAIL_PROVIDERS.includes(p as any)) || 'zoho',
                deliveryChannel: form.deliveryChannel,
                languageMode: form.languageMode,
                languageInstruction: getCampaignLanguageInstruction({ languageMode: form.languageMode }),
                deliverySettings: {
                    selectedProviders: form.selectedProviders.filter((p) => CAMPAIGN_SUPPORTED_EMAIL_PROVIDERS.includes(p as any)),
                    balanceByDailyLimit: form.balanceByDailyLimit,
                },
                abTest: form.abTestEnabled
                    ? {
                        enabled: true,
                        subjectB: form.subjectB.trim(),
                        splitPercent: form.abSplitPercent,
                    }
                    : { enabled: false },
            },
        });

        if (error) { toast.error(error, { id: toastId }); return; }
        if (campaign) {
            let finalIds = recipientType === 'all'
                ? contacts.map(c => c.id)
                : selectedContactIds;
            const recipientResult = await emailCampaignService.addRecipientsToCampaign(campaign.id, finalIds, {
                skipPreviouslyContacted: form.skipPreviouslyContacted,
            });

            if (recipientResult.error) {
                toast.error(`Campaign saved as draft. Recipients failed: ${recipientResult.error}`, { id: toastId });
                setViewMode('list');
                setActiveStep(1);
                setRecipientType(null);
                setSelectedContactIds([]);
                loadData();
                return;
            }

            if (recipientResult.added === 0) {
                toast.error(
                    `Campaign saved as draft. No recipients were added${recipientResult.skipped ? ` (${recipientResult.skipped} skipped as already contacted)` : ''}. Turn off "Skip previously contacted" or pick different contacts.`,
                    { id: toastId, duration: 7000 },
                );
                setViewMode('list');
                setActiveStep(1);
                setRecipientType(null);
                setSelectedContactIds([]);
                loadData();
                return;
            }

            if (!form.scheduleEnabled || !form.scheduledAt) {
                toast.loading('Running pre-flight checks...', { id: toastId });
                const diag = await emailCampaignService.diagnoseCampaign(campaign.id);
                if (diag.issues.length > 0) {
                    toast.error(`Campaign saved but blocked: ${diag.issues.join(' ')}`, { id: toastId, duration: 8000 });
                    setViewMode('list');
                    loadData();
                    return;
                }

                toast.loading('Dispatching campaign emails...', { id: toastId });
                const sendResult = await emailCampaignService.sendCampaign(campaign.id);
                if (!sendResult.success) {
                    const detail = await describeCampaignFailure(campaign.id, sendResult.error);
                    toast.error(`Campaign created but sending failed: ${detail}`, { id: toastId, duration: 8000 });
                    showActionNextSteps('campaign_created', (path) => router.push(path));
                } else {
                    toast.success('Campaign launched and sent!', { id: toastId });
                    showActionNextSteps('campaign_sent', (path) => router.push(path));
                }
            } else {
                await emailCampaignService.updateCampaign(campaign.id, { status: 'scheduled' });
                toast.success('Campaign scheduled successfully.', { id: toastId });
                showActionNextSteps('campaign_created', (path) => router.push(path));
            }
        }
        setViewMode('list');
        setActiveStep(1);
        setRecipientType(null);
        setSelectedContactIds([]);
        loadData();
    };

    const runComposeAudit = () => {
        setAuditLoading(true);
        const nextAudit = buildComposeAudit;
        setComposeAudit(nextAudit);
        setAuditLoading(false);
        if (nextAudit.issues.length === 0) {
            toast.success('Campaign passed the builder audit.');
            return;
        }
        toast.error(nextAudit.issues[0]);
    };

    const handleSendTestEmail = async () => {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) {
            toast.error('No active tenant found.');
            return;
        }
        if (!testEmailAddress.trim()) {
            toast.error('Enter a test email address first.');
            return;
        }
        if (resolvedProvider === 'auto') {
            toast.error('Connect an email provider before sending a test email.');
            return;
        }

        setSendingTestEmail(true);
        try {
            const response = await fetch('/api/email/providers/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId,
                    provider: resolvedProvider,
                    to: testEmailAddress.trim(),
                    subject: form.subject?.trim() || 'AlphaClone campaign test',
                    message: plainFromHtml(form.bodyHtml).trim() || 'This is a campaign test email from AlphaClone.',
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to send test email');
            }
            toast.success(`Test email sent via ${DELIVERY_PROVIDER_LABELS[resolvedProvider]} to ${testEmailAddress.trim()}.`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to send test email');
        } finally {
            setSendingTestEmail(false);
        }
    };

    const insertVariable = (tag: string) => {
        setForm(f => ({ ...f, bodyHtml: f.bodyHtml + ' ' + tag }));
    };

    const generateWithAI = async () => {
        if (!form.subject) { toast.error('Enter a subject line first'); return; }
        setAiGenerating(true);
        try {
            // Try DeepSeek first if API key is configured
            const deepSeekKey = typeof process !== 'undefined' && 
                (process.env.DEEPSEEK_API_KEY || process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY);

            if (deepSeekKey) {
                try {
                    const { callDeepSeek } = await import('@/lib/ai/deepseek');
                    const prompt = `You are the best email copywriter alive — warm, human, and impossible to ignore. Write a high-converting marketing email body.
Campaign goal: ${campaignGoal || 'Keep it simple and useful.'}
Subject: "${form.subject}"
${getCampaignLanguageInstruction({ languageMode: form.languageMode })}

Voice & rules:
- Open with a first line that hooks instantly — a bold statement, a relatable pain, or a curiosity gap. NEVER "I hope this email finds you well" or generic corporate intros.
- Sound like a real person talking to a friend, not a press release. No stiff jargon, no buzzword soup.
- Keep paragraphs short and skimmable. Build one clear idea, then a single confident call to action.
- Be specific and benefit-driven; make the reader feel something.
- Write in plain HTML format. Use <h2>, <p>, <br> tags. No markdown. No asterisks.`;

                    const text = await callDeepSeek(prompt, {
                        model: 'deepseek-chat',
                        maxTokens: 2048,
                        temperature: 0.7,
                    });

                    if (text) {
                        setForm(f => ({ ...f, bodyHtml: text }));
                        setAiGenerating(false);
                        return;
                    }
                } catch (deepSeekError) {
                    console.warn('DeepSeek generation failed, falling back:', deepSeekError);
                }
            }

            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `You are the best email copywriter alive — warm, human, and impossible to ignore. Write a high-converting marketing email body.
Campaign goal: ${campaignGoal || 'Keep it simple and useful.'}
Subject: "${form.subject}"
${getCampaignLanguageInstruction({ languageMode: form.languageMode })}

Voice & rules:
- Open with a first line that hooks instantly — a bold statement, a relatable pain, or a curiosity gap. NEVER "I hope this email finds you well" or generic corporate intros.
- Sound like a real person, not a press release. No stiff jargon. Short, skimmable paragraphs. One clear call to action.
- Write in plain HTML format. Use <h2>, <p>, <br> tags. No markdown. No asterisks.`,
                })
            });
            const data = await response.json();
            if (data.text) setForm(f => ({ ...f, bodyHtml: data.text }));
        } catch {
            toast.error('AI writer generation failed');
        } finally {
            setAiGenerating(false);
        }
    };

    // Swipe handlers
    const handleTouchStart = (e: React.TouchEvent, id: string) => {
        touchStartX.current = e.touches[0].clientX;
        setSwipeActiveId(id);
    };

    const handleTouchMove = (e: React.TouchEvent, id: string) => {
        if (swipeActiveId !== id) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - touchStartX.current;
        const capped = Math.max(-80, Math.min(80, diff));
        setSwipeState(prev => ({ ...prev, [id]: capped }));
    };

    const handleTouchEnd = (e: React.TouchEvent, id: string) => {
        const finalOffset = swipeState[id] || 0;
        if (finalOffset > 45) {
            setSwipeState(prev => ({ ...prev, [id]: 60 }));
            handleDuplicateCampaign(campaigns.find(c => c.id === id)!);
            setTimeout(() => {
                setSwipeState(prev => ({ ...prev, [id]: 0 }));
            }, 800);
        } else if (finalOffset < -45) {
            setSwipeState(prev => ({ ...prev, [id]: -60 }));
            if (confirm('Delete this campaign?')) {
                handleDeleteCampaign(id);
            } else {
                setSwipeState(prev => ({ ...prev, [id]: 0 }));
            }
        } else {
            setSwipeState(prev => ({ ...prev, [id]: 0 }));
        }
        setSwipeActiveId(null);
    };

    const handleDeleteCampaign = async (id: string) => {
        const toastId = toast.loading('Deleting campaign...');
        try {
            const { success, error } = await emailCampaignService.deleteCampaign(id);
            if (!success) throw new Error(error || 'Failed to delete campaign');
            toast.success('Campaign deleted', { id: toastId });
            setCampaigns(prev => prev.filter(c => c.id !== id));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to delete campaign';
            toast.error(message, { id: toastId });
        }
    };

    const handleDuplicateCampaign = (camp: EmailCampaign) => {
        const meta = (camp.metadata as Record<string, unknown>) || {};
        const abTest = (meta.abTest as Record<string, unknown>) || {};
        setForm({
            name: `${camp.name} (Copy)`,
            subject: camp.subject,
            bodyHtml: (meta.bodyHtml as string) || '',
            fromName: camp.fromName,
            fromEmail: camp.fromEmail,
            scheduledAt: '',
            scheduleEnabled: false,
            skipPreviouslyContacted: true,
            selectedProviders: [(meta.provider as string) || 'zoho'],
            deliveryChannel: ((meta.deliveryChannel as string) || 'email') as 'email' | 'whatsapp' | 'both',
            balanceByDailyLimit: true,
            sendImmediately: false,
            languageMode: ((meta.languageMode as string) || 'auto') as CampaignLanguageMode,
            abTestEnabled: !!abTest.enabled,
            subjectB: String(abTest.subjectB || ''),
            abSplitPercent: Number(abTest.splitPercent) || 50,
        });
        setViewMode('compose');
        setActiveStep(1);
        toast.success('Campaign details copied to composer');
    };

    useEffect(() => {
        const loadSelectedRecipients = async () => {
            if (viewMode !== 'detail' || !selectedCampaign) {
                setSelectedCampaignRecipients([]);
                return;
            }
            setLoadingSelectedRecipients(true);
            const { recipients } = await emailCampaignService.getCampaignRecipients(selectedCampaign.id);
            setSelectedCampaignRecipients(recipients);
            setLoadingSelectedRecipients(false);
        };

        void loadSelectedRecipients();
    }, [selectedCampaign, viewMode]);

    const startNewCompose = () => {
        setForm({
            name: '',
            subject: '',
            bodyHtml: '',
            fromName: 'AlphaClone Systems',
            fromEmail: '',
            scheduledAt: '',
            scheduleEnabled: false,
            skipPreviouslyContacted: true,
            selectedProviders: [],
            deliveryChannel: 'email',
            balanceByDailyLimit: true,
            sendImmediately: false,
            languageMode: 'auto',
            abTestEnabled: false,
            subjectB: '',
            abSplitPercent: 50,
        });
        setCampaignMode('simple');
        setCampaignGoal('');
        setRecipientType(null);
        setSelectedContactIds([]);
        setActiveStep(1);
        setViewMode('compose');
        setShowCopilot(true);
    };

    const applyQuickStart = (preset: typeof QUICK_STARTS[number]) => {
        setCampaignGoal(preset.prompt);
        setForm((f) => ({
            ...f,
            name: preset.label,
            subject: preset.subject,
            bodyHtml: preset.bodyHtml,
            languageMode: 'auto',
        }));
        setShowCopilot(true);
        setEditorTab('preview');
        toast.success(`${preset.label} ready`);
    };

    if (loading) {
        return (
            <BonnieModulePageShell>
                <div className="flex flex-col bg-slate-950 rounded-2xl md:rounded-3xl border border-white/5 overflow-hidden backdrop-blur-sm relative min-h-[calc(100dvh-140px)]">
                    <div className="flex flex-1 items-center justify-center p-8 text-slate-400 text-center">
                        <div>
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-500 mb-2" />
                            Loading Campaigns...
                        </div>
                    </div>
                </div>
            </BonnieModulePageShell>
        );
    }

    return (
        <BonnieModulePageShell>
        <div className="flex flex-col bg-slate-950 rounded-2xl md:rounded-3xl border border-white/5 overflow-hidden backdrop-blur-sm relative min-h-[calc(100dvh-140px)]">
            
            {/* Header bar */}
            <div className="h-16 border-b border-white/5 bg-slate-900 px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    {viewMode !== 'list' ? (
                        <button 
                            onClick={() => setViewMode('list')}
                            className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    ) : (
                        <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center">
                            <Mail size={18} className="text-white" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-sm font-black tracking-widest text-white uppercase">Campaigns</h1>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Plain-English campaign builder</p>
                    </div>
                </div>
                {viewMode === 'list' && (
                    <button 
                        onClick={startNewCompose} 
                        className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                    >
                        Create Campaign
                    </button>
                )}
                {viewMode === 'compose' && (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-xl border border-white/5 bg-slate-950 p-1">
                            {(['simple', 'advanced'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setCampaignMode(mode)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${campaignMode === mode ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'}`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                        <button 
                            onClick={() => setShowCopilot(prev => !prev)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                                showCopilot ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-slate-900 text-slate-400 border border-white/5'
                            }`}
                        >
                            <Sparkles className="w-3.5 h-3.5" /> Copilot {showCopilot ? 'ON' : 'OFF'}
                        </button>
                    </div>
                )}
            </div>

            {/* Main view router */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-28">
                <AnimatePresence mode="wait">
                    
                    {/* 1. LIST VIEW */}
                    {viewMode === 'list' && (
                        <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                            <DeliverabilityPanel />
                            {campaigns.some((camp) => camp.status === 'draft') && (
                                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm">
                                        <p className="font-semibold text-amber-200">Draft campaigns stay draft until you launch them</p>
                                        <p className="mt-1 text-slate-400 leading-relaxed">
                                            Open a draft and tap <span className="text-white font-semibold">Run Now</span>, or connect an email provider in{' '}
                                            <button
                                                type="button"
                                                onClick={() => router.push('/dashboard/business/settings')}
                                                className="text-teal-400 hover:text-teal-300 underline underline-offset-2"
                                            >
                                                Settings → Integrations
                                            </button>{' '}
                                            (SendGrid, Resend, Brevo, Zoho Mail, or Gmail).
                                        </p>
                                    </div>
                                </div>
                            )}
                            {campaigns.length === 0 ? (
                                <div className="py-16 text-center border border-dashed border-white/5 rounded-2xl">
                                    <Inbox className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                                    <h3 className="text-sm font-bold text-slate-400">No campaigns yet</h3>
                                    <p className="text-xs text-slate-600 max-w-xs mx-auto mt-1">Create a simple campaign, choose who should receive it, and let the Copilot write the first draft.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5 border border-white/5 rounded-2xl bg-slate-900/30 overflow-hidden">
                                    {campaigns.map((camp) => {
                                        const offset = swipeState[camp.id] || 0;
                                        const provider = (camp.metadata as any)?.provider || 'tenant-default';
                                        const sent = Number(camp.totalSent || 0);
                                        const opened = Number(camp.totalOpened || 0);
                                        const clicked = Number(camp.totalClicked || 0);
                                        const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
                                        const clickRate = sent > 0 ? Math.round((clicked / sent) * 100) : 0;
                                        
                                        return (
                                            <div 
                                                key={camp.id}
                                                className="relative select-none overflow-hidden bg-slate-950"
                                                onTouchStart={(e) => handleTouchStart(e, camp.id)}
                                                onTouchMove={(e) => handleTouchMove(e, camp.id)}
                                                onTouchEnd={(e) => handleTouchEnd(e, camp.id)}
                                            >
                                                {/* Swipe actions */}
                                                <div className="absolute inset-y-0 right-0 w-20 bg-rose-600 flex items-center justify-center text-white text-xs font-bold">
                                                    <Trash2 className="w-4 h-4" />
                                                </div>
                                                <div className="absolute inset-y-0 left-0 w-20 bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                                                    <Repeat className="w-4 h-4" />
                                                </div>

                                                {/* Camp list row */}
                                                <div 
                                                    onClick={() => {
                                                        setSelectedCampaign(camp);
                                                        setViewMode('detail');
                                                    }}
                                                    className="relative z-10 flex items-center justify-between p-3.5 bg-slate-900/70 active:bg-slate-800 transition-transform duration-150 cursor-pointer"
                                                    style={{ transform: `translateX(${offset}px)` }}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                                        {/* Avatar / provider badge */}
                                                        <div className="w-9 h-9 rounded-full bg-slate-950 border border-white/5 flex items-center justify-center text-slate-400 font-bold text-xs uppercase flex-shrink-0">
                                                            {provider.slice(0, 2)}
                                                        </div>
                                                        <div className="min-w-0 flex-1 flex flex-col">
                                                            <span className="text-[14px] text-white font-bold truncate">
                                                                {camp.name}
                                                            </span>
                                                            <span className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                                                                Subj: {camp.subject} • Opens: {openRate}% • Clicks: {clickRate}%
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2.5 ml-3 flex-shrink-0">
                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${statusColors[camp.status]}`}>
                                                            {camp.status}
                                                        </span>
                                                        <ChevronRight className="w-4 h-4 text-slate-600" />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* 2. DETAIL VIEW */}
                    {viewMode === 'detail' && selectedCampaign && (
                        <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                            
                            {/* Title & metadata panel */}
                            <div className="bg-slate-900/50 p-5 rounded-3xl border border-white/5 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${statusColors[selectedCampaign.status]}`}>
                                            {selectedCampaign.status}
                                        </span>
                                        <h2 className="text-lg font-black text-white mt-2 leading-tight">{selectedCampaign.name}</h2>
                                        <p className="text-xs text-slate-400 mt-1">Subject: "{selectedCampaign.subject}"</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {(selectedCampaign.status === 'draft' || selectedCampaign.status === 'scheduled') && (
                                            <button 
                                                onClick={async () => {
                                                    const toastId = toast.loading('Running pre-flight checks...');
                                                    const diag = await emailCampaignService.diagnoseCampaign(selectedCampaign.id);
                                                    if (diag.issues.length > 0) {
                                                        toast.error(diag.issues.join(' '), { id: toastId, duration: 8000 });
                                                        return;
                                                    }
                                                    toast.loading('Sending campaign...', { id: toastId });
                                                    const res = await emailCampaignService.sendCampaign(selectedCampaign.id);
                                                    if (res.success) {
                                                        toast.success('Campaign sent!', { id: toastId });
                                                        showActionNextSteps('campaign_sent', (path) => router.push(path));
                                                        loadData();
                                                        setViewMode('list');
                                                    } else {
                                                        const detail = await describeCampaignFailure(selectedCampaign.id, res.error);
                                                        toast.error(detail, { id: toastId, duration: 8000 });
                                                    }
                                                }}
                                                className="px-3 py-2 bg-teal-600 hover:bg-teal-500 rounded-xl text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
                                            >
                                                <Play className="w-3 h-3" /> Run Now
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleDuplicateCampaign(selectedCampaign)}
                                            className="p-2 bg-slate-950 border border-white/5 rounded-xl text-slate-400 hover:text-white transition-colors"
                                        >
                                            <Repeat className="w-4 h-4" />
                                        </button>
                                        {selectedCampaignDeliverySummary && selectedCampaignDeliverySummary.failedCount > 0 && (
                                            <button
                                                onClick={async () => {
                                                    if (!selectedCampaign) return;
                                                    setRetryingFailedRecipients(true);
                                                    const resetResult = await emailCampaignService.retryFailedRecipients(selectedCampaign.id);
                                                    if (!resetResult.success) {
                                                        toast.error(resetResult.error || 'Failed to reset failed recipients');
                                                        setRetryingFailedRecipients(false);
                                                        return;
                                                    }
                                                    const sendResult = await emailCampaignService.sendCampaign(selectedCampaign.id);
                                                    if (!sendResult.success) {
                                                        const detail = await describeCampaignFailure(selectedCampaign.id, sendResult.error);
                                                        toast.error(detail);
                                                    } else {
                                                        toast.success(`Retried ${resetResult.reset} failed recipient${resetResult.reset === 1 ? '' : 's'}.`);
                                                    }
                                                    await loadData();
                                                    await refreshSelectedCampaignRecipients();
                                                    setRetryingFailedRecipients(false);
                                                }}
                                                disabled={retryingFailedRecipients}
                                                className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl text-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50"
                                            >
                                                {retryingFailedRecipients ? <Loader2 className="w-3 h-3 animate-spin" /> : <Repeat className="w-3 h-3" />}
                                                Retry failed
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {selectedCampaignDeliverySummary ? (
                                <div className="rounded-3xl border border-white/5 bg-slate-900 p-5 space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-teal-400">Delivery summary</p>
                                            <h3 className="mt-1 text-sm font-bold text-white">
                                                Sent via {selectedCampaignDeliverySummary.topProvider}
                                            </h3>
                                            <p className="mt-1 text-sm text-slate-400">
                                                {selectedCampaignDeliverySummary.sentCount} delivered or progressing, {selectedCampaignDeliverySummary.failedCount} failed, {selectedCampaignDeliverySummary.unsubscribedCount} unsubscribed, {selectedCampaignDeliverySummary.pendingCount} pending.
                                            </p>
                                        </div>
                                        <span className="rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-300">
                                            {selectedCampaignRecipients.length} recipients
                                        </span>
                                    </div>

                                    {selectedCampaignDeliverySummary.topFailureReasons.length > 0 ? (
                                        <div className="rounded-2xl border border-rose-500/15 bg-rose-500/5 p-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-300">Top failure reasons</p>
                                            <ul className="mt-2 space-y-1 text-sm text-rose-100">
                                                {selectedCampaignDeliverySummary.topFailureReasons.map(([reason, count]) => (
                                                    <li key={reason}>• {count}x {reason}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4 text-sm text-emerald-100">
                                            No failure reasons recorded for this campaign yet.
                                        </div>
                                    )}
                                </div>
                            ) : null}

                            {/* 2x2 Statistics dashboard */}
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: 'Recipients', value: selectedCampaign.totalRecipients || 0, rate: 'Audience size' },
                                    { label: 'Sent', value: selectedCampaign.totalSent || 0, rate: `${selectedCampaign.totalRecipients ? Math.round((selectedCampaign.totalSent / selectedCampaign.totalRecipients) * 100) : 0}% of segment` },
                                    { label: 'Opened', value: selectedCampaign.totalOpened || 0, rate: `${selectedCampaign.totalSent ? Math.round((selectedCampaign.totalOpened / selectedCampaign.totalSent) * 100) : 0}% open rate` },
                                    { label: 'Clicked', value: selectedCampaign.totalClicked || 0, rate: `${selectedCampaign.totalSent ? Math.round((selectedCampaign.totalClicked / selectedCampaign.totalSent) * 100) : 0}% click rate` }
                                ].map((stat, i) => (
                                    <div key={i} className="p-4 bg-slate-900 rounded-2xl border border-white/5 space-y-1">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{stat.label}</span>
                                        <div className="text-xl font-black text-white">{String(stat.value)}</div>
                                        <span className="text-[10px] text-teal-400 font-bold block">{stat.rate}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Detailed analytics panel */}
                            {(selectedCampaign.status === 'sent' || selectedCampaign.totalSent > 0) && (
                                <div className="bg-slate-900 p-5 rounded-3xl border border-white/5">
                                    <h3 className="text-xs font-bold text-slate-400 tracking-wide mb-4">Campaign Analytics</h3>
                                    <EmailCampaignAnalytics campaign={selectedCampaign} embedded />
                                </div>
                            )}

                            {/* Timeline status steps */}
                            <div className="bg-slate-900 p-5 rounded-3xl border border-white/5 space-y-4">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Campaign Journey</h3>
                                <div className="relative pl-6 space-y-4 border-l border-white/10 ml-2">
                                    <div className="relative">
                                        <div className="absolute -left-[30px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 border border-slate-950 flex items-center justify-center text-[8px] text-white">✓</div>
                                        <h4 className="text-xs font-bold text-white">Campaign Created</h4>
                                        <p className="text-[10px] text-slate-500">Initialized by dashboard tenant</p>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute -left-[30px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 border border-slate-950 flex items-center justify-center text-[8px] text-white">✓</div>
                                        <h4 className="text-xs font-bold text-white">Recipients Segmented</h4>
                                        <p className="text-[10px] text-slate-500">Audience parsed and matching rules checked</p>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute -left-[30px] top-0.5 w-4 h-4 rounded-full bg-teal-500 border border-slate-950 animate-pulse" />
                                        <h4 className="text-xs font-bold text-teal-400">Queue Processing</h4>
                                        <p className="text-[10px] text-slate-500">Sending via tenant email provider</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-900 p-5 rounded-3xl border border-white/5 space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Recipient delivery audit</h3>
                                    <button
                                        type="button"
                                        onClick={refreshSelectedCampaignRecipients}
                                        className="rounded-xl border border-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:text-white"
                                    >
                                        Refresh
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                    {[
                                        { label: 'Pending', value: selectedCampaignRecipients.filter((recipient) => recipient.status === 'pending').length },
                                        { label: 'Sent', value: selectedCampaignRecipients.filter((recipient) => recipient.status === 'sent' || recipient.status === 'delivered' || recipient.status === 'opened' || recipient.status === 'clicked').length },
                                        { label: 'Failed', value: selectedCampaignRecipients.filter((recipient) => recipient.status === 'failed' || recipient.status === 'bounced').length },
                                        { label: 'Unsubscribed', value: selectedCampaignRecipients.filter((recipient) => recipient.status === 'unsubscribed').length },
                                    ].map((stat) => (
                                        <div key={stat.label} className="rounded-2xl border border-white/5 bg-slate-950/60 p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{stat.label}</p>
                                            <p className="mt-1 text-lg font-black text-white">{stat.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {loadingSelectedRecipients ? (
                                    <div className="flex items-center justify-center py-10 text-sm text-slate-500">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin text-teal-400" />
                                        Loading recipient audit...
                                    </div>
                                ) : selectedCampaignRecipients.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-white/5 py-10 text-center text-sm text-slate-500">
                                        No recipient rows recorded for this campaign yet.
                                    </div>
                                ) : (
                                    <div className="overflow-hidden rounded-2xl border border-white/5">
                                        <div className="grid grid-cols-[minmax(0,2fr)_auto_auto] gap-3 border-b border-white/5 bg-slate-950/80 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            <span>Recipient</span>
                                            <span>Provider</span>
                                            <span>Status</span>
                                        </div>
                                        <div className="divide-y divide-white/5">
                                            {selectedCampaignRecipients.slice(0, 12).map((recipient) => {
                                                const recipientMeta = (recipient.metadata || {}) as Record<string, unknown>;
                                                const provider = String(recipientMeta.provider || recipientMeta.whatsapp_provider || 'n/a');
                                                return (
                                                    <div key={recipient.id} className="grid grid-cols-[minmax(0,2fr)_auto_auto] gap-3 px-4 py-3 text-sm">
                                                        <div className="min-w-0">
                                                            <p className="truncate font-semibold text-white">{recipient.email}</p>
                                                            <p className="mt-1 truncate text-[11px] text-slate-500">
                                                                {recipient.errorMessage || recipient.bounceReason || `Created ${new Date(recipient.createdAt).toLocaleString()}`}
                                                            </p>
                                                        </div>
                                                        <span className="self-start rounded-full border border-white/10 bg-slate-950 px-2 py-1 text-[10px] font-bold uppercase text-slate-300">
                                                            {provider}
                                                        </span>
                                                        <span className={`self-start rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${
                                                            recipient.status === 'failed' || recipient.status === 'bounced'
                                                                ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                                                                : recipient.status === 'unsubscribed'
                                                                    ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                                                                    : recipient.status === 'pending'
                                                                        ? 'border-slate-600 bg-slate-800 text-slate-300'
                                                                        : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                                        }`}>
                                                            {recipient.status}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* 3. WIZARD COMPOSE FLOW */}
                    {viewMode === 'compose' && (
                        <motion.div key="compose" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 15 }} className="flex flex-col lg:flex-row gap-6 items-start w-full">
                            
                            {/* Main wizard step builder panel */}
                            <div className="flex-1 w-full space-y-6">
                                <div className="bg-slate-900/70 border border-white/5 rounded-3xl p-5 space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-teal-400">Plain-English Start</p>
                                            <h3 className="text-white text-lg font-black">Tell us what you want to say and who should hear it.</h3>
                                            <p className="text-sm text-slate-400 max-w-2xl">
                                                Pick a starter, describe the goal in one sentence, or let the Copilot write the first draft for you.
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {QUICK_STARTS.map((preset) => (
                                                <button
                                                    key={preset.id}
                                                    type="button"
                                                    onClick={() => applyQuickStart(preset)}
                                                    className="px-3 py-2 rounded-xl border border-white/5 bg-slate-950 text-slate-300 text-xs font-bold hover:border-teal-500/40 hover:text-white transition-all"
                                                >
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Campaign Goal</label>
                                        <textarea
                                            value={campaignGoal}
                                            onChange={(e) => setCampaignGoal(e.target.value)}
                                            placeholder="Example: Re-engage cold leads who haven’t replied in 60 days."
                                            className="w-full min-h-[88px] bg-slate-950 border border-white/5 rounded-2xl p-4 text-sm text-white outline-none resize-y"
                                        />
                                    </div>
                                </div>

                                {/* Thin Progress bar indicator */}
                                <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-teal-500 transition-all duration-300"
                                        style={{ width: `${(activeStep / 4) * 100}%` }}
                                    />
                                </div>

                                <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                                    <span>Step {activeStep} of 4</span>
                                    <span>
                                        {campaignMode === 'simple' ? (
                                            activeStep === 1 ? 'Basics' :
                                            activeStep === 2 ? 'Who gets it' :
                                            activeStep === 3 ? 'Write your message' :
                                            'Review & send'
                                        ) : (
                                            activeStep === 1 ? 'Message & Provider' :
                                            activeStep === 2 ? 'Segment' :
                                            activeStep === 3 ? 'Templates & Preview' :
                                            'Review Summary'
                                        )}
                                    </span>
                                </div>

                                {/* WIZARD STEPS */}
                                {activeStep === 1 && (
                                    <div className="space-y-5 animate-in fade-in duration-300">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Internal Name</label>
                                            <input 
                                                value={form.name} 
                                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                                placeholder="e.g. Q2 Outreach Campaign"
                                                className="w-full h-11 bg-slate-900 border border-white/5 rounded-xl px-4 text-xs text-white outline-none focus:border-teal-500/50"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Subject Line</label>
                                            <input 
                                                value={form.subject} 
                                                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                                                placeholder="e.g. Quick question about workspace optimization"
                                                className="w-full h-11 bg-slate-900 border border-white/5 rounded-xl px-4 text-xs text-white outline-none focus:border-teal-500/50"
                                            />
                                        </div>

                                        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
                                            <label className="flex items-center gap-2 text-xs font-bold text-violet-300">
                                                <input
                                                    type="checkbox"
                                                    checked={form.abTestEnabled}
                                                    onChange={(e) => setForm((f) => ({ ...f, abTestEnabled: e.target.checked }))}
                                                    className="rounded border-violet-500/50"
                                                />
                                                A/B test subject lines
                                            </label>
                                            {form.abTestEnabled && (
                                                <>
                                                    <input
                                                        value={form.subjectB}
                                                        onChange={(e) => setForm((f) => ({ ...f, subjectB: e.target.value }))}
                                                        placeholder="Subject line B"
                                                        className="w-full h-10 bg-slate-900 border border-white/5 rounded-xl px-3 text-xs text-white"
                                                    />
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] text-slate-400">Split to B: {form.abSplitPercent}%</span>
                                                        <input
                                                            type="range"
                                                            min={10}
                                                            max={90}
                                                            value={form.abSplitPercent}
                                                            onChange={(e) => setForm((f) => ({ ...f, abSplitPercent: Number(e.target.value) }))}
                                                            className="flex-1 accent-violet-500"
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="rounded-2xl border border-white/5 bg-slate-900 p-4 space-y-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-teal-400">Delivery readiness</p>
                                                    <h4 className="mt-1 text-sm font-bold text-white">
                                                        {resolvedProviderMeta?.label || DELIVERY_PROVIDER_LABELS[resolvedProvider]}
                                                    </h4>
                                                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                                                        {campaignsProviderNote || 'Confirm the connected provider, sender identity, and test send before launch.'}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={runComposeAudit}
                                                    className="rounded-xl border border-teal-500/20 bg-teal-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-teal-300 hover:bg-teal-500/20"
                                                >
                                                    {auditLoading ? 'Checking...' : 'Run audit'}
                                                </button>
                                            </div>

                                            <div className="grid gap-3 md:grid-cols-2">
                                                <div className="rounded-xl border border-white/5 bg-slate-950/70 p-3">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Workspace provider</p>
                                                    <p className="mt-1 text-sm font-semibold text-white">
                                                        {resolvedProviderMeta?.label || DELIVERY_PROVIDER_LABELS[resolvedProvider]}
                                                    </p>
                                                    <p className="mt-1 text-[11px] text-slate-500">
                                                        {resolvedProviderMeta?.connected ? 'Connected and available.' : 'Not connected yet.'}
                                                    </p>
                                                </div>
                                                <div className="rounded-xl border border-white/5 bg-slate-950/70 p-3">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Sender identity</p>
                                                    <p className="mt-1 text-sm font-semibold text-white">{form.fromName || 'No sender name set'}</p>
                                                    <p className="mt-1 text-[11px] text-slate-500">{form.fromEmail || 'No sender email set'}</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {connectedProviders.map((provider) => (
                                                    <span
                                                        key={provider.id}
                                                        className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                                            provider.connected
                                                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                                                : 'border-slate-700 bg-slate-950 text-slate-500'
                                                        }`}
                                                    >
                                                        {provider.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {campaignMode === 'advanced' ? (
                                            <>
                                                <div className="space-y-2">
                                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Delivery Channel</label>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {[
                                                            { id: 'email' as const, label: 'Email', icon: Mail },
                                                            { id: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle },
                                                            { id: 'both' as const, label: 'Both', icon: Layers },
                                                        ].map((ch) => {
                                                            const isSelected = form.deliveryChannel === ch.id;
                                                            return (
                                                                <button
                                                                    key={ch.id}
                                                                    type="button"
                                                                    onClick={() => setForm((f) => ({ ...f, deliveryChannel: ch.id }))}
                                                                    className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-all ${isSelected ? 'bg-teal-500/10 border-teal-500 text-teal-400' : 'bg-slate-900 border-white/5 text-slate-400'}`}
                                                                >
                                                                    <ch.icon className="w-4 h-4" />
                                                                    <span className="text-[10px] font-bold uppercase">{ch.label}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    {form.deliveryChannel !== 'email' && (
                                                        <p className="text-[10px] text-slate-500 px-1">WhatsApp uses phone numbers from leads, clients, or contacts matched by email.</p>
                                                    )}
                                                </div>

                                                {/* Email Provider select cards */}
                                                {(form.deliveryChannel === 'email' || form.deliveryChannel === 'both') && (
                                                <div className="space-y-2">
                                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Email Provider Service</label>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {[
                                                            { id: 'resend', label: 'Resend.com' },
                                                            { id: 'sendgrid', label: 'SendGrid' },
                                                            { id: 'brevo', label: 'Brevo (Sendinblue)' },
                                                            { id: 'zoho', label: 'Zoho Mail Client' }
                                                        ].map((provider) => {
                                                            const isSelected = form.selectedProviders.includes(provider.id);
                                                            return (
                                                                <button
                                                                    key={provider.id}
                                                                    type="button"
                                                                    onClick={() => setForm(f => ({ ...f, selectedProviders: [provider.id] }))}
                                                                    className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${isSelected ? 'bg-teal-500/10 border-teal-500 text-teal-400' : 'bg-slate-900 border-white/5 text-slate-400'}`}
                                                                >
                                                                    <span className="text-xs font-bold uppercase">{provider.label}</span>
                                                                    {isSelected && <Check className="w-4 h-4 text-teal-400" />}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                )}

                                                <div className="space-y-1.5">
                                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Campaign Language</label>
                                                    <div className="relative">
                                                        <Languages className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                                        <select
                                                            value={form.languageMode}
                                                            onChange={e => setForm(f => ({ ...f, languageMode: e.target.value as CampaignLanguageMode }))}
                                                            className="w-full h-11 bg-slate-900 border border-white/5 rounded-xl pl-9 pr-4 text-xs text-white outline-none focus:border-teal-500/50"
                                                        >
                                                            {CAMPAIGN_LANGUAGE_OPTIONS.map(option => (
                                                                <option key={option.code} value={option.code}>{option.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="rounded-2xl border border-white/5 bg-slate-900 p-4 space-y-3">
                                                <p className="text-sm text-slate-300">
                                                    Simple mode keeps the setup focused on the essentials: name, message, audience, then send or schedule.
                                                </p>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                    <div className="rounded-xl bg-slate-950 border border-white/5 p-3">
                                                        <p className="text-[10px] uppercase font-black text-slate-500">Delivery</p>
                                                        <p className="text-sm text-white font-semibold mt-1">Email by default</p>
                                                    </div>
                                                    <div className="rounded-xl bg-slate-950 border border-white/5 p-3">
                                                        <p className="text-[10px] uppercase font-black text-slate-500">Language</p>
                                                        <p className="text-sm text-white font-semibold mt-1">Auto-detected</p>
                                                    </div>
                                                    <div className="rounded-xl bg-slate-950 border border-white/5 p-3">
                                                        <p className="text-[10px] uppercase font-black text-slate-500">Provider</p>
                                                        <p className="text-sm text-white font-semibold mt-1">{form.selectedProviders[0] || 'tenant default'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeStep === 2 && (
                                    <div className="space-y-5 animate-in fade-in duration-300">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-xs text-slate-400">Recipients include CRM contacts, saved leads, and clients with email.</p>
                                            <button
                                                type="button"
                                                onClick={() => router.push('/dashboard/leads/campaigns')}
                                                className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20"
                                            >
                                                Open Lead Finder
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {[
                                                { id: 'all', title: 'Entire Database', icon: Database },
                                                { id: 'specific', title: 'Segment Filter', icon: Tag },
                                                { id: 'few', title: 'Manual Selection', icon: Users },
                                                { id: 'import', title: 'Paste / Import', icon: Upload }
                                            ].map(opt => (
                                                <button 
                                                    key={opt.id} 
                                                    onClick={() => setRecipientType(opt.id as any)} 
                                                    className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${recipientType === opt.id ? 'bg-teal-500/10 border-teal-600 text-teal-400' : 'bg-slate-900 border-white/5 text-slate-400'}`}
                                                >
                                                    <opt.icon className="w-5 h-5 mb-2" />
                                                    <span className="text-[10px] font-bold uppercase">{opt.title}</span>
                                                </button>
                                            ))}
                                        </div>

                                        {recipientType === 'specific' && (
                                            <>
                                            <SegmentBuilder />
                                            <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl space-y-3">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Select Industry Target</span>
                                                {Array.from(new Set(contacts.map(c => c.industry).filter(Boolean))).length === 0 && (
                                                    <p className="text-xs text-slate-500">No industry tags yet — find leads in Lead Finder, then return here to segment by industry.</p>
                                                )}
                                                <div className="grid grid-cols-2 gap-2">
                                                    {Array.from(new Set(contacts.map(c => c.industry).filter(Boolean))).map(industry => {
                                                        const isChecked = contacts.filter(c => c.industry === industry).every(c => selectedContactIds.includes(c.id));
                                                        return (
                                                            <button
                                                                key={industry}
                                                                onClick={() => {
                                                                    const ids = contacts.filter(c => c.industry === industry).map(c => c.id);
                                                                    setSelectedContactIds(prev => 
                                                                        isChecked ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))
                                                                    );
                                                                }}
                                                                className={`p-3 rounded-xl border text-left flex items-center justify-between text-xs ${isChecked ? 'bg-teal-500/10 border-teal-500 text-teal-400' : 'bg-slate-950 border-white/5 text-slate-400'}`}
                                                            >
                                                                <span>{industry}</span>
                                                                <Check className={`w-3.5 h-3.5 ${isChecked ? 'text-teal-400' : 'text-transparent'}`} />
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            </>
                                        )}

                                        {recipientType === 'few' && (
                                            <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl space-y-3">
                                                <input 
                                                    value={contactSearch}
                                                    onChange={e => setContactSearch(e.target.value)}
                                                    placeholder="Search contacts name..."
                                                    className="w-full h-9 bg-slate-950 border border-white/5 rounded-lg px-3 text-xs text-white outline-none"
                                                />
                                                <div className="max-h-40 overflow-y-auto space-y-1">
                                                    {contacts.filter(c => !contactSearch || c.name?.toLowerCase().includes(contactSearch.toLowerCase())).map(c => (
                                                        <button
                                                            key={c.id}
                                                            onClick={() => setSelectedContactIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                                                            className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between text-xs ${selectedContactIds.includes(c.id) ? 'bg-teal-500/10 border-teal-500 text-teal-400' : 'bg-slate-950 border-white/5 text-slate-400'}`}
                                                        >
                                                            <span>{c.name || c.email}</span>
                                                            <Check className={`w-3.5 h-3.5 ${selectedContactIds.includes(c.id) ? 'text-teal-400' : 'text-transparent'}`} />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {recipientType === 'import' && (
                                            <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl space-y-4">
                                                <div className="flex flex-col space-y-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paste Leads List</span>
                                                    <p className="text-[10px] text-slate-500">Paste names and emails (e.g. "John Doe, john@example.com" or just "john@example.com" on separate lines).</p>
                                                </div>
                                                <textarea
                                                    value={pasteLeadsText}
                                                    onChange={e => setPasteLeadsText(e.target.value)}
                                                    placeholder="John Doe, john@example.com&#10;Mary Smith, mary@example.com&#10;sales@clientcompany.com"
                                                    className="w-full h-32 bg-slate-950 border border-white/5 rounded-xl p-3 text-xs text-white outline-none resize-none font-mono"
                                                />
                                                <button
                                                    onClick={handleImportLeads}
                                                    disabled={importingLeads || !pasteLeadsText.trim()}
                                                    className="w-full py-2.5 bg-teal-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-teal-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                                                >
                                                    {importingLeads ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                                    Process and Import Leads
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeStep === 3 && (
                                    <div className="space-y-5 animate-in fade-in duration-300">
                                        <div className="grid grid-cols-2 gap-3">
                                            {PRESET_TEMPLATES.map((tmpl) => (
                                                <button
                                                    key={tmpl.id}
                                                    onClick={() => {
                                                        setForm(f => ({ ...f, bodyHtml: tmpl.html }));
                                                        toast.success(`${tmpl.title} loaded`);
                                                    }}
                                                    className="p-4 bg-slate-900 border border-white/5 rounded-2xl text-left hover:border-teal-500 transition-all flex flex-col justify-between"
                                                >
                                                    <div>
                                                        <h4 className="text-xs font-bold text-white mb-1">{tmpl.title}</h4>
                                                        <p className="text-[10px] text-slate-500 line-clamp-2">"{tmpl.subject}"</p>
                                                    </div>
                                                    <span className="text-[9px] text-teal-400 font-bold uppercase mt-4 block">Use Template</span>
                                                </button>
                                            ))}
                                        </div>

                                        {campaignMode === 'simple' ? (
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center px-1">
                                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Your message</label>
                                                    <button
                                                        onClick={generateWithAI}
                                                        disabled={aiGenerating}
                                                        className="text-xs text-teal-400 flex items-center gap-1 bg-teal-500/10 px-2.5 py-1 rounded-lg border border-teal-500/20 disabled:opacity-50"
                                                    >
                                                        {aiGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Write it for me
                                                    </button>
                                                </div>
                                                <textarea
                                                    value={plainFromHtml(form.bodyHtml)}
                                                    onChange={e => setForm(f => ({ ...f, bodyHtml: htmlFromPlain(e.target.value) }))}
                                                    placeholder={"Type your email the way you'd write it to a customer.\n\nLeave a blank line between paragraphs. No code needed — we handle the formatting."}
                                                    className="w-full h-48 bg-slate-900 border border-white/5 rounded-2xl p-4 text-sm text-white outline-none resize-none leading-relaxed focus:border-teal-500/40"
                                                />
                                                <p className="text-[11px] text-slate-500 px-1">Tip: pick a template above to start, or let AI write a first draft — then tweak the words.</p>
                                                <div className="space-y-2">
                                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">How it will look</label>
                                                    <div
                                                        className="p-5 bg-white text-slate-800 rounded-2xl min-h-[160px] prose prose-sm max-w-none shadow-inner overflow-y-auto"
                                                        dangerouslySetInnerHTML={{ __html: sanitizedBodyHtml || '<p class="text-slate-400 italic text-center py-8">Start typing your message above.</p>' }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                        <>
                                        <div className="flex gap-2 border-b border-slate-800 pb-2">
                                            <button
                                                onClick={() => setEditorTab('preview')}
                                                className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-colors ${
                                                    editorTab === 'preview' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'text-slate-500 hover:text-slate-300'
                                                }`}
                                            >
                                                Visual Preview
                                            </button>
                                            <button
                                                onClick={() => setEditorTab('code')}
                                                className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-colors ${
                                                    editorTab === 'code' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'text-slate-500 hover:text-slate-300'
                                                }`}
                                            >
                                                Code Editor
                                            </button>
                                        </div>

                                        {editorTab === 'code' ? (
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center px-1">
                                                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Email Html Content</label>
                                                    <button 
                                                        onClick={generateWithAI}
                                                        disabled={aiGenerating}
                                                        className="text-xs text-teal-400 flex items-center gap-1 bg-teal-500/10 px-2.5 py-1 rounded-lg border border-teal-500/20"
                                                    >
                                                        {aiGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI writer
                                                    </button>
                                                </div>
                                                <textarea
                                                    value={form.bodyHtml}
                                                    onChange={e => setForm(f => ({ ...f, bodyHtml: e.target.value }))}
                                                    placeholder="Write message HTML or plain text here..."
                                                    className="w-full h-40 bg-slate-900 border border-white/5 rounded-2xl p-4 text-xs text-white outline-none resize-none font-mono"
                                                />
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Live HTML Render Preview</label>
                                                <div className="bg-slate-950 border border-white/5 rounded-3xl overflow-hidden p-5 flex flex-col gap-4">
                                                    <div className="bg-slate-900 rounded-xl p-3 border border-white/5 text-[11px] space-y-1">
                                                        <div className="text-slate-400"><span className="font-bold text-slate-600">From:</span> {form.fromName}</div>
                                                        <div className="text-slate-400"><span className="font-bold text-slate-600">Subject:</span> {form.subject || '(No Subject)'}</div>
                                                    </div>
                                                    <div 
                                                        className="p-5 bg-white text-slate-800 rounded-2xl min-h-[220px] prose prose-sm max-w-none shadow-inner overflow-y-auto"
                                                        dangerouslySetInnerHTML={{ __html: sanitizedBodyHtml || '<p class="text-slate-400 italic text-center py-10">Select a template or click "Code Editor" to write some HTML.</p>' }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        </>
                                        )}
                                    </div>
                                )}

                                {activeStep === 4 && (
                                    <div className="space-y-5 animate-in fade-in duration-300">
                                        <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 space-y-4">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Review Details</span>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-[9px] text-slate-500 font-bold uppercase">Name</span>
                                                    <p className="text-xs text-white font-bold truncate">{form.name || 'Untitled'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] text-slate-500 font-bold uppercase">Subject</span>
                                                    <p className="text-xs text-white font-bold truncate">{form.subject || 'Empty'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] text-slate-500 font-bold uppercase">Provider</span>
                                                    <p className="text-xs text-white font-bold uppercase">{form.selectedProviders[0] || 'tenant default'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] text-slate-500 font-bold uppercase">Language</span>
                                                    <p className="text-xs text-white font-bold">
                                                        {CAMPAIGN_LANGUAGE_OPTIONS.find(option => option.code === form.languageMode)?.label || 'Auto'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] text-slate-500 font-bold uppercase">Recipients</span>
                                                    <p className="text-xs text-white font-bold">
                                                        {recipientType === 'all'
                                                            ? 'All contacts'
                                                            : recipientType === 'specific'
                                                                ? `${selectedContactIds.length} industry match(es)`
                                                                : recipientType === 'few'
                                                                    ? `${selectedContactIds.length} selected contact(s)`
                                                                    : recipientType === 'import'
                                                                        ? `${selectedContactIds.length} imported contact(s)`
                                                                        : 'Not selected'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Final Visual Content</span>
                                            <div className="bg-slate-950 border border-white/5 rounded-3xl overflow-hidden p-5">
                                                <div 
                                                    className="p-5 bg-white text-slate-800 rounded-2xl min-h-[200px] prose prose-sm max-w-none shadow-inner"
                                                    dangerouslySetInnerHTML={{ __html: sanitizedBodyHtml || '<p class="text-slate-400 italic">No email body content.</p>' }}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid gap-4 lg:grid-cols-3">
                                            <div className="rounded-3xl border border-white/5 bg-slate-900 p-4">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Desktop inbox</p>
                                                <p className="mt-1 text-[11px] text-slate-500">{form.fromName || 'Sender'} · {form.fromEmail || 'from@example.com'}</p>
                                                <div className="mt-3 rounded-2xl bg-white p-4 text-slate-800 shadow-inner">
                                                    <div className="mb-3 rounded-xl bg-slate-100 px-3 py-2 text-[11px]">
                                                        <div><span className="font-bold">From:</span> {form.fromName || 'Sender'} &lt;{form.fromEmail || 'from@example.com'}&gt;</div>
                                                        <div className="mt-1"><span className="font-bold">Subject:</span> {form.subject || '(No subject yet)'}</div>
                                                    </div>
                                                    <div
                                                        className="prose prose-sm max-w-none"
                                                        dangerouslySetInnerHTML={{ __html: sanitizedBodyHtml || '<p class="text-slate-400 italic">Email preview will appear here.</p>' }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="rounded-3xl border border-white/5 bg-slate-900 p-4">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Mobile preview</p>
                                                <p className="mt-1 text-[11px] text-slate-500">Shorter lines and tighter spacing for phone inboxes.</p>
                                                <div className="mt-3 mx-auto w-[220px] rounded-[28px] border border-slate-700 bg-slate-950 p-3">
                                                    <div className="rounded-[22px] bg-white p-3 text-slate-800 shadow-inner">
                                                        <div className="mb-2 text-[10px] text-slate-500">
                                                            <div>{form.fromName || 'Sender'}</div>
                                                            <div className="font-semibold text-slate-700">{form.subject || '(No subject yet)'}</div>
                                                        </div>
                                                        <div
                                                            className="prose prose-sm max-w-none text-[12px]"
                                                            dangerouslySetInnerHTML={{ __html: sanitizedBodyHtml || '<p class="text-slate-400 italic">Email preview will appear here.</p>' }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="rounded-3xl border border-white/5 bg-slate-900 p-4">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Plain text fallback</p>
                                                <p className="mt-1 text-[11px] text-slate-500">Provider: {resolvedProviderMeta?.label || DELIVERY_PROVIDER_LABELS[resolvedProvider]}</p>
                                                <div className="mt-3 rounded-2xl bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-300">
                                                    {plainFromHtml(form.bodyHtml) || 'Plain text version will appear here.'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 space-y-4">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div>
                                                    <span className="block text-[10px] font-bold uppercase tracking-widest text-teal-400">Pre-send audit</span>
                                                    <p className="mt-1 text-sm text-slate-400">
                                                        This checks the same things users expect from Brevo or Resend before launch: provider connection, sender identity, content, and recipients.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={runComposeAudit}
                                                    className="rounded-xl border border-teal-500/20 bg-teal-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-teal-300 hover:bg-teal-500/20"
                                                >
                                                    {auditLoading ? 'Checking...' : 'Refresh audit'}
                                                </button>
                                            </div>

                                            {composeAudit.issues.length > 0 ? (
                                                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
                                                    <p className="text-xs font-black uppercase tracking-wider text-rose-300">Blocked</p>
                                                    <ul className="mt-2 space-y-1 text-sm text-rose-100">
                                                        {composeAudit.issues.map((issue) => (
                                                            <li key={issue}>• {issue}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ) : (
                                                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                                                    <p className="text-xs font-black uppercase tracking-wider text-emerald-300">Ready to launch</p>
                                                    <p className="mt-2 text-sm text-emerald-100">
                                                        The builder has enough sender, content, provider, and audience information to attempt delivery.
                                                    </p>
                                                </div>
                                            )}

                                            {composeAudit.warnings.length > 0 && (
                                                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                                                    <p className="text-xs font-black uppercase tracking-wider text-amber-300">Warnings</p>
                                                    <ul className="mt-2 space-y-1 text-sm text-amber-100">
                                                        {composeAudit.warnings.map((warning) => (
                                                            <li key={warning}>• {warning}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {composeAudit.info.length > 0 && (
                                                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4">
                                                    <p className="text-xs font-black uppercase tracking-wider text-sky-300">Audit notes</p>
                                                    <ul className="mt-2 space-y-1 text-sm text-sky-100">
                                                        {composeAudit.info.map((item) => (
                                                            <li key={item}>• {item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            <div className="rounded-2xl border border-white/5 bg-slate-950/70 p-4 space-y-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Send test</p>
                                                        <p className="mt-1 text-xs text-slate-400">Verify how the email looks in a real inbox before bulk delivery.</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={handleSendTestEmail}
                                                        disabled={sendingTestEmail || providerStateLoading}
                                                        className="rounded-xl bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-950 hover:bg-slate-200 disabled:opacity-50"
                                                    >
                                                        {sendingTestEmail ? 'Sending...' : 'Send test'}
                                                    </button>
                                                </div>
                                                <input
                                                    type="email"
                                                    value={testEmailAddress}
                                                    onChange={(e) => setTestEmailAddress(e.target.value)}
                                                    placeholder={senderProfile?.fromEmail || 'name@example.com'}
                                                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none"
                                                />
                                                <p className="text-[11px] text-slate-500">
                                                    Test uses {resolvedProviderMeta?.label || DELIVERY_PROVIDER_LABELS[resolvedProvider]} with the current subject and message draft.
                                                </p>
                                                {PROVIDER_DELIVERY_NOTES[resolvedProvider] ? (
                                                    <p className="text-[11px] text-slate-500">
                                                        {PROVIDER_DELIVERY_NOTES[resolvedProvider]}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 space-y-3">
                                            <label className="flex items-center gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={form.scheduleEnabled}
                                                    onChange={(e) => setForm((f) => ({ ...f, scheduleEnabled: e.target.checked }))}
                                                    className="rounded border-slate-600"
                                                />
                                                <span className="text-sm text-white font-medium">Schedule for later</span>
                                            </label>
                                            {form.scheduleEnabled && (
                                                <input
                                                    type="datetime-local"
                                                    value={form.scheduledAt}
                                                    onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                                />
                                            )}
                                            <label className="flex items-center gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={form.skipPreviouslyContacted}
                                                    onChange={(e) => setForm((f) => ({ ...f, skipPreviouslyContacted: e.target.checked }))}
                                                    className="rounded border-slate-600"
                                                />
                                                <span className="text-sm text-slate-400">Skip contacts already emailed</span>
                                            </label>
                                        </div>

                                        <button
                                            onClick={handleCreate}
                                            className="w-full py-4 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-teal-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            {form.scheduleEnabled && form.scheduledAt ? '📅 Schedule Campaign' : '🚀 Launch Email Campaign Now'}
                                        </button>
                                    </div>
                                )}

                                {/* Step controllers */}
                                <div className="flex justify-between items-center pt-4">
                                    {activeStep > 1 ? (
                                        <button 
                                            onClick={() => setActiveStep(prev => prev - 1)}
                                            className="text-xs text-slate-500 font-bold px-4 py-2 hover:text-white"
                                        >
                                            Back
                                        </button>
                                    ) : <div />}
                                    
                                    {activeStep < 4 ? (
                                        <button 
                                            onClick={() => {
                                                if (activeStep === 1 && (!form.name || !form.subject)) {
                                                    return toast.error('Name and subject are required');
                                                }
                                                if (activeStep === 2) {
                                                    if (!recipientType) {
                                                        return toast.error('Choose who should receive this');
                                                    }
                                                    if (recipientType === 'all' && contacts.length === 0) {
                                                        return toast.error('You have no contacts yet. Add contacts or paste recipients first.');
                                                    }
                                                    if (recipientType !== 'all' && selectedContactIds.length === 0) {
                                                        return toast.error('Select at least one recipient');
                                                    }
                                                }
                                                if (activeStep === 3 && !form.bodyHtml?.trim()) {
                                                    return toast.error('Write your message before continuing');
                                                }
                                                setActiveStep(prev => prev + 1);
                                            }}
                                            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase rounded-xl border border-white/5"
                                        >
                                            Continue
                                        </button>
                                    ) : <div />}
                                </div>
                            </div>

                            {/* AI Copilot Side Drawer */}
                            {showCopilot && (
                                <div className="w-full lg:w-[350px] bg-slate-900 border border-teal-500/20 rounded-3xl p-5 shadow-2xl space-y-4 shrink-0 animate-in slide-in-from-right-4 duration-300 lg:sticky lg:top-4">
                                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-teal-400 animate-pulse" />
                                            <span className="text-xs font-black text-white uppercase tracking-widest">AI Campaign Copilot</span>
                                        </div>
                                        <button 
                                            onClick={() => setShowCopilot(false)}
                                            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Messages list */}
                                    <div className="h-[300px] overflow-y-auto space-y-3 p-1 custom-scrollbar text-xs">
                                        {copilotMessages.map((msg, i) => (
                                            <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                                                <div className={`p-3 rounded-2xl max-w-[90%] whitespace-pre-wrap leading-relaxed ${
                                                    msg.sender === 'user' 
                                                        ? 'bg-teal-600 text-white rounded-tr-sm font-semibold' 
                                                        : 'bg-slate-950 text-slate-200 border border-slate-800 rounded-tl-sm'
                                                }`}>
                                                    {msg.text}
                                                </div>
                                                {msg.suggestion && (
                                                    <button
                                                        onClick={() => applyCopilotSuggestion(msg.suggestion)}
                                                        className="mt-2 px-3.5 py-2 bg-teal-500/10 border border-teal-500/30 text-teal-400 rounded-xl hover:bg-teal-500/20 transition-all font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 self-start"
                                                    >
                                                        <Check className="w-3.5 h-3.5" /> Apply AI Draft
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {copilotLoading && (
                                            <div className="flex items-center gap-2 text-slate-500 italic">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400" />
                                                <span>AI Agent thinking...</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Input Form */}
                                    <form onSubmit={handleCopilotSend} className="flex gap-2 pt-2 border-t border-slate-800">
                                        <input
                                            value={copilotInput}
                                            onChange={e => setCopilotInput(e.target.value)}
                                            placeholder="Suggest tech outreach, paste emails..."
                                            className="flex-1 h-9 bg-slate-950 border border-slate-800 rounded-xl px-3 text-xs text-white placeholder-slate-600 outline-none focus:border-teal-500/40"
                                        />
                                        <button 
                                            type="submit"
                                            disabled={copilotLoading || !copilotInput.trim()}
                                            className="h-9 w-9 bg-teal-600 text-white rounded-xl flex items-center justify-center hover:bg-teal-500 transition-colors disabled:opacity-50"
                                        >
                                            <Send className="w-3.5 h-3.5" />
                                        </button>
                                    </form>
                                </div>
                            )}
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>

            {/* iOS/PWA bottom nav overlay helper */}
            {viewMode === 'compose' && (
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-white/5 px-4 flex items-center justify-between z-[50] pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.4)]">
                    <button 
                        onClick={() => {
                            if (activeStep > 1) setActiveStep(prev => prev - 1);
                            else setViewMode('list');
                        }}
                        className="text-slate-500 flex items-center gap-1 text-xs font-bold"
                    >
                        <ArrowLeft className="w-4 h-4" /> Prev
                    </button>
                    <div className="flex gap-1">
                        {[1, 2, 3, 4].map(s => (
                            <div 
                                key={s} 
                                className={`w-1.5 h-1.5 rounded-full ${activeStep === s ? 'bg-teal-500 w-4' : 'bg-slate-800'} transition-all`} 
                            />
                        ))}
                    </div>
                    {activeStep < 4 ? (
                        <button 
                            onClick={() => {
                                if (activeStep === 1 && (!form.name || !form.subject)) {
                                    return toast.error('Name and subject are required');
                                }
                                if (activeStep === 2) {
                                    if (!recipientType) {
                                        return toast.error('Choose who should receive this');
                                    }
                                    if (recipientType === 'all' && contacts.length === 0) {
                                        return toast.error('You have no contacts yet. Add contacts or paste recipients first.');
                                    }
                                    if (recipientType !== 'all' && selectedContactIds.length === 0) {
                                        return toast.error('Select at least one recipient');
                                    }
                                }
                                if (activeStep === 3 && !form.bodyHtml?.trim()) {
                                    return toast.error('Write your message before continuing');
                                }
                                setActiveStep(prev => prev + 1);
                            }}
                            className="text-teal-400 text-xs font-black uppercase"
                        >
                            Next
                        </button>
                    ) : (
                        <button 
                            onClick={handleCreate}
                            className="text-emerald-400 text-xs font-black uppercase"
                        >
                            Launch
                        </button>
                    )}
                </div>
            )}

        </div>
        </BonnieModulePageShell>
    );
};

export default CampaignBuilder;
