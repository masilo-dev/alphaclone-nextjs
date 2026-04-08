'use client';
import React, { useState, useEffect, useRef } from 'react';
import { FileText, Bot, Download, Printer, Save, CheckCircle, User, Building2, DollarSign, Calendar, MapPin, Mail, Briefcase, ChevronRight, Loader2, Eye, Edit3, RotateCcw, Send } from 'lucide-react';
import { businessClientService, BusinessClient } from '../../services/businessClientService';
import { contractService, Contract } from '../../services/contractService';
import { fileUploadService } from '../../services/fileUploadService';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { User as UserType } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { SignaturePad } from './SignaturePad';

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
}

const PROJECT_TYPES = [
    'Web Application Development',
    'Mobile App Development',
    'E-Commerce Platform',
    'UI/UX Design',
    'Brand Identity & Design',
    'Digital Marketing Campaign',
    'SEO & Content Strategy',
    'Software Consulting',
    'IT Infrastructure & Support',
    'Data Analytics & Reporting',
    'Custom Software Solution',
    'SaaS Product Development',
];

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
    const { currentTenant } = useTenant();
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
        projectType: PROJECT_TYPES[0],
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
    });

    useEffect(() => {
        if (currentTenant?.id) {
            businessClientService.getClients(currentTenant.id).then(({ clients: c }) => setClients(c || []));
            supabase.from('contracts').select('*').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false })
                .then(({ data }: { data: any[] | null }) => { setSavedContracts(data || []); setLoadingContracts(false); })
                .catch(() => setLoadingContracts(false));
        }
    }, [currentTenant?.id]);

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
                body: JSON.stringify({ prompt, maxTokens: 4000, stream: true }),
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
            setGeneratedContract(buildTemplateContract(form));
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
                content: generatedContract,
                client_id: form.clientId || undefined,
                status: isSigned ? 'sent' : 'draft',
                payment_amount: parseFloat(form.totalAmount) || 0,
                admin_signature: isSigned ? signatureData : undefined,
                admin_signed_at: isSigned ? new Date().toISOString() : undefined,
            });
            if (error) throw new Error(error);
            toast.success('Contract saved successfully!');
            setSavedContracts(prev => [contract, ...prev]);
            setStep('saved');
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

    const inputCls = 'w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-all text-sm';
    const labelCls = 'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5';
    const sectionCls = 'bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4';

    return (
        <div className="min-h-full text-white">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Contract Generator</h1>
                    <p className="text-slate-400 text-sm mt-1">AI-powered professional contracts — fully customized, legally structured</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveView('new')}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeView === 'new' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                    >
                        New Contract
                    </button>
                    <button
                        onClick={() => setActiveView('list')}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeView === 'list' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                    >
                        Saved ({savedContracts.length})
                    </button>
                </div>
            </div>

            {/* Saved Contracts List */}
            {activeView === 'list' && (
                <div className="space-y-3">
                    {loadingContracts ? (
                        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-teal-400 animate-spin" /></div>
                    ) : savedContracts.length === 0 ? (
                        <div className="text-center py-20 text-slate-500">
                            <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                            <p>No saved contracts yet. Generate your first one!</p>
                        </div>
                    ) : savedContracts.map((c: any) => (
                        <div key={c.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center justify-between hover:border-teal-500/30 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-teal-400" />
                                </div>
                                <div>
                                    <p className="font-semibold text-white">{c.title}</p>
                                    <p className="text-xs text-slate-500">{c.status} · {c.currency} {c.value?.toLocaleString()} · {c.created_at ? format(new Date(c.created_at), 'MMM d, yyyy') : ''}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
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
                                    setActiveView('new');
                                }}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                            >
                                <Eye className="w-4 h-4" /> View
                            </button>
                        </div>
                    ))}
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
                                        <label className={labelCls}>Project Type</label>
                                        <select className={inputCls} value={form.projectType} onChange={e => set('projectType', e.target.value)}>
                                            {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
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
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Generating Professional Contract...</>
                                ) : (
                                    <><Bot className="w-5 h-5" /> Generate 5-Page Professional Contract</>
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
                                        <Edit3 className="w-4 h-4" /> Edit Details
                                    </button>
                                    {isSigned && (
                                        <>
                                            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-all">
                                                <Printer className="w-4 h-4" /> Print / PDF
                                            </button>
                                            {step !== 'saved' && (
                                                <button onClick={saveContract} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-60">
                                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                    Save Contract
                                                </button>
                                            )}
                                        </>
                                    )}
                                    {step === 'saved' && (
                                        <span className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 rounded-xl text-sm font-medium border border-green-500/20">
                                            <CheckCircle className="w-4 h-4" /> Saved
                                        </span>
                                    )}
                                </div>
                                <button onClick={() => { setStep('form'); setGeneratedContract(''); setContractId(''); setIsSigned(false); setSignatureName(''); setSignatureData(''); }} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-sm transition-all">
                                    <RotateCcw className="w-4 h-4" /> New Contract
                                </button>
                            </div>

                            {/* Signature Panel — shown when not yet signed */}
                            {!isSigned && (
                                <div className="bg-gradient-to-br from-teal-900/30 to-slate-900/60 border border-teal-500/30 rounded-2xl p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                                            <Edit3 className="w-5 h-5 text-teal-400" />
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

                            {/* Contract Document */}
                            <div ref={printRef} className="bg-white text-gray-900 rounded-2xl shadow-2xl overflow-hidden">
                                <div className="p-8 md:p-12 font-serif leading-relaxed" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                                    <div className="whitespace-pre-wrap text-sm leading-7" dangerouslySetInnerHTML={{ __html: contractToHTML(generatedContract) }} />
                                </div>
                            </div>
                        </div>
                    )}
                </>
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

function buildAIPrompt(f: ContractForm): string {
    const deposit = f.totalAmount ? (parseFloat(f.totalAmount) * parseFloat(f.depositPercent || '50') / 100).toLocaleString() : '0';
    return `You are a professional contract lawyer. Generate a complete, formal, legally-structured 5-page Master Services Agreement (MSA) between the following parties. The contract must be fully professional with NO placeholder text, NO asterisks, NO brackets like [NAME] or [DATE] — use only the real information provided below. Every section must be fully written out in proper legal language.

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

Structure the contract with these sections:
1. PARTIES AND RECITALS
2. SCOPE OF SERVICES AND DELIVERABLES
3. COMPENSATION, PAYMENT TERMS, AND SCHEDULE
4. PROJECT TIMELINE AND MILESTONES
5. INTELLECTUAL PROPERTY RIGHTS
6. CONFIDENTIALITY AND NON-DISCLOSURE
7. WARRANTIES AND REPRESENTATIONS
8. LIMITATION OF LIABILITY AND INDEMNIFICATION
9. TERMINATION AND DISPUTE RESOLUTION
10. GENERAL PROVISIONS (Force Majeure, Entire Agreement, Amendments, Severability, Assignment, Notices)
11. SIGNATURES AND EXECUTION (Use exactly the explicitly provided Provider Name, Client Full Name, and contact information. Do NOT use blank lines or underscores under any circumstances for names, dates, or titles.)

Use markdown formatting: # for main title, ## for sections, **bold** for key terms. Make it exactly 5 pages worth of content. Write every clause in full — do not abbreviate or use placeholders.`;
}

function buildTemplateContract(f: ContractForm): string {
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

export default ContractDashboard;
