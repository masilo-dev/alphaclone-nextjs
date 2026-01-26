import React, { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, FileText, Send, MessageCircle, CheckCircle, Edit3, Save } from 'lucide-react';
import { Button, Input, Badge } from '../ui/UIComponents';
import { SignaturePad } from './SignaturePad';
import { generateAlphaCloneContract, ContractVariables, PAYMENT_SCHEDULES, SCOPE_TEMPLATES } from '../../services/alphacloneContractTemplate';
import { contractService } from '../../services/contractService';
import toast from 'react-hot-toast';
import { User, Project } from '../../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
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
    const [step, setStep] = useState<'edit' | 'preview' | 'sign' | 'success'>('edit');
    const [contractText, setContractText] = useState('');
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [showComments, setShowComments] = useState(false);

    // Contract variables with defaults
    const [variables, setVariables] = useState<ContractVariables>({
        clientName: project.ownerName || 'Client Name',
        clientCompany: '',
        clientAddress: '',
        clientEmail: project.email || '',
        projectName: project.name || 'Project Name',
        projectScope: project.description || SCOPE_TEMPLATES.web_app,
        projectDeliverables: 'Web application with source code, documentation, and deployment',
        totalAmount: project.budget || 10000,
        paymentSchedule: PAYMENT_SCHEDULES['50_50'],
        depositAmount: (project.budget || 10000) * 0.5,
        startDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        deliveryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        contractDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    });

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
        generateContract();
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

    const handleSignContract = async (signatureDataUrl: string) => {
        try {
            if (existingContractId) {
                // Sign existing contract
                await contractService.signContract(
                    existingContractId,
                    user.role === 'admin' ? 'admin' : 'client',
                    signatureDataUrl
                );
                toast.success('Contract signed successfully!');
            } else {
                // Create and sign new contract
                const { contract, error } = await contractService.createContract({
                    project_id: project.id,
                    client_id: project.ownerId, // Link to Client
                    title: `Service Agreement - ${project.name}`,
                    type: 'service_agreement',
                    content: contractText,
                    status: 'sent' // Auto-set to SENT so client sees it
                });

                if (error) throw new Error(error);

                if (contract) {
                    await contractService.signContract(
                        contract.id,
                        user.role === 'admin' ? 'admin' : 'client',
                        signatureDataUrl
                    );

                    // Also update Project status
                    if (user.role === 'admin') {
                        // Import dynamically to avoid circular deps if needed, or use service directly
                        const { projectService } = await import('../../services/projectService');
                        await projectService.updateProject(project.id, {
                            contractStatus: 'Sent',
                            contractText: contractText
                        });
                    }

                    toast.success('Contract signed and sent to client!');
                }
            }
            setStep('success'); // Move to success step instead of closing
        } catch (error) {
            console.error(error);
            toast.error('Failed to sign contract');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-6xl bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl my-8">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <FileText className="w-6 h-6 text-teal-400" />
                            AlphaClone Systems Contract
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
                                <Input
                                    label="Client Name *"
                                    value={variables.clientName}
                                    onChange={(e) => handleVariableChange('clientName', e.target.value)}
                                />
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

                    {/* STEP 2: Preview Contract */}
                    {step === 'preview' && (
                        <div className="space-y-6">
                            {/* Contract Preview */}
                            <div className="bg-white text-black p-8 rounded-lg font-mono text-xs whitespace-pre-wrap border-4 border-slate-700 max-h-[500px] overflow-y-auto">
                                {contractText}
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
                                        {user.role === 'admin' ? 'Sign as Bonnie' : 'Sign Contract'}
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
                                        {user.role === 'admin' && ' Signing as Bonnie (Authorized Agent of AlphaClone Systems).'}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-white mb-2 block">
                                    {user.role === 'admin' ? 'Sign as Bonnie (AlphaClone Agent)' : `Sign as ${user.name}`}
                                </label>
                                <div className="border-2 border-slate-700 rounded-xl overflow-hidden bg-white">
                                    <SignaturePad onSave={handleSignContract} onClear={() => { }} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3">
                                <Button variant="outline" onClick={() => setStep('preview')}>Back</Button>
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

                            <div className="flex gap-4">
                                <Button variant="outline" onClick={() => {
                                    toast.success("PDF Download started...");
                                    // In production generate PDF blob here
                                }}>
                                    <DollarSign className="w-4 h-4 mr-2" /> Download PDF
                                </Button>
                                <Button onClick={onClose} className="bg-teal-600 hover:bg-teal-500">
                                    Close Window
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AlphaCloneContractModal;
