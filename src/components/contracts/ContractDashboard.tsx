import React, { useState, useEffect } from 'react';
import { contractService, Contract } from '../../services/contractService';
import { SignaturePad } from './SignaturePad';
import { Card, Button, Badge, Input } from '../ui/UIComponents';
import { FileText, PenTool, Download, Plus, CheckCircle, Clock, X, Bot, Eye, Save } from 'lucide-react';
import { format } from 'date-fns';
import { User } from '../../types';
import toast from 'react-hot-toast';

interface ContractDashboardProps {
    user: User;
}

const ContractDashboard: React.FC<ContractDashboardProps> = ({ user }) => {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSignModal, setShowSignModal] = useState(false);
    const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

    // Role-based access: client can only view and sign, admin can do everything
    const isAdmin = user.role === 'admin';

    // Editor State
    const [isEditing, setIsEditing] = useState(false);
    const [draftTitle, setDraftTitle] = useState('');
    const [draftClient, setDraftClient] = useState('');
    const [draftContent, setDraftContent] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        loadContracts();
    }, [user.id]);

    const loadContracts = async () => {
        setLoading(true);
        const { contracts: data } = await contractService.getUserContracts(user.id, user.role);
        if (data) setContracts(data);
        setLoading(false);
    };

    const handleCreateDraft = async () => {
        if (!draftTitle || !draftContent) {
            toast.error("Please provide title and content");
            return;
        }
        await contractService.createContract({
            title: draftTitle,
            content: draftContent,
            type: 'service_agreement',
            status: 'draft',
            owner_id: user.id
            // client_id would be selected in a real app
        });
        toast.success("Contract Draft Created");
        setIsEditing(false);
        setDraftContent('');
        setDraftTitle('');
        loadContracts();
    };

    const handleAIDraft = async () => {
        if (!draftClient) {
            toast.error("Please enter Client Name for AI context");
            return;
        }
        setIsGenerating(true);
        try {
            const { text } = await contractService.generateDraft('Service Agreement', draftClient, 'Standard web development services');
            if (text) setDraftContent(text);
        } catch (e) {
            toast.error("AI Generation Failed");
        }
        setIsGenerating(false);
    };

    const handleSignClick = (contract: Contract) => {
        setSelectedContract(contract);
        setShowSignModal(true);
    };

    const handleSaveSignature = async (signatureDataUrl: string) => {
        if (selectedContract) {
            // Use actual user role for signing
            const role = isAdmin ? 'admin' : 'client';

            await contractService.signContract(selectedContract.id, role, signatureDataUrl);
            setShowSignModal(false);
            setSelectedContract(null);
            toast.success(`Signed as ${role}`);
            loadContracts();
        }
    };

    const handleDownload = (contract: Contract) => {
        contractService.downloadPDF(contract);
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-400">Loading contracts...</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <FileText className="w-6 h-6 text-teal-400" />
                        Contracts & Documents
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        {isAdmin ? 'Manage, draft, and sign legal agreements.' : 'View and sign your contracts.'}
                    </p>
                </div>
            </div>

            {/* Admin Editor - Only visible to admins */}
            {isAdmin && !isEditing && (
                <Button onClick={() => setIsEditing(true)} className="w-full md:w-auto">
                    <Plus className="w-4 h-4 mr-2" /> New Contract
                </Button>
            )}

            {/* Contract Editor - Admin Only */}
            {isAdmin && isEditing && (
                <Card className="p-6 border-teal-500/30">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white">New Contract Draft</h3>
                        <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <Input label="Contract Title" value={draftTitle} onChange={e => setDraftTitle(e.target.value)} placeholder="e.g. Service Agreement - Project X" />
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <Input label="Client Name (for AI)" value={draftClient} onChange={e => setDraftClient(e.target.value)} placeholder="e.g. Acme Corp" />
                            </div>
                            <Button onClick={handleAIDraft} disabled={isGenerating} className="mb-0.5 bg-purple-600 hover:bg-purple-500">
                                <Bot className="w-4 h-4 mr-2" /> {isGenerating ? 'Drafting...' : 'AI Draft'}
                            </Button>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-400 mb-1">Contract Content</label>
                        <textarea
                            className="w-full h-64 bg-slate-950 border border-slate-700 rounded-lg p-4 text-slate-300 font-mono text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                            value={draftContent}
                            onChange={e => setDraftContent(e.target.value)}
                            placeholder="Type manually or use AI to generate..."
                        ></textarea>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                        <Button onClick={handleCreateDraft}>
                            <Save className="w-4 h-4 mr-2" /> Save Draft
                        </Button>
                    </div>
                </Card>
            )}

            {/* Contract List */}
            <div className="grid grid-cols-1 gap-4">
                {contracts.length === 0 && !isEditing ? (
                    <Card className="p-8 text-center text-slate-400">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        No contracts found. Switch to Admin View to create one.
                    </Card>
                ) : (
                    contracts.map((contract) => (
                        <Card key={contract.id} className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 hover:border-teal-500/20 transition-all">
                            <div className="flex items-center gap-4 flex-1">
                                <div className={`p-3 rounded-full ${contract.status === 'fully_signed' ? 'bg-green-500/10 text-green-500' : 'bg-slate-700 text-slate-300'}`}>
                                    {contract.status === 'fully_signed' ? <CheckCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">{contract.title}</h3>
                                    <div className="text-sm text-slate-400">Created: {format(new Date(contract.created_at), 'MMM dd, yyyy')}</div>
                                    <div className="flex gap-2 mt-1">
                                        <Badge className={`text-[10px] ${contract.status === 'fully_signed' ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-400'}`}>
                                            {contract.status.toUpperCase().replace('_', ' ')}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button variant="outline" onClick={() => handleDownload(contract)} size="sm">
                                    <Download className="w-4 h-4 mr-2" /> PDF
                                </Button>

                                {contract.status !== 'fully_signed' && (
                                    <>
                                        {/* Client signing logic */}
                                        {!isAdmin && contract.status === 'draft' && (
                                            <Button onClick={() => handleSignClick(contract)} size="sm" className="bg-teal-600 hover:bg-teal-500">
                                                <PenTool className="w-4 h-4 mr-2" /> Sign Contract
                                            </Button>
                                        )}
                                        {/* Admin signing logic */}
                                        {isAdmin && contract.status === 'client_signed' && (
                                            <Button onClick={() => handleSignClick(contract)} size="sm" className="bg-blue-600 hover:bg-blue-500">
                                                <PenTool className="w-4 h-4 mr-2" /> Sign as Executive
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* Signature Modal */}
            {showSignModal && selectedContract && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <Card className="w-full max-w-2xl relative animate-fade-in-up max-h-[90vh] overflow-y-auto flex flex-col">
                        <button
                            onClick={() => setShowSignModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white z-10"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-white mb-1">Review & Sign</h3>
                            <p className="text-slate-400 text-sm">Please review the contract terms before signing.</p>
                        </div>

                        {/* Contract Content Preview */}
                        <div className="bg-slate-950 p-6 rounded-lg border border-slate-800 mb-6 font-mono text-sm text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto">
                            {typeof selectedContract.content === 'string' ? selectedContract.content : 'Content format error'}
                        </div>

                        <div className="mb-2">
                            <label className="text-sm font-medium text-white">Sign Below ({isAdmin ? 'Executive' : 'Client'})</label>
                        </div>

                        <div className="border border-slate-700 rounded-lg overflow-hidden bg-white">
                            <SignaturePad
                                onSave={handleSaveSignature}
                                onClear={() => { }}
                            />
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-700 text-center text-xs text-slate-500">
                            By clicking "Save Signature", you legally agree to the terms listed in {selectedContract.title}.
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default ContractDashboard;
