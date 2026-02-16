import React, { useState, useEffect, useCallback } from 'react';
import { contractService, Contract } from '../../services/contractService';
import { SignaturePad } from './SignaturePad';
import { DocumentViewer } from './DocumentViewer';
import { fileUploadService } from '../../services/fileUploadService';
import { businessClientService, BusinessClient } from '../../services/businessClientService';
import { Card, Button, Badge, Input } from '../ui/UIComponents';
import {
    FileText,
    PenTool,
    Download,
    Plus,
    CheckCircle,
    Clock,
    X,
    Bot,
    Eye,
    Save,
    Zap,
    Loader2,
    Upload,
    FileCheck,
    FileText as FileTextIcon,
    FileImage,
    Archive,
    Copy,
    ExternalLink,
    MessageSquare,
    Edit3,
    Search,
    Trash,
    Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { User } from '../../types';
import toast from 'react-hot-toast';
import { useTenant } from '../../contexts/TenantContext';

interface ContractDashboardProps {
    user: User;
    initialTab?: 'details' | 'document' | 'hub';
}

const ContractDashboard: React.FC<ContractDashboardProps> = ({ user, initialTab = 'hub' }) => {
    const { currentTenant } = useTenant();
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSignModal, setShowSignModal] = useState(false);
    const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'document' | 'hub'>(initialTab);
    const [storageUsage, setStorageUsage] = useState<number>(0);
    const [allFiles, setAllFiles] = useState<any[]>([]);
    const [isFilesLoading, setIsFilesLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [entityFilter, setEntityFilter] = useState<string>('all');
    const MAX_STORAGE = 100 * 1024 * 1024; // 100MB

    // Role-based access: client can only view and sign, admin can do everything
    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin';

    // Editor State
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [draftTitle, setDraftTitle] = useState('');
    const [draftClient, setDraftClient] = useState('');
    const [draftContent, setDraftContent] = useState('');
    const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
    const [clients, setClients] = useState<BusinessClient[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');

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

    const loadStorageUsage = useCallback(async () => {
        const usage = await fileUploadService.getUserStorageUsage(user.id);
        setStorageUsage(usage);
    }, [user.id]);

    const loadAllFiles = useCallback(async () => {
        setIsFilesLoading(true);
        try {
            if (!currentTenant?.id) return;
            const { files, error } = await fileUploadService.getFilesByTenant(currentTenant.id);
            if (!error) {
                setAllFiles(files || []);
            }
        } catch (err) {
            console.error('Error loading all files:', err);
        } finally {
            setIsFilesLoading(false);
        }
    }, []);

    const loadContracts = useCallback(async () => {
        setLoading(true);
        const { contracts: data } = await contractService.getUserContracts(user.id, user.role);
        if (data) setContracts(data);

        if (currentTenant?.id) {
            const { clients: clientData } = await businessClientService.getClients(currentTenant.id);
            setClients(clientData || []);
        }

        await loadStorageUsage();
        await loadAllFiles();
        setLoading(false);
    }, [user.id, user.role, currentTenant?.id, loadStorageUsage, loadAllFiles]);

    const handleCreateDraft = useCallback(async () => {
        if (!draftTitle || !draftContent) {
            toast.error("Please provide title and content");
            return;
        }
        await contractService.createContract({
            title: draftTitle,
            content: draftContent,
            type: 'service_agreement',
            status: 'draft',
            owner_id: user.id,
            client_id: selectedClientId
        });
        toast.success("Contract Draft Created");
        setIsEditing(false);
        setDraftContent('');
        setDraftTitle('');
        setSelectedClientId('');
        loadContracts();
    }, [draftTitle, draftContent, user.id, selectedClientId, loadContracts]);

    const handleAIDraft = useCallback(async () => {
        const clientName = draftClient || clients.find(c => c.id === selectedClientId)?.name;
        if (!clientName) {
            toast.error("Please select a Client or enter name for AI context");
            return;
        }
        setIsGenerating(true);
        try {
            const { text } = await contractService.generateDraft('Service Agreement', clientName, 'Standard web development services');
            if (text) setDraftContent(text);
        } catch (e) {
            toast.error("AI Generation Failed");
        }
        setIsGenerating(false);
    }, [draftClient, selectedClientId, clients]);

    const handleExport = () => {
        const data = {
            title: draftTitle,
            content: draftContent,
            clientId: selectedClientId,
            exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contract_draft_${draftTitle.replace(/\s+/g, '_') || 'untitled'}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Draft exported as JSON");
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                setDraftTitle(data.title || '');
                setDraftContent(data.content || '');
                setSelectedClientId(data.clientId || '');
                toast.success("Draft imported successfully");
            } catch (err) {
                toast.error("Invalid JSON format");
            }
        };
        reader.readAsText(file);
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedContract) return;

        setIsUploading(true);
        try {
            const result = await fileUploadService.uploadFile(file, 'contract', selectedContract.id);
            if (result.success && result.url) {
                const { error } = await contractService.updateContract(selectedContract.id, {
                    document_url: result.url
                });
                if (error) throw error;

                setSelectedContract({ ...selectedContract, document_url: result.url });
                loadContracts();
                toast.success('Document uploaded successfully');
            } else {
                throw new Error(result.error);
            }
        } catch (err: any) {
            toast.error(err.message || 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveAnnotations = async (annotations: any[]) => {
        if (!selectedContract) return;

        const updatedMetadata = {
            ...(selectedContract.metadata || {}),
            annotations
        };

        const { error } = await contractService.updateContract(selectedContract.id, {
            metadata: updatedMetadata
        });

        if (error) {
            toast.error('Failed to save annotations');
        } else {
            setSelectedContract({ ...selectedContract, metadata: updatedMetadata });
            toast.success('Annotations saved successfully');
        }
    };

    const handleSignClick = useCallback((contract: Contract) => {
        setSelectedContract(contract);
        setShowSignModal(true);
    }, []);

    const handleSaveSignature = useCallback(async (signatureDataUrl: string) => {
        if (selectedContract) {
            const role = isAdmin ? 'admin' : 'client';
            await contractService.signContract(selectedContract.id, role, signatureDataUrl);
            setShowSignModal(false);
            setSelectedContract(null);
            toast.success(`Signed as ${role}`);
            loadContracts();
        }
    }, [selectedContract, isAdmin, loadContracts]);

    const handleDownload = useCallback((contract: Contract) => {
        if (contract.document_url) {
            window.open(contract.document_url, '_blank');
        } else {
            contractService.downloadPDF(contract, currentTenant);
        }
    }, [currentTenant]);

    const handleDeleteDocument = useCallback(async (contractId: string) => {
        if (!window.confirm('Are you sure you want to delete this document? This will free up storage space but the action cannot be undone.')) {
            return;
        }

        try {
            const { error } = await contractService.deleteContract(contractId);
            if (error) throw error;

            toast.success('Document deleted');
            loadContracts();
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete document');
        }
    }, [loadContracts]);

    useEffect(() => {
        loadContracts();
    }, [loadContracts]);

    if (loading) {
        return <div className="p-8 text-center text-slate-400">Loading contracts...</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 bg-slate-900/40 border border-white/5 p-6 rounded-2xl backdrop-blur-md">
                <div className="flex-1">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <FileTextIcon className="w-6 h-6 text-teal-400" />
                        Contracts & Documents
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        {isAdmin ? 'Manage, draft, and sign legal agreements.' : 'View and sign your contracts.'}
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center md:items-end lg:items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center gap-3 bg-slate-950/40 border border-white/5 px-4 py-2.5 rounded-xl flex-1 md:flex-none justify-between sm:justify-start">
                        <div className="text-left md:text-right min-w-[100px]">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Storage Used</div>
                            <div className={`text-xs font-bold mt-1 ${storageUsage > MAX_STORAGE * 0.9 ? 'text-red-400' : 'text-teal-400'}`}>
                                {(storageUsage / 1024 / 1024).toFixed(1)}MB / 100MB
                            </div>
                        </div>
                        <div className="w-24 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-white/5 shrink-0">
                            <div
                                className={`h-full transition-all duration-1000 ${storageUsage > MAX_STORAGE * 0.9 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.3)]'}`}
                                style={{ width: `${Math.min((storageUsage / MAX_STORAGE) * 100, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                    {isAdmin && (
                        <Button
                            onClick={() => {
                                setIsEditing(true);
                                setActiveTab('details');
                            }}
                            className="w-full sm:w-auto md:w-full lg:w-auto font-bold h-12"
                        >
                            <Plus className="w-4 h-4 mr-2" /> New Contract
                        </Button>
                    )}
                </div>
            </div>

            {/* Standalone Document Hub */}
            {activeTab === 'hub' && !isEditing && (
                <Card className="p-6 border-teal-500/30 bg-slate-900/60 shadow-2xl shadow-teal-500/5 min-h-[600px] animate-fade-in-up">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <Archive className="w-5 h-5 text-teal-400" />
                            Global Document Hub
                        </h3>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadAllFiles}
                            className="text-xs font-black uppercase tracking-widest border-white/10"
                        >
                            Refresh Hub
                        </Button>
                    </div>
                    {/* Render the hub content - Refactored into fragment below */}
                    <HubContent
                        allFiles={allFiles}
                        isFilesLoading={isFilesLoading}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        entityFilter={entityFilter}
                        setEntityFilter={setEntityFilter}
                        loadAllFiles={loadAllFiles}
                        loadStorageUsage={loadStorageUsage}
                    />
                </Card>
            )}

            {/* Contract Editor - Admin Only */}
            {isAdmin && isEditing && (
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-fade-in-up">
                    {/* Sidebar */}
                    <Card className="xl:col-span-1 p-4 border-white/5 bg-slate-900/40 backdrop-blur-md hidden xl:block sticky top-6 self-start">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2 text-teal-400 font-bold text-sm mb-2">
                                <MessageSquare className="w-4 h-4" />
                                Editor Mode
                            </div>
                            <button
                                onClick={() => setActiveTab('details')}
                                className={`w-full text-left p-3 rounded-xl transition-all ${activeTab === 'details' ? 'bg-teal-500/10 border border-teal-500/30 text-teal-400' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <PenTool className="w-4 h-4" />
                                    Draft Editor
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('document')}
                                className={`w-full text-left p-3 rounded-xl transition-all ${activeTab === 'document' ? 'bg-teal-500/10 border border-teal-500/30 text-teal-400' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Download className="w-4 h-4" />
                                    PDF & Annotations
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('hub')}
                                className={`w-full text-left p-3 rounded-xl transition-all ${activeTab === 'hub' ? 'bg-teal-500/10 border border-teal-500/30 text-teal-400' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Archive className="w-4 h-4" />
                                        <span>Document Hub</span>
                                    </div>
                                    <Badge className="bg-teal-500/10 text-teal-400 text-[10px]">{allFiles.length}</Badge>
                                </div>
                            </button>

                            {activeTab === 'details' && (
                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Clause Library</h4>
                                        <Archive className="w-3 h-3 text-slate-700" />
                                    </div>
                                    <div className="space-y-2">
                                        {CLAUSE_LIBRARY.map((clause, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => insertClause(clause.content)}
                                                className="w-full text-left p-2 rounded-lg border border-white/5 hover:border-teal-500/30 hover:bg-teal-500/5 transition-all group"
                                            >
                                                <div className="text-[9px] font-bold uppercase text-slate-400 group-hover:text-teal-400 transition-colors">{clause.title}</div>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-white/5 space-y-3">
                                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Portability</h4>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full text-[10px] font-black uppercase tracking-widest h-9"
                                            onClick={handleExport}
                                        >
                                            <Download className="w-3 h-3 mr-2" /> Export JSON
                                        </Button>
                                        <label className="w-full">
                                            <div className="flex items-center justify-center w-full h-9 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:border-teal-400 cursor-pointer transition-all">
                                                <Upload className="w-3 h-3 mr-2" /> Import JSON
                                            </div>
                                            <input type="file" className="hidden" accept=".json" onChange={handleImport} />
                                        </label>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'document' && (
                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <label className="w-full flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 rounded-xl hover:border-teal-500/50 cursor-pointer transition-colors group">
                                        <Upload className="w-6 h-6 text-slate-500 group-hover:text-teal-400 transition-colors" />
                                        <span className="text-[10px] text-slate-500 group-hover:text-teal-400 mt-2 font-black uppercase tracking-widest">Upload PDF</span>
                                        <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                                    </label>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Main Content Area */}
                    <Card className="xl:col-span-3 p-6 border-teal-500/30 bg-slate-900/60 shadow-2xl shadow-teal-500/5 min-h-[600px]">
                        {activeTab === 'details' ? (
                            <>
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
                                            Source Code
                                        </button>
                                        <button
                                            onClick={() => setViewMode('preview')}
                                            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'preview' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-slate-500 hover:text-white'}`}
                                        >
                                            Live Preview
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <Input
                                        label="Document Identifier"
                                        value={draftTitle}
                                        onChange={e => setDraftTitle(e.target.value)}
                                        placeholder="e.g. Master Service Agreement v1.0"
                                    />
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Link to Client</label>
                                        <select
                                            className="w-full bg-slate-950 border border-white/10 rounded-xl h-12 px-4 text-sm text-slate-300 focus:ring-2 focus:ring-teal-500/30 outline-none"
                                            value={selectedClientId}
                                            onChange={e => setSelectedClientId(e.target.value)}
                                        >
                                            <option value="">-- No Client Linked --</option>
                                            {clients.map(c => (
                                                <option key={c.id} value={c.id}>{c.name} ({c.company || 'Private'})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            <Input label="Manual Counterparty Context" value={draftClient} onChange={e => setDraftClient(e.target.value)} placeholder="e.g. Acme Corporation" />
                                        </div>
                                        <Button onClick={handleAIDraft} disabled={isGenerating} className="mb-0.5 bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 border-none">
                                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />} AI Init
                                        </Button>
                                    </div>
                                    <div className="flex items-end gap-1.5 p-1 bg-slate-950/50 rounded-xl border border-white/5">
                                        <Button variant="ghost" size="sm" onClick={() => setDraftContent(prev => prev + '<strong></strong>')} className="flex-1 text-[10px] font-black h-8">BOLD</Button>
                                        <Button variant="ghost" size="sm" onClick={() => setDraftContent(prev => prev + '<em></em>')} className="flex-1 text-[10px] font-black h-8">ITALIC</Button>
                                        <Button variant="ghost" size="sm" onClick={() => setDraftContent(prev => prev + '<h2 class="text-xl font-bold mt-4 mb-2"></h2>')} className="flex-1 text-[10px] font-black h-8">H2</Button>
                                        <Button variant="ghost" size="sm" onClick={() => setDraftContent(prev => prev + '<br/>')} className="flex-1 text-[10px] font-black h-8">BR</Button>
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
                                            <div className="whitespace-pre-wrap text-sm" dangerouslySetInnerHTML={{ __html: draftContent || 'Document content will appear here...' }}></div>
                                            <div className="mt-20 grid grid-cols-2 gap-8">
                                                <div className="border-t border-slate-300 pt-2 text-[10px] text-slate-400">SIGNATURE (CLIENT)</div>
                                                <div className="border-t border-slate-300 pt-2 text-[10px] text-slate-400">SIGNATURE (EXECUTIVE)</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : activeTab === 'document' ? (
                            <div className="h-full flex flex-col">
                                {selectedContract?.document_url ? (
                                    <DocumentViewer
                                        url={selectedContract.document_url}
                                        userName={user.name}
                                        initialAnnotations={(selectedContract.metadata as any)?.annotations || []}
                                        onSaveAnnotations={handleSaveAnnotations}
                                    />
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-950/40">
                                        <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-4 border border-white/5">
                                            <FileTextIcon className="w-8 h-8 text-slate-700" />
                                        </div>
                                        <h3 className="text-white font-bold mb-2">No Document Uploaded</h3>
                                        <p className="text-slate-500 text-sm mb-6 text-center max-w-xs">Upload a professional PDF version of this contract to enable in-platform viewing and annotations.</p>
                                        <label className="cursor-pointer">
                                            <Button variant="primary" className="bg-teal-600 hover:bg-teal-500 pointer-events-none">
                                                {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                                                Upload Contract PDF
                                            </Button>
                                            <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                                        </label>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <HubContent
                                allFiles={allFiles}
                                isFilesLoading={isFilesLoading}
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                entityFilter={entityFilter}
                                setEntityFilter={setEntityFilter}
                                loadAllFiles={loadAllFiles}
                                loadStorageUsage={loadStorageUsage}
                            />
                        )}

                        <div className="flex justify-between items-center pt-6 border-t border-white/5 mt-6">
                            <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel Changes</Button>
                            <Button onClick={handleCreateDraft} className="bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-500/20">
                                <Save className="w-4 h-4 mr-2" /> Save Draft
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Contract List */}
            <div className="grid grid-cols-1 gap-4">
                {contracts.length === 0 && !isEditing ? (
                    <Card className="p-8 text-center text-slate-400">
                        <FileTextIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        No contracts found.
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
                                        {contract.document_url && (
                                            <Badge variant="blue" className="text-[10px] border-blue-500/20 text-blue-400">
                                                <FileCheck className="w-3 h-3 mr-1" /> PDF UPLOADED
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                                <Button variant="outline" onClick={() => handleDownload(contract)} size="sm" className="flex-1 md:flex-none">
                                    <Download className="w-4 h-4 mr-2" /> Download
                                </Button>

                                {contract.document_url && (
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setSelectedContract(contract);
                                            setIsEditing(true);
                                            setActiveTab('document');
                                        }}
                                        size="sm"
                                        className="flex-1 md:flex-none border-teal-500/30 text-teal-400 hover:bg-teal-500/10"
                                    >
                                        <Eye className="w-4 h-4 mr-2" /> Annotate
                                    </Button>
                                )}

                                {contract.status !== 'fully_signed' && (
                                    <>
                                        {!isAdmin && contract.status === 'draft' && (
                                            <Button onClick={() => handleSignClick(contract)} size="sm" className="flex-1 md:flex-none bg-teal-600 hover:bg-teal-500">
                                                <PenTool className="w-4 h-4 mr-2" /> Sign
                                            </Button>
                                        )}
                                        {isAdmin && contract.status === 'client_signed' && (
                                            <Button onClick={() => handleSignClick(contract)} size="sm" className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500">
                                                <PenTool className="w-4 h-4 mr-2" /> Executive Sign
                                            </Button>
                                        )}
                                    </>
                                )}

                                {isAdmin && (
                                    <Button
                                        variant="outline"
                                        onClick={() => handleDeleteDocument(contract.id)}
                                        size="sm"
                                        className="shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
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
                        <div className="bg-slate-950 p-6 rounded-lg border border-slate-800 mb-6 font-mono text-sm text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto shadow-inner">
                            {typeof selectedContract.content === 'string' ? selectedContract.content : 'Content format error'}
                        </div>

                        <div className="mb-2">
                            <label className="text-sm font-medium text-white">Sign Below ({isAdmin ? 'Executive' : 'Client'})</label>
                        </div>

                        <div className="border border-slate-700 rounded-lg overflow-hidden bg-white shadow-inner">
                            <SignaturePad
                                onSave={handleSaveSignature}
                                onClear={() => { }}
                            />
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-700 text-center text-[10px] text-slate-500 uppercase tracking-widest font-black">
                            By clicking "Save Signature", you legally agree to the terms listed in {selectedContract.title}.
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

const HubContent: React.FC<{
    allFiles: any[];
    isFilesLoading: boolean;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    entityFilter: string;
    setEntityFilter: (f: string) => void;
    loadAllFiles: () => void;
    loadStorageUsage: () => void;
}> = ({
    allFiles,
    isFilesLoading,
    searchQuery,
    setSearchQuery,
    entityFilter,
    setEntityFilter,
    loadAllFiles,
    loadStorageUsage
}) => (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                <div className="flex-1 w-full lg:w-auto">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search platform documents..."
                            className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-teal-500/30 outline-none transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 w-full lg:w-auto">
                    {['all', 'deal', 'quote', 'contract', 'project', 'lead'].map(filter => (
                        <button
                            key={filter}
                            onClick={() => setEntityFilter(filter)}
                            className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${entityFilter === filter ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'bg-slate-950 text-slate-500 hover:text-white border border-white/5'}`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            {isFilesLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="relative">
                        <div className="w-12 h-12 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin"></div>
                        <Zap className="absolute inset-0 m-auto w-5 h-5 text-teal-400 animate-pulse" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Indexing artifacts...</p>
                </div>
            ) : allFiles.filter(f =>
                (entityFilter === 'all' || f.entity_type === entityFilter) &&
                (f.file_name.toLowerCase().includes(searchQuery.toLowerCase()))
            ).length === 0 ? (
                <div className="text-center py-24 bg-slate-950/40 rounded-3xl border border-white/5 backdrop-blur-sm">
                    <div className="w-20 h-20 bg-slate-900/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
                        <FileTextIcon className="w-10 h-10 text-slate-700 opacity-50" />
                    </div>
                    <h4 className="text-white font-bold mb-2">No results found</h4>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto">Adjust your search or filter settings to find what you're looking for.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {allFiles
                        .filter(f =>
                            (entityFilter === 'all' || f.entity_type === entityFilter) &&
                            (f.file_name.toLowerCase().includes(searchQuery.toLowerCase()))
                        )
                        .map(file => (
                            <div key={file.id} className="flex items-center justify-between p-4 bg-slate-950/40 border border-white/5 rounded-2xl hover:border-teal-500/30 hover:bg-slate-900/40 transition-all group">
                                <div className="flex items-center gap-4 overflow-hidden">
                                    <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-500">
                                        <div className="relative">
                                            {file.file_name.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                                                <FileImage className="w-6 h-6 text-teal-400" />
                                            ) : file.file_name.match(/\.(zip|rar|7z)$/i) ? (
                                                <Archive className="w-6 h-6 text-teal-400" />
                                            ) : (
                                                <FileText className="w-6 h-6 text-teal-400" />
                                            )}
                                            {file.file_name.endsWith('.pdf') && (
                                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-950"></div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <p className="text-white font-bold truncate group-hover:text-teal-400 transition-colors uppercase tracking-tight">{file.file_name}</p>
                                            <Badge className="text-[8px] bg-indigo-500/10 text-indigo-400 border-indigo-500/20 font-black">
                                                {file.entity_type}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-slate-600" />
                                                {format(new Date(file.created_at), 'MMM dd, HH:mm')}
                                            </div>
                                            <span className="w-1 h-1 bg-slate-800 rounded-full"></span>
                                            <div className="flex items-center gap-1">
                                                <Save className="w-3 h-3 text-slate-600" />
                                                {(file.file_size / 1024).toFixed(1)} KB
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            navigator.clipboard.writeText(file.file_url);
                                            toast.success('Public URL copied');
                                        }}
                                        className="w-10 h-10 p-0 text-slate-400 hover:text-teal-400 hover:bg-teal-500/10 rounded-xl transition-all"
                                        title="Copy URL"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => window.open(file.file_url, '_blank')}
                                        className="w-10 h-10 p-0 text-slate-400 hover:text-teal-400 hover:bg-teal-500/10 rounded-xl transition-all"
                                        title="Open in Tab"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => window.open(file.file_url, '_blank')}
                                        className="w-10 h-10 p-0 text-slate-400 hover:text-teal-400 hover:bg-teal-500/10 rounded-xl transition-all"
                                        title="Preview"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={async () => {
                                            const { success } = await fileUploadService.deleteFile(file.id);
                                            if (success) {
                                                toast.success('Artifact purged successfully');
                                                loadAllFiles();
                                                loadStorageUsage();
                                            }
                                        }}
                                        className="w-10 h-10 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                                        title="Purge"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                </div>
            )}
        </div>
    );

export default ContractDashboard;
