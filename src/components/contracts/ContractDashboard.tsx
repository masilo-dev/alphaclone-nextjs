'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FileText, Bot, Printer, Save, CheckCircle, User, Building2, DollarSign, Calendar, Briefcase, Loader2, Eye, Edit3, RotateCcw, Languages, Scale, Send, MessageSquare, Sparkles, Trash2, CheckSquare, Square, PenTool } from 'lucide-react';
import { businessClientService, BusinessClient } from '../../services/businessClientService';
import { contractService, Contract } from '../../services/contractService';
import { fileUploadService } from '../../services/fileUploadService';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { User as UserType } from '../../types';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { showActionNextSteps } from '../common/showActionNextSteps';
import { OperationalWorkflowStrip } from '../dashboard/OperationalWorkflowStrip';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';
import { SignaturePad } from './SignaturePad';
import { ContractAuditLog } from './ContractAuditLog';
import { DocumentThemePicker } from '@/components/documents/DocumentThemePicker';
import { DocumentQualityPanel } from '@/components/documents/DocumentQualityPanel';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { BulkActions } from '@/components/BulkActions';
import CustomContextMenu from '@/components/common/CustomContextMenu';
import {
    buildContractDocumentInput,
    resolveDocumentThemeId,
} from '@/lib/documents/documentBuilders';
import type { DocumentThemeId } from '@/lib/documents/renderDocument';
import { ContractLifecycleDrawer } from '@/components/contracts/ContractLifecycleDrawer';
import { EmptyStateFromPreset } from '@/components/ui/EmptyState';
import { ContractTemplateLibrary, ContractTemplate } from './ContractTemplateLibrary';
import { ContractRenewalAlertsPanel } from './ContractRenewalAlertsPanel';
import { SignerProfileModal } from './SignerProfileModal';
import { JurisdictionFields } from './JurisdictionFields';
import { contractSignerProfileService } from '../../services/contractSignerProfileService';
import {
    EMPTY_SIGNER_PROFILE,
    applySignerProfileDefaults,
    type ContractSignerProfile,
} from '@/lib/contracts/signerProfile';
import { resolveContractGoverningLaw } from '@/lib/contracts/contractGoverningLaw';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
import 'react-quill-new/dist/quill.snow.css';
import {
    getContractProjectTypeOptions,
    getPreferredContractProjectTypes,
} from '../../services/universalServiceCatalog';
import { generateEmailDraft } from '../../services/unifiedAIService';
import { contractLifecycleService } from '../../services/contractLifecycleService';

interface ContractDashboardProps {
    user: UserType;
    initialTab?: string;
}

interface ContractForm {
    // Parties
    providerName: string;
    providerAddress: string;
    providerEmail: string;
    providerPhone: string;
    providerRegistration: string;
    clientId: string;
    clientName: string;
    clientCompany: string;
    clientAddress: string;
    clientEmail: string;
    clientPhone: string;
    // Project
    projectName: string;
    projectType: string;
    projectScope: string;
    deliverables: string;
    // Financial
    totalAmount: string;
    currency: string;
    paymentSchedule: string;
    depositPercent: string;
    // Timeline
    startDate: string;
    endDate: string;
    // Legal
    jurisdiction: string;
    governingLaw: string;
    // Extra
    additionalTerms: string;
    /** Target length for AI output (PDF pages still depend on print layout). */
    contractLength: '1' | '2' | '3' | 'full';
    /** BCP 47 or display label; passed to the model for generation language. */
    outputLanguage: string;
}

const CONTRACT_LENGTH_OPTIONS: { id: ContractForm['contractLength']; label: string; hint: string }[] = [
    { id: '1', label: '1 page (summary)', hint: 'Short agreement: parties, scope, payment, core terms, signatures.' },
    { id: '2', label: '2 pages (standard)', hint: 'Adds confidentiality, liability, and dispute basics.' },
    { id: '3', label: '3 pages (detailed)', hint: 'Broader clauses while staying relatively compact.' },
    { id: 'full', label: 'Full agreement (comprehensive)', hint: 'Full MSA-style sections; longest output.' },
];

const OUTPUT_LANGUAGES: { code: string; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Spanish' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'it', label: 'Italian' },
    { code: 'pt', label: 'Portuguese' },
    { code: 'nl', label: 'Dutch' },
    { code: 'pl', label: 'Polish' },
    { code: 'sv', label: 'Swedish' },
    { code: 'da', label: 'Danish' },
    { code: 'no', label: 'Norwegian' },
    { code: 'fi', label: 'Finnish' },
    { code: 'cs', label: 'Czech' },
    { code: 'ro', label: 'Romanian' },
    { code: 'el', label: 'Greek' },
    { code: 'tr', label: 'Turkish' },
    { code: 'ar', label: 'Arabic' },
    { code: 'he', label: 'Hebrew' },
    { code: 'hi', label: 'Hindi' },
    { code: 'zh', label: 'Chinese (Simplified)' },
    { code: 'ja', label: 'Japanese' },
    { code: 'ko', label: 'Korean' },
];

function maxTokensForLength(length: ContractForm['contractLength']): number {
    switch (length) {
        case '1':
            return 1600;
        case '2':
            return 2600;
        case '3':
            return 3600;
        default:
            return 4500;
    }
}

const PAYMENT_OPTIONS = [
    '50% upfront, 50% on delivery',
    '30% upfront, 30% at midpoint, 40% on delivery',
    '25% upfront, 25% at each milestone, 25% on delivery',
    'Monthly installments over project duration',
    '100% upfront before work begins',
    'Net 30 upon invoice',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'ZAR', 'NGN', 'GHS'];

const ContractDashboard: React.FC<ContractDashboardProps> = ({ user }) => {
    const router = useRouter();
    const { currentTenant } = useTenant();
    const { confirm: confirmDialog } = useConfirmDialog();
    const [projectTypeOptions, setProjectTypeOptions] = useState<string[]>(() => getContractProjectTypeOptions());
    const [clients, setClients] = useState<BusinessClient[]>([]);
    const [step, setStep] = useState<'form' | 'preview' | 'sign' | 'saved'>('form');
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiSuggesting, setAiSuggesting] = useState(false);
    const [signatureModalOpen, setSignatureModalOpen] = useState(false);
    // Owner's reusable signer profile: provider details, default governing law
    // and the adopted signature. Pre-fills every new contract.
    const [signerProfile, setSignerProfile] = useState<ContractSignerProfile>(EMPTY_SIGNER_PROFILE);
    const [generatedContract, setGeneratedContract] = useState('');
    const [contractId, setContractId] = useState<string>('');
    const [savedContracts, setSavedContracts] = useState<any[]>([]);
        const [loadingContracts, setLoadingContracts] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeView, setActiveView] = useState<'new' | 'list' | 'lawyer' | 'templates' | 'alerts'>('new');
    const [selectedContractIds, setSelectedContractIds] = useState<Set<string>>(new Set());
    const [bulkDeletingContracts, setBulkDeletingContracts] = useState(false);
    const [listQuery, setListQuery] = useState('');
    const [listStatusFilter, setListStatusFilter] = useState<'all' | 'draft' | 'sent' | 'client_signed' | 'fully_signed' | 'rejected'>('all');
    const [listSort, setListSort] = useState<'newest' | 'oldest' | 'title_asc' | 'title_desc' | 'value_desc' | 'value_asc'>('newest');
    const [lifecycleContractId, setLifecycleContractId] = useState<string | null>(null);
    
    // AI Lawyer Chat States
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
        { role: 'assistant', content: 'Hello! I am your AI Legal Assistant. You can ask me to review clauses, draft custom sections, explain legal terms, or evaluate potential risks. Select a contract below to analyze it specifically, or just start typing.' }
    ]);
    const [selectedContractIdForChat, setSelectedContractIdForChat] = useState<string>('');
    const [selectedClientIdForLawyer, setSelectedClientIdForLawyer] = useState<string>('');
    const [chatInput, setChatInput] = useState('');
    const [isLawyerResponding, setIsLawyerResponding] = useState(false);
    const [isSavingLawyerPdf, setIsSavingLawyerPdf] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeView === 'lawyer') {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages, activeView]);

    const handleSendLawyerMessage = async (customPrompt?: string) => {
        const textToSend = customPrompt || chatInput;
        if (!textToSend.trim()) return;

        const newMessages = [
            ...chatMessages,
            { role: 'user' as const, content: textToSend }
        ];
        setChatMessages(newMessages);
        setChatInput('');
        setIsLawyerResponding(true);

        // Add placeholder assistant response that we will stream into
        setChatMessages(prev => [...prev, { role: 'assistant' as const, content: '' }]);

        try {
            // Find contract context
            let contractContext = '';
            if (selectedContractIdForChat) {
                const contract = savedContracts.find(c => c.id === selectedContractIdForChat);
                if (contract) {
                    contractContext = `You are reviewing the following contract:\nTitle: ${contract.title}\nContent:\n${contract.content || contract.original_content || ''}\n\n`;
                }
            }

            let clientContext = '';
            if (selectedClientIdForLawyer && clients.length > 0) {
                const client = clients.find((c) => c.id === selectedClientIdForLawyer);
                if (client) {
                    clientContext = `Client context from CRM:\nName: ${client.name}\nEmail: ${client.email || 'N/A'}\nPhone: ${client.phone || 'N/A'}\nLocation: ${client.location || 'N/A'}\n\n`;
                }
            }

            const jurisdictionHint = form.jurisdiction
                ? `Preferred governing jurisdiction: ${form.jurisdiction}${form.governingLaw ? ` (${form.governingLaw})` : ''}.\n\n`
                : '';

            const prompt = `You are an expert professional contract lawyer specializing in EU/EEA and international commercial agreements. Provide clean, professional, legally sound analysis and explanations. When drafting clauses, use the client's name and jurisdiction when known. Format responses in markdown suitable for a professional PDF export.\n\n${jurisdictionHint}${clientContext}${contractContext}User Question: ${textToSend}`;

            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    maxTokens: 1500,
                    stream: true,
                    ...(currentTenant?.id ? { tenantId: currentTenant.id } : {}),
                }),
            });

            if (!res.ok) {
                // Surface the actual reason (quota, workspace, provider) instead of a silent failure.
                let serverMsg = '';
                try {
                    const errJson = await res.json();
                    if (errJson?.code === 'TENANT_REQUIRED') {
                        serverMsg = 'Please select your workspace/organization first, then ask again.';
                    } else if (res.status === 429 || /quota/i.test(errJson?.error || '')) {
                        serverMsg = "You've reached today's AI usage limit. Please try again later or upgrade your plan.";
                    } else if (res.status === 503) {
                        serverMsg = 'The AI service is not configured yet (no provider key). Please add an AI provider key in settings.';
                    } else {
                        serverMsg = errJson?.error || '';
                    }
                } catch {
                    /* response wasn't JSON */
                }
                throw new Error(serverMsg || 'Failed to get lawyer response');
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error('No reader available');

            const decoder = new TextDecoder();
            let done = false;
            let accumulated = '';

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                const chunkValue = decoder.decode(value);
                accumulated += chunkValue;

                setChatMessages(prev => {
                    const next = [...prev];
                    if (next.length > 0) {
                        next[next.length - 1] = { role: 'assistant', content: accumulated };
                    }
                    return next;
                });

                if (doneReading) break;
            }

            // Guard against a completed-but-empty stream so users never see endless loading dots.
            if (!accumulated.trim()) {
                setChatMessages(prev => {
                    const next = [...prev];
                    if (next.length > 0) {
                        next[next.length - 1] = { role: 'assistant', content: "I couldn't generate a response just now. Please rephrase your question or try again in a moment." };
                    }
                    return next;
                });
            }
        } catch (err: any) {
            console.error(err);
            const friendly = err?.message && err.message !== 'Failed to get lawyer response'
                ? err.message
                : 'Sorry, I encountered an error while processing your request. Please try again.';
            setChatMessages(prev => {
                const next = [...prev];
                if (next.length > 0) {
                    next[next.length - 1] = { role: 'assistant', content: friendly };
                }
                return next;
            });
        } finally {
            setIsLawyerResponding(false);
        }
    };

    const stripMarkdownFence = (content: string) =>
        content.replace(/```(?:markdown|md)?\s*|```/g, '').trim();

    const handleSaveLawyerDraftAsPdf = async (content: string) => {
        if (!currentTenant?.id) {
            toast.error('Select a workspace first');
            return;
        }
        setIsSavingLawyerPdf(true);
        const toastId = toast.loading('Saving contract and generating PDF...');
        try {
            const cleaned = stripMarkdownFence(content);
            if (!cleaned.trim()) throw new Error('Nothing to save yet');

            const title = `AI Lawyer Agreement — ${form.clientName || 'Client'} — ${format(new Date(), 'MMM d, yyyy')}`;
            const html = cleaned.startsWith('<') ? cleaned : contractToHTML(cleaned);
            const { contract, error } = await contractService.createContract({
                title,
                content: html,
                status: 'draft',
                client_id: selectedClientIdForLawyer || form.clientId || undefined,
                metadata: {
                    document_theme: documentTheme,
                    client_name: form.clientName,
                    client_email: form.clientEmail,
                    source: 'lawyer_assistant',
                },
            });
            if (error || !contract) throw new Error(typeof error === 'object' && error && 'message' in error ? String((error as any).message) : String(error || 'Failed to save contract'));

            setGeneratedContract(cleaned);
            setEditedHtml(html);
            setContractId(contract.id);
            setStep('preview');
            setPreviewTab('document');
            setIsEditing(false);
            setIsSigned(false);
            setSignatureName('');
            setSignatureData('');
            setActiveView('new');

            await contractService.downloadPDF({ ...contract, content: html }, currentTenant);
            toast.success('AI Lawyer contract saved and PDF generated', { id: toastId });
        } catch (err: any) {
            toast.error(err?.message || 'Failed to generate PDF', { id: toastId });
        } finally {
            setIsSavingLawyerPdf(false);
        }
    };

    const [signatureName, setSignatureName] = useState('');
    const [signatureData, setSignatureData] = useState('');
    const [signatureDate] = useState(format(new Date(), 'MMMM d, yyyy'));
    const [isSigned, setIsSigned] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);
    const [showSendModal, setShowSendModal] = useState(false);
    const [sendingContract, setSendingContract] = useState(false);
    const [aiDraftingSend, setAiDraftingSend] = useState(false);
    const [aiSendInstructions, setAiSendInstructions] = useState('');
    const [sendForm, setSendForm] = useState({ recipientEmail: '', subject: '', message: '', provider: 'auto' as string, jurisdiction: '', governingLaw: '' });
    const [resendForSignature, setResendForSignature] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedHtml, setEditedHtml] = useState('');
    const [previewTab, setPreviewTab] = useState<'document' | 'audit'>('document');
    const [lifecycleStats, setLifecycleStats] = useState({
        templateCount: 0,
        pendingApprovals: 0,
        versionCount: 0,
    });

    const today = format(new Date(), 'MMMM d, yyyy');
    const ninetyDays = format(new Date(Date.now() + 90 * 86400000), 'MMMM d, yyyy');

    const [form, setForm] = useState<ContractForm>({
        providerName: currentTenant?.name || '',
        providerAddress: '',
        providerEmail: user.email || '',
        providerPhone: '',
        providerRegistration: '',
        clientId: '',
        clientName: '',
        clientCompany: '',
        clientAddress: '',
        clientEmail: '',
        clientPhone: '',
        projectName: '',
        projectType: getContractProjectTypeOptions()[0] ?? 'Other (describe fully in scope below)',
        projectScope: '',
        deliverables: '',
        totalAmount: '',
        currency: 'USD',
        paymentSchedule: PAYMENT_OPTIONS[0],
        depositPercent: '50',
        startDate: today,
        endDate: ninetyDays,
        jurisdiction: '',
        governingLaw: '',
        additionalTerms: '',
        contractLength: 'full',
        outputLanguage: 'en',
    });
    const [documentTheme, setDocumentTheme] = useState<DocumentThemeId>('executive');

    useEffect(() => {
        if (currentTenant?.id) {
            businessClientService.getClients(currentTenant.id).then(({ clients: c }) => setClients(c || []));
            supabase.from('contracts').select('*').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false })
                .then(({ data }: { data: any[] | null }) => { setSavedContracts(data || []); setLoadingContracts(false); })
                .catch(() => setLoadingContracts(false));
            Promise.all([
                contractLifecycleService.getTemplates(),
                contractLifecycleService.getApprovals(),
                supabase.from('contract_versions').select('id', { count: 'exact', head: true }).eq('tenant_id', currentTenant.id),
            ]).then(([templatesRes, approvalsRes, versionsRes]) => {
                setLifecycleStats({
                    templateCount: templatesRes.templates.length,
                    pendingApprovals: approvalsRes.approvals.filter((approval) => approval.status === 'pending').length,
                    versionCount: versionsRes.count || 0,
                });
            }).catch(() => {
                setLifecycleStats({ templateCount: 0, pendingApprovals: 0, versionCount: 0 });
            });
        }
    }, [currentTenant?.id]);

    // Load the saved signer profile once and pre-fill the provider block +
    // governing law so the owner never retypes them.
    useEffect(() => {
        let cancelled = false;
        contractSignerProfileService.load().then((profile) => {
            if (cancelled) return;
            setSignerProfile(profile);
            setForm((prev) => applySignerProfileDefaults(prev, profile, { tenantFallbackName: currentTenant?.name || '' }));
        });
        return () => { cancelled = true; };
    }, [currentTenant?.name, user.id]);

    const applySignerProfile = (profile: ContractSignerProfile) => {
        setSignerProfile(profile);
        setForm((prev) => applySignerProfileDefaults(prev, profile, { tenantFallbackName: currentTenant?.name || '' }));
    };

    /** Persist the provider block + governing law from the current form (fire-and-forget). */
    const rememberSignerDetails = (f: ContractForm) => {
        const patch = {
            providerName: f.providerName,
            providerAddress: f.providerAddress,
            providerEmail: f.providerEmail,
            providerPhone: f.providerPhone,
            providerRegistration: f.providerRegistration,
            jurisdiction: f.jurisdiction,
            governingLaw: f.governingLaw,
        };
        const unchanged = (Object.keys(patch) as (keyof typeof patch)[]).every((key) => (signerProfile[key] || '') === (patch[key] || '').trim());
        if (unchanged) return;
        contractSignerProfileService.save(patch).then(setSignerProfile).catch((error) => {
            console.warn('[contracts] signer details were not remembered', error);
        });
    };

    const rememberSignature = async (cleanDataUrl: string, fullName: string) => {
        try {
            const saved = await contractSignerProfileService.save({ signature: { dataUrl: cleanDataUrl, fullName } });
            setSignerProfile(saved);
            toast.success('Signature saved — next time you can sign with one click.');
        } catch (error) {
            toast.error((error as Error).message || 'Signature could not be saved for reuse');
        }
    };

    useEffect(() => {
        if (!currentTenant?.id) return;
        supabase
            .from('business_settings')
            .select('settings')
            .eq('tenant_id', currentTenant.id)
            .maybeSingle()
            .then(({ data }: { data: { settings?: { service_sectors?: string[] } } | null }) => {
                const sectors = data?.settings?.service_sectors ?? [];
                const preferred = getPreferredContractProjectTypes(sectors);
                const all = getContractProjectTypeOptions();
                const merged = [...new Set([...preferred, ...all])];
                setProjectTypeOptions(merged);
            });
    }, [currentTenant?.id]);

    useEffect(() => {
        if (projectTypeOptions.length === 0) return;
        setForm(prev =>
            projectTypeOptions.includes(prev.projectType)
                ? prev
                : { ...prev, projectType: projectTypeOptions[0] }
        );
    }, [projectTypeOptions]);

    useEffect(() => {
        if (form.clientId && clients.length > 0) {
            const c = clients.find(cl => cl.id === form.clientId);
            if (c) {
                setForm(prev => ({
                    ...prev,
                    clientName: c.name || prev.clientName,
                    clientEmail: c.email || prev.clientEmail,
                    clientAddress: c.location || prev.clientAddress,
                    clientPhone: c.phone || prev.clientPhone,
                    clientCompany: c.name || prev.clientCompany,
                }));
            }
        }
    }, [form.clientId, clients]);

    const set = (field: keyof ContractForm, val: string) =>
        setForm(prev => ({ ...prev, [field]: val }));

    const generateContract = async () => {
        if (!form.clientName.trim()) { toast.error('Client name is required'); return; }
        if (!form.projectName.trim()) { toast.error('Project name is required'); return; }
        if (!form.totalAmount.trim()) { toast.error('Contract value is required'); return; }
        if (!form.jurisdiction.trim() || !form.governingLaw.trim()) {
            toast.error('Governing jurisdiction and governing law are required — a contract cannot be sent for signature without them.');
            return;
        }

        rememberSignerDetails(form);
        setIsGenerating(true);
        setGeneratedContract('');
        // A fresh draft has no saved row, no signature and no manual edits.
        // Reset here, before streaming starts — never after it finishes, or a
        // signature adopted while the text was still arriving would be wiped.
        setEditedHtml('');
        setIsEditing(false);
        setContractId('');
        setIsSigned(false);
        setSignatureName('');
        setSignatureData('');
        setPreviewTab('document');
        setStep('preview');

        try {
            const prompt = buildAIPrompt(form);
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    maxTokens: maxTokensForLength(form.contractLength),
                    stream: true,
                    ...(currentTenant?.id ? { tenantId: currentTenant.id } : {}),
                }),
            });

            if (!res.ok) throw new Error('Generation failed');

            const reader = res.body?.getReader();
            if (!reader) throw new Error('No reader available');

            const decoder = new TextDecoder();
            let done = false;
            let accumulated = '';

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                const chunkValue = decoder.decode(value);
                accumulated += chunkValue;
                setGeneratedContract(accumulated);

                // Keep UI feeling responsive
                if (doneReading) break;
            }

            setEditedHtml(contractToHTML(accumulated));
        } catch (err) {
            console.error('Streaming error:', err);
            toast.error('AI Streaming failed, using template...');
            // Fallback: generate from template
            const template = buildTemplateContract(form, form.contractLength);
            setGeneratedContract(template);
            setEditedHtml(contractToHTML(template));
        } finally {
            setIsGenerating(false);
        }
    };

    const saveContract = async () => {
        if (!currentTenant?.id) return;
        setIsSaving(true);
        try {
            const content = isEditing ? editedHtml : (editedHtml || contractToHTML(generatedContract));
            const legal = resolveContractGoverningLaw({
                provided: { governingLaw: form.governingLaw, jurisdiction: form.jurisdiction },
                content,
            });
            const metadata = {
                document_theme: documentTheme,
                client_name: form.clientName,
                client_email: form.clientEmail,
                client_address: form.clientAddress,
                project_name: form.projectName,
                provider_name: form.providerName,
                supplier_legal_name: form.providerName,
                admin_signer_name: isSigned ? signatureName : undefined,
            };
            const existing = contractId ? savedContracts.find((c) => c.id === contractId) : undefined;
            let saved: any;
            if (existing) {
                // Re-saving a contract that was opened from the list: update it in
                // place instead of creating a duplicate row.
                const { contract, error } = await contractService.updateContract(contractId, {
                    content,
                    status: isSigned && existing.status === 'draft' ? 'sent' : undefined,
                    payment_amount: parseFloat(form.totalAmount) || existing.payment_amount || 0,
                    admin_signature: isSigned ? signatureData : undefined,
                    admin_signed_at: isSigned ? (existing.admin_signed_at || new Date().toISOString()) : undefined,
                    governing_law: legal.governingLaw || undefined,
                    jurisdiction: legal.jurisdiction || undefined,
                    metadata: { ...(existing.metadata || {}), ...metadata },
                });
                if (error) throw new Error(error.message);
                saved = contract;
                setSavedContracts((prev) => prev.map((c) => (c.id === contractId ? { ...c, ...saved } : c)));
                toast.success('Contract updated');
            } else {
                const { contract, error } = await contractService.createContract({
                    title: `${form.projectName} — ${form.clientName}`,
                    content,
                    client_id: form.clientId || undefined,
                    status: isSigned ? 'sent' : 'draft',
                    payment_amount: parseFloat(form.totalAmount) || 0,
                    admin_signature: isSigned ? signatureData : undefined,
                    admin_signed_at: isSigned ? new Date().toISOString() : undefined,
                    governing_law: legal.governingLaw || undefined,
                    jurisdiction: legal.jurisdiction || undefined,
                    metadata,
                });
                if (error) throw new Error(String(error.message || error));
                saved = contract;
                toast.success('Contract saved successfully!');
                if (contract?.id) setContractId(contract.id);
                setSavedContracts(prev => [contract, ...prev]);
            }
            rememberSignerDetails(form);
            showActionNextSteps(isSigned ? 'contract_signed' : 'contract_saved', (path) => router.push(path));
            setStep('saved');
            setIsEditing(false);
        } catch (e: any) {
            toast.error(e.message || 'Failed to save contract');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => {
        const mockContract: Partial<Contract> = {
            id: contractId || 'NEW',
            title: `${form.projectName} — ${form.clientName}`,
            content: generatedContract,
            admin_signature: signatureData,
            admin_signed_at: isSigned ? new Date().toISOString() : undefined,
            status: isSigned ? 'sent' : 'draft'
        };
        try {
            toast.success("PDF Download started...");
            contractService.downloadPDF(mockContract, currentTenant || undefined);
        } catch (e) {
            toast.error("Failed to generate PDF");
        }
    };

    const resolveContractClientContact = (contract?: any | null) => {
        const meta = (contract?.metadata || {}) as Record<string, unknown>;
        const linkedClient =
            (contract?.client_id && clients.find((c) => c.id === contract.client_id)) ||
            (form.clientId && clients.find((c) => c.id === form.clientId)) ||
            null;

        const emailCandidates = [
            contract?.client_email,
            meta.client_email,
            meta.clientEmail,
            meta.signer_email,
            linkedClient?.email,
            form.clientEmail,
        ]
            .map((value) => String(value || '').trim())
            .filter((value) => value.includes('@'));

        const nameCandidates = [
            meta.client_name,
            meta.clientName,
            linkedClient?.name,
            form.clientName,
            contract?.client_name,
        ]
            .map((value) => String(value || '').trim())
            .filter(Boolean);

        return {
            email: emailCandidates[0] || '',
            name: nameCandidates[0] || 'the client',
            clientId: String(contract?.client_id || linkedClient?.id || form.clientId || ''),
        };
    };

    /**
     * True when the contract being sent has no governing law on its row and
     * none can be recovered from its text — the server would reject the send,
     * so the modal asks for it up front instead.
     */
    const sendNeedsGoverningLaw = useMemo(() => {
        if (!showSendModal || !contractId) return false;
        const target = savedContracts.find((c) => c.id === contractId);
        if (!target) return false;
        return resolveContractGoverningLaw({ row: target, content: target.content }).source === 'none';
    }, [showSendModal, contractId, savedContracts]);

    const openSendContractModal = (options?: { resend?: boolean; contract?: any }) => {
        const targetContract = options?.contract;
        const isResend = Boolean(options?.resend);
        const contractTitle = targetContract?.title || form.projectName || 'Service Agreement';
        const contact = resolveContractClientContact(targetContract);
        const targetEmail = contact.email;
        const projectLabel =
            form.projectName ||
            String((targetContract?.metadata as Record<string, unknown> | undefined)?.project_name || '') ||
            contractTitle;

        setResendForSignature(isResend);
        setSendForm({
            recipientEmail: targetEmail,
            subject: isResend
                ? `Action required: Sign contract — ${contractTitle} (your process is on hold)`
                : `Contract: ${contractTitle}`,
            message: isResend
                ? `We still need your signature on "${contractTitle}". Until this contract is signed, we cannot move your project forward. Please review and sign using the secure link as soon as possible.`
                : `Hello${contact.name && contact.name !== 'the client' ? ` ${contact.name}` : ''},\n\nPlease review and sign the attached contract for ${projectLabel || 'our engagement'}.\n\nBest regards,\n${form.providerName || user.name}`,
            provider: 'auto',
            jurisdiction: form.jurisdiction || signerProfile.jurisdiction,
            governingLaw: form.governingLaw || signerProfile.governingLaw,
        });
        setAiSendInstructions(
            isResend
                ? `Write an urgent but professional follow-up asking ${contact.name} to sign "${contractTitle}" because the project cannot proceed until signed.`
                : `Write a professional contract delivery email for ${contact.name} about ${projectLabel || 'our engagement'}. Keep it concise and clear.`
        );
        if (targetContract?.id) {
            setContractId(targetContract.id);
        }
        if (contact.email && !form.clientEmail) {
            setForm((prev) => ({
                ...prev,
                clientEmail: contact.email,
                clientName: contact.name !== 'the client' ? contact.name : prev.clientName,
                clientId: contact.clientId || prev.clientId,
            }));
        }
        setShowSendModal(true);
        if (!targetEmail) {
            toast.error('No client email on this contract yet — pick the client or type their email before sending.');
        }
    };

    const handleAiDraftSendMessage = async () => {
        setAiDraftingSend(true);
        try {
            const instruction = aiSendInstructions.trim()
                ? aiSendInstructions.trim()
                : `Write a professional contract delivery email for project ${form.projectName} and client ${form.clientName}.`;
            const draft = await generateEmailDraft(
                instruction,
                sendForm.recipientEmail,
                sendForm.subject
            );
            if (draft) setSendForm(prev => ({ ...prev, message: draft }));
            else toast.error('Failed to generate AI draft');
        } catch {
            toast.error('Failed to generate AI draft');
        } finally {
            setAiDraftingSend(false);
        }
    };

    const handleSendContract = async () => {
        if (!currentTenant?.id) return;
        if (!sendForm.recipientEmail.trim()) {
            toast.error('Recipient email is required');
            return;
        }
        if (!contractId) {
            toast.error('Save the contract first before sending');
            return;
        }
        if (sendNeedsGoverningLaw && (!sendForm.jurisdiction.trim() || !sendForm.governingLaw.trim())) {
            toast.error('Pick the governing jurisdiction and law — the contract cannot be sent without them.');
            return;
        }

        setSendingContract(true);
        try {
            const res = await fetch('/api/contracts/management', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                    tenantId: currentTenant.id,
                    action: 'send_contract',
                    config: {
                        contractId,
                        recipients: [sendForm.recipientEmail.trim()],
                        subject: sendForm.subject,
                        message: sendForm.message,
                        format: 'pdf',
                        userId: user.id,
                        provider: sendForm.provider !== 'auto' ? sendForm.provider : undefined,
                        resendForSignature,
                        jurisdiction: sendForm.jurisdiction.trim() || undefined,
                        governingLaw: sendForm.governingLaw.trim() || undefined,
                    },
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok || !payload?.success) {
                throw new Error(payload?.error || 'Failed to send contract');
            }
            const sentAt = new Date().toISOString();
            setSavedContracts((prev) => prev.map((c) => (c.id === contractId
                ? {
                    ...c,
                    status: c.status === 'draft' ? 'sent' : c.status,
                    updated_at: sentAt,
                    governing_law: c.governing_law || sendForm.governingLaw.trim() || c.governing_law,
                    jurisdiction: c.jurisdiction || sendForm.jurisdiction.trim() || c.jurisdiction,
                }
                : c)));
            toast.success(resendForSignature ? 'Signature request resent' : 'Contract sent successfully');
            setShowSendModal(false);
            setResendForSignature(false);
        } catch (error: any) {
            toast.error(error?.message || 'Failed to send contract');
        } finally {
            setSendingContract(false);
        }
    };

    const inputCls = 'w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-all text-sm';
    const labelCls = 'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5';
    const sectionCls = 'bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4';

    const draftContracts = savedContracts.filter((c) => c.status === 'draft');
    const toggleContractSelection = (contractId: string, isDraft: boolean) => {
        if (!isDraft) {
            toast.error('Only draft contracts can be deleted. Signed contracts stay on file for your records.');
            return;
        }
        setSelectedContractIds((prev) => {
            const next = new Set(prev);
            if (next.has(contractId)) next.delete(contractId);
            else next.add(contractId);
            return next;
        });
    };

    const parseContractValue = (c: any) => {
        if (typeof c.value === 'number') return c.value;
        const raw = c.value ?? c.payment_amount ?? c.total_amount ?? 0;
        const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
        return Number.isFinite(num) ? num : 0;
    };

    const listContracts = useMemo(() => {
        const q = listQuery.trim().toLowerCase();
        const base = savedContracts.filter((c) => {
            if (listStatusFilter !== 'all' && c.status !== listStatusFilter) return false;
            if (!q) return true;
            const contact = resolveContractClientContact(c);
            const hay = [
                String(c.title || ''),
                String(c.status || ''),
                String(c.currency || ''),
                String(contact.name || ''),
                String(contact.email || ''),
            ]
                .join(' ')
                .toLowerCase();
            return hay.includes(q);
        });

        const sorted = [...base];
        sorted.sort((a, b) => {
            const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
            const aTitle = String(a.title || '');
            const bTitle = String(b.title || '');
            const aVal = parseContractValue(a);
            const bVal = parseContractValue(b);
            switch (listSort) {
                case 'oldest':
                    return aCreated - bCreated;
                case 'title_asc':
                    return aTitle.localeCompare(bTitle);
                case 'title_desc':
                    return bTitle.localeCompare(aTitle);
                case 'value_asc':
                    return aVal - bVal;
                case 'value_desc':
                    return bVal - aVal;
                case 'newest':
                default:
                    return bCreated - aCreated;
            }
        });

        return sorted;
    }, [listQuery, listSort, listStatusFilter, savedContracts]);

    const handleBulkDeleteContracts = async (
        idsOverride?: string[] | React.MouseEvent<HTMLButtonElement>
    ) => {
        if (idsOverride && !Array.isArray(idsOverride)) {
            idsOverride.preventDefault();
        }
        const ids = Array.isArray(idsOverride) ? idsOverride : [...selectedContractIds];
        if (!ids.length) return;
        const ok = await confirmDialog({
            title: 'Delete draft contracts?',
            description: `Delete ${ids.length} draft contract(s)? This cannot be undone.`,
            confirmLabel: 'Delete drafts',
            cancelLabel: 'Cancel',
            variant: 'danger',
        });
        if (!ok) return;

        const deleteSet = new Set(ids);
        setBulkDeletingContracts(true);
        const toastId = toast.loading(`Deleting ${ids.length} contract(s)...`);
        try {
            const { error, count, skipped } = await contractService.bulkDeleteContracts(ids);
            if (error) throw new Error(String(error));
            setSavedContracts((prev) => prev.filter((c) => !deleteSet.has(c.id)));
            setSelectedContractIds((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.delete(id));
                return next;
            });
            if (skipped > 0) {
                toast.success(`Deleted ${count} draft(s). ${skipped} signed contract(s) were skipped.`, { id: toastId });
            } else {
                toast.success(`Deleted ${count} contract(s)`, { id: toastId });
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Bulk delete failed', { id: toastId });
        } finally {
            setBulkDeletingContracts(false);
        }
    };

    const handleDeleteSingleDraft = async (contractIdToDelete: string) => {
        const target = savedContracts.find((c) => c.id === contractIdToDelete);
        if (!target) return;
        if (target.status !== 'draft') {
            toast.error('Only draft contracts can be deleted.');
            return;
        }
        const ok = await confirmDialog({
            title: 'Delete draft contract?',
            description: `Delete "${target.title || 'Draft contract'}"? This cannot be undone.`,
            confirmLabel: 'Delete draft',
            cancelLabel: 'Cancel',
            variant: 'danger',
        });
        if (!ok) return;

        const toastId = toast.loading('Deleting draft...');
        try {
            const { error } = await contractService.bulkDeleteContracts([contractIdToDelete]);
            if (error) throw new Error(String(error));
            setSavedContracts((prev) => prev.filter((c) => c.id !== contractIdToDelete));
            setSelectedContractIds((prev) => {
                const next = new Set(prev);
                next.delete(contractIdToDelete);
                return next;
            });
            toast.success('Draft deleted', { id: toastId });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Delete failed', { id: toastId });
        }
    };

    return (
        <div className="min-h-full text-white px-1 sm:px-0">
            <OperationalWorkflowStrip moduleId="contracts" userRole={user.role} className="mb-3 sm:mb-4" />
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5 sm:mb-6">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-white">Contract Generator</h1>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">AI-assisted contracts tailored to your client and scope.</p>
                </div>
                <div className="flex gap-2 shrink-0 w-full sm:w-auto flex-wrap">
                    <button
                        type="button"
                        onClick={() => setActiveView('new')}
                        className={`flex-1 sm:flex-none h-8 px-3 rounded-full text-[11px] font-bold transition-all ${activeView === 'new' ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                    >
                        New Contract
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveView('list')}
                        className={`flex-1 sm:flex-none h-8 px-3 rounded-full text-[11px] font-bold transition-all ${activeView === 'list' ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                    >
                        Saved ({savedContracts.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveView('templates')}
                        className={`flex-1 sm:flex-none h-8 px-3 rounded-full text-[11px] font-bold transition-all ${activeView === 'templates' ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                    >
                        Templates
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveView('alerts')}
                        className={`flex-1 sm:flex-none h-8 px-3 rounded-full text-[11px] font-bold transition-all ${activeView === 'alerts' ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                    >
                        Renewal Alerts
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveView('lawyer')}
                        className={`flex-1 sm:flex-none h-8 px-3 rounded-full text-[11px] font-bold transition-all ${activeView === 'lawyer' ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                    >
                        AI Lawyer
                    </button>
                    <button
                        type="button"
                        onClick={() => setSignatureModalOpen(true)}
                        className="flex-1 sm:flex-none h-8 px-3 rounded-full text-[11px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 hover:bg-teal-500/30 transition-all flex items-center justify-center gap-1.5"
                        title="Your saved signature and signer details, reused on every contract"
                    >
                        <PenTool className="w-3 h-3" /> My signature
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {[
                    { label: 'Active Templates', value: lifecycleStats.templateCount, tone: 'text-sky-300' },
                    { label: 'Pending Approvals', value: lifecycleStats.pendingApprovals, tone: 'text-amber-300' },
                    { label: 'Stored Versions', value: lifecycleStats.versionCount, tone: 'text-emerald-300' },
                ].map((item) => (
                    <div key={item.label} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                        <p className={`mt-2 text-2xl font-black ${item.tone}`}>{item.value}</p>
                    </div>
                ))}
            </div>

            {activeView === 'templates' && (
                <ContractTemplateLibrary
                    onUseTemplate={(tmpl: ContractTemplate) => {
                        set('projectName', tmpl.title);
                        set('projectScope', tmpl.body);
                        setActiveView('new');
                        toast.success(`Loaded "${tmpl.title}" into draft form`);
                    }}
                />
            )}

            {activeView === 'alerts' && (
                <ContractRenewalAlertsPanel
                    onOpenContract={(id: string) => {
                        setLifecycleContractId(id);
                    }}
                />
            )}
            {activeView === 'list' && (
                <div className="space-y-2 sm:space-y-3">
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex-1 min-w-0">
                                <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">
                                    Search
                                </label>
                                <input
                                    className={inputCls}
                                    value={listQuery}
                                    onChange={(e) => setListQuery(e.target.value)}
                                    placeholder="Search by title, client, email, status…"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end sm:justify-end sm:gap-3">
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">
                                        Status
                                    </label>
                                    <select
                                        className={inputCls}
                                        value={listStatusFilter}
                                        onChange={(e) => setListStatusFilter(e.target.value as any)}
                                    >
                                        <option value="all">All</option>
                                        <option value="draft">Draft</option>
                                        <option value="sent">Sent</option>
                                        <option value="client_signed">Client signed</option>
                                        <option value="fully_signed">Fully signed</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1.5">
                                        Sort
                                    </label>
                                    <select
                                        className={inputCls}
                                        value={listSort}
                                        onChange={(e) => setListSort(e.target.value as any)}
                                    >
                                        <option value="newest">Newest</option>
                                        <option value="oldest">Oldest</option>
                                        <option value="title_asc">Title A–Z</option>
                                        <option value="title_desc">Title Z–A</option>
                                        <option value="value_desc">Value high–low</option>
                                        <option value="value_asc">Value low–high</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-slate-500">
                                Tip: select drafts to delete. Signed contracts remain for compliance.
                            </p>
                            <p className="text-xs text-slate-500">
                                Showing <span className="text-slate-300 font-semibold">{listContracts.length}</span> of{' '}
                                <span className="text-slate-300 font-semibold">{savedContracts.length}</span>
                            </p>
                        </div>
                    </div>

                    <BulkActions
                        items={listContracts.filter((c) => c.status === 'draft')}
                        selectedIds={selectedContractIds}
                        onSelectionChange={setSelectedContractIds}
                        actions={[
                            {
                                label: 'Delete drafts',
                                icon: <Trash2 className="w-4 h-4" aria-hidden="true" />,
                                variant: 'danger',
                                onClick: async (selected) => {
                                    await handleBulkDeleteContracts(selected.map((s) => s.id));
                                },
                            },
                        ]}
                    />
                    {loadingContracts ? (
                        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-teal-400 animate-spin" /></div>
                    ) : savedContracts.length === 0 ? (
                        <div className="px-4 py-6">
                            <EmptyStateFromPreset
                                moduleId="contracts"
                                onAction={() => setActiveView('new')}
                            />
                        </div>
                    ) : listContracts.length === 0 ? (
                        <div className="text-center py-14 sm:py-16 text-slate-500 text-xs px-4">
                            <FileText className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-3 opacity-30" />
                            <p>No contracts match your filters.</p>
                            <button
                                type="button"
                                onClick={() => { setListQuery(''); setListStatusFilter('all'); setListSort('newest'); }}
                                className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-white/5"
                            >
                                Reset filters
                            </button>
                        </div>
                    ) : listContracts.map((c: any) => {
                        const statusBadgeStyles = {
                            fully_signed: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
                            client_signed: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                            sent: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                            draft: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
                            rejected: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                        }[c.status as string] || 'text-slate-400 bg-slate-500/10 border-slate-500/20';

                        const getExpiry = () => {
                            const date = c.created_at ? new Date(c.created_at) : new Date();
                            date.setFullYear(date.getFullYear() + 1);
                            return format(date, 'MMM d, yyyy');
                        };

                        const contextItems = [
                            {
                                label: 'View',
                                icon: <Eye className="w-4 h-4" aria-hidden="true" />,
                                onClick: () => {
                                    const html = c.content.startsWith('<') ? c.content : contractToHTML(c.content);
                                    setEditedHtml(html);
                                    setGeneratedContract(c.content);
                                    setContractId(c.id);
                                    setSignatureData(c.admin_signature || '');
                                    setSignatureName(
                                        c.admin_signature
                                            ? String(c.metadata?.admin_signer_name || signerProfile.signature?.fullName || signerProfile.providerName || 'Administrator')
                                            : '',
                                    );
                                    setIsSigned(!!c.admin_signature);
                                    setDocumentTheme(resolveDocumentThemeId(c.metadata || {}));

                                    const contact = resolveContractClientContact(c);
                                    const linked = c.client_id
                                        ? clients.find((cl) => cl.id === c.client_id)
                                        : undefined;
                                    setForm((prev) => ({
                                        ...prev,
                                        clientId: c.client_id || prev.clientId,
                                        clientName: contact.name !== 'the client' ? contact.name : prev.clientName,
                                        clientEmail: contact.email || prev.clientEmail,
                                        clientCompany: linked?.name || prev.clientCompany,
                                        clientPhone: linked?.phone || prev.clientPhone,
                                        clientAddress: linked?.location || prev.clientAddress,
                                        projectName: prev.projectName || String(c.title || '').split('—')[0]?.trim() || prev.projectName,
                                        totalAmount:
                                            prev.totalAmount ||
                                            (c.payment_amount != null ? String(c.payment_amount) : prev.totalAmount),
                                        jurisdiction: c.jurisdiction || prev.jurisdiction,
                                        governingLaw: c.governing_law || prev.governingLaw,
                                    }));

                                    if (c.document_url) {
                                        c.document_url = fileUploadService.convertToProxiedUrl(c.document_url);
                                    }

                                    setStep('preview');
                                    setIsEditing(false);
                                    setPreviewTab('document');
                                    setActiveView('new');
                                },
                            },
                            ...(c.status !== 'fully_signed' && c.status !== 'rejected'
                                ? [{
                                    label: c.status === 'draft' ? 'Send to client' : 'Resend for signature',
                                    icon: <Send className="w-4 h-4" aria-hidden="true" />,
                                    onClick: () =>
                                        openSendContractModal({
                                            resend: c.status !== 'draft',
                                            contract: c,
                                        }),
                                }]
                                : []),
                            ...(c.status === 'draft'
                                ? [{
                                    label: 'Delete draft',
                                    icon: <Trash2 className="w-4 h-4" aria-hidden="true" />,
                                    onClick: () => handleDeleteSingleDraft(c.id),
                                    destructive: true,
                                }]
                                : []),
                        ];

                        return (
                            <CustomContextMenu key={c.id} items={contextItems}>
                            <div className={`bg-slate-900/60 border rounded-xl sm:rounded-2xl p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between hover:border-teal-500/30 transition-all ${
                                selectedContractIds.has(c.id) ? 'border-teal-500/40' : 'border-white/5'
                            }`}>
                                <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => toggleContractSelection(c.id, c.status === 'draft')}
                                        className={`mt-0.5 shrink-0 ${c.status === 'draft' ? 'text-slate-400 hover:text-teal-400' : 'text-slate-700 cursor-not-allowed'}`}
                                        aria-label={c.status === 'draft' ? `Select ${c.title}` : 'Signed contracts cannot be deleted'}
                                    >
                                        {selectedContractIds.has(c.id)
                                            ? <CheckSquare className="w-4 h-4 text-teal-400" />
                                            : <Square className="w-4 h-4" />}
                                    </button>
                                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
                                        <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-teal-400" />
                                    </div>
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-semibold text-white text-sm sm:text-base truncate">{c.title}</p>
                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${statusBadgeStyles}`}>
                                                {c.status?.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <p className="text-[11px] sm:text-xs text-slate-500">
                                            Value: <span className="text-slate-300 font-medium">{c.currency || 'USD'} {c.value ? (typeof c.value === 'number' ? c.value : parseFloat(c.value as any) || 0).toLocaleString() : '0'}</span>
                                            <span className="mx-1.5">·</span>
                                            Created: <span className="text-slate-300">{c.created_at ? format(new Date(c.created_at), 'MMM d, yyyy') : 'Recent'}</span>
                                            <span className="mx-1.5">·</span>
                                            Expiry: <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Expires {getExpiry()}</span>
                                            {(() => {
                                                const contact = resolveContractClientContact(c);
                                                if (!contact.email && contact.name === 'the client') return null;
                                                return (
                                                    <>
                                                        <span className="mx-1.5">·</span>
                                                        <span className="text-teal-300/90">
                                                            {contact.name !== 'the client' ? contact.name : 'Client'}
                                                            {contact.email ? ` · ${contact.email}` : ''}
                                                        </span>
                                                    </>
                                                );
                                            })()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                <button type="button" onClick={() => setLifecycleContractId(c.id)} className="w-full sm:w-auto justify-center px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 shrink-0 border border-white/5 hover:border-white/10"><Scale className="w-3.5 h-3.5 text-violet-300" /> Lifecycle</button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const html = c.content.startsWith('<') ? c.content : contractToHTML(c.content);
                                        setEditedHtml(html);
                                        setGeneratedContract(c.content);
                                        setContractId(c.id);
                                        setSignatureData(c.admin_signature || '');
                                        setSignatureName(c.admin_signature ? 'Administrator' : '');
                                        setIsSigned(!!c.admin_signature);
                                        setDocumentTheme(resolveDocumentThemeId(c.metadata || {}));

                                        const contact = resolveContractClientContact(c);
                                        const linked = c.client_id
                                            ? clients.find((cl) => cl.id === c.client_id)
                                            : undefined;
                                        setForm((prev) => ({
                                            ...prev,
                                            clientId: c.client_id || prev.clientId,
                                            clientName: contact.name !== 'the client' ? contact.name : prev.clientName,
                                            clientEmail: contact.email || prev.clientEmail,
                                            clientCompany: linked?.name || prev.clientCompany,
                                            clientPhone: linked?.phone || prev.clientPhone,
                                            clientAddress: linked?.location || prev.clientAddress,
                                            projectName: prev.projectName || String(c.title || '').split('—')[0]?.trim() || prev.projectName,
                                            totalAmount:
                                                prev.totalAmount ||
                                                (c.payment_amount != null ? String(c.payment_amount) : prev.totalAmount),
                                        }));

                                        // Use proxied URL if available
                                        if (c.document_url) {
                                            c.document_url = fileUploadService.convertToProxiedUrl(c.document_url);
                                        }

                                        setStep('preview');
                                        setIsEditing(false);
                                        setPreviewTab('document');
                                        setActiveView('new');
                                    }}
                                    className="w-full sm:w-auto justify-center px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 shrink-0 border border-white/5 hover:border-white/10"
                                >
                                    <Eye className="w-3.5 h-3.5 text-teal-400" /> View
                                </button>
                                {c.status !== 'fully_signed' && c.status !== 'rejected' ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            openSendContractModal({
                                                resend: c.status !== 'draft',
                                                contract: c,
                                            })
                                        }
                                        className={`w-full sm:w-auto justify-center px-3.5 py-2 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 shrink-0 border ${
                                            c.status === 'draft'
                                                ? 'bg-teal-500/10 hover:bg-teal-500/20 text-teal-200 border-teal-500/30'
                                                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 border-amber-500/30'
                                        }`}
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                        {c.status === 'draft' ? 'Send to client' : 'Resend for signature'}
                                    </button>
                                ) : null}
                                </div>
                            </div>
                            </CustomContextMenu>
                        );
                    })}
                </div>
            )}

            {/* New Contract Flow */}
            {activeView === 'new' && (
                <>
                    {/* Step: Form */}
                    {step === 'form' && (
                        <div className="space-y-6">
                            {/* Service Provider */}
                            <div className={sectionCls}>
                                <div className="flex items-center gap-3 mb-2">
                                    <Building2 className="w-5 h-5 text-teal-400" />
                                    <h2 className="text-base font-bold text-white">Service Provider (You)</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Full Legal Name / Company Name *</label>
                                        <input className={inputCls} value={form.providerName} onChange={e => set('providerName', e.target.value)} placeholder="e.g. Acme Solutions Ltd." />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Email Address</label>
                                        <input className={inputCls} value={form.providerEmail} onChange={e => set('providerEmail', e.target.value)} placeholder="you@company.com" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Business Address</label>
                                        <input className={inputCls} value={form.providerAddress} onChange={e => set('providerAddress', e.target.value)} placeholder="123 Business Ave, City, State" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Phone Number</label>
                                        <input className={inputCls} value={form.providerPhone} onChange={e => set('providerPhone', e.target.value)} placeholder="+1 (555) 000-0000" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={labelCls}>Business Registration Number (optional)</label>
                                        <input className={inputCls} value={form.providerRegistration} onChange={e => set('providerRegistration', e.target.value)} placeholder="e.g. LLC-123456 or Company No. 12345678" />
                                    </div>
                                </div>
                            </div>

                            {/* Client */}
                            <div className={sectionCls}>
                                <div className="flex items-center gap-3 mb-2">
                                    <User className="w-5 h-5 text-purple-400" />
                                    <h2 className="text-base font-bold text-white">Client Information</h2>
                                </div>
                                {clients.length > 0 && (
                                    <div>
                                        <label className={labelCls}>Select from CRM (optional)</label>
                                        <select className={inputCls} value={form.clientId} onChange={e => set('clientId', e.target.value)}>
                                            <option value="">— Select a client —</option>
                                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Client Full Name *</label>
                                        <input className={inputCls} value={form.clientName} onChange={e => set('clientName', e.target.value)} placeholder="e.g. Jonathan Williams" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Company / Organization</label>
                                        <input className={inputCls} value={form.clientCompany} onChange={e => set('clientCompany', e.target.value)} placeholder="e.g. Williams Enterprises Inc." />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Email Address</label>
                                        <input className={inputCls} value={form.clientEmail} onChange={e => set('clientEmail', e.target.value)} placeholder="client@email.com" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Phone Number</label>
                                        <input className={inputCls} value={form.clientPhone} onChange={e => set('clientPhone', e.target.value)} placeholder="+1 (555) 000-0000" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={labelCls}>Client Address</label>
                                        <input className={inputCls} value={form.clientAddress} onChange={e => set('clientAddress', e.target.value)} placeholder="456 Client Street, City, State, ZIP" />
                                    </div>
                                </div>
                            </div>

                            {/* Project */}
                            <div className={sectionCls}>
                                <div className="flex items-center gap-3 mb-2">
                                    <Briefcase className="w-5 h-5 text-blue-400" />
                                    <h2 className="text-base font-bold text-white">Project Details</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Project Name *</label>
                                        <input className={inputCls} value={form.projectName} onChange={e => set('projectName', e.target.value)} placeholder="e.g. E-Commerce Platform Redesign" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Project type</label>
                                        <p className="text-slate-500 text-xs mb-2 leading-relaxed">
                                            Options come from the universal service catalog (50+ lines of business). Categories you enable under Settings → Business Profile are listed first.
                                        </p>
                                        <select className={inputCls} value={form.projectType} onChange={e => set('projectType', e.target.value)}>
                                            {projectTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={labelCls}>Scope of Work *</label>
                                        <textarea className={`${inputCls} min-h-[100px] resize-y`} value={form.projectScope} onChange={e => set('projectScope', e.target.value)} placeholder="Describe what you will do in detail. E.g. Design and develop a full-stack e-commerce platform with product catalog, shopping cart, Stripe payments, admin dashboard, and mobile-responsive design." />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={labelCls}>Deliverables</label>
                                        <textarea className={`${inputCls} min-h-[80px] resize-y`} value={form.deliverables} onChange={e => set('deliverables', e.target.value)} placeholder="List specific deliverables. E.g. Fully functional web app, source code, deployment, 30-day support, documentation." />
                                    </div>
                                </div>
                            </div>

                            {/* Financial */}
                            <div className={sectionCls}>
                                <div className="flex items-center gap-3 mb-2">
                                    <DollarSign className="w-5 h-5 text-green-400" />
                                    <h2 className="text-base font-bold text-white">Financial Terms</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className={labelCls}>Total Contract Value *</label>
                                        <input className={inputCls} type="number" value={form.totalAmount} onChange={e => set('totalAmount', e.target.value)} placeholder="10000" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Currency</label>
                                        <select className={inputCls} value={form.currency} onChange={e => set('currency', e.target.value)}>
                                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Deposit %</label>
                                        <input className={inputCls} type="number" min="0" max="100" value={form.depositPercent} onChange={e => set('depositPercent', e.target.value)} placeholder="50" />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className={labelCls}>Payment Schedule</label>
                                        <select className={inputCls} value={form.paymentSchedule} onChange={e => set('paymentSchedule', e.target.value)}>
                                            {PAYMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Document language & length */}
                            <div className={sectionCls}>
                                <div className="flex items-center gap-3 mb-2">
                                    <Languages className="w-5 h-5 text-cyan-400" />
                                    <h2 className="text-base font-bold text-white">Contract language & length</h2>
                                </div>
                                <p className="text-slate-500 text-xs leading-relaxed mb-4">
                                    The AI writes the full contract text in the language you select. PDF downloads use fixed print margins and fonts, so the number of PDF pages often differs from what you see on screen (for example, a long on-screen draft may become more pages in PDF).
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Output language</label>
                                        <select
                                            className={inputCls}
                                            value={form.outputLanguage}
                                            onChange={e => set('outputLanguage', e.target.value)}
                                        >
                                            {OUTPUT_LANGUAGES.map(({ code, label }) => (
                                                <option key={code} value={code}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={labelCls}>Target length (AI)</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {CONTRACT_LENGTH_OPTIONS.map(opt => (
                                                <label
                                                    key={opt.id}
                                                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                                        form.contractLength === opt.id
                                                            ? 'border-teal-500/60 bg-teal-500/10'
                                                            : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
                                                    }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="contractLength"
                                                        className="mt-1"
                                                        checked={form.contractLength === opt.id}
                                                        onChange={() => set('contractLength', opt.id)}
                                                    />
                                                    <span>
                                                        <span className="block text-sm font-semibold text-white">{opt.label}</span>
                                                        <span className="block text-xs text-slate-500 mt-0.5">{opt.hint}</span>
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Timeline & Legal */}
                            <div className={sectionCls}>
                                <div className="flex items-center gap-3 mb-2">
                                    <Calendar className="w-5 h-5 text-orange-400" />
                                    <h2 className="text-base font-bold text-white">Timeline & Legal</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Start Date</label>
                                        <input className={inputCls} value={form.startDate} onChange={e => set('startDate', e.target.value)} placeholder="e.g. March 1, 2026" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Estimated Completion Date</label>
                                        <input className={inputCls} value={form.endDate} onChange={e => set('endDate', e.target.value)} placeholder="e.g. June 1, 2026" />
                                    </div>
                                    <JurisdictionFields
                                        jurisdiction={form.jurisdiction}
                                        governingLaw={form.governingLaw}
                                        required
                                        onChange={(next) => setForm((prev) => ({ ...prev, ...next }))}
                                        hint="Required — the contract cannot be sent for signature without a governing law. Saved to your signer profile for next time."
                                    />
                                    <div className="md:col-span-2">
                                        <label className={labelCls}>Additional Terms (optional)</label>
                                        <textarea className={`${inputCls} min-h-[80px] resize-y`} value={form.additionalTerms} onChange={e => set('additionalTerms', e.target.value)} placeholder="Any special clauses, NDA requirements, exclusivity terms, etc." />
                                    </div>
                                </div>
                            </div>

                            {/* Generate Button */}
                            <button
                                onClick={generateContract}
                                disabled={isGenerating}
                                className="w-full py-4 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-bold text-base rounded-2xl transition-all shadow-lg shadow-teal-900/30 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isGenerating ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Generating contract...</>
                                ) : (
                                    <>
                                        <Bot className="w-5 h-5" />
                                        Generate contract
                                        ({CONTRACT_LENGTH_OPTIONS.find(o => o.id === form.contractLength)?.label ?? 'Custom'}
                                        {form.outputLanguage !== 'en' ? ` · ${OUTPUT_LANGUAGES.find(l => l.code === form.outputLanguage)?.label ?? form.outputLanguage}` : ''})
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Step: Preview */}
                    {(step === 'preview' || step === 'saved') && (
                        <div className="space-y-4">
                            {/* Action Bar */}
                            <div className="flex flex-wrap gap-3 items-center justify-between bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                                <div className="flex gap-2 flex-wrap">
                                    <button onClick={() => setStep('form')} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-slate-800 px-3 text-[11px] font-bold text-slate-300 transition-all hover:bg-slate-700 hover:text-white">
                                        <RotateCcw className="w-3.5 h-3.5" /> Edit Parameters
                                    </button>
                                    {!isSigned && (
                                        <button
                                            onClick={() => setIsEditing(!isEditing)}
                                            disabled={isGenerating}
                                            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isEditing ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                                        >
                                            <Edit3 className="w-3.5 h-3.5" /> {isEditing ? 'Save Refinements' : 'Refine Text'}
                                        </button>
                                    )}
                                    {(isSigned || step === 'saved') && (
                                        <>
                                            <button onClick={handlePrint} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-slate-800 px-3 text-[11px] font-bold text-slate-300 transition-all hover:bg-slate-700 hover:text-white">
                                                <Printer className="w-3.5 h-3.5" /> Print / PDF
                                            </button>
                                            <button onClick={() => openSendContractModal()} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-slate-800 px-3 text-[11px] font-bold text-slate-300 transition-all hover:bg-slate-700 hover:text-white">
                                                <FileText className="w-3.5 h-3.5" /> Send Contract
                                            </button>
                                        </>
                                    )}
                                    {step !== 'saved' && (
                                        <button
                                            onClick={saveContract}
                                            disabled={isSaving || isGenerating}
                                            title={isGenerating ? 'Wait for the draft to finish writing' : undefined}
                                            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-teal-600 px-3 text-[11px] font-bold text-white transition-all hover:bg-teal-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                            Save Contract
                                        </button>
                                    )}
                                </div>
                                <button onClick={() => { setStep('form'); setGeneratedContract(''); setContractId(''); setIsSigned(false); setSignatureName(''); setSignatureData(''); setIsEditing(false); setPreviewTab('document'); setDocumentTheme('executive'); }} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-slate-800 px-3 text-[11px] font-bold text-slate-400 transition-all hover:bg-slate-700 hover:text-white">
                                    <RotateCcw className="w-3.5 h-3.5" /> New Contract
                                </button>
                            </div>

                            {/* Tab Selection */}
                            {contractId && (
                                <div className="inline-flex gap-1 rounded-full border border-white/5 bg-slate-900/60 p-1 mb-6">
                                    <button
                                        onClick={() => setPreviewTab('document')}
                                        className={`h-8 px-3 rounded-full text-[11px] font-bold transition-all ${previewTab === 'document' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        Contract Document
                                    </button>
                                    <button
                                        onClick={() => setPreviewTab('audit')}
                                        className={`h-8 px-3 rounded-full text-[11px] font-bold transition-all ${previewTab === 'audit' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        Audit Trail & Compliance
                                    </button>
                                </div>
                            )}

                            {previewTab === 'audit' ? (
                                <ContractAuditLog
                                    contractId={contractId}
                                    contractTitle={form.projectName || "Contract Audit"}
                                />
                            ) : (
                                <>
                                    {/* Still streaming: the text below is incomplete, so signing/saving wait. */}
                                    {isGenerating && (
                                        <div
                                            className="bg-slate-900/60 border border-teal-500/20 rounded-2xl p-4 flex items-center gap-3"
                                            role="status"
                                            data-testid="contract-generating"
                                        >
                                            <Loader2 className="w-5 h-5 text-teal-400 animate-spin flex-shrink-0" />
                                            <div>
                                                <p className="text-white font-semibold text-sm">Drafting your contract…</p>
                                                <p className="text-slate-400 text-xs">The text below is still being written. Signing and saving unlock as soon as it finishes.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Signature Panel — shown when not yet signed */}
                                    {!isSigned && !isEditing && !isGenerating && (
                                <div className="bg-gradient-to-br from-teal-900/30 to-slate-900/60 border border-teal-500/30 rounded-2xl p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                                            <CheckCircle className="w-5 h-5 text-teal-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold text-base">Sign to Proceed</h3>
                                            <p className="text-slate-400 text-sm">
                                                {signerProfile.signature
                                                    ? 'Apply your saved signature with one click, or draw a new one.'
                                                    : 'Draw your signature and type your name once — tick "Remember" and future contracts sign with one click.'}
                                            </p>
                                        </div>
                                    </div>
                                    <SignaturePad
                                        savedSignature={signerProfile.signature}
                                        onRememberSignature={rememberSignature}
                                        initialFullName={signerProfile.signature?.fullName || ''}
                                        onSave={(sig, name) => {
                                            setSignatureData(sig);
                                            setSignatureName(name);
                                            setIsSigned(true);
                                        }}
                                        onClear={() => {
                                            setSignatureData('');
                                            setSignatureName('');
                                            setIsSigned(false);
                                        }}
                                    />
                                </div>
                            )}

                            {/* Signed confirmation */}
                            {isSigned && (
                                <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                                    <div>
                                        <p className="text-green-300 font-semibold text-sm">Signed by <span className="font-serif italic">{signatureName}</span> on {signatureDate}</p>
                                        <p className="text-green-400/70 text-xs">You can now save or print this contract.</p>
                                    </div>
                                </div>
                            )}

                            <p className="text-slate-500 text-xs">
                                {isEditing
                                    ? 'Editing mode enabled. Your changes will be saved to the final contract.'
                                    : 'Pick a brand theme below — preview and PDF export use the same colorful design as quotes and invoices.'}
                            </p>

                            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-4">
                                <DocumentThemePicker value={documentTheme} onChange={setDocumentTheme} />
                                <DocumentQualityPanel
                                    input={{
                                        type: 'contract',
                                        hasClientName: Boolean(form.clientName?.trim()),
                                        hasSignature: Boolean(isSigned || signatureName),
                                        hasTerms: Boolean(editedHtml || generatedContract),
                                        clientEmail: form.clientEmail,
                                        hasLogo: Boolean(
                                            currentTenant &&
                                                ((currentTenant as { logo_url?: string }).logo_url ||
                                                    (currentTenant as { settings?: { logo_url?: string } }).settings?.logo_url)
                                        ),
                                        hasPricing: Number(form.totalAmount) > 0,
                                    }}
                                />
                                <DocumentPreview
                                    input={buildContractDocumentInput(
                                        {
                                            id: contractId || undefined,
                                            title: `${form.projectName || 'Service Agreement'} — ${form.clientName || 'Client'}`,
                                            content: isEditing
                                                ? editedHtml
                                                : (editedHtml || generatedContract || contractToHTML(generatedContract)),
                                            status: isSigned ? 'sent' : 'draft',
                                            payment_amount: parseFloat(form.totalAmount) || 0,
                                            created_at: new Date().toISOString(),
                                            metadata: {
                                                document_theme: documentTheme,
                                                client_name: form.clientName,
                                                client_email: form.clientEmail,
                                            },
                                        },
                                        currentTenant
                                            ? {
                                                name: currentTenant.name,
                                                logo_url: (currentTenant as { logo_url?: string }).logo_url,
                                                brand_color_primary: (currentTenant as { brand_color_primary?: string }).brand_color_primary,
                                                settings: (currentTenant as { settings?: unknown }).settings,
                                            }
                                            : null,
                                        { name: form.clientName, email: form.clientEmail }
                                    )}
                                />
                            </div>

                            {/* Contract Document */}
                            <div className="bg-white text-gray-900 rounded-2xl shadow-2xl overflow-hidden min-h-[600px]">
                                <div className="p-8 md:p-12 font-serif leading-relaxed" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                                    {isEditing ? (
                                        <div className="quill-contract-editor">
                                            <style>{`
                                                .quill-contract-editor .ql-container {
                                                    font-family: 'Times New Roman', Georgia, serif !important;
                                                    font-size: 13pt !important;
                                                    border: none !important;
                                                }
                                                .quill-contract-editor .ql-toolbar {
                                                    border: none !important;
                                                    border-bottom: 1px solid #e2e8f0 !important;
                                                    margin-bottom: 20px;
                                                    background: #f8fafc;
                                                    border-radius: 8px 8px 0 0;
                                                }
                                                .quill-contract-editor .ql-editor {
                                                    padding: 0 !important;
                                                    color: #0f172a !important;
                                                    min-height: 500px;
                                                }
                                            `}</style>
                                            <ReactQuill
                                                theme="snow"
                                                value={editedHtml}
                                                onChange={setEditedHtml}
                                                modules={{
                                                    toolbar: [
                                                        [{ 'header': [1, 2, 3, false] }],
                                                        ['bold', 'italic', 'underline', 'strike'],
                                                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                                        ['clean']
                                                    ]
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div
                                            className="whitespace-pre-wrap text-[13pt] leading-relaxed text-slate-900"
                                            dangerouslySetInnerHTML={{ __html: editedHtml || contractToHTML(generatedContract) }}
                                        />
                                    )}
                                </div>
                            </div>
                            </>
                        )}
                        </div>
                    )}
                </>
            )}

            {activeView === 'lawyer' && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-auto lg:h-[calc(100vh-280px)] min-h-0 lg:min-h-[500px] mb-8">
                    {/* Left Sidebar: Context and Quick Actions */}
                    <div className="lg:col-span-1 flex flex-col gap-4">
                        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
                            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1.5">
                                <Scale className="w-4 h-4 text-teal-400" /> Contract Context
                            </h2>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Select a contract from your account to ask questions or draft modifications for that specific document.
                            </p>
                            
                            <select
                                value={selectedContractIdForChat}
                                onChange={(e) => setSelectedContractIdForChat(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 transition-colors"
                            >
                                <option value="">No context (General AI Lawyer)</option>
                                {savedContracts.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.title || 'Untitled Contract'}
                                    </option>
                                ))}
                            </select>
                            
                            {selectedContractIdForChat && (
                                <div className="text-[10px] text-teal-400/80 bg-teal-950/40 border border-teal-900/30 rounded-lg p-2 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                    <span>AI will reference selected contract content</span>
                                </div>
                            )}

                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-2">Client from CRM</label>
                            <select
                                value={selectedClientIdForLawyer}
                                onChange={(e) => {
                                    const id = e.target.value;
                                    setSelectedClientIdForLawyer(id);
                                    const picked = clients.find((c) => c.id === id);
                                    if (picked) {
                                        setForm((prev) => ({
                                            ...prev,
                                            clientId: id,
                                            clientName: picked.name || prev.clientName,
                                            clientCompany: String(picked.customFields?.company || picked.metadata?.company || ''),
                                            clientEmail: picked.email || prev.clientEmail,
                                            clientPhone: picked.phone || prev.clientPhone,
                                            clientAddress: picked.location || prev.clientAddress,
                                        }));
                                    }
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500 transition-colors"
                            >
                                <option value="">Who is the client? (select from CRM)</option>
                                {clients.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}{c.customFields?.company ? ` — ${c.customFields.company}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2.5">
                            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-teal-400" /> Quick Actions
                            </h2>
                            <p className="text-xs text-slate-500 leading-relaxed mb-1">
                                Click any pre-set query to consult the lawyer instantly.
                            </p>
                            
                            {[
                                { label: 'Explain Indemnity Clause', query: 'Explain the purpose and implications of an indemnity clause in simple terms.' },
                                { label: 'Draft NDA Clause', query: 'Draft a robust confidentiality and non-disclosure clause for a service agreement.' },
                                { label: 'Check Liability Risks', query: 'What are the main liability risks in a standard service agreement, and how do I limit them?' },
                                { label: 'Draft Custom Payments', query: 'Draft a payment schedule clause with 50% deposit and milestones.' },
                                { label: 'Termination Clause', query: 'Draft a termination for convenience and termination for cause clause.' }
                            ].map((action, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    disabled={isLawyerResponding}
                                    onClick={() => handleSendLawyerMessage(action.query)}
                                    className="w-full text-left bg-slate-950/50 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700/60 rounded-xl px-3 py-2 text-xs text-slate-300 hover:text-white transition-all duration-150 disabled:opacity-50"
                                >
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right Main Panel: Chat Thread */}
                    <div className="lg:col-span-3 bg-slate-900/60 border border-slate-800 rounded-3xl flex flex-col overflow-hidden h-full">
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
                            <div className="flex items-center gap-2.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
                                <div>
                                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                                        <Bot className="w-4 h-4 text-teal-400" /> AI Legal Assistant
                                    </h3>
                                    <p className="text-[11px] text-slate-500">Virtual legal expert powered by AI</p>
                                </div>
                            </div>
                            
                            <button
                                type="button"
                                onClick={() => setChatMessages([
                                    { role: 'assistant', content: 'Hello! I am your AI Legal Assistant. You can ask me to review clauses, draft custom sections, explain legal terms, or evaluate potential risks. Select a contract below to analyze it specifically, or just start typing.' }
                                ])}
                                className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                            >
                                Clear Chat
                            </button>
                        </div>

                        {/* Message list */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {chatMessages.map((msg, i) => (
                                <div
                                    key={i}
                                    className={`flex gap-3 max-w-[85%] ${
                                        msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
                                    }`}
                                >
                                    <div
                                        className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${
                                            msg.role === 'user'
                                                ? 'bg-teal-600 text-white'
                                                : 'bg-slate-800 text-teal-400 border border-slate-700/50'
                                        }`}
                                    >
                                        {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                    </div>
                                    
                                    <div
                                        className={`rounded-2xl px-4 py-3 text-xs leading-relaxed overflow-x-auto ${
                                            msg.role === 'user'
                                                ? 'bg-teal-600/10 border border-teal-500/20 text-teal-100'
                                                : 'bg-slate-950/60 border border-slate-800 text-slate-300'
                                        }`}
                                    >
                                        {msg.content ? (
                                            <>
                                                <div className="prose prose-invert prose-xs max-w-none space-y-1.5 break-words whitespace-pre-wrap">
                                                    {msg.content}
                                                </div>
                                                {msg.role === 'assistant' && i > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-slate-850 flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const html = msg.content.startsWith('<') ? msg.content : contractToHTML(msg.content);
                                                                setGeneratedContract(msg.content);
                                                                setEditedHtml(html);
                                                                setStep('preview');
                                                                setIsEditing(true);
                                                                setContractId('');
                                                                setIsSigned(false);
                                                                setSignatureName('');
                                                                setSignatureData('');
                                                                setActiveView('new');
                                                                toast.success('AI draft loaded into the editor. Review, edit, then save or send as PDF.');
                                                            }}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/50 text-[10px] font-bold text-slate-300 hover:text-white uppercase transition-all duration-150"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5" /> Open in Editor
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={isSavingLawyerPdf}
                                                            onClick={() => handleSaveLawyerDraftAsPdf(msg.content)}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600 border border-teal-500/30 hover:border-teal-400 text-[10px] font-bold text-teal-400 hover:text-white uppercase transition-all duration-150 disabled:opacity-50"
                                                        >
                                                            {isSavingLawyerPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                                                            Save & Generate PDF
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-1.5 py-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input bar */}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSendLawyerMessage();
                            }}
                            className="p-4 border-t border-slate-800 bg-slate-900/30 flex gap-2"
                        >
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                disabled={isLawyerResponding}
                                placeholder={
                                    selectedContractIdForChat
                                        ? "Ask a question about the selected contract..."
                                        : "Ask a general legal question or request a clause..."
                                }
                                className="flex-1 bg-slate-950 border border-slate-800 focus:border-teal-500 focus:outline-none rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 transition-colors"
                            />
                            <button
                                type="submit"
                                disabled={isLawyerResponding || !chatInput.trim()}
                                className="bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 disabled:text-slate-500 text-white p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showSendModal && (
                <div className="fixed inset-0 z-[1100] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowSendModal(false)} />
                    <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-h-[calc(100vh-2rem)] flex flex-col">
                        <div className="px-5 sm:px-6 py-4 border-b border-slate-800">
                            <h3 className="text-lg font-semibold text-white">
                                {resendForSignature ? 'Resend contract for signature' : 'Send Contract by Email'}
                            </h3>
                            {resendForSignature ? (
                                <p className="text-sm text-amber-300/90 mt-1.5">
                                    The recipient will get an urgent subject line explaining their project cannot proceed until the contract is signed.
                                </p>
                            ) : (
                                <p className="text-sm text-slate-400 mt-1.5">
                                    Send the signing link with a clear subject and message. The entire form is scrollable.
                                </p>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Recipient Email</label>
                                <input
                                    className={inputCls}
                                    value={sendForm.recipientEmail}
                                    onChange={(e) => setSendForm(prev => ({ ...prev, recipientEmail: e.target.value }))}
                                    placeholder="client@example.com"
                                />
                                <p className="text-[11px] text-slate-500 mt-1.5">
                                    Auto-filled from the client this contract is for
                                    {sendForm.recipientEmail ? ` (${sendForm.recipientEmail})` : ' — add their email on the client record if empty'}.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Subject</label>
                                <input
                                    className={inputCls}
                                    value={sendForm.subject}
                                    onChange={(e) => setSendForm(prev => ({ ...prev, subject: e.target.value }))}
                                />
                            </div>
                            {sendNeedsGoverningLaw && (
                                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3" data-testid="send-governing-law">
                                    <p className="text-sm text-amber-200 font-semibold">This contract has no governing law recorded yet.</p>
                                    <p className="text-[12px] text-slate-400">
                                        It cannot be sent for signature without one. Pick it here and it will be recorded on the contract before sending.
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <JurisdictionFields
                                            jurisdiction={sendForm.jurisdiction}
                                            governingLaw={sendForm.governingLaw}
                                            required
                                            onChange={(next) => setSendForm((prev) => ({ ...prev, ...next }))}
                                        />
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Send via</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {[
                                        { value: 'auto', label: 'Auto', icon: '🔄' },
                                        { value: 'zoho', label: 'Zoho Mail', icon: '📧' },
                                        { value: 'gmail', label: 'Gmail', icon: '✉️' },
                                        { value: 'brevo', label: 'Brevo', icon: '📨' },
                                        { value: 'sendgrid', label: 'SendGrid', icon: '📬' },
                                        { value: 'resend', label: 'Resend', icon: '🚀' },
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setSendForm(prev => ({ ...prev, provider: opt.value }))}
                                            className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-2 text-[11px] font-medium transition-all ${
                                                sendForm.provider === opt.value
                                                    ? 'bg-teal-600/20 border-teal-500 text-teal-300'
                                                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                                            }`}
                                        >
                                            <span className="text-sm sm:text-base">{opt.icon}</span>
                                            <span>{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                                {sendForm.provider !== 'auto' && (
                                    <p className="text-xs text-slate-500 mt-1.5">
                                        Will attempt <span className="text-teal-400 font-medium">{sendForm.provider}</span> first, then fall back to other configured services if unavailable.
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">AI Instructions (What to write)</label>
                                <textarea
                                    className={`${inputCls} min-h-[110px]`}
                                    value={aiSendInstructions}
                                    onChange={(e) => setAiSendInstructions(e.target.value)}
                                    placeholder="Example: Write a friendly follow-up, mention delivery timeline and ask them to sign by Friday."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Message</label>
                                <textarea
                                    className={`${inputCls} min-h-[180px]`}
                                    value={sendForm.message}
                                    onChange={(e) => setSendForm(prev => ({ ...prev, message: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="px-5 sm:px-6 py-4 border-t border-slate-800 bg-slate-900/80 backdrop-blur flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <button
                                type="button"
                                onClick={handleAiDraftSendMessage}
                                disabled={aiDraftingSend}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm w-full sm:w-auto"
                            >
                                {aiDraftingSend ? 'Drafting...' : 'AI Draft Message'}
                            </button>
                            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                                <button
                                    type="button"
                                    onClick={() => setShowSendModal(false)}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm w-full sm:w-auto"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSendContract}
                                    disabled={sendingContract}
                                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-semibold w-full sm:w-auto disabled:opacity-50"
                                >
                                    {sendingContract ? 'Sending...' : resendForSignature ? 'Resend for signature' : 'Send Contract'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <ContractLifecycleDrawer contractId={lifecycleContractId} tenantId={currentTenant?.id} open={Boolean(lifecycleContractId)} onOpenChange={(open) => !open && setLifecycleContractId(null)} />
            {signatureModalOpen && (
                <SignerProfileModal
                    profile={signerProfile}
                    onSaved={applySignerProfile}
                    onClose={() => setSignatureModalOpen(false)}
                />
            )}
        </div>
    );
};

function contractToHTML(text: string): string {
    return text
        .replace(/^# (.+)$/gm, '<h1 style="font-size:20pt;text-align:center;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px;font-weight:bold;">$1</h1>')
        .replace(/^## (.+)$/gm, '<h2 style="font-size:13pt;text-transform:uppercase;border-bottom:1px solid #333;padding-bottom:4px;margin:28px 0 12px;font-weight:bold;">$1</h2>')
        .replace(/^### (.+)$/gm, '<h3 style="font-size:12pt;margin:16px 0 8px;font-weight:bold;">$1</h3>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #333;margin:20px 0;" />')
        .replace(/\n\n/g, '</p><p style="margin:8px 0;text-align:justify;">')
        .replace(/\n/g, '<br/>');
}

function outputLanguageInstruction(langCode: string): string {
    const entry = OUTPUT_LANGUAGES.find(l => l.code === langCode);
    const label = entry?.label ?? 'English';
    if (langCode === 'en') {
        return 'LANGUAGE: Write the entire agreement in English.';
    }
    return `LANGUAGE: Write the entire agreement in ${label}, using appropriate legal and business register for that language. Do not add a parallel English version unless a defined term or proper name requires it.`;
}

function lengthInstruction(length: ContractForm['contractLength']): { headline: string; sections: string; wordHint: string } {
    switch (length) {
        case '1':
            return {
                headline: 'You are a professional contract lawyer. Generate a concise ONE-PAGE Master Services Agreement (MSA)',
                wordHint: 'Target about 400–650 words. Be dense and complete; avoid repetition. This should reasonably fit one printed page at typical legal font size.',
                sections: `Use these sections (keep each tight):
1. Parties and short recitals
2. Scope, deliverables, and written change orders
3. Fees, deposit, payment schedule, late payment (brief)
4. Start date, target completion, reasonable client cooperation
5. IP: assignment on full payment; Provider retains pre-existing tools; Client materials license
6. Confidentiality (one compact section)
7. Termination for convenience and cause (summary)
8. Liability cap tied to fees paid in the prior 12 months (exclude willful misconduct / confidentiality where appropriate)
9. Governing law, dispute resolution (negotiation then arbitration or courts as fits the stated jurisdiction)
10. Signatures with the exact names and contact details provided`,
            };
        case '2':
            return {
                headline: 'You are a professional contract lawyer. Generate a TWO-PAGE Master Services Agreement (MSA)',
                wordHint: 'Target about 900–1,200 words.',
                sections: `Include: Parties & recitals; Scope, deliverables & change orders; Compensation, invoicing, expenses; Timeline & cooperation; IP (assignment, pre-existing, client materials); Confidentiality; Warranties (concise) & disclaimer; Liability cap & core indemnities; Termination & survival; Dispute & governing law; General (entire agreement, notices, assignment, independent contractors); Signatures.`,
            };
        case '3':
            return {
                headline: 'You are a professional contract lawyer. Generate a THREE-PAGE Master Services Agreement (MSA)',
                wordHint: 'Target about 1,400–1,900 words.',
                sections: `Numbered sections 1–10: Parties & recitals; Scope & deliverables & changes; Payment, invoicing, late fees, expenses; Timeline, milestones, cooperation; IP; Confidentiality; Warranties & disclaimer; Liability & indemnification; Termination & effect; Dispute resolution & governing law; General (force majeure, severability, amendments, counterparts); Signatures.`,
            };
        default:
            return {
                headline: 'You are a professional contract lawyer. Generate a comprehensive Master Services Agreement (MSA)',
                wordHint: 'Full professional detail suitable for a long-form services agreement. Write every clause in full.',
                sections: `1. PARTIES AND RECITALS
2. SCOPE OF SERVICES AND DELIVERABLES
3. COMPENSATION, PAYMENT TERMS, AND SCHEDULE
4. PROJECT TIMELINE AND MILESTONES
5. INTELLECTUAL PROPERTY RIGHTS
6. CONFIDENTIALITY AND NON-DISCLOSURE
7. WARRANTIES AND REPRESENTATIONS
8. LIMITATION OF LIABILITY AND INDEMNIFICATION
9. TERMINATION AND DISPUTE RESOLUTION
10. GENERAL PROVISIONS (Force Majeure, Entire Agreement, Amendments, Severability, Assignment, Notices)
11. SIGNATURES AND EXECUTION (Use exactly the provided Provider Name, Client Full Name, and contact information. Do NOT use blank lines or underscores for names, dates, or titles.)`,
            };
    }
}

function safeParseFloat(val: any, fallback: number = 0): number {
    if (val === null || val === undefined || val === '') return fallback;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
}

function buildAIPrompt(f: ContractForm): string {
    const total = safeParseFloat(f.totalAmount, 0);
    const depPercent = safeParseFloat(f.depositPercent, 50);
    const deposit = (total * depPercent / 100).toLocaleString();
    const { headline, sections, wordHint } = lengthInstruction(f.contractLength);
    const lang = outputLanguageInstruction(f.outputLanguage);

    return `${headline} between the parties below. The contract must be professional with NO placeholder text, NO brackets like [NAME] or [DATE], NO unfilled underscores — only the factual details provided. ${lang}

${wordHint}

SERVICE PROVIDER:
- Name: ${f.providerName}
- Address: ${f.providerAddress || 'On file with the parties'}
- Email: ${f.providerEmail}
- Phone: ${f.providerPhone || 'On file'}
- Registration: ${f.providerRegistration || 'N/A'}

CLIENT:
- Full Name: ${f.clientName}
- Company: ${f.clientCompany || 'N/A'}
- Address: ${f.clientAddress || 'On file with the parties'}
- Email: ${f.clientEmail || 'On file'}
- Phone: ${f.clientPhone || 'On file'}

PROJECT:
- Name: ${f.projectName}
- Type: ${f.projectType}
- Scope: ${f.projectScope || f.projectType + ' services as mutually agreed'}
- Deliverables: ${f.deliverables || 'All project deliverables as described in the scope'}

FINANCIAL:
- Total Value: ${f.currency} ${total.toLocaleString()}
- Deposit (${f.depositPercent}%): ${f.currency} ${deposit}
- Payment Schedule: ${f.paymentSchedule}

TIMELINE:
- Start: ${f.startDate}
- Completion: ${f.endDate}

LEGAL:
- Jurisdiction: ${f.jurisdiction || 'the parties\' agreed jurisdiction'}
- Governing Law: ${f.governingLaw || 'applicable law'}
${f.additionalTerms ? `- Additional Terms: ${f.additionalTerms}` : ''}

STRUCTURE AND SECTIONS:
${sections}

Use markdown: # for main title, ## for sections, **bold** for key terms.`;
}

function buildOnePageTemplateContract(f: ContractForm): string {
    const amount = safeParseFloat(f.totalAmount, 0);
    const depositPct = safeParseFloat(f.depositPercent, 50);
    const deposit = (amount * depositPct) / 100;
    const balance = amount - deposit;
    const jurisdiction = f.jurisdiction || 'the jurisdiction agreed by the parties';
    const govLaw = f.governingLaw || 'the laws of the applicable jurisdiction';
    const today = format(new Date(), 'MMMM d, yyyy');

    return `# MASTER SERVICES AGREEMENT

**Date:** ${today}

**${f.providerName}** ("Provider")${f.providerAddress ? `, ${f.providerAddress}` : ''}, and **${f.clientName}**${f.clientCompany && f.clientCompany !== f.clientName ? ` (${f.clientCompany})` : ''} ("Client")${f.clientAddress ? `, ${f.clientAddress}` : ''}, agree: Provider will perform **${f.projectType}** for **${f.projectName}**. Scope: ${f.projectScope || 'As agreed in writing during the project.'} Deliverables: ${f.deliverables || 'As specified in writing.'} Changes require a written change order.

**Fees:** **${f.currency} ${amount.toLocaleString()}** total. ${f.paymentSchedule} Deposit (${depositPct}%): **${f.currency} ${deposit.toLocaleString()}**; balance **${f.currency} ${balance.toLocaleString()}** per invoices. Late payment may incur interest allowed by law. Work starts **${f.startDate}**; target completion **${f.endDate}**.

**IP:** On full payment, Provider assigns custom work product to Client. Provider keeps pre-existing IP and general methods. Client grants a license for Client materials solely to perform the Services.

**Confidentiality:** Each party protects the other's non-public information for three (3) years after this agreement ends, except information that is public, already known, or legally required to be disclosed.

**Termination:** Either party may terminate with thirty (30) days' notice; fees through the termination date remain due. Either party may terminate for material breach uncured after fifteen (15) days.

**Liability:** Neither party is liable for indirect or consequential damages. Total liability (except confidentiality, IP, or willful misconduct) is capped at fees paid in the twelve (12) months before the claim.

**Law & disputes:** Governed by ${govLaw}. Disputes: good-faith negotiation, then binding arbitration in ${jurisdiction}, except injunctive relief may be sought for IP or confidentiality.

**Entire agreement; notices:** This is the entire agreement. Notices by email to ${f.providerEmail} and ${f.clientEmail || 'the Client\'s email on file'}.

---

**Provider:** ${f.providerName} — ${today}
**Client:** ${f.clientName} — ${today}`;
}

function buildTwoPageTemplateContract(f: ContractForm): string {
    const amount = safeParseFloat(f.totalAmount, 0);
    const depositPct = safeParseFloat(f.depositPercent, 50);
    const deposit = (amount * depositPct) / 100;
    const balance = amount - deposit;
    const jurisdiction = f.jurisdiction || 'the jurisdiction agreed by the parties';
    const govLaw = f.governingLaw || 'the laws of the applicable jurisdiction';
    const today = format(new Date(), 'MMMM d, yyyy');

    return `# MASTER SERVICES AGREEMENT

**Effective Date:** ${today}

Between **${f.providerName}** ("Provider")${f.providerAddress ? `, ${f.providerAddress}` : ''}${f.providerEmail ? `, ${f.providerEmail}` : ''} and **${f.clientName}**${f.clientCompany && f.clientCompany !== f.clientName ? ` (${f.clientCompany})` : ''} ("Client")${f.clientAddress ? `, ${f.clientAddress}` : ''}${f.clientEmail ? `, ${f.clientEmail}` : ''}.

---

## 1. Services and deliverables
Provider performs **${f.projectType}** for **${f.projectName}**. Scope: ${f.projectScope || 'Services as agreed between the parties.'} Deliverables: ${f.deliverables || 'Deliverables as specified in writing.'} Changes require written change orders.

## 2. Compensation
Total: **${f.currency} ${amount.toLocaleString()}**. ${f.paymentSchedule} Deposit (${depositPct}%): **${f.currency} ${deposit.toLocaleString()}**; balance **${f.currency} ${balance.toLocaleString()}** as invoiced. Late fees may apply as permitted by law. Commencement **${f.startDate}**; target completion **${f.endDate}**.

## 3. Intellectual property
On full payment, Provider assigns custom work product to Client. Provider retains pre-existing IP and general methods. Client grants a license to use Client materials solely to perform the Services.

## 4. Confidentiality
Each party protects the other's Confidential Information for three (3) years after termination, with standard exceptions (public domain, prior knowledge, independent development, legal process).

## 5. Warranties and disclaimer
Provider warrants professional performance. Client warrants rights to supplied materials. EXCEPT AS STATED, IMPLIED WARRANTIES ARE DISCLAIMED TO THE MAXIMUM EXTENT PERMITTED BY LAW.

## 6. Liability and indemnity
Neither party is liable for indirect or consequential damages. Aggregate liability (except confidentiality, IP, or willful misconduct) is limited to fees paid in the twelve (12) months preceding the claim. Each party indemnifies the other against third-party claims arising from the indemnifying party's materials or gross negligence, subject to prompt notice.

## 7. Termination and dispute
Termination for convenience: thirty (30) days' notice; fees due through termination remain payable. Termination for cause if breach uncured after fifteen (15) days. Disputes: negotiation, then binding arbitration in ${jurisdiction}, except either party may seek injunctive relief for IP or confidentiality.

## 8. General
Governing law: ${govLaw}. Entire agreement; amendments in writing; independent contractors; assignment requires consent where not unreasonable; notices by email to addresses above.

---

## Signatures

**Provider:** ${f.providerName} — ${today}

**Client:** ${f.clientName} — ${today}`;
}

function buildThreePageTemplateContract(f: ContractForm): string {
    const amount = safeParseFloat(f.totalAmount, 0);
    const depositPct = safeParseFloat(f.depositPercent, 50);
    const deposit = (amount * depositPct) / 100;
    const balance = amount - deposit;
    const jurisdiction = f.jurisdiction || 'the jurisdiction agreed by the parties';
    const govLaw = f.governingLaw || 'the laws of the applicable jurisdiction';
    const today = format(new Date(), 'MMMM d, yyyy');

    return `# MASTER SERVICES AGREEMENT

**Effective Date:** ${today}

Between **${f.providerName}** ("Provider")${f.providerAddress ? `, ${f.providerAddress}` : ''}${f.providerEmail ? `, ${f.providerEmail}` : ''} and **${f.clientName}**${f.clientCompany && f.clientCompany !== f.clientName ? ` (${f.clientCompany})` : ''} ("Client")${f.clientAddress ? `, ${f.clientAddress}` : ''}${f.clientEmail ? `, ${f.clientEmail}` : ''}.

---

## 1. Services and deliverables
Provider performs **${f.projectType}** for **${f.projectName}**. Scope: ${f.projectScope || 'Services as agreed between the parties.'} Deliverables: ${f.deliverables || 'Deliverables as specified in writing.'} Changes require written change orders specifying fees and schedule impact.

## 2. Compensation and invoicing
Total: **${f.currency} ${amount.toLocaleString()}**. ${f.paymentSchedule} Deposit (${depositPct}%): **${f.currency} ${deposit.toLocaleString()}**; balance **${f.currency} ${balance.toLocaleString()}** as invoiced. Invoices payable within fourteen (14) days unless stated otherwise. Late fees as permitted by law. Reasonable expenses pre-approved in writing are reimbursable.

## 3. Timeline and cooperation
Commencement **${f.startDate}**; target completion **${f.endDate}**. Client will provide timely feedback, credentials, and materials. Client-caused delays extend timelines and are not a breach by Provider.

## 4. Intellectual property
On full payment, Provider assigns custom work product to Client. Provider retains pre-existing IP, tools, and methodologies. Client materials remain Client property; Client grants a limited license to use them to perform the Services.

## 5. Confidentiality
Each party protects the other's Confidential Information for three (3) years after termination, with standard exceptions. Either party may seek injunctive relief for misuse.

## 6. Warranties and disclaimer
Provider warrants professional, workmanlike performance. Client warrants accuracy and rights in its materials. Deliverables warranted against material defects for thirty (30) days after delivery, excluding Client modifications. EXCEPT AS STATED, IMPLIED WARRANTIES ARE DISCLAIMED TO THE MAXIMUM EXTENT PERMITTED BY LAW.

## 7. Liability and indemnity
Neither party is liable for indirect or consequential damages. Aggregate liability (except confidentiality, IP, or willful misconduct) is limited to fees paid in the twelve (12) months preceding the claim. Each party indemnifies the other against third-party claims arising from the indemnifying party's breach, materials, or gross negligence, subject to prompt notice.

## 8. Termination and dispute resolution
Termination for convenience: thirty (30) days' notice; fees through termination remain due. Termination for cause if material breach uncured after fifteen (15) days. Disputes: good-faith negotiation, then binding arbitration in ${jurisdiction}, except injunctive relief for IP or confidentiality may be sought in any competent court.

## 9. General provisions
Governing law: ${govLaw}. Entire agreement; amendments in writing; severability; assignment subject to reasonable consent; independent contractors; force majeure with prompt notice; notices by email to addresses above; electronic signatures and counterparts are valid.

---

## Signatures

**Provider:** ${f.providerName} — ${today}

**Client:** ${f.clientName} — ${today}`;
}

function buildFullTemplateContract(f: ContractForm): string {
    const amount = safeParseFloat(f.totalAmount, 0);
    const depositPct = safeParseFloat(f.depositPercent, 50);
    const deposit = (amount * depositPct / 100);
    const balance = amount - deposit;
    const jurisdiction = f.jurisdiction || 'the applicable jurisdiction agreed upon by the parties';
    const govLaw = f.governingLaw || 'the laws of the applicable jurisdiction';
    const today = format(new Date(), 'MMMM d, yyyy');

    return `# MASTER SERVICES AGREEMENT

**Agreement Date:** ${today}

**Reference Number:** MSA-${Date.now().toString().slice(-6)}

---

This Master Services Agreement ("Agreement") is entered into as of ${today}, by and between:

**${f.providerName}** ("Service Provider")${f.providerAddress ? `, a business entity located at ${f.providerAddress}` : ''}${f.providerEmail ? `, reachable at ${f.providerEmail}` : ''}${f.providerRegistration ? `, registered under number ${f.providerRegistration}` : ''};

AND

**${f.clientName}**${f.clientCompany && f.clientCompany !== f.clientName ? ` of ${f.clientCompany}` : ''} ("Client")${f.clientAddress ? `, located at ${f.clientAddress}` : ''}${f.clientEmail ? `, reachable at ${f.clientEmail}` : ''}.

The Service Provider and the Client are each referred to herein individually as a "Party" and collectively as the "Parties."

---

## 1. RECITALS AND PURPOSE

WHEREAS, the Service Provider is engaged in the business of providing professional ${f.projectType} services and possesses the requisite expertise, skills, and resources to perform such services;

WHEREAS, the Client desires to engage the Service Provider to perform certain services in connection with the project described herein, and the Service Provider desires to perform such services for the Client, subject to the terms and conditions set forth in this Agreement;

NOW, THEREFORE, in consideration of the mutual covenants and agreements contained herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Parties agree as follows:

---

## 2. SCOPE OF SERVICES AND DELIVERABLES

**2.1 Project Identification**

The Service Provider agrees to perform the following project for the Client:

**Project Name:** ${f.projectName}
**Project Type:** ${f.projectType}

**2.2 Scope of Work**

The Service Provider shall perform the following services (collectively, the "Services"):

${f.projectScope || `The Service Provider shall deliver comprehensive ${f.projectType} services, including all planning, design, development, testing, and deployment activities necessary to complete the ${f.projectName} project to the Client's satisfaction and in accordance with industry best practices.`}

**2.3 Deliverables**

Upon completion of the Services, the Service Provider shall deliver to the Client the following ("Deliverables"):

${f.deliverables || `All work product, documentation, source files, and materials produced in connection with the ${f.projectName} project, including but not limited to: final production-ready outputs, technical documentation, user guides, and all associated assets created specifically for this engagement.`}

**2.4 Change Orders**

Any modifications to the Scope of Work or Deliverables must be agreed upon in writing by both Parties prior to implementation. Additional work beyond the agreed scope shall be subject to a separate written change order specifying the additional fees and timeline adjustments.

**2.5 Service Standards**

The Service Provider shall perform all Services in a professional and workmanlike manner, consistent with applicable industry standards and best practices. The Service Provider shall assign qualified personnel to perform the Services and shall maintain adequate resources to fulfill its obligations under this Agreement.

---

## 3. COMPENSATION AND PAYMENT TERMS

**3.1 Total Contract Value**

In consideration for the Services and Deliverables described herein, the Client agrees to pay the Service Provider a total fee of **${f.currency} ${amount.toLocaleString()}** (the "Contract Value").

**3.2 Payment Schedule**

Payments shall be made according to the following schedule:

${f.paymentSchedule}

Specifically:
- **Initial Deposit (${depositPct}%):** ${f.currency} ${deposit.toLocaleString()} — due upon execution of this Agreement
- **Remaining Balance:** ${f.currency} ${balance.toLocaleString()} — due as per the payment schedule above

**3.3 Invoicing**

The Service Provider shall issue invoices to the Client in accordance with the payment schedule set forth above. All invoices shall be sent to ${f.clientEmail || "the Client's designated billing contact"} and shall be payable within fourteen (14) calendar days of the invoice date unless otherwise specified.

**3.4 Late Payment**

Payments not received within fourteen (14) days of the due date shall accrue interest at the rate of one and one-half percent (1.5%) per month, or the maximum rate permitted by applicable law, whichever is lower. The Service Provider reserves the right to suspend performance of the Services if any payment remains outstanding for more than fourteen (14) days beyond the due date, without prejudice to any other rights or remedies available.

**3.5 Expenses**

Unless otherwise agreed in writing, all reasonable out-of-pocket expenses incurred by the Service Provider in connection with the performance of the Services (including travel, accommodation, and third-party software licenses) shall be reimbursed by the Client within fourteen (14) days of submission of supporting documentation.

---

## 4. PROJECT TIMELINE AND MILESTONES

**4.1 Commencement**

The Service Provider shall commence performance of the Services on or about **${f.startDate}**, subject to receipt of the initial deposit specified in Section 3.2.

**4.2 Estimated Completion**

The Service Provider shall use commercially reasonable efforts to complete the Services and deliver the Deliverables on or before **${f.endDate}** (the "Estimated Completion Date").

**4.3 Milestone Schedule**

The Parties agree to the following general project phases:

- **Phase 1 — Discovery and Planning:** Requirements gathering, technical specification, and project roadmap development
- **Phase 2 — Design and Architecture:** Creation of design concepts, prototypes, and technical architecture
- **Phase 3 — Development and Implementation:** Core development, integration, and iterative testing
- **Phase 4 — Quality Assurance and Review:** Comprehensive testing, bug resolution, and client review cycles
- **Phase 5 — Delivery and Deployment:** Final delivery, deployment, and post-launch support

**4.4 Client Cooperation**

The Client acknowledges that timely completion of the project depends on the Client's cooperation, including the prompt provision of feedback, approvals, content, credentials, and other materials reasonably requested by the Service Provider. Delays caused by the Client's failure to cooperate in a timely manner shall extend the Estimated Completion Date by a corresponding period and shall not constitute a breach by the Service Provider.

---

## 5. INTELLECTUAL PROPERTY RIGHTS

**5.1 Assignment of Work Product**

Upon receipt of full and final payment of all fees and expenses due under this Agreement, the Service Provider hereby assigns to the Client all right, title, and interest in and to the custom work product and Deliverables created specifically for the Client under this Agreement, including all copyrights, patents, trade secrets, and other intellectual property rights therein.

**5.2 Service Provider's Retained Rights**

Notwithstanding Section 5.1, the Service Provider retains all right, title, and interest in and to: (a) pre-existing intellectual property owned by the Service Provider prior to the commencement of this Agreement; (b) general methodologies, processes, tools, frameworks, and know-how developed or used by the Service Provider; and (c) any open-source or third-party components incorporated into the Deliverables, which shall remain subject to their respective licenses.

**5.3 License to Pre-Existing Materials**

To the extent that any pre-existing materials of the Service Provider are incorporated into the Deliverables, the Service Provider hereby grants the Client a non-exclusive, perpetual, royalty-free license to use such pre-existing materials solely as incorporated into and as part of the Deliverables.

**5.4 Client-Provided Materials**

The Client represents and warrants that it has all necessary rights to any materials, content, data, or information provided to the Service Provider for use in connection with the Services, and grants the Service Provider a limited license to use such materials solely for the purpose of performing the Services.

---

## 6. CONFIDENTIALITY AND NON-DISCLOSURE

**6.1 Confidential Information**

Each Party (as a "Receiving Party") acknowledges that it may receive confidential or proprietary information of the other Party (the "Disclosing Party"), including but not limited to technical data, trade secrets, business plans, financial information, customer lists, and other non-public information ("Confidential Information").

**6.2 Obligations**

The Receiving Party agrees to: (a) hold all Confidential Information in strict confidence; (b) not disclose Confidential Information to any third party without the prior written consent of the Disclosing Party; (c) use Confidential Information solely for the purpose of performing its obligations or exercising its rights under this Agreement; and (d) protect Confidential Information with at least the same degree of care it uses to protect its own confidential information, but in no event less than reasonable care.

**6.3 Exceptions**

The obligations of confidentiality shall not apply to information that: (a) is or becomes publicly available through no fault of the Receiving Party; (b) was rightfully known to the Receiving Party prior to disclosure; (c) is independently developed by the Receiving Party without use of Confidential Information; or (d) is required to be disclosed by law or court order, provided that the Receiving Party gives the Disclosing Party prompt written notice and cooperates in seeking a protective order.

**6.4 Survival**

The obligations of confidentiality set forth in this Section 6 shall survive the termination or expiration of this Agreement for a period of three (3) years.

---

## 7. WARRANTIES AND REPRESENTATIONS

**7.1 Service Provider Warranties**

The Service Provider represents and warrants that: (a) it has the full right, power, and authority to enter into and perform this Agreement; (b) the Services will be performed in a professional and workmanlike manner consistent with applicable industry standards; (c) the Deliverables will substantially conform to the specifications agreed upon by the Parties; and (d) the Deliverables will not, to the Service Provider's knowledge, infringe upon any third-party intellectual property rights.

**7.2 Client Warranties**

The Client represents and warrants that: (a) it has the full right, power, and authority to enter into and perform this Agreement; (b) all materials and information provided by the Client to the Service Provider are accurate and do not infringe upon any third-party rights; and (c) the Client will make all payments required under this Agreement in a timely manner.

**7.3 Warranty Period**

The Service Provider warrants that the Deliverables will be free from material defects for a period of thirty (30) days following final delivery (the "Warranty Period"). The Service Provider's sole obligation under this warranty shall be to correct any such defects at no additional charge. This warranty does not cover defects caused by the Client's modifications, misuse, or third-party components.

**7.4 Disclaimer**

EXCEPT AS EXPRESSLY SET FORTH IN THIS SECTION 7, THE SERVICE PROVIDER MAKES NO WARRANTIES, EXPRESS OR IMPLIED, INCLUDING ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.

---

## 8. LIMITATION OF LIABILITY AND INDEMNIFICATION

**8.1 Limitation of Liability**

IN NO EVENT SHALL EITHER PARTY BE LIABLE TO THE OTHER FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING LOSS OF PROFITS, LOSS OF DATA, OR LOSS OF BUSINESS OPPORTUNITY, ARISING OUT OF OR RELATED TO THIS AGREEMENT, EVEN IF SUCH PARTY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. THE SERVICE PROVIDER'S TOTAL CUMULATIVE LIABILITY UNDER THIS AGREEMENT SHALL NOT EXCEED THE TOTAL FEES ACTUALLY PAID BY THE CLIENT TO THE SERVICE PROVIDER UNDER THIS AGREEMENT IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.

**8.2 Indemnification by Client**

The Client agrees to indemnify, defend, and hold harmless the Service Provider and its officers, directors, employees, and agents from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) the Client's use of the Deliverables; (b) any content or materials provided by the Client; (c) the Client's breach of this Agreement; or (d) the Client's violation of any applicable law or regulation.

**8.3 Indemnification by Service Provider**

The Service Provider agrees to indemnify, defend, and hold harmless the Client from and against any claims arising out of the Service Provider's gross negligence, willful misconduct, or material breach of this Agreement.

---

## 9. TERMINATION AND DISPUTE RESOLUTION

**9.1 Termination for Convenience**

Either Party may terminate this Agreement upon thirty (30) days' prior written notice to the other Party. In the event of termination by the Client for convenience, the Client shall pay the Service Provider for all Services performed and expenses incurred up to the effective date of termination, plus a termination fee equal to twenty percent (20%) of the remaining unpaid Contract Value.

**9.2 Termination for Cause**

Either Party may terminate this Agreement immediately upon written notice if the other Party: (a) materially breaches this Agreement and fails to cure such breach within fifteen (15) days after receiving written notice thereof; (b) becomes insolvent or makes an assignment for the benefit of creditors; or (c) ceases to conduct business in the ordinary course.

**9.3 Effect of Termination**

Upon termination, the Service Provider shall deliver to the Client all completed Deliverables and work-in-progress, and the Client shall pay all amounts due for Services rendered through the termination date. Sections 5, 6, 7.4, 8, and 10 shall survive any termination or expiration of this Agreement.

**9.4 Dispute Resolution**

In the event of any dispute arising out of or relating to this Agreement, the Parties shall first attempt to resolve the dispute through good-faith negotiation. If the dispute is not resolved within thirty (30) days, the Parties agree to submit the dispute to binding arbitration in ${jurisdiction}, conducted in accordance with the rules of a mutually agreed arbitration body. The arbitrator's decision shall be final and binding. Notwithstanding the foregoing, either Party may seek injunctive or other equitable relief in any court of competent jurisdiction to protect its intellectual property or confidential information.

---

## 10. GENERAL PROVISIONS

**10.1 Governing Law**

This Agreement shall be governed by and construed in accordance with ${govLaw}, without regard to its conflict of law principles.

**10.2 Entire Agreement**

This Agreement constitutes the entire agreement between the Parties with respect to the subject matter hereof and supersedes all prior and contemporaneous agreements, representations, and understandings, whether written or oral, relating to such subject matter.

**10.3 Amendments**

No amendment, modification, or waiver of any provision of this Agreement shall be effective unless made in writing and signed by authorized representatives of both Parties.

**10.4 Severability**

If any provision of this Agreement is held to be invalid, illegal, or unenforceable, the remaining provisions shall continue in full force and effect, and the invalid provision shall be modified to the minimum extent necessary to make it valid and enforceable.

**10.5 Assignment**

Neither Party may assign or transfer this Agreement or any of its rights or obligations hereunder without the prior written consent of the other Party, which consent shall not be unreasonably withheld. Any purported assignment in violation of this Section shall be null and void.

**10.6 Force Majeure**

Neither Party shall be liable for any delay or failure to perform its obligations under this Agreement to the extent such delay or failure is caused by circumstances beyond such Party's reasonable control, including acts of God, natural disasters, war, terrorism, government actions, or widespread internet outages, provided that the affected Party gives prompt written notice to the other Party and uses commercially reasonable efforts to resume performance.

**10.7 Notices**

All notices required or permitted under this Agreement shall be in writing and shall be deemed delivered when: (a) delivered personally; (b) sent by confirmed email to the addresses specified in this Agreement; or (c) sent by overnight courier with tracking confirmation.

**10.8 Independent Contractors**

The Parties are independent contractors. Nothing in this Agreement shall be construed to create a partnership, joint venture, agency, employment, or fiduciary relationship between the Parties.

**10.9 Waiver**

The failure of either Party to enforce any provision of this Agreement shall not constitute a waiver of that Party's right to enforce such provision in the future.

**10.10 Counterparts**

This Agreement may be executed in one or more counterparts, each of which shall be deemed an original, and all of which together shall constitute one and the same instrument. Electronic signatures shall be deemed valid and binding.

---

## 11. SIGNATURES AND EXECUTION

IN WITNESS WHEREOF, the Parties have executed this Master Services Agreement as of the date first written above, each by its duly authorized representative.

---

**SERVICE PROVIDER:**

**${f.providerName}**

Signature: [DIGITAL SIGNATURE]

Printed Name: ${f.providerName}

Title: Authorized Representative

Date: ${today}

${f.providerAddress ? `Address: ${f.providerAddress}` : ''}
${f.providerEmail ? `Email: ${f.providerEmail}` : ''}
${f.providerPhone ? `Phone: ${f.providerPhone}` : ''}

---

**CLIENT:**

**${f.clientName}**${f.clientCompany && f.clientCompany !== f.clientName ? ` (${f.clientCompany})` : ''}

Signature: [DIGITAL SIGNATURE]

Printed Name: ${f.clientName}

Title: Authorized Representative

Date: ${today}

${f.clientAddress ? `Address: ${f.clientAddress}` : ''}
${f.clientEmail ? `Email: ${f.clientEmail}` : ''}
${f.clientPhone ? `Phone: ${f.clientPhone}` : ''}

---

*This Master Services Agreement is a legally binding document. Both Parties are advised to review this Agreement carefully and seek independent legal counsel if needed before signing. This document was prepared using AlphaClone's professional contract generation system.*`;
}

function buildTemplateContract(
    f: ContractForm,
    length: ContractForm['contractLength'] = 'full'
): string {
    switch (length) {
        case '1':
            return buildOnePageTemplateContract(f);
        case '2':
            return buildTwoPageTemplateContract(f);
        case '3':
            return buildThreePageTemplateContract(f);
        default:
            return buildFullTemplateContract(f);
    }
}

export default ContractDashboard;
