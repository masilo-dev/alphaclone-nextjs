import React, { useState, useEffect } from 'react';
import { contractService, Contract } from '../../services/contractService';
import { SignaturePad } from './SignaturePad';
import { Card, Button, Badge, Input } from '../ui/UIComponents';
import { FileText, PenTool, Download, Plus, CheckCircle, Clock, X, Bot, Eye, Save, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { User } from '../../types';
import toast from 'react-hot-toast';

import { useTenant } from '../../contexts/TenantContext';

interface ContractDashboardProps {
    user: User;
}

const ContractDashboard: React.FC<ContractDashboardProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSignModal, setShowSignModal] = useState(false);
    const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

    // Role-based access: client can only view and sign, admin can do everything
    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin';

    // Editor State
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [draftTitle, setDraftTitle] = useState('');
    const [draftClient, setDraftClient] = useState('');
    const [draftContent, setDraftContent] = useState('');
    const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

    const CLAUSE_LIBRARY = [
        { title: 'Standard Liability', content: '\n\nSection 6.0 LIMITATION OF LIABILITY. To the maximum extent permitted by applicable law, in no event shall either party be liable for any indirect, punitive, incidental, special, consequential, or exemplary damages...' },
        { title: 'Intellectual Property', content: '\n\nSection 4.0 INTELLECTUAL PROPERTY. Upon full and final payment of all Fees, Contractor hereby assigns to Client all right, title, and interest in and to any work product created under this Agreement.' },
        { title: 'Termination 30-Day', content: '\n\nSection 7.0 TERMINATION. Either party may terminate this Agreement upon thirty (30) days written notice to the other party if the other party breaches any material term of this Agreement.' },
        { title: 'Confidentiality', content: '\n\nSection 5.0 CONFIDENTIALITY. Each party agrees that it will not disclose to any third party or use any Confidential Information disclosed to it by the other party except as required to perform its obligations.' }
    ];

    const insertClause = (content: string) => {
        setDraftContent(prev => prev + content);
        toast.success("Clause Inserted");
    };

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
        contractService.downloadPDF(contract, currentTenant);
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

            {/* Contract Editor - Admin Only (Desktop-Optimized Split Screen) */}
            {isAdmin && isEditing && (
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-fade-in-up">
                    {/* Clause Library Sidebar */}
                    <Card className="xl:col-span-1 p-4 border-white/5 bg-slate-900/40 backdrop-blur-md hidden xl:block sticky top-6 self-start">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <Zap className="w-3 h-3 text-teal-400" />
                            Clause Library
                        </h4>
                        <div className="space-y-3">
                            {CLAUSE_LIBRARY.map((clause, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => insertClause(clause.content)}
                                    className="w-full text-left p-3 rounded-xl border border-white/5 hover:border-teal-500/30 hover:bg-teal-500/5 transition-all group"
                                >
                                    <div className="text-[10px] font-black uppercase text-slate-400 group-hover:text-teal-400 transition-colors mb-1">{clause.title}</div>
                                    <div className="text-[10px] text-slate-500 line-clamp-2 italic">"{clause.content.trim()}"</div>
                                </button>
                            ))}
                        </div>
                    </Card>

                    {/* Main Editor Console */}
                    <Card className="xl:col-span-3 p-6 border-teal-500/30 bg-slate-900/60 shadow-2xl shadow-teal-500/5">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                                <h3 className="text-lg font-bold text-white">Advanced Drafting Engine</h3>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-white/10">
                                <button
                                    onClick={() => setViewMode('edit')}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'edit' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-slate-500 hover:text-white'}`}
                                >
                                    Code View
                                </button>
                                <button
                                    onClick={() => setViewMode('preview')}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'preview' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-slate-500 hover:text-white'}`}
                                >
                                    Live Preview
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <Input label="Document Identifier" value={draftTitle} onChange={e => setDraftTitle(e.target.value)} placeholder="e.g. Master Service Agreement v1.0" />
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <Input label="Counterparty Name" value={draftClient} onChange={e => setDraftClient(e.target.value)} placeholder="e.g. Acme Corporation" />
                                </div>
                                <Button onClick={handleAIDraft} disabled={isGenerating} className="mb-0.5 bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 border-none">
                                    <Bot className="w-4 h-4 mr-2" /> AI Init
                                </Button>
                            </div>
                        </div>

                        <div className="relative mb-6">
                            {viewMode === 'edit' ? (
                                <textarea
                                    className="w-full h-96 bg-slate-950 border border-white/5 rounded-2xl p-6 text-slate-300 font-mono text-sm focus:ring-2 focus:ring-teal-500/30 outline-none shadow-inner"
                                    value={draftContent}
                                    onChange={e => setDraftContent(e.target.value)}
                                    placeholder="Initialize content via AI or type manually..."
                                ></textarea>
                            ) : (
                                <div className="w-full h-96 bg-white rounded-2xl p-8 text-slate-900 overflow-y-auto shadow-inner font-serif leading-relaxed">
                                    <h1 className="text-2xl font-bold mb-6 border-b-2 border-slate-200 pb-4 text-center uppercase tracking-tight">{draftTitle || 'Untitled Agreement'}</h1>
                                    <div className="whitespace-pre-wrap text-sm">{draftContent || 'Document content will appear here...'}</div>
                                    <div className="mt-20 grid grid-cols-2 gap-8">
                                        <div className="border-t border-slate-300 pt-2 text-[10px] text-slate-400">SIGNATURE (CLIENT)</div>
                                        <div className="border-t border-slate-300 pt-2 text-[10px] text-slate-400">SIGNATURE (EXECUTIVE)</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                            <Button variant="outline" onClick={() => setIsEditing(false)} className="rounded-xl">Terminate Draft</Button>
                            <Button onClick={handleCreateDraft} className="bg-gradient-to-r from-teal-600 to-teal-400 rounded-xl shadow-lg shadow-teal-500/20">
                                <Save className="w-4 h-4 mr-2" /> Commit to Ledger
                            </Button>
                        </div>
                    </Card>
                </div>
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
