'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Bot, Search, Play, Pause, Settings, RefreshCw, Plus, Filter, Database, MessageSquare, ArrowRight, CheckCircle2, AlertCircle, UserPlus, Phone, Send, Trash2, Upload, FileSpreadsheet, X, Mail, ExternalLink, FileText, Zap, Layout, CheckSquare, Clock, ShieldCheck, Globe } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { generateLeads, chatWithGrowthAgent, isAnyAIConfigured } from '../../services/unifiedAIService';
import { leadService, Lead } from '../../services/leadService';
import { fileImportService } from '../../services/fileImportService';
import LeadDetailModal from './leads/LeadDetailModal';
import { Button, Input, Card, Modal } from '../ui/UIComponents';
import { TableSkeleton } from '../ui/Skeleton';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

import { useBackgroundTasks } from '../../contexts/BackgroundTaskContext';
import { AerialLeadNavigator } from './leads/AerialLeadNavigator';
import { auditService, AuditResult } from '../../services/auditService';
import { LeadAuditReport } from './leads/LeadAuditReport';
import OmniLeadFinder from '../leads/OmniLeadFinder';
import KanbanBoard from './crm/KanbanBoard';
import AutomationBuilder from './workflows/AutomationBuilder';
import { launchFunnelService } from '@/services/launchFunnelService';

interface ParsedContact {
    name?: string;
    email?: string;
    phone?: string;
    industry?: string;
    location?: string;
    description?: string;
}

const SalesAgent: React.FC = () => {
    const aiConfigured = isAnyAIConfigured();
    const { startTask } = useBackgroundTasks();
    const router = useRouter();
    const { t } = useLanguage();
    const searchParams = useSearchParams();
    // Map URL ?tab= param to internal tab names
    const getInitialTab = (): 'leads' | 'agent' | 'omni' | 'kanban' | 'automation' => {
        const tab = searchParams?.get('tab');
        if (tab === 'chat') return 'agent';
        if (tab === 'finder') return 'omni';
        return 'omni';
    };
    const [activeTab, setActiveTab] = useState<'leads' | 'agent' | 'omni' | 'kanban' | 'automation'>(getInitialTab);
    const [searchCriteria, setSearchCriteria] = useState({ industry: '', location: '' });
    const [leads, setLeads] = useState<Lead[]>([]);
    
    // Validate that required functions are available
    useEffect(() => {
        if (typeof generateLeads !== 'function') {
            console.error('generateLeads function is not available. AI leads generation will not work.');
        }
        if (typeof startTask !== 'function') {
            console.error('startTask function is not available. Background tasks will not work.');
        }
    }, []);
    const [isSearching, setIsSearching] = useState(false);
    const [isVisualSearchActive, setIsVisualSearchActive] = useState(false);
    const [visualSearchParams, setVisualSearchParams] = useState({ industry: '', location: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
    const [filters, setFilters] = useState({ businessSize: '', employeeCount: '' });

    const [showUpload, setShowUpload] = useState(false);
    const [contacts, setContacts] = useState<ParsedContact[]>([]);

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

    // Audit State
    const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
    const [showAudit, setShowAudit] = useState(false);

    // Filter leads for dashboard
    const filteredLeads = leads.filter(l => !l.client_id);

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

            // Auto-process manual lead too? User said "ALL generated leads", but let's stick to AI ones for now unless specified.
            // Actually, for consistency, let's keep manual separate unless requested.
            loadLeads();
        }
    };

    // Helper to process a single lead into CRM and Quote
    const processLeadHelper = async (lead: Lead, userId: string, tenantId: string) => {
        try {
            // 0. Dynamic imports
            const { businessClientService } = await import('../../services/businessClientService');
            const { quoteService } = await import('../../services/quoteService');
            const { dealService } = await import('../../services/dealService');

            // 1. Qualify Lead
            await leadService.updateLead(lead.id, { stage: 'qualified' });

            // 2. Create Client
            const { client, error: clientError } = await businessClientService.createClient(tenantId, {
                name: lead.businessName,
                email: lead.email || '',
                phone: lead.phone,
                salesStage: 'customer',
                industry: lead.industry,
                value: lead.value || 0,
                location: lead.location,
                description: lead.notes
            });

            if (clientError || !client) return { success: false, error: clientError || 'Failed to create client' };

            // 3. Link Lead to Client
            await leadService.updateLead(lead.id, { client_id: client.id });

            // 4. Create Draft Quote
            const { quote, error: quoteError } = await quoteService.createQuote(userId, {
                name: `Quote for ${lead.businessName}`,
                validForDays: 30,
                currency: 'USD',
                contactId: client.id,
                notes: 'Auto-generated draft quote from AI Agent'
            });

            if (quoteError || !quote) return { success: false, error: quoteError || 'Failed to create quote' };

            // 5. Create Deal (NEW)
            const { error: dealError } = await dealService.createDeal(userId, {
                name: `${lead.businessName} - Opportunity`,
                contactId: client.id,
                value: lead.value || 0,
                currency: 'USD',
                stage: 'lead',
                source: 'other',
                sourceDetails: 'AI Growth Agent',
                description: lead.notes || 'Auto-generated deal'
            });

            if (dealError) {
                console.error("Deal creation failed after quote creation:", dealError);
                // We don't fail the whole process if just the deal fails, but we log it
            }

            // 6. Add default line item
            await quoteService.addQuoteItem(quote.id, {
                productName: 'Consultation Services',
                description: 'Initial consultation and requirements gathering',
                quantity: 1,
                unitPrice: 0 // User to edit
            });

            // 7. Sync to HubSpot (NEW)
            try {
                const { supabase } = await import('../../lib/supabase');
                const { data: hubspotIntegration } = await supabase
                    .from('integrations')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('type', 'hubspot')
                    .maybeSingle();

                if (hubspotIntegration && hubspotIntegration.enabled) {
                    console.log(`[SalesAgent] HubSpot connected, syncing lead ${lead.businessName}...`);
                    await fetch('/api/hubspot/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, leads: [lead] })
                    });
                }
            } catch (hsErr) {
                console.error('HubSpot background sync failed:', hsErr);
                // We don't fail the whole process if HubSpot fails
            }

            return { success: true };
        } catch (err: any) {
            console.error("Auto-process error", err);
            return { success: false, error: err.message };
        }
    };
    const handleExecuteLead = async (lead: Lead) => {
        const { supabase } = await import('../../lib/supabase');
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            toast.error("You must be logged in to execute leads");
            return;
        }

        const { tenantService } = await import('../../services/tenancy/TenantService');
        const tenantId = tenantService.getCurrentTenantId();

        if (!tenantId) {
            toast.error("No active organization found");
            return;
        }

        const toastId = toast.loading(`Executing flow for ${lead.businessName}...`);

        const result = await processLeadHelper(lead, user.id, tenantId);

        if (result.success) {
            toast.success(`Successfully converted ${lead.businessName} to Client with Deal and Draft Quote!`, { id: toastId });
            loadLeads();
        } else {
            toast.error(`Execution failed: ${result.error}`, { id: toastId });
        }
    };

    const handleBulkExecute = async () => {
        if (selectedLeads.length === 0) {
            toast.error("Please select leads to execute");
            return;
        }

        const { supabase } = await import('../../lib/supabase');
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            toast.error("You must be logged in to execute leads");
            return;
        }

        const { tenantService } = await import('../../services/tenancy/TenantService');
        const tenantId = tenantService.getCurrentTenantId();

        if (!tenantId) {
            toast.error("No active organization found");
            return;
        }

        const toastId = toast.loading(`Executing flow for ${selectedLeads.length} leads...`);
        let successCount = 0;
        let failCount = 0;

        for (const leadId of selectedLeads) {
            const lead = leads.find(l => l.id === leadId);
            if (lead) {
                const result = await processLeadHelper(lead, user.id, tenantId);
                if (result.success) successCount++;
                else failCount++;
            }
        }

        if (failCount === 0) {
            toast.success(`Successfully executed all ${successCount} leads!`, { id: toastId });
        } else {
            toast.success(`Execution complete. Success: ${successCount}, Failed: ${failCount}`, { id: toastId });
        }

        setSelectedLeads([]);
        loadLeads();
    };
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
        { id: 1, sender: 'agent', text: 'Hello. I can help you find leads, draft outreach messages, and prepare CRM follow-up. Assisted workflows are available now; fully autonomous execution is still in beta.' }
    ]);
    const [inputText, setInputText] = useState('');
    const [pendingSearch, setPendingSearch] = useState<{ industry: string, location: string, filters?: string } | null>(null);

    const handleSearch = async () => {
        // Validate inputs
        if (!searchCriteria.industry.trim()) {
            toast.error('Please enter a target industry');
            return;
        }
        if (!searchCriteria.location.trim()) {
            toast.error('Please enter a location');
            return;
        }
        
        if (contacts.length === 0) {
            toast.error("No valid contacts found in file.");
            return;
        }

        // Map ParsedContact to Lead
        const leadsToAdd = contacts.map(c => ({
            businessName: c.name || 'Unknown Business',
            email: c.email,
            phone: c.phone,
            industry: c.industry || 'Imported',
            location: c.location || 'Unknown',
            notes: c.description,
            source: 'CSV Import'
            // value: c.value // Pending DB support for value
        }));

        const { count, error: dbError } = await leadService.addBulkLeads(leadsToAdd);

        if (dbError) {
            toast.error(`Database error: ${dbError}`);
            return;
        }

        toast.success(`Successfully added ${count} leads from CSV`);
        setShowUpload(false);
        setContacts([]);
    };

    const handleVisualSearch = async () => {
        if (!searchCriteria.industry || !searchCriteria.location) {
            toast.error('Please enter both industry and location for AI lead search');
            return;
        }
        
        // Validate functions are available before proceeding
        if (typeof generateLeads !== 'function') {
            toast.error('AI leads generation service is not available. Please contact support.');
            return;
        }
        
        if (typeof startTask !== 'function') {
            toast.error('Background task service is not available. Please refresh the page.');
            return;
        }

        setIsSearching(true);
        const taskName = `AI Senior SDR & Data Scientist Lead Search for ${searchCriteria.industry} in ${searchCriteria.location}`;

        setVisualSearchParams({ industry: searchCriteria.industry, location: searchCriteria.location });
        setIsVisualSearchActive(true);

        startTask(
            `lead_search_${Date.now()}`,
            taskName,
            async () => {
                console.log('Starting AI lead generation...');
                
                // Check if generateLeads is available
                if (typeof generateLeads !== 'function') {
                    throw new Error('generateLeads function is not available. Please check AI service configuration.');
                }
                
                // Assuming generateLeads now returns { leads: Lead[], rawMapsData: any[] }
                const res = await generateLeads(searchCriteria.industry, searchCriteria.location, '', 'tenant');

                if (res && res.leads && res.leads.length > 0) {
                    console.log(`✅ Generated ${res.leads.length} leads, saving to database...`);

                    // 2. Perform Audit
                    if (res.rawMapsData && res.rawMapsData.length > 0) {
                        const audit = auditService.performLeadAudit(res.leads, res.rawMapsData, searchCriteria.industry);
                        setAuditResult(audit);
                        setShowAudit(true);
                    }

                    // 3. Save leads to state and DB
                    const leadsToAdd = res.leads.map((r: any) => ({
                        businessName: r.businessName || r.business_name || r.name || r.company || 'Unknown Business',
                        industry: r.industry || r.category || 'Discovery',
                        location: r.location || r.city || r.address || 'Unknown',
                        phone: r.phone || r.phone_number || r.contact_phone || '',
                        email: r.email || r.contact_email || '',
                        website: r.website || r.url || r.websiteUri || r.link || '',
                        fb: r.facebook || r.fb || '',
                        notes: r.notes || r.aiAnalysis || r.description || r.intelligence || '',
                        outreachMessage: r.outreachMessage || r.emailDraft || r.message || '',
                        value: r.estimatedValue || r.value || 0,
                        source: r.leadSource || r.source || 'AI Agent',
                        isVerified: r.isVerified || false,
                        trustScore: r.trustScore || 0,
                        verificationNotes: r.verificationNotes || r.reasoning || '',
                        sdrInsight: r.sdrInsight || r.insight || ''
                    }));

                    const { count, error } = await leadService.addBulkLeads(leadsToAdd);
                    if (error) {
                        throw new Error(`AI found leads but failed to save them: ${error}`);
                    }

                    const { leads: newLeads } = await leadService.getLeads();
                    const leadsToProcess = newLeads.slice(0, res.leads.length);
                    let processed = 0;

                    const { supabase } = await import('../../lib/supabase');
                    const { data: { user } } = await supabase.auth.getUser();

                    if (user) {
                        const { tenantService } = await import('../../services/tenancy/TenantService');
                        const tenantId = tenantService.getCurrentTenantId();

                        if (tenantId) {
                            for (const lead of leadsToProcess) {
                                try {
                                    const result = await processLeadHelper(lead, user.id, tenantId);
                                    if (result.success) {
                                        processed++;
                                    } else {
                                        console.error(`Conversion failed for ${lead.businessName}:`, result.error);
                                        toast.error(`CRM sync failed for ${lead.businessName}. The lead was saved but conversion aborted.`, { duration: 3000 });
                                    }
                                } catch (innerErr) {
                                    console.error(`Unexpected conversion error for ${lead.businessName}:`, innerErr);
                                }
                            }
                        }
                    }
                    return { count, processed };
                } else {
                    throw new Error("No leads found. AI can make mistakes or have region-specific limitations. Try being more direct with your search or adjusting the criteria.");
                }
            },
            (result) => {
                toast.success(`🎉 Added ${result.count} leads, created ${result.processed} clients & draft quotes!`, { duration: 5000 });
                if (result.count > 0) {
                    void launchFunnelService.completeStep('first_lead_found');
                }
                loadLeads();
                setIsVisualSearchActive(false);
            }
        );

        toast.success(`Task started: ${taskName}. You can safely navigate away!`);
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
                businessName: c.name || 'Unknown Business',
                email: c.email,
                phone: c.phone,
                industry: c.industry || 'Imported',
                location: c.location || 'Unknown',
                notes: c.description,
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

    const handleEnrich = async (leadId: string) => {
        const { data: { user } } = await (await import('../../lib/supabase')).supabase.auth.getUser();
        if (!user) return;

        toast.loading('Researching business...', { id: 'enriching' });
        try {
            const { notes, error } = await leadService.enrichLead(leadId, user.id);
            if (error) throw new Error(error);
            toast.success('Business intelligence gathered!', { id: 'enriching' });
            loadLeads();
        } catch (error: any) {
            toast.error('Research failed: ' + error.message, { id: 'enriching' });
        }
    };

    const handleCreateProject = async (lead: Lead) => {
        const { data: { user } } = await (await import('../../lib/supabase')).supabase.auth.getUser();
        if (!user) return;

        const name = window.prompt('Enter Project Name:', `Project: ${lead.businessName}`);
        if (!name) return;

        try {
            const { projectService } = await import('../../services/projectService');
            const { contactService } = await import('../../services/contactService');

            // STEP 1: Ensure we have a contact
            const { contactId, error: convertError } = await contactService.convertLeadToContact(lead.id, {
                createCompany: true,
                companyName: lead.businessName
            });

            if (convertError || !contactId) throw new Error(convertError || 'Failed to prepare contact/company');

            // STEP 2: Create project
            const { error: projectError } = await projectService.createProject({
                ownerId: user.id,
                ownerName: user.email?.split('@')[0] || 'User',
                name,
                category: 'Client Project',
                status: 'Active',
                currentStage: 'Initiation',
                progress: 0,
                team: [user.id],
                description: `Project initialized from lead discovery. \n\nIndustry: ${lead.industry}\nIntelligence: ${lead.notes || 'None'}`,
                clientId: contactId,
                contractStatus: 'None',
                startDate: new Date().toISOString().split('T')[0]
            });

            if (projectError) throw new Error(projectError);

            toast.success(`Project "${name}" initialized!`);
            loadLeads();
        } catch (error: any) {
            toast.error('Failed to create project: ' + error.message);
        }
    };

    const handleCreateTask = async (lead: Lead) => {
        const { data: { user } } = await (await import('../../lib/supabase')).supabase.auth.getUser();
        if (!user) return;

        const title = window.prompt('What needs to be done?', `Follow up with ${lead.businessName}`);
        if (!title) return;

        try {
            const { taskService } = await import('../../services/taskService');
            const { error } = await taskService.createTask(user.id, {
                title,
                relatedToLead: lead.id,
                priority: 'medium',
                status: 'todo'
            });

            if (error) throw new Error(error);
            toast.success('Task created successfully');
        } catch (error: any) {
            toast.error('Failed to create task: ' + error.message);
        }
    };

    const handleCreateDeal = async (lead: Lead) => {
        const { data: { user } } = await (await import('../../lib/supabase')).supabase.auth.getUser();
        if (!user) return;

        const name = window.prompt('Enter Deal Name:', lead.businessName);
        if (!name) return;

        toast.loading(`Creating deal "${name}"...`, { id: 'create_deal' });

        try {
            const { contactService } = await import('../../services/contactService');
            const { dealService } = await import('../../services/dealService');

            const { contactId, error: convertError } = await contactService.convertLeadToContact(lead.id);
            if (convertError || !contactId) throw new Error(convertError || 'Failed to create contact');

            const { error: dealError } = await dealService.createDeal(user.id, {
                name,
                contactId: contactId,
                value: lead.value,
                stage: 'qualified',
                probability: 25,
                metadata: {
                    originalLeadId: lead.id,
                    convertedAt: new Date().toISOString()
                }
            });

            if (dealError) throw new Error(dealError);

            toast.success(`✅ Deal "${name}" created!`, { id: 'create_deal' });
            void launchFunnelService.completeStep('first_deal_created', user.id);
            loadLeads();
        } catch (error: any) {
            toast.error('Failed to create deal: ' + error.message, { id: 'create_deal' });
        }
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
                stage: 'qualified'
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
                phone: lead.phone,
                value: lead.value || 0,
                salesStage: 'customer', // Qualified leads become customers in CRM
                industry: lead.industry,
                location: lead.location,
                description: lead.notes
            });

            if (clientError) {
                toast.error(`Lead qualified but failed to create client: ${clientError}`);
                // Still update local state to show qualified
                setLeads(prev => prev.map(l => l.id === id ? { ...l, stage: 'qualified' } : l));
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
            setLeads(prev => prev.map(l => l.id === id ? { ...l, stage: 'qualified' } : l));

        } catch (err) {
            console.error('Add to CRM error:', err);
            toast.error("An unexpected error occurred");
        }
    };

    const bulkAddLeadsToCRM = async () => {
        if (selectedLeads.length === 0) return;

        const toastId = toast.loading(`Converting ${selectedLeads.length} leads to CRM clients...`);
        try {
            const { businessClientService } = await import('../../services/businessClientService');
            const { tenantService } = await import('../../services/tenancy/TenantService');
            const tenantId = tenantService.getCurrentTenantId();

            if (!tenantId) {
                toast.error('No active organization session', { id: toastId });
                return;
            }

            let successCount = 0;
            let failCount = 0;

            for (const id of selectedLeads) {
                const lead = leads.find(l => l.id === id);
                if (!lead) continue;

                // Mark lead as qualified
                await leadService.updateLead(id, { stage: 'qualified' });

                // Create client
                const { client, error: clientError } = await businessClientService.createClient(tenantId, {
                    name: lead.businessName,
                    email: lead.email || '',
                    phone: lead.phone,
                    value: lead.value || 0,
                    salesStage: 'customer',
                    industry: lead.industry,
                    location: lead.location,
                    description: lead.notes
                });

                if (client && !clientError) {
                    await leadService.updateLead(id, { client_id: client.id });
                    successCount++;
                } else {
                    failCount++;
                }
            }

            toast.success(`Successfully converted ${successCount} leads to CRM!`, { id: toastId });
            setSelectedLeads([]);
            loadLeads();
        } catch (err: any) {
            toast.error(`Bulk conversion failed: ${err.message}`, { id: toastId });
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

            // Get specialized Growth Agent response
            const { text, commands } = await chatWithGrowthAgent(history, userMessage);

            if (!text) throw new Error("No response from AI");

            setMessages(prev => [...prev, {
                id: prev.length + 1,
                sender: 'agent',
                text: text
            }]);

            // --- Command Handling (AlphaClone AI Style) ---
            if (commands.search) {
                const { industry, location, filters } = commands.search;
                if (industry && location) {
                    toast.success(`🤖 Intent detected: Searching for ${industry}...`);
                    handleAutoSearch(industry, location, filters);
                }
            }

            if (commands.research) {
                const { businessName, context } = commands.research;
                // Find visible lead with this name if possible
                const matchingLead = leads.find(l =>
                    (l.businessName || '').toLowerCase().includes((businessName || '').toLowerCase())
                );

                if (matchingLead) {
                    toast.success(`🔬 Researching "${businessName}"...`);
                    handleEnrich(matchingLead.id);
                } else {
                    setMessages(prev => [...prev, {
                        id: prev.length + 1,
                        sender: 'agent',
                        text: `I'd love to research ${businessName} for you, but I don't see them in your current lead list. Would you like me to find them first?`
                    }]);
                }
            }
        } catch (error: any) {
            console.error('❌ AI Chat Error:', error);
            const errorMessage = error?.message || 'I apologize, but I encountered a technical issue. Please try again or contact support if the problem persists.';
            setMessages(prev => [...prev, {
                id: prev.length + 1,
                sender: 'agent',
                text: errorMessage.includes('Failed to fetch')
                    ? 'I am having trouble connecting to the AI core. Please check your internet connection or try again later.'
                    : errorMessage
            }]);
        }
    };

    // Specialized auto-search that bypasses toast.loading if needed or just reuses handleSearch
    const handleAutoSearch = async (industry: string, location: string, filters?: string) => {
        // Validate inputs
        if (!industry.trim() || !location.trim()) return;

        // CHECK LEAD LIMIT BEFORE GENERATING
        const { data: { user } } = await (await import('../../lib/supabase')).supabase.auth.getUser();
        const limitCheck = await leadService.checkLeadLimit((user as any)?.role);
        if (!limitCheck.allowed) {
            toast.error(limitCheck.error || 'Daily lead limit reached.');
            return;
        }

        const taskName = `AI Agent Search for ${industry} in ${location}`;

        setVisualSearchParams({ industry, location });
        setIsVisualSearchActive(true);

        startTask(
            `auto_search_${Date.now()}`,
            taskName,
            async () => {
                // Check if generateLeads is available
                if (typeof generateLeads !== 'function') {
                    throw new Error('generateLeads function is not available. Please check AI service configuration.');
                }
                
                // Assuming generateLeads now returns { leads: Lead[], rawMapsData: any[] }
                const res = await generateLeads(industry, location, '', 'tenant', filters);

                if (res && res.leads && res.leads.length > 0) {
                    // 2. Perform Audit
                    if (res.rawMapsData && res.rawMapsData.length > 0) {
                        const audit = auditService.performLeadAudit(res.leads, res.rawMapsData, industry);
                        setAuditResult(audit);
                        setShowAudit(true);
                    }

                    const leadsToAdd = res.leads.map((r: any) => ({
                        businessName: r.businessName || r.business_name || r.name || r.company || 'Unknown Business',
                        industry: r.industry || r.category || 'Discovery',
                        location: r.location || r.city || r.address || 'Unknown',
                        phone: r.phone || r.phone_number || r.contact_phone || '',
                        email: r.email || r.contact_email || '',
                        website: r.website || r.url || r.websiteUri || r.link || '',
                        fb: r.facebook || r.fb || '',
                        notes: r.notes || r.aiAnalysis || r.description || r.intelligence || '',
                        outreachMessage: r.outreachMessage || r.emailDraft || r.message || '',
                        value: r.estimatedValue || r.value || 0,
                        source: r.leadSource || r.source || 'AI Agent',
                        isVerified: r.isVerified || false,
                        trustScore: r.trustScore || 0,
                        verificationNotes: r.verificationNotes || r.reasoning || '',
                        sdrInsight: r.sdrInsight || r.insight || ''
                    }));

                    const { count, error } = await leadService.addBulkLeads(leadsToAdd);
                    if (error) {
                        throw new Error(`AI found leads but failed to save them: ${error}`);
                    }

                    const { leads: newLeads } = await leadService.getLeads();
                    const leadsToProcess = newLeads.slice(0, res.leads.length);
                    let processed = 0;

                    const { supabase } = await import('../../lib/supabase');
                    const { data: { user } } = await supabase.auth.getUser();

                    if (user) {
                        const { tenantService } = await import('../../services/tenancy/TenantService');
                        const tenantId = tenantService.getCurrentTenantId();

                        if (tenantId) {
                            for (const lead of leadsToProcess) {
                                const result = await processLeadHelper(lead, user.id, tenantId);
                                if (result.success) processed++;
                            }
                        }
                    }

                    return { count, processed, industry, location };
                } else {
                    throw new Error("No leads found. Try different criteria.");
                }
            },
            (result) => {
                toast.success(`🎉 Process complete! Created ${result.processed} draft quotes ready for review.`, { duration: 5000 });
                if (result.count > 0) {
                    void launchFunnelService.completeStep('first_lead_found');
                }
                loadLeads();

                setMessages(prev => [...prev, {
                    id: prev.length + 1,
                    sender: 'agent',
                    text: `Done! I've discovered ${result.count} high-quality leads for ${result.industry} in ${result.location} and added them to your Lead Finder. Would you like me to analyze any of them or draft a specific outreach?`
                }]);
                setIsVisualSearchActive(false);
            }
        );

        toast.success(`Task started: ${taskName}. You can safely navigate away!`);
        setIsSearching(false);
    };

    // New Function: Process Pending Leads
    const handleProcessPendingLeads = async () => {
        const toastId = toast.loading('🔍 Scanning for pending leads...');
        try {
            const { leads: allLeads, error } = await leadService.getLeads();
            if (error) throw new Error(error);

            const pendingLeads = allLeads.filter(l => !l.client_id);

            if (pendingLeads.length === 0) {
                toast.success('No pending leads found! All leads are processed.', { id: toastId });
                return;
            }

            toast.loading(`⚡ Found ${pendingLeads.length} pending leads. Processing...`, { id: toastId });

            const { supabase } = await import('../../lib/supabase');
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                toast.error('User not authenticated', { id: toastId });
                return;
            }

            const { tenantService } = await import('../../services/tenancy/TenantService');
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) {
                toast.error('No active tenant', { id: toastId });
                return;
            }

            let successCount = 0;
            let failCount = 0;

            // Process in chunks to avoid overwhelming? Or just loop. Loop is fine for < 500.
            for (const lead of pendingLeads) {
                const result = await processLeadHelper(lead, user.id, tenantId);
                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                }
                // Update toast every 5 leads
                if ((successCount + failCount) % 5 === 0) {
                    toast.loading(`Processing... ${successCount + failCount}/${pendingLeads.length}`, { id: toastId });
                }
            }

            toast.success(`Complete! Processed ${successCount} leads. (${failCount} failed)`, { id: toastId, duration: 5000 });
            loadLeads(); // Refresh UI

        } catch (err: any) {
            console.error('Error processing pending leads:', err);
            toast.error(`Failed: ${err.message}`, { id: toastId });
        }
    };

    return (
        <div className="space-y-4 sm:space-y-6 animate-fade-in h-full flex flex-col px-4 py-4 sm:px-6 sm:py-6 lg:p-8 overflow-y-auto custom-scrollbar min-w-0">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
                <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500 flex items-center gap-2 sm:gap-3">
                        <Bot className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-teal-400 flex-shrink-0" />
                        <span className="truncate">{t('Growth Agent')}</span>
                    </h2>
                </div>
                <div className="hidden md:flex flex-wrap bg-slate-800 p-1 rounded-lg self-start sm:self-auto max-w-full overflow-x-auto custom-scrollbar">
                    <button
                        type="button"
                        onClick={() => setActiveTab('omni')}
                        className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'omni' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Globe className="w-3.5 h-3.5" />
                        {t('AlphaClone System Lead')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('agent')}
                        className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'agent' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        {t('Agent Chat')}
                    </button>
                    <button
                        type="button"
                        onClick={() => router.push('/dashboard/marketplace')}
                        className="px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap text-slate-400 hover:text-white"
                    >
                        {t('Integrations')}
                    </button>
                </div>
                <div className="md:hidden w-full min-w-0">
                    <label htmlFor="growth-agent-view" className="sr-only">
                        {t('Select Growth Agent mode')}
                    </label>
                    <select
                        id="growth-agent-view"
                        className="w-full max-w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        value={activeTab === 'agent' ? 'agent' : 'omni'}
                        onChange={(e) => {
                            const v = e.target.value;
                            if (v === 'marketplace') {
                                router.push('/dashboard/marketplace');
                                return;
                            }
                            if (v === 'omni' || v === 'agent') {
                                setActiveTab(v);
                            }
                        }}
                    >
                        <option value="omni">{t('Lead search')}</option>
                        <option value="agent">{t('Agent chat')}</option>
                        <option value="marketplace">{t('Integration marketplace')}</option>
                    </select>
                </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-slate-900/50 px-4 py-2 text-[10px] uppercase tracking-widest font-bold text-slate-500 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                {t('Finding Leads & Autonomous SDR System Active')}
            </div>
            {/* Aerial View - Mini Widget during search or navigation - Hidden as per user request to eliminate map visuals */}
            {/* 
            {activeTab === 'leads' && (isVisualSearchActive || leads.length > 0) && (
                <div className="fixed bottom-6 right-6 w-72 sm:w-80 h-48 sm:h-64 z-40 rounded-2xl overflow-hidden shadow-2xl border border-teal-500/30 bg-slate-950 pointer-events-none sm:pointer-events-auto">
                    <AerialLeadNavigator
                        leads={leads}
                        isSearching={isVisualSearchActive}
                        searchTopic={visualSearchParams.industry || searchCriteria.industry}
                        searchLocation={visualSearchParams.location || searchCriteria.location}
                    />
                </div>
            )}
            */}



            {activeTab === 'omni' ? (
                <div className="flex-1 bg-transparent w-full">
                    <OmniLeadFinder />
                </div>
            ) : (
                <div className="flex-1 bg-transparent flex flex-col">
                    {/* Chat Area */}
                    <div className="flex-1 p-3 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] sm:max-w-[80%] p-3 sm:p-4 rounded-xl text-sm sm:text-base ${msg.sender === 'user' ? 'bg-teal-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none'}`}>
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                            ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2" {...props} />,
                                            ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                                            li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                                            strong: ({ node, ...props }) => <strong className="font-bold text-teal-400" {...props} />,
                                        }}
                                    >
                                        {msg.text}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Input Area */}
                    <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col gap-4">
                        {pendingSearch && (
                            <div className="bg-slate-900 border border-teal-500/30 p-4 rounded-xl shadow-lg">
                                <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                                    <Search className="w-4 h-4 text-teal-400" /> Confirm AI Lead Search
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                    <Input
                                        label="Target Industry"
                                        value={pendingSearch.industry}
                                        onChange={e => setPendingSearch(prev => prev ? { ...prev, industry: e.target.value } : null)}
                                    />
                                    <Input
                                        label="Target Location"
                                        value={pendingSearch.location}
                                        onChange={e => setPendingSearch(prev => prev ? { ...prev, location: e.target.value } : null)}
                                    />
                                    <div className="sm:col-span-2">
                                        <Input
                                            label="Additional Filters (optional)"
                                            placeholder="e.g., 'no website', 'size > 10'"
                                            value={pendingSearch.filters || ''}
                                            onChange={e => setPendingSearch(prev => prev ? { ...prev, filters: e.target.value } : null)}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 justify-end items-center mt-2">
                                    <span className="text-xs text-slate-400 mr-auto flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> Verify filters before searching
                                    </span>
                                    <Button variant="outline" size="sm" onClick={() => setPendingSearch(null)}>Cancel</Button>
                                    <Button size="sm" className="bg-teal-600 hover:bg-teal-500" onClick={() => {
                                        if (!pendingSearch) return;
                                        setSearchCriteria({
                                            industry: pendingSearch.industry,
                                            location: pendingSearch.location
                                        });
                                        setActiveTab('omni');
                                        handleAutoSearch(pendingSearch.industry, pendingSearch.location, pendingSearch.filters);
                                        setPendingSearch(null);
                                    }}>Confirm & Start Search</Button>
                                </div>
                            </div>
                        )}
                        <div className="flex gap-4">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            {selectedLeadForDetail && (
                <LeadDetailModal
                    isOpen={!!selectedLeadForDetail}
                    onClose={() => setSelectedLeadForDetail(null)}
                    lead={selectedLeadForDetail}
                    onLeadUpdate={() => {
                        // Optional: refresh list
                    }}
                />
            )}
        </div>
    );
};

export default SalesAgent;
