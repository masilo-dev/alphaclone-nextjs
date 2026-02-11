import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Phone, CheckCircle2, Bot, Send, Trash2, Upload, FileSpreadsheet, X, Mail, Settings, ExternalLink, FileText, Zap } from 'lucide-react';
import { generateLeads, chatWithAI, isAnyAIConfigured } from '../../services/unifiedAIService';
import { leadService, Lead } from '../../services/leadService';
import { fileImportService } from '../../services/fileImportService';
import LeadDetailModal from './leads/LeadDetailModal';
import { Button, Input, Card, Modal } from '../ui/UIComponents';
import { TableSkeleton } from '../ui/Skeleton';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const SalesAgent: React.FC = () => {
    const aiConfigured = isAnyAIConfigured();
    const [activeTab, setActiveTab] = useState<'leads' | 'agent'>('leads');
    const [searchParams, setSearchParams] = useState({ industry: '', location: '' });
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
    const [filters, setFilters] = useState({ businessSize: '', employeeCount: '' });

    const [showUpload, setShowUpload] = useState(false);

    const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<Lead | null>(null);
    const [viewingMessage, setViewingMessage] = useState<{ title: string; body: string } | null>(null);

    // Manual Entry State
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualLead, setManualLead] = useState({
        businessName: '',
        email: '',
        phone: '',
        industry: '',
        location: '',
        value: ''
    });

    const handleManualAddLead = async () => {
        if (!manualLead.businessName) {
            toast.error('Business Name is required');
            return;
        }

        const newLead = {
            businessName: manualLead.businessName,
            email: manualLead.email,
            phone: manualLead.phone,
            industry: manualLead.industry,
            location: manualLead.location,
            value: manualLead.value ? parseFloat(manualLead.value) : 0,
            source: 'Manual Entry'
        };

        const { lead, error } = await leadService.addLead(newLead);
        if (error) {
            toast.error(`Failed to add: ${error}`);
        } else {
            toast.success('Lead added successfully');
            setShowManualModal(false);
            setManualLead({ businessName: '', email: '', phone: '', industry: '', location: '', value: '' });
            loadLeads();
        }
    };



    // Initial Load
    useEffect(() => {
        loadLeads();
    }, []);

    const loadLeads = async () => {
        setIsLoading(true);
        const { leads: data, error } = await leadService.getLeads();
        if (error) {
            console.error(error);
            toast.error("Failed to load leads from database");
        } else {
            setLeads(data);
        }
        setIsLoading(false);
    };

    // Chat State
    const [messages, setMessages] = useState([
        { id: 1, sender: 'agent', text: 'Hello! I am your AI Sales Agent. I can help you find leads, draft outreach messages, or manage your CRM. What would you like to do today?' }
    ]);
    const [inputText, setInputText] = useState('');

    const handleSearch = async () => {
        // Validate inputs
        if (!searchParams.industry.trim()) {
            toast.error('Please enter a target industry');
            return;
        }
        if (!searchParams.location.trim()) {
            toast.error('Please enter a location');
            return;
        }

        // CHECK LEAD LIMIT BEFORE GENERATING
        const limitCheck = await leadService.checkLeadLimit();
        if (!limitCheck.allowed) {
            toast.error(limitCheck.error || 'Daily lead limit reached.');
            return;
        }

        setIsSearching(true);

        // Show progress indicator
        const progressToast = toast.loading('🤖 AI is searching for leads... This may take 30-60 seconds.');

        try {
            console.log('🚀 Starting AI lead generation...');
            // Pass API key if available
            const results = await generateLeads(searchParams.industry, searchParams.location, '', 'tenant');

            if (results && results.length > 0) {
                console.log(`✅ Generated ${results.length} leads, saving to database...`);

                // Update progress
                toast.loading('💾 Saving leads to database...', { id: progressToast });

                // Bulk add to DB
                const leadsToAdd = results.map((r: any) => ({
                    businessName: r.businessName,
                    industry: r.industry,
                    location: r.location,
                    phone: r.phone,
                    email: r.email,
                    value: r.value,
                    source: r.leadSource || 'AI Agent'
                }));

                const { count, error } = await leadService.addBulkLeads(leadsToAdd);
                if (error) {
                    console.error('❌ Database error:', error);
                    toast.error(`AI found leads but failed to save them: ${error}`, { id: progressToast });
                } else {
                    toast.success(`🎉 AI discovered and saved ${count} new leads!`, { id: progressToast, duration: 4000 });
                    loadLeads(); // Reload from DB
                }
            } else {
                toast.error("No leads found. Try different search criteria.", { id: progressToast });
            }
        } catch (error: any) {
            console.error('❌ Lead generation error:', error);
            const errorMessage = error?.message || 'AI Generation failed. Please try again.';
            toast.error(errorMessage, { id: progressToast, duration: 5000 });

            // Show helpful message if it's an API key issue
            if (errorMessage.includes('API key') || errorMessage.includes('not configured')) {
                toast.error('Please check your Gemini API key in Vercel settings.', { duration: 7000 });
            }
        }
        setIsSearching(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const { contacts, error } = await fileImportService.importFromExcel(file);

            if (error) {
                toast.error(`Import failed: ${error}`);
                return;
            }

            if (contacts.length === 0) {
                toast.error("No valid contacts found in file.");
                return;
            }

            // Map ParsedContact to Lead
            const leadsToAdd = contacts.map(c => ({
                businessName: c.name || c.company || 'Unknown Business',
                email: c.email,
                phone: c.phone,
                industry: 'Imported',
                location: 'Unknown',
                notes: c.notes,
                source: 'CSV Import'
                // value: c.value // Pending DB support for value
            }));

            const { count, error: dbError } = await leadService.addBulkLeads(leadsToAdd);

            if (dbError) {
                toast.error(`Database error: ${dbError}`);
            } else {
                toast.success(`Successfully imported ${count} leads.`);
                loadLeads();
                setShowUpload(false);
            }
        } catch (err: any) {
            console.error("Import Error", err);
            toast.error("Failed to process file.");
        }
    };

    const toggleSelectLead = (id: string) => {
        if (selectedLeads.includes(id)) {
            setSelectedLeads(selectedLeads.filter(lid => lid !== id));
        } else {
            setSelectedLeads([...selectedLeads, id]);
        }
    };

    const toggleSelectAll = () => {
        if (selectedLeads.length === leads.length) {
            setSelectedLeads([]);
        } else {
            setSelectedLeads(leads.map(l => l.id));
        }
    };

    const deleteSelected = async () => {
        // Delete individually or bulk if service supports
        for (const id of selectedLeads) {
            await leadService.deleteLead(id);
        }
        toast.success("Deleted selected leads");
        setLeads(prev => prev.filter(l => !selectedLeads.includes(l.id)));
        setSelectedLeads([]);
    };

    const addToCRM = async (id: string, currentStage: string) => {
        try {
            // Get the lead details first
            const lead = leads.find(l => l.id === id);
            if (!lead) {
                toast.error('Lead not found');
                return;
            }

            // Step 1: Mark lead as qualified
            const { error: updateError } = await leadService.updateLead(id, {
                stage: 'qualified',
                status: 'Qualified'
            });

            if (updateError) {
                toast.error(`Failed to qualify lead: ${updateError}`);
                return;
            }

            // Step 2: Create client record in CRM
            const { businessClientService } = await import('../../services/businessClientService');
            const { tenantService } = await import('../../services/tenancy/TenantService');
            const tenantId = tenantService.getCurrentTenantId();

            if (!tenantId) {
                toast.error('No active organization session');
                return;
            }

            const { client, error: clientError } = await businessClientService.createClient(tenantId, {
                name: lead.businessName,
                email: lead.email || '',
                company: lead.businessName,
                phone: lead.phone,
                stage: 'customer' // Qualified leads become customers in CRM
            });

            if (clientError) {
                toast.error(`Lead qualified but failed to create client: ${clientError}`);
                // Still update local state to show qualified
                setLeads(prev => prev.map(l => l.id === id ? { ...l, stage: 'qualified', status: 'Qualified' } : l));
                return;
            }

            // Step 3: Link the lead to the client
            if (client) {
                await leadService.updateLead(id, {
                    client_id: client.id
                });
            }

            // Success!
            toast.success(`✅ ${lead.businessName} added to CRM as client!`, { duration: 4000 });

            // Update local state
            setLeads(prev => prev.map(l => l.id === id ? { ...l, stage: 'qualified', status: 'Qualified' } : l));

        } catch (err) {
            console.error('Add to CRM error:', err);
            toast.error("An unexpected error occurred");
        }
    };

    const handleSendMessage = async () => {
        if (!inputText.trim()) return;

        const userMessage = inputText.trim();
        const newMsg = { id: messages.length + 1, sender: 'user', text: userMessage };
        setMessages([...messages, newMsg]);
        setInputText('');

        try {
            // Prepare conversation history for AI
            const history = messages.map(m => ({
                role: m.sender === 'user' ? 'user' : 'model',
                text: m.text
            }));

            // Get AI response
            const { text } = await chatWithAI(history, userMessage);

            setMessages(prev => [...prev, {
                id: prev.length + 1,
                sender: 'agent',
                text: text || 'I apologize, but I encountered an issue processing your request. Please try again.'
            }]);
        } catch (error) {
            console.error('❌ AI Chat Error:', error);
            setMessages(prev => [...prev, {
                id: prev.length + 1,
                sender: 'agent',
                text: 'I apologize, but I encountered a technical issue. Please try again or contact support if the problem persists.'
            }]);
        }
    };

    return (
        <div className="space-y-4 sm:space-y-6 animate-fade-in h-full flex flex-col">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
                <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500 flex items-center gap-2 sm:gap-3">
                        <Bot className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-teal-400 flex-shrink-0" />
                        <span className="truncate">AlphaClone Growth Agent</span>
                    </h2>
                    <p className="text-slate-400 mt-1 text-xs sm:text-sm flex items-center gap-2">
                        <span>Lead Generation Powered by Advanced AI</span>
                        <Zap className="w-3 h-3 text-teal-400 animate-pulse" />
                    </p>
                </div>
                <div className="flex bg-slate-800 p-1 rounded-lg self-start sm:self-auto">
                    <button
                        onClick={() => setActiveTab('leads')}
                        className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'leads' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Lead Finder
                    </button>
                    <button
                        onClick={() => setActiveTab('agent')}
                        className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'agent' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Agent Chat
                    </button>
                </div>
            </div>

            {activeTab === 'leads' ? (
                <div className="space-y-6">
                    {/* Search Bar */}
                    <Card className="bg-slate-900 border-slate-800">
                        <div className="flex flex-col gap-3 sm:gap-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="w-full">
                                    <Input
                                        label="Target Industry"
                                        placeholder="e.g. Construction, Tech"
                                        value={searchParams.industry}
                                        onChange={e => setSearchParams({ ...searchParams, industry: e.target.value })}
                                    />
                                </div>
                                <div className="w-full">
                                    <Input
                                        label="Location / Region"
                                        placeholder="e.g. Zimbabwe, Harare"
                                        value={searchParams.location}
                                        onChange={e => setSearchParams({ ...searchParams, location: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Filter Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="w-full">
                                    <label className="block text-xs font-medium text-slate-400 mb-2">Business Size</label>
                                    <select
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        value={filters.businessSize}
                                        onChange={e => setFilters({ ...filters, businessSize: e.target.value })}
                                    >
                                        <option value="">All Sizes</option>
                                        <option value="very_small">Very Small (1-10)</option>
                                        <option value="small_medium">Small-Medium (11-100)</option>
                                        <option value="enterprise">Enterprise (100+)</option>
                                    </select>
                                </div>
                                <div className="w-full">
                                    <label className="block text-xs font-medium text-slate-400 mb-2">Employee Count</label>
                                    <select
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        value={filters.employeeCount}
                                        onChange={e => setFilters({ ...filters, employeeCount: e.target.value })}
                                    >
                                        <option value="">All Counts</option>
                                        <option value="1-10">1-10 employees</option>
                                        <option value="11-50">11-50 employees</option>
                                        <option value="51-100">51-100 employees</option>
                                        <option value="101-500">101-500 employees</option>
                                        <option value="500+">500+ employees</option>
                                    </select>
                                </div>
                            </div>



                            <div className="flex flex-wrap gap-2 sm:gap-3">
                                <Button onClick={handleSearch} className="flex-1 sm:flex-initial bg-teal-500 hover:bg-teal-400" isLoading={isSearching} disabled={!aiConfigured}>
                                    <Search className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">{aiConfigured ? 'Find Leads' : 'AI core offline'}</span>
                                </Button>

                                <Button onClick={() => setShowManualModal(true)} variant="outline" className="flex-1 sm:flex-initial border-dashed border-slate-600 hover:border-teal-500 hover:text-teal-400">
                                    <UserPlus className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Add Lead</span>
                                </Button>

                                <Button variant="outline" className="flex-1 sm:flex-initial border-dashed border-slate-600 hover:border-teal-500 hover:text-teal-400" onClick={() => setShowUpload(!showUpload)}>
                                    <Upload className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Import</span>
                                </Button>

                                {selectedLeads.length > 0 && (
                                    <Button onClick={deleteSelected} variant="danger" className="flex-1 sm:flex-initial bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/50">
                                        <Trash2 className="w-4 h-4 sm:mr-2" /> ({selectedLeads.length})
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Dropzone */}
                        {showUpload && (
                            <div className="mt-4 p-8 border-2 border-dashed border-slate-700 rounded-xl bg-slate-950/50 text-center animate-fade-in relative">
                                <button onClick={() => setShowUpload(false)} className="absolute top-2 right-2 text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
                                <FileSpreadsheet className="w-10 h-10 text-teal-500 mx-auto mb-3" />
                                <p className="text-white font-medium mb-1">Drag and drop Excel/CSV file</p>
                                <p className="text-xs text-slate-500 mb-4">Supported columns: Name, Email, Phone, Industry, Location</p>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id="file-upload"
                                />
                                <label htmlFor="file-upload" className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded cursor-pointer transition-colors text-sm">
                                    Select File
                                </label>
                            </div>
                        )}
                    </Card>

                    {/* Results */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl min-h-[400px]">
                        {isLoading || isSearching ? (
                            <div className="p-4 sm:p-6">
                                <TableSkeleton rows={5} />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs sm:text-sm text-slate-400">
                                    <thead className="bg-slate-950/50 text-[10px] sm:text-xs uppercase font-semibold text-slate-500">
                                        <tr>
                                            <th className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedLeads.length === leads.length && leads.length > 0}
                                                    onChange={toggleSelectAll}
                                                    className="rounded border-slate-700 bg-slate-900"
                                                />
                                            </th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4">Business</th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 hidden md:table-cell">Industry</th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 hidden lg:table-cell">Location</th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4">Contact</th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 hidden sm:table-cell">Source</th>
                                            <th className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {(() => {
                                            // Apply filters
                                            let filteredLeads = leads;

                                            if (filters.businessSize) {
                                                filteredLeads = filteredLeads.filter(lead => {
                                                    const size = (lead as any).businessSize || (lead as any).metadata?.businessSize;
                                                    return size === filters.businessSize;
                                                });
                                            }

                                            if (filters.employeeCount) {
                                                filteredLeads = filteredLeads.filter(lead => {
                                                    const count = (lead as any).employeeCount || (lead as any).metadata?.employeeCount;
                                                    return count === filters.employeeCount;
                                                });
                                            }

                                            if (filteredLeads.length === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                                            {leads.length === 0 ? 'No leads found. Try searching or uploading a file.' : 'No leads match the selected filters.'}
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            return filteredLeads.map((lead) => (
                                                <tr key={lead.id} className="hover:bg-slate-800/40 transition-colors">
                                                    <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedLeads.includes(lead.id)}
                                                            onChange={() => toggleSelectLead(lead.id)}
                                                            className="rounded border-slate-700 bg-slate-900"
                                                        />
                                                    </td>
                                                    <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 font-medium text-white max-w-[120px] sm:max-w-none truncate hover:text-teal-400 cursor-pointer" onClick={() => setSelectedLeadForDetail(lead)}>
                                                        {lead.businessName}
                                                    </td>
                                                    <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 hidden md:table-cell">{lead.industry || '-'}</td>
                                                    <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 hidden lg:table-cell">{lead.location || '-'}</td>
                                                    <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4">
                                                        <div className="flex flex-col gap-1">
                                                            {lead.phone && <span className="flex items-center gap-1 text-[10px] sm:text-xs truncate max-w-[100px] sm:max-w-none"><Phone className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{lead.phone}</span></span>}
                                                            {lead.email && <span className="text-[10px] sm:text-xs text-blue-400 truncate max-w-[100px] sm:max-w-none">{lead.email}</span>}
                                                            {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] sm:text-xs text-teal-400 hover:underline"><ExternalLink className="w-3 h-3" /> Website</a>}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 hidden sm:table-cell">
                                                        <div className="flex flex-col gap-2">
                                                            <span className={`text-[10px] sm:text-xs px-2 py-1 rounded-full border w-fit font-bold uppercase tracking-wider ${lead.source === 'Manus AI' ? 'bg-teal-500/20 text-teal-400 border-teal-500/30' :
                                                                lead.source === 'Google Places' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                                                    'bg-slate-800 text-slate-400 border-slate-700'
                                                                }`}>
                                                                {lead.source === 'Manus AI' ? 'Premium' : lead.source}
                                                            </span>
                                                            {lead.outreachMessage && (
                                                                <button
                                                                    onClick={() => setViewingMessage({ title: `Email for ${lead.businessName}`, body: lead.outreachMessage! })}
                                                                    className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 w-fit"
                                                                >
                                                                    <Mail className="w-3 h-3" /> View Draft
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4">
                                                        {lead.status === 'Added to CRM' || lead.stage === 'qualified' || lead.stage === 'converted' ? (
                                                            <span className="flex items-center gap-1 text-green-400 text-[10px] sm:text-xs font-bold">
                                                                <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Qualified</span>
                                                            </span>
                                                        ) : (
                                                            <div className="relative group">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => addToCRM(lead.id, lead.stage)}
                                                                    className="text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                                                                >
                                                                    <UserPlus className="w-3 h-3" /> <span className="hidden sm:inline ml-1">Add to CRM</span>
                                                                </Button>

                                                                {/* Dropdown Menu on Hover */}
                                                                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
                                                                    <div className="p-2 space-y-1">
                                                                        <button
                                                                            onClick={() => {
                                                                                addToCRM(lead.id, 'qualified');
                                                                                toast.success('Lead qualified!');
                                                                            }}
                                                                            className="w-full text-left px-3 py-2 text-xs text-white hover:bg-slate-800 rounded flex items-center gap-2"
                                                                        >
                                                                            <CheckCircle2 className="w-3 h-3 text-green-400" />
                                                                            Qualify Lead
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                // Navigate to deals with lead pre-selected
                                                                                window.location.href = `/dashboard/deals?leadId=${lead.id}`;
                                                                            }}
                                                                            className="w-full text-left px-3 py-2 text-xs text-white hover:bg-slate-800 rounded flex items-center gap-2"
                                                                        >
                                                                            <UserPlus className="w-3 h-3 text-blue-400" />
                                                                            Create Deal
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setSelectedLeadForDetail(lead)}
                                                                            className="w-full text-left px-3 py-2 text-xs text-white hover:bg-slate-800 rounded flex items-center gap-2"
                                                                        >
                                                                            <CheckCircle2 className="w-3 h-3 text-purple-400" />
                                                                            Manage Lead
                                                                        </button>
                                                                        <button
                                                                            disabled
                                                                            className="w-full text-left px-3 py-2 text-xs text-slate-500 cursor-not-allowed rounded flex items-center gap-2"
                                                                            title="Quote creation available from lead detail view"
                                                                        >
                                                                            <FileText className="w-3 h-3 text-slate-600" />
                                                                            Create Quote
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ));
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                    {/* Chat Area */}
                    <div className="flex-1 p-3 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] sm:max-w-[80%] p-3 sm:p-4 rounded-xl text-sm sm:text-base ${msg.sender === 'user' ? 'bg-teal-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Input Area */}
                    <div className="p-4 bg-slate-950 border-t border-slate-800 flex gap-4">
                        <input
                            type="text"
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
                            placeholder={aiConfigured ? "Type a message to the agent..." : "AI core offline..."}
                            disabled={!aiConfigured}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <Button onClick={handleSendMessage} className="bg-teal-500" disabled={!aiConfigured}><Send className="w-4 h-4" /></Button>
                    </div>
                </div>
            )}

            {/* Email Preview Modal */}
            {viewingMessage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl shadow-2xl animate-fade-in-up">
                        <div className="flex justify-between items-center p-4 border-b border-slate-800">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Mail className="w-5 h-5 text-teal-500" />
                                Outreach Draft
                            </h3>
                            <button onClick={() => setViewingMessage(null)} className="text-slate-500 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-slate-400 mb-4">Generated for: <span className="text-white font-medium">{viewingMessage.title}</span></p>
                            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-sm text-slate-300 font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                                {viewingMessage.body}
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-800 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setViewingMessage(null)}>Close</Button>
                            <Button className="bg-teal-600 hover:bg-teal-500" onClick={() => {
                                toast.success("Draft copied to clipboard!");
                                navigator.clipboard.writeText(viewingMessage.body);
                                setViewingMessage(null);
                            }}>
                                Copy to Clipboard
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Entry Modal */}
            <Modal isOpen={showManualModal} onClose={() => setShowManualModal(false)} title="Add Lead Manually">
                <div className="space-y-4">
                    <Input
                        label="Business / Contact Name *"
                        placeholder="e.g. John Doe / Alpha Corp"
                        value={manualLead.businessName}
                        onChange={e => setManualLead({ ...manualLead, businessName: e.target.value })}
                        required
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Email Address"
                            type="email"
                            placeholder="email@example.com"
                            value={manualLead.email}
                            onChange={e => setManualLead({ ...manualLead, email: e.target.value })}
                        />
                        <Input
                            label="Phone Number"
                            placeholder="+1 555 0000"
                            value={manualLead.phone}
                            onChange={e => setManualLead({ ...manualLead, phone: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Industry"
                            placeholder="e.g. Technology"
                            value={manualLead.industry}
                            onChange={e => setManualLead({ ...manualLead, industry: e.target.value })}
                        />
                        <Input
                            label="Location"
                            placeholder="e.g. New York"
                            value={manualLead.location}
                            onChange={e => setManualLead({ ...manualLead, location: e.target.value })}
                        />
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setShowManualModal(false)}>Cancel</Button>
                        <Button onClick={handleManualAddLead}>Save Lead</Button>
                    </div>
                </div>
            </Modal>

            {/* Lead Detail Modal */}
            {
                selectedLeadForDetail && (
                    <LeadDetailModal
                        isOpen={!!selectedLeadForDetail}
                        onClose={() => setSelectedLeadForDetail(null)}
                        lead={selectedLeadForDetail}
                        onLeadUpdate={() => {
                            // Optional: refresh list
                        }}
                    />
                )
            }
        </div >
    );
};

export default SalesAgent;
