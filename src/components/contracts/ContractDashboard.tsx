'use client';
import React, { useState, useEffect, useRef } from 'react';
import { FileText, Bot, Printer, Save, CheckCircle, User, Building2, DollarSign, Calendar, Briefcase, Loader2, Eye, Edit3, RotateCcw, Languages } from 'lucide-react';
import { businessClientService, BusinessClient } from '../../services/businessClientService';
import { contractService, Contract } from '../../services/contractService';
import { fileUploadService } from '../../services/fileUploadService';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { User as UserType } from '../../types';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { showActionNextSteps } from '../common/showActionNextSteps';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';
import { SignaturePad } from './SignaturePad';
import { ContractAuditLog } from './ContractAuditLog';

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
    const [projectTypeOptions, setProjectTypeOptions] = useState<string[]>(() => getContractProjectTypeOptions());
    const [clients, setClients] = useState<BusinessClient[]>([]);
    const [step, setStep] = useState<'form' | 'preview' | 'sign' | 'saved'>('form');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedContract, setGeneratedContract] = useState('');
    const [contractId, setContractId] = useState<string>('');
    const [savedContracts, setSavedContracts] = useState<any[]>([]);
    const [loadingContracts, setLoadingContracts] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeView, setActiveView] = useState<'new' | 'list'>('new');
    const [signatureName, setSignatureName] = useState('');
    const [signatureData, setSignatureData] = useState('');
    const [signatureDate] = useState(format(new Date(), 'MMMM d, yyyy'));
    const [isSigned, setIsSigned] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);
    const [showSendModal, setShowSendModal] = useState(false);
    const [sendingContract, setSendingContract] = useState(false);
    const [aiDraftingSend, setAiDraftingSend] = useState(false);
    const [aiSendInstructions, setAiSendInstructions] = useState('');
    const [sendForm, setSendForm] = useState({ recipientEmail: '', subject: '', message: '' });
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

        setIsGenerating(true);
        setGeneratedContract('');
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

            const finalHtml = contractToHTML(accumulated);
            setEditedHtml(finalHtml);
            setContractId('');
            setIsSigned(false);
            setSignatureName('');
            setSignatureData('');
            setIsGenerating(false);
            return;
        } catch (err) {
            console.error('Streaming error:', err);
            toast.error('AI Streaming failed, using template...');
            // Fallback: generate from template
            setGeneratedContract(buildTemplateContract(form, form.contractLength));
            setContractId('');
            setIsSigned(false);
            setSignatureName('');
            setSignatureData('');
            setIsGenerating(false);
        }
    };

    const saveContract = async () => {
        if (!currentTenant?.id) return;
        setIsSaving(true);
        try {
            const { contract, error } = await contractService.createContract({
                title: `${form.projectName} — ${form.clientName}`,
                content: isEditing ? editedHtml : (editedHtml || contractToHTML(generatedContract)),
                client_id: form.clientId || undefined,
                status: isSigned ? 'sent' : 'draft',
                payment_amount: parseFloat(form.totalAmount) || 0,
                admin_signature: isSigned ? signatureData : undefined,
                admin_signed_at: isSigned ? new Date().toISOString() : undefined,
            });
            if (error) throw new Error(error);
            toast.success('Contract saved successfully!');
            if (contract?.id) setContractId(contract.id);
            showActionNextSteps('contract_saved', (path) => router.push(path));
            setSavedContracts(prev => [contract, ...prev]);
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

    const openSendContractModal = () => {
        const targetEmail = form.clientEmail || '';
        setSendForm({
            recipientEmail: targetEmail,
            subject: `Contract: ${form.projectName || 'Service Agreement'}`,
            message: `Hello,\n\nPlease review and sign the attached contract for ${form.projectName || 'our engagement'}.\n\nBest regards,\n${form.providerName || user.name}`,
        });
        setAiSendInstructions(
            `Write a professional contract delivery email for ${form.clientName || 'the client'} about ${form.projectName || 'our engagement'}. Keep it concise and clear.`
        );
        setShowSendModal(true);
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
                    },
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok || !payload?.success) {
                throw new Error(payload?.error || 'Failed to send contract');
            }
            toast.success('Contract sent successfully');
            setShowSendModal(false);
        } catch (error: any) {
            toast.error(error?.message || 'Failed to send contract');
        } finally {
            setSendingContract(false);
        }
    };

    const inputCls = 'w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-all text-sm';
    const labelCls = 'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5';
    const sectionCls = 'bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4';

    return (
        <div className="min-h-full text-white px-1 sm:px-0">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6 sm:mb-8">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-white">Contract Generator</h1>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">AI-assisted contracts tailored to your client and scope.</p>
                </div>
                <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => setActiveView('new')}
                        className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${activeView === 'new' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                    >
                        New Contract
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveView('list')}
                        className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${activeView === 'list' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                    >
                        Saved ({savedContracts.length})
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

            {/* Saved Contracts List */}
            {activeView === 'list' && (
                <div className="space-y-2 sm:space-y-3">
                    {loadingContracts ? (
                        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-teal-400 animate-spin" /></div>
                    ) : savedContracts.length === 0 ? (
                        <div className="text-center py-16 sm:py-20 text-slate-500 text-sm px-4">
                            <FileText className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 opacity-30" />
                            <p>No saved contracts yet. Generate your first one.</p>
                        </div>
                    ) : savedContracts.map((c: any) => {
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

                        return (
                            <div key={c.id} className="bg-slate-900/60 border border-white/5 rounded-xl sm:rounded-2xl p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between hover:border-teal-500/30 transition-all">
                                <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
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
                                            Value: <span className="text-slate-300 font-medium">{c.currency || 'USD'} {c.value ? c.value.toLocaleString() : '0'}</span>
                                            <span className="mx-1.5">·</span>
                                            Created: <span className="text-slate-300">{c.created_at ? format(new Date(c.created_at), 'MMM d, yyyy') : 'Recent'}</span>
                                            <span className="mx-1.5">·</span>
                                            Expiry: <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Expires {getExpiry()}</span>
                                        </p>
                                    </div>
                                </div>
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

                                        // Use proxied URL if available
                                        if (c.document_url) {
                                            c.document_url = fileUploadService.convertToProxiedUrl(c.document_url);
                                        }

                                        setStep('preview');
                                        setIsEditing(false);
                                        setPreviewTab('document');
                                        setActiveView('new');
                                    }}
                                    className="w-full sm:w-auto justify-center px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shrink-0 border border-white/5 hover:border-white/10"
                                >
                                    <Eye className="w-4 h-4 text-teal-400" /> View
                                </button>
                            </div>
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
                                    <div>
                                        <label className={labelCls}>Governing Jurisdiction</label>
                                        <input className={inputCls} value={form.jurisdiction} onChange={e => set('jurisdiction', e.target.value)} placeholder="e.g. State of California, USA" />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Governing Law</label>
                                        <input className={inputCls} value={form.governingLaw} onChange={e => set('governingLaw', e.target.value)} placeholder="e.g. Laws of the State of California" />
                                    </div>
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
                                    <button onClick={() => setStep('form')} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-all">
                                        <RotateCcw className="w-4 h-4" /> Edit Parameters
                                    </button>
                                    {!isSigned && (
                                        <button
                                            onClick={() => setIsEditing(!isEditing)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isEditing ? 'bg-teal-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                                        >
                                            <Edit3 className="w-4 h-4" /> {isEditing ? 'Save Refinements' : 'Refine Text'}
                                        </button>
                                    )}
                                    {(isSigned || step === 'saved') && (
                                        <>
                                            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-all">
                                                <Printer className="w-4 h-4" /> Print / PDF
                                            </button>
                                            <button onClick={openSendContractModal} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-all">
                                                <FileText className="w-4 h-4" /> Send Contract
                                            </button>
                                        </>
                                    )}
                                    {step !== 'saved' && (
                                        <button onClick={saveContract} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-60">
                                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Save Contract
                                        </button>
                                    )}
                                </div>
                                <button onClick={() => { setStep('form'); setGeneratedContract(''); setContractId(''); setIsSigned(false); setSignatureName(''); setSignatureData(''); setIsEditing(false); setPreviewTab('document'); }} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-sm transition-all">
                                    <RotateCcw className="w-4 h-4" /> New Contract
                                </button>
                            </div>

                            {/* Tab Selection */}
                            {contractId && (
                                <div className="flex gap-4 mb-6 border-b border-slate-800">
                                    <button
                                        onClick={() => setPreviewTab('document')}
                                        className={`pb-3 text-sm font-bold transition-all border-b-2 ${previewTab === 'document' ? 'border-teal-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                                    >
                                        Contract Document
                                    </button>
                                    <button
                                        onClick={() => setPreviewTab('audit')}
                                        className={`pb-3 text-sm font-bold transition-all border-b-2 ${previewTab === 'audit' ? 'border-teal-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
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
                                    {/* Signature Panel — shown when not yet signed */}
                                    {!isSigned && !isEditing && (
                                <div className="bg-gradient-to-br from-teal-900/30 to-slate-900/60 border border-teal-500/30 rounded-2xl p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                                            <CheckCircle className="w-5 h-5 text-teal-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold text-base">Sign to Proceed</h3>
                                            <p className="text-slate-400 text-sm">Draw your signature and type your name to sign this contract before saving or printing.</p>
                                        </div>
                                    </div>
                                    <SignaturePad
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
                                {isEditing ? 'Editing mode enabled. Your changes will be saved to the final contract.' : 'On-screen preview uses responsive layout. The PDF export uses standard A4 typography and adds a title block and signature area.'}
                            </p>

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

            {showSendModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowSendModal(false)} />
                    <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <h3 className="text-lg font-semibold text-white">Send Contract by Email</h3>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Recipient Email</label>
                            <input
                                className={inputCls}
                                value={sendForm.recipientEmail}
                                onChange={(e) => setSendForm(prev => ({ ...prev, recipientEmail: e.target.value }))}
                                placeholder="client@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Subject</label>
                            <input
                                className={inputCls}
                                value={sendForm.subject}
                                onChange={(e) => setSendForm(prev => ({ ...prev, subject: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">AI Instructions (What to write)</label>
                            <textarea
                                className={`${inputCls} min-h-[90px]`}
                                value={aiSendInstructions}
                                onChange={(e) => setAiSendInstructions(e.target.value)}
                                placeholder="Example: Write a friendly follow-up, mention delivery timeline and ask them to sign by Friday."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Message</label>
                            <textarea
                                className={`${inputCls} min-h-[140px]`}
                                value={sendForm.message}
                                onChange={(e) => setSendForm(prev => ({ ...prev, message: e.target.value }))}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={handleAiDraftSendMessage}
                                disabled={aiDraftingSend}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm"
                            >
                                {aiDraftingSend ? 'Drafting...' : 'AI Draft Message'}
                            </button>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setShowSendModal(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm">
                                    Cancel
                                </button>
                                <button type="button" onClick={handleSendContract} disabled={sendingContract} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-semibold">
                                    {sendingContract ? 'Sending...' : 'Send Contract'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
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

function buildAIPrompt(f: ContractForm): string {
    const deposit = f.totalAmount ? (parseFloat(f.totalAmount) * parseFloat(f.depositPercent || '50') / 100).toLocaleString() : '0';
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
- Total Value: ${f.currency} ${parseFloat(f.totalAmount || '0').toLocaleString()}
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
    const amount = parseFloat(f.totalAmount || '0');
    const depositPct = parseFloat(f.depositPercent || '50');
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
    const amount = parseFloat(f.totalAmount || '0');
    const depositPct = parseFloat(f.depositPercent || '50');
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
    const amount = parseFloat(f.totalAmount || '0');
    const depositPct = parseFloat(f.depositPercent || '50');
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
    const amount = parseFloat(f.totalAmount || '0');
    const depositPct = parseFloat(f.depositPercent || '50');
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

