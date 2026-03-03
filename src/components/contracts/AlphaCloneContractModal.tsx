import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Calendar, DollarSign, FileText, Send, MessageCircle, CheckCircle, Edit3, Save, Printer, Share2 } from 'lucide-react';
import { Button, Input, Badge } from '../ui/UIComponents';
import { SignaturePad } from './SignaturePad';
import { generateAlphaCloneContract, ContractVariables, PAYMENT_SCHEDULES, SCOPE_TEMPLATES } from '../../services/alphacloneContractTemplate';
import { contractService } from '../../services/contractService';
import { businessClientService, BusinessClient } from '../../services/businessClientService';
import { googleDriveService } from '../../services/googleDriveService';
import toast from 'react-hot-toast';
import { User, Project } from '../../types';
import { supabase } from '../../lib/supabase';
import ContractDraftingVisual from './ContractDraftingVisual';

import { useTenant } from '../../contexts/TenantContext';
import { useBackgroundTasks } from '../../contexts/BackgroundTaskContext';
import { PLAN_PRICING } from '../../services/tenancy/types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    project?: Partial<Project>;
    user: User;
    existingContractId?: string;
    existingContractText?: string;
}

interface Comment {
    id: string;
    userId: string;
    userName: string;
    text: string;
    createdAt: Date;
}

const AlphaCloneContractModal: React.FC<Props> = ({
    isOpen,
    onClose,
    project,
    user,
    existingContractId,
    existingContractText
}) => {
    const { currentTenant } = useTenant();
    const [step, setStep] = useState<'edit' | 'drafting' | 'preview' | 'sign' | 'success'>('edit');
    const [contractText, setContractText] = useState('');
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [showComments, setShowComments] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSavingToDrive, setIsSavingToDrive] = useState(false);
    const [clients, setClients] = useState<BusinessClient[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>(project?.ownerId || '');
    const { startTask } = useBackgroundTasks();

    // Contract variables with defaults
    const [variables, setVariables] = useState<ContractVariables>({
        clientName: project?.ownerName || 'Client Name',
        clientCompany: '',
        clientAddress: '',
        clientEmail: project?.email || '',
        projectName: project?.name || 'New Contract',
        projectScope: project?.description || SCOPE_TEMPLATES.custom,
        projectDeliverables: 'Professional services and deliverables as mutually agreed upon',
        totalAmount: project?.budget || 10000,
        paymentSchedule: PAYMENT_SCHEDULES['50_50'],
        depositAmount: (project?.budget || 10000) * 0.5,
        startDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        deliveryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        contractDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        providerName: currentTenant?.name || 'Authorized Service Provider',
        providerCompanyName: currentTenant?.name || '', // New field
        providerPersonalName: user.name || '', // New field
        providerAddress: '',
        providerEmail: user.email || '',
        providerRegistration: '',
        governingJurisdiction: '[Your State/Country Jurisdiction]',
        providerRepName: user.name || '',
        providerRepTitle: 'Authorized Representative',
        clientRepName: project?.ownerName || '',
        clientRepTitle: 'Authorized Representative'
    });

    useEffect(() => {
        if (currentTenant?.id) {
            businessClientService.getClients(currentTenant.id).then(({ clients }) => {
                setClients(clients || []);
            });
        }
    }, [currentTenant?.id]);

    useEffect(() => {
        if (selectedClientId && clients.length > 0) {
            const client = clients.find(c => c.id === selectedClientId);
            if (client) {
                setVariables(prev => ({
                    ...prev,
                    clientName: client.name,
                    clientCompany: client.name || '',
                    clientEmail: client.email || prev.clientEmail,
                    clientAddress: client.location || '',
                    clientRepName: client.name || prev.clientRepName
                }));
            }
        }
    }, [selectedClientId, clients]);

    useEffect(() => {
        if (existingContractText) {
            // Load existing contract
            setContractText(existingContractText);
            setStep('preview');
        } else {
            // Generate new contract
            generateContract();
        }
    }, [existingContractText]);

    const generateContract = () => {
        const generated = generateAlphaCloneContract(variables);
        setContractText(generated);
    };

    const handleVariableChange = (key: keyof ContractVariables, value: any) => {
        setVariables(prev => ({ ...prev, [key]: value }));
    };

    const handleGeneratePreview = () => {
        // Validation for mandatory fields
        const requiredFields = [
            { key: variables.clientName, name: 'Client Name' },
            { key: variables.clientEmail, name: 'Client Email' },
            { key: variables.clientRepName, name: 'Client Authorized Representative' },
            { key: variables.clientRepTitle, name: 'Client Signatory Title' },
            { key: variables.providerCompanyName, name: 'Provider Company Name' },
            { key: variables.providerPersonalName, name: 'Provider Personal Name' },
            { key: variables.providerName, name: 'Provider Name' },
            { key: variables.providerEmail, name: 'Provider Email' },
            { key: variables.providerRepName, name: 'Provider Authorized Rep.' },
            { key: variables.providerRepTitle, name: 'Provider Signatory Title' },
            { key: variables.governingJurisdiction, name: 'Governing Jurisdiction' },
            { key: variables.contractDate, name: 'Contract Date' },
            { key: variables.startDate, name: 'Start Date' },
            { key: variables.deliveryDate, name: 'Delivery Date' },
            { key: variables.totalAmount, name: 'Total Amount' },
            { key: variables.projectScope, name: 'Project Scope' },
            { key: variables.projectDeliverables, name: 'Deliverables' }
        ];

        for (const field of requiredFields) {
            if (!field.key && field.key !== 0) {
                toast.error(`Please fill out the mandatory field: ${field.name}`);
                return;
            }
        }

        generateContract();
        setStep('drafting');
        toast.success('Initiating legal AI drafting process...');
    };

    const handleDraftingComplete = () => {
        setStep('preview');
        toast.success('Contract generated successfully');
    };

    const handleAddComment = () => {
        if (!newComment.trim()) return;

        const comment: Comment = {
            id: Date.now().toString(),
            userId: user.id,
            userName: user.name,
            text: newComment,
            createdAt: new Date()
        };

        setComments(prev => [...prev, comment]);
        setNewComment('');
        toast.success('Comment added - admin will review');
    };

    const [signature, setSignature] = useState<string | null>(null);
    const [signatureName, setSignatureName] = useState<string>('');

    const handleSignContract = async (signatureData: string, fullName: string) => {
        try {
            if (!currentTenant?.id) {
                toast.error('No active tenant selected');
                return;
            }

            // We need a contract ID to sign.
            // In creation flow, we send the contract first, which generates the ID.
            if (!existingContractId) {
                setSignature(signatureData); // Store for later
                setSignatureName(fullName);
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error: signError } = await contractService.signContract(existingContractId, 'admin', signatureData, {
                id: user.id,
                name: fullName,
                email: user.email || ''
            });

            if (signError) throw signError;

            setSignature(signatureData);
            setSignatureName(fullName);
            toast.success('Contract signed locally. Proceed to send.');

        } catch (error) {
            console.error('Error signing contract:', error);
            toast.error(`Failed to sign contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleSendToClient = async () => {
        if (!signature) {
            toast.error('Please provide a signature first');
            return;
        }

        setIsSubmitting(true);
        const taskName = `Finalizing Contract for ${project?.name || 'Client'}`;

        try {
            startTask(
                `finalize_contract_${Date.now()}`,
                taskName,
                async () => {
                    try {
                        const { data: { user: authUser } } = await supabase.auth.getUser();
                        if (!authUser) throw new Error('Not authenticated');

                        if (existingContractId) {
                            await contractService.signContract(
                                existingContractId,
                                user.role === 'admin' ? 'admin' : 'client',
                                signature,
                                { id: authUser.id, name: signatureName || authUser.user_metadata.full_name || authUser.email || 'Admin', email: authUser.email || '' }
                            );

                            // Auto-save to Document Hub
                            try {
                                const { fileUploadService } = await import('../../services/fileUploadService');
                                // const { supabase } = await import('../../lib/supabase'); // Already imported statically
                                const { data: finalContract } = await supabase
                                    .from('contracts')
                                    .select('*, project:projects(name)')
                                    .eq('id', existingContractId)
                                    .single();

                                if (finalContract) {
                                    const doc = contractService.generateProfessionalPDF(finalContract, currentTenant);
                                    const pdfBlob = doc.output('blob');
                                    const pdfFile = new File([pdfBlob], `Contract-${finalContract.title}.pdf`, { type: 'application/pdf' });
                                    await fileUploadService.uploadFile(pdfFile, 'contract', finalContract.id);
                                }
                            } catch (err) {
                                console.error('Failed to auto-save contract PDF:', err);
                            }

                            return { success: true };
                        } else {
                            const { contract, error } = await contractService.createContract({
                                project_id: project?.id !== 'new' ? project?.id : undefined,
                                client_id: selectedClientId || project?.ownerId,
                                title: `Service Agreement - ${project?.name || variables.clientName || 'Standalone'}`,
                                content: contractText,
                            });

                            if (error) throw new Error(error);

                            if (contract) {
                                // If pre-signed, apply signature
                                if (signature && signatureName) {
                                    await contractService.signContract(contract.id, 'admin', signature, {
                                        id: authUser.id,
                                        name: signatureName,
                                        email: authUser.email || ''
                                    });
                                } else if (signature) {
                                    await contractService.signContract(contract.id, 'admin', signature, {
                                        id: authUser.id,
                                        name: 'Administrator', // Fallback if signatureName is not set
                                        email: authUser.email || ''
                                    });
                                }

                                if (user.role === 'admin' && project?.id && project.id !== 'new') {
                                    const { projectService } = await import('../../services/projectService');
                                    await projectService.updateProject(project.id, {
                                        contractStatus: 'Sent',
                                        contractText: contractText
                                    });
                                }

                                // Auto-save to Document Hub
                                try {
                                    const { fileUploadService } = await import('../../services/fileUploadService');
                                    // const { supabase } = await import('../../lib/supabase'); // Already imported statically
                                    const { data: finalContract } = await supabase
                                        .from('contracts')
                                        .select('*, project:projects(name)')
                                        .eq('id', contract.id)
                                        .single();

                                    if (finalContract) {
                                        const doc = contractService.generateProfessionalPDF(finalContract, currentTenant);
                                        const pdfBlob = doc.output('blob');
                                        const pdfFile = new File([pdfBlob], `Contract-${finalContract.title}.pdf`, { type: 'application/pdf' });
                                        await fileUploadService.uploadFile(pdfFile, 'contract', finalContract.id);
                                    }
                                } catch (err) {
                                    console.error('Failed to auto-save contract PDF:', err);
                                }
                            }
                            return { contractId: contract?.id };
                        }
                    } catch (taskErr) {
                        console.error('Background task error:', taskErr);
                        toast.error(`Background task failed: ${taskErr instanceof Error ? taskErr.message : 'Unknown error'}`);
                        throw taskErr;
                    }
                }
            );

            // Successfully started the task, move to success step
            setStep('success');
            toast.success(`Started: ${taskName}`);
        } catch (err) {
            console.error('Failed to start contract task:', err);
            toast.error('Failed to initiate contract processing');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveToDrive = async () => {
        setIsSavingToDrive(true);
        const toastId = toast.loading('Exporting to Google Drive...');

        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) throw new Error('Not authenticated');

            let finalContract;
            if (existingContractId) {
                const { data } = await supabase
                    .from('contracts')
                    .select('*, project:projects(name)')
                    .eq('id', existingContractId)
                    .single();
                finalContract = data;
            } else {
                finalContract = {
                    title: `${variables.projectName} — ${variables.clientName}`,
                    content: contractText,
                    admin_signature: signature,
                    admin_signed_at: new Date().toISOString(),
                    status: 'sent'
                };
            }

            if (!finalContract) throw new Error('Contract data not found');

            const doc = contractService.generateProfessionalPDF(finalContract, currentTenant);
            const pdfBlob = doc.output('blob');

            await googleDriveService.uploadFile(
                authUser.id,
                pdfBlob,
                `Contract-${finalContract.title || 'Untitled'}.pdf`
            );

            toast.success('Successfully saved to Google Drive!', { id: toastId });
        } catch (err: any) {
            console.error('Google Drive Export Error:', err);
            toast.error(err.message || 'Failed to save to Google Drive', { id: toastId });
        } finally {
            setIsSavingToDrive(false);
        }
    };

    if (!isOpen) return null;

    // Check feature flag
    const plan = currentTenant?.subscription_plan || 'free';
    const planFeatures = PLAN_PRICING[plan as keyof typeof PLAN_PRICING]?.features;

    if (planFeatures && !planFeatures.contractGeneration && user.role === 'admin') {
        return (
            <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
                <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl p-8 text-center">
                    <div className="w-16 h-16 bg-teal-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FileText className="w-8 h-8 text-teal-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Upgrade to Pro</h2>
                    <p className="text-slate-400 mb-6">
                        Contract generation and professional service agreements are available on our Pro and Enterprise plans.
                    </p>
                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={() => window.location.href = '/dashboard/settings?tab=billing'}
                            className="bg-teal-600 hover:bg-teal-500 font-bold"
                        >
                            Upgrade Plan
                        </Button>
                        <Button variant="outline" onClick={onClose} className="border-slate-700 text-slate-400 hover:text-white">
                            Close
                        </Button>
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-6xl bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl my-8">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <FileText className="w-6 h-6 text-teal-400" />
                            {currentTenant?.name || 'Service'} Contract
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                            {existingContractId ? 'Review and Sign' : 'Professional Service Agreement'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {step === 'preview' && user.role === 'client' && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowComments(!showComments)}
                                className="flex items-center gap-2"
                            >
                                <MessageCircle className="w-4 h-4" />
                                Comments ({comments.length})
                            </Button>
                        )}
                        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    {/* STEP 1: Edit Variables (Admin Only) */}
                    {step === 'edit' && user.role === 'admin' && (
                        <div className="space-y-6">
                            <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4 flex items-start gap-3">
                                <Edit3 className="w-5 h-5 text-teal-400 mt-0.5" />
                                <div>
                                    <h3 className="text-teal-400 font-bold text-sm">Edit Contract Details</h3>
                                    <p className="text-slate-400 text-xs mt-1">
                                        Fill in the contract details below. Dates must be edited before sending.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Select Existing Client</label>
                                    <select
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-300 text-sm outline-none focus:ring-2 focus:ring-teal-500/30"
                                        value={selectedClientId}
                                        onChange={e => setSelectedClientId(e.target.value)}
                                    >
                                        <option value="">-- Manual Entry --</option>
                                        {clients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-start-1">
                                    <Input
                                        label="Client Name *"
                                        value={variables.clientName}
                                        onChange={(e) => handleVariableChange('clientName', e.target.value)}
                                    />
                                </div>
                                <Input
                                    label="Client Company"
                                    value={variables.clientCompany}
                                    onChange={(e) => handleVariableChange('clientCompany', e.target.value)}
                                    placeholder="Optional"
                                />
                                <Input
                                    label="Client Email *"
                                    value={variables.clientEmail}
                                    onChange={(e) => handleVariableChange('clientEmail', e.target.value)}
                                />
                                <Input
                                    label="Client Address"
                                    value={variables.clientAddress}
                                    onChange={(e) => handleVariableChange('clientAddress', e.target.value)}
                                    placeholder="Optional"
                                />
                                <Input
                                    label="Client Authorized Representative *"
                                    value={variables.clientRepName}
                                    onChange={(e) => handleVariableChange('clientRepName', e.target.value)}
                                    placeholder="Name of individual signing"
                                />
                                <Input
                                    label="Client Signatory Title *"
                                    value={variables.clientRepTitle}
                                    onChange={(e) => handleVariableChange('clientRepTitle', e.target.value)}
                                    placeholder="e.g. CEO, Founder"
                                />
                            </div>

                            <div className="border-t border-slate-800 pt-4">
                                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-teal-400" />
                                    Provider Details (Your Business)
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Provider Business Name *"
                                        value={variables.providerName}
                                        onChange={(e) => handleVariableChange('providerName', e.target.value)}
                                        placeholder="Display fallback"
                                    />
                                    <Input
                                        label="Company/Legal Name *"
                                        value={variables.providerCompanyName}
                                        onChange={(e) => handleVariableChange('providerCompanyName', e.target.value)}
                                        placeholder="Full Legal Company Name"
                                    />
                                    <Input
                                        label="Personal Name (Sender) *"
                                        value={variables.providerPersonalName}
                                        onChange={(e) => handleVariableChange('providerPersonalName', e.target.value)}
                                        placeholder="Your Full Legal Name"
                                    />
                                    <Input
                                        label="Business Registration #"
                                        value={variables.providerRegistration}
                                        onChange={(e) => handleVariableChange('providerRegistration', e.target.value)}
                                        placeholder="e.g. TAX ID, EIN"
                                    />
                                    <Input
                                        label="Provider Email *"
                                        value={variables.providerEmail}
                                        onChange={(e) => handleVariableChange('providerEmail', e.target.value)}
                                    />
                                    <Input
                                        label="Governing Jurisdiction *"
                                        value={variables.governingJurisdiction}
                                        onChange={(e) => handleVariableChange('governingJurisdiction', e.target.value)}
                                        placeholder="e.g. State of California, USA"
                                    />
                                    <Input
                                        label="Provider Address"
                                        value={variables.providerAddress}
                                        onChange={(e) => handleVariableChange('providerAddress', e.target.value)}
                                        placeholder="Optional but recommended"
                                    />
                                    <Input
                                        label="Provider Authorized Rep. *"
                                        value={variables.providerRepName}
                                        onChange={(e) => handleVariableChange('providerRepName', e.target.value)}
                                        placeholder="Name of individual signing"
                                    />
                                    <Input
                                        label="Provider Signatory Title *"
                                        value={variables.providerRepTitle}
                                        onChange={(e) => handleVariableChange('providerRepTitle', e.target.value)}
                                        placeholder="e.g. Owner, Managing Director"
                                    />
                                </div>
                            </div>

                            <div className="border-t border-slate-800 pt-4">
                                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-teal-400" />
                                    Timeline & Dates
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Input
                                        label="Contract Date *"
                                        value={variables.contractDate}
                                        onChange={(e) => handleVariableChange('contractDate', e.target.value)}
                                    />
                                    <Input
                                        label="Start Date *"
                                        value={variables.startDate}
                                        onChange={(e) => handleVariableChange('startDate', e.target.value)}
                                    />
                                    <Input
                                        label="Delivery Date *"
                                        value={variables.deliveryDate}
                                        onChange={(e) => handleVariableChange('deliveryDate', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="border-t border-slate-800 pt-4">
                                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                                    <DollarSign className="w-5 h-5 text-green-400" />
                                    Financial Terms
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Total Amount (USD) *"
                                        type="number"
                                        value={variables.totalAmount}
                                        onChange={(e) => handleVariableChange('totalAmount', parseInt(e.target.value) || 0)}
                                    />
                                    <Input
                                        label="Deposit Amount (USD)"
                                        type="number"
                                        value={variables.depositAmount}
                                        onChange={(e) => handleVariableChange('depositAmount', parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="mt-4">
                                    <label className="text-sm font-medium text-slate-300 mb-2 block">Payment Schedule *</label>
                                    <select
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-300"
                                        value={variables.paymentSchedule}
                                        onChange={(e) => handleVariableChange('paymentSchedule', e.target.value)}
                                    >
                                        {Object.entries(PAYMENT_SCHEDULES).map(([key, value]) => (
                                            <option key={key} value={value}>
                                                {key.replace(/_/g, ' ').toUpperCase()}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="border-t border-slate-800 pt-4">
                                <h3 className="text-white font-bold mb-3">Project Scope *</h3>
                                <textarea
                                    className="w-full h-24 bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-300"
                                    value={variables.projectScope}
                                    onChange={(e) => handleVariableChange('projectScope', e.target.value)}
                                />
                            </div>

                            <div>
                                <h3 className="text-white font-bold mb-3">Deliverables *</h3>
                                <textarea
                                    className="w-full h-24 bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-300"
                                    value={variables.projectDeliverables}
                                    onChange={(e) => handleVariableChange('projectDeliverables', e.target.value)}
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                                <Button variant="outline" onClick={onClose}>Cancel</Button>
                                <Button onClick={handleGeneratePreview} className="bg-teal-600 hover:bg-teal-500">
                                    <Save className="w-4 h-4 mr-2" />
                                    Generate Contract
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* STEP 1.5: Drafting Visual Sequence */}
                    {step === 'drafting' && (
                        <div className="absolute inset-0 z-[60] bg-slate-950 flex flex-col items-center justify-center rounded-2xl overflow-hidden">
                            <ContractDraftingVisual
                                clientName={variables.clientCompany || variables.clientName}
                                onComplete={handleDraftingComplete}
                                durationMs={6000} // 6 seconds of AI processing visual
                            />
                        </div>
                    )}

                    {/* STEP 2: Preview Contract */}
                    {step === 'preview' && (
                        <div className="space-y-6">
                            {/* Contract Preview */}
                            <div className="bg-white text-black p-10 rounded-lg border-4 border-slate-700 max-h-[600px] overflow-y-auto shadow-inner prose prose-slate max-w-none">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        h1: ({ node, ...props }) => <h1 className="text-2xl font-black mb-6 border-b-2 border-slate-200 pb-2 uppercase tracking-tight" {...props} />,
                                        h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-8 mb-4 border-b border-slate-100 pb-1" {...props} />,
                                        h3: ({ node, ...props }) => <h3 className="text-lg font-bold mt-6 mb-3 italic" {...props} />,
                                        p: ({ node, ...props }) => <p className="mb-4 leading-relaxed text-sm text-slate-800" {...props} />,
                                        ul: ({ node, ...props }) => <ul className="list-disc pl-6 mb-4 space-y-1 text-sm" {...props} />,
                                        ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-4 space-y-1 text-sm" {...props} />,
                                        li: ({ node, ...props }) => <li className="text-slate-800" {...props} />,
                                        strong: ({ node, ...props }) => <strong className="font-black text-black" {...props} />,
                                        hr: ({ node, ...props }) => <hr className="my-8 border-slate-200" {...props} />,
                                    }}
                                >
                                    {contractText}
                                </ReactMarkdown>
                            </div>

                            {/* Comments Section (Client Only) */}
                            {showComments && user.role === 'client' && (
                                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                                    <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                                        <MessageCircle className="w-5 h-5 text-purple-400" />
                                        Contract Comments
                                    </h3>
                                    <p className="text-slate-400 text-sm mb-4">
                                        If you disagree with any terms, add comments below. Admin will review and update the contract.
                                    </p>

                                    {/* Comments List */}
                                    <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                                        {comments.map(comment => (
                                            <div key={comment.id} className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-teal-400 text-xs font-bold">{comment.userName}</span>
                                                    <span className="text-slate-500 text-[10px]">
                                                        {comment.createdAt.toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <p className="text-slate-300 text-sm">{comment.text}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add Comment */}
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-300 text-sm"
                                            placeholder="Add a comment about the contract..."
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                                        />
                                        <Button onClick={handleAddComment} size="sm">
                                            <Send className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                                <div>
                                    {user.role === 'admin' && !existingContractId && (
                                        <Button variant="outline" onClick={() => setStep('edit')}>
                                            <Edit3 className="w-4 h-4 mr-2" />
                                            Edit Details
                                        </Button>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                                    <Button onClick={() => setStep('sign')} className="bg-green-600 hover:bg-green-500">
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        {user.role === 'admin' ? `Sign as ${user.name}` : 'Sign Contract'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Sign Contract */}
                    {step === 'sign' && (
                        <div className="space-y-6">
                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-start gap-3">
                                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                                <div>
                                    <h3 className="text-green-400 font-bold text-sm">Sign Contract</h3>
                                    <p className="text-slate-400 text-xs mt-1">
                                        By signing, you legally agree to all terms in this contract.
                                        {user.role === 'admin' && ` Signing as ${user.name} (Authorized Agent of ${currentTenant?.name || 'Company'}).`}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-white mb-2 block">
                                    {user.role === 'admin' ? `Sign as ${user.name} (${currentTenant?.name || 'Provider'})` : `Sign as ${user.name}`}
                                </label>
                                <div className="border-2 border-slate-700 rounded-xl overflow-hidden bg-white">
                                    <SignaturePad
                                        onSave={(sig, name) => {
                                            handleSignContract(sig, name);
                                        }}
                                        onClear={() => {
                                            setSignature(null);
                                            setSignatureName('');
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-between items-center gap-3">
                                <Button variant="outline" onClick={() => setStep('preview')}>Back</Button>
                                {signature && (
                                    <Button
                                        onClick={handleSendToClient}
                                        disabled={isSubmitting}
                                        className="bg-teal-600 hover:bg-teal-500"
                                    >
                                        <Send className="w-4 h-4 mr-2" />
                                        {isSubmitting ? 'Sending...' : 'Sign & Send Contract'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 4: Success Message */}
                    {step === 'success' && (
                        <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in-up">
                            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                                <CheckCircle className="w-10 h-10 text-green-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Contract Signed Successfully!</h3>
                            <p className="text-slate-400 max-w-md mb-8">
                                The contract has been securely saved and logged. A notification has been sent to all parties.
                            </p>

                            <div className="flex flex-wrap justify-center gap-4">
                                <Button variant="outline" onClick={async () => {
                                    toast.success("PDF Download started...");
                                    try {
                                        if (existingContractId) {
                                            const { data: contract } = await supabase.from('contracts').select('*').eq('id', existingContractId).single();
                                            if (contract) {
                                                contractService.downloadPDF(contract, currentTenant || undefined);
                                            }
                                        } else {
                                            const mockContract = {
                                                title: `${variables.projectName} — ${variables.clientName}`,
                                                content: contractText,
                                                admin_signature: signature,
                                                admin_signed_at: new Date().toISOString(),
                                                status: 'sent'
                                            };
                                            contractService.downloadPDF(mockContract, currentTenant || undefined);
                                        }
                                    } catch (e) {
                                        toast.error("Failed to generate PDF");
                                    }
                                }}>
                                    <FileText className="w-4 h-4 mr-2" /> Download PDF
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={() => window.print()}
                                    className="border-slate-700 text-slate-300 hover:text-white"
                                >
                                    <Printer className="w-4 h-4 mr-2" /> Print Contract
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={handleSaveToDrive}
                                    disabled={isSavingToDrive}
                                    className="border-slate-700 text-slate-300 hover:text-white"
                                >
                                    <Share2 className={`w-4 h-4 mr-2 ${isSavingToDrive ? 'animate-spin' : ''}`} />
                                    {isSavingToDrive ? 'Saving...' : 'Save to Drive'}
                                </Button>

                                <Button onClick={onClose} className="bg-teal-600 hover:bg-teal-500 min-w-[120px]">
                                    Close Window
                                </Button>
                            </div>

                            {existingContractId && (
                                <div className="mt-8 pt-6 border-t border-slate-800 w-full max-w-md">
                                    <p className="text-slate-500 text-sm mb-3">Share External Signing Link</p>
                                    <div className="flex gap-2">
                                        <input
                                            readOnly
                                            value={`${window.location.origin}/dashboard/business/contracts`}
                                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-400 text-sm"
                                        />
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${window.location.origin}/dashboard/business/contracts`);
                                                toast.success('Link copied!');
                                            }}
                                        >
                                            Copy
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div >
        </div >
    );
};

export default AlphaCloneContractModal;
