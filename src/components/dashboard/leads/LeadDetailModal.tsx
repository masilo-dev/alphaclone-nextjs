import React, { useState, useEffect } from 'react';
import { 
    X, 
    Mail, 
    Phone, 
    Globe, 
    MapPin, 
    Calendar, 
    CheckCircle2, 
    Clock, 
    Plus, 
    CheckSquare, 
    FileText, 
    MessageSquare, 
    Bot, 
    Zap, 
    Send,
    Database,
    AlertCircle,
    Layout,
    ArrowRight,
    Target,
    MoreVertical,
    Copy,
    PhoneCall,
    Search,
    DollarSign,
    History as HistoryIcon,
} from 'lucide-react';
import { Modal, Button, Input, Card, Badge, Dropdown } from '../../ui/UIComponents';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { RecordHeader, AskBonnieButton } from '@/components/ui/os';
import { CRMActionChips } from '../crm/CRMActionChips';
import { Lead, leadService } from '../../../services/leadService';
import { taskService, Task } from '../../../services/taskService';
import { calendarService, CalendarEvent } from '../../../services/calendarService';
import { dealService } from '../../../services/dealService';
import { contactService } from '../../../services/contactService';
import { projectService } from '../../../services/projectService';
import { quoteService } from '../../../services/quoteService';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';
import GhostIntelligence from '@/components/leads/GhostIntelligence';
import { useTenant } from '@/contexts/TenantContext';
import {
    calculateLeadScore,
    getNextBestAction,
    getScoreColor,
    getStageBadge,
    getVerificationStatus,
} from './leadDetailHelpers';
import { googleMapsService } from '../../../services/googleMapsService';
import { getPublicGoogleMapsApiKey } from '@/config/publicEnv';
import dynamic from 'next/dynamic';

const ComposeEmailModal = dynamic(
    () => import('@/components/dashboard/business/ComposeEmailModal'),
    { ssr: false }
);

interface LeadDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: Lead;
    onLeadUpdate?: (lead: Lead) => void;
    onLeadDelete?: (leadId: string) => void;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string' && error.trim()) return error;
    if (error && typeof error === 'object') {
        const maybeError = error as { message?: unknown; error?: unknown; details?: unknown };
        if (typeof maybeError.message === 'string' && maybeError.message.trim()) return maybeError.message;
        if (typeof maybeError.error === 'string' && maybeError.error.trim()) return maybeError.error;
        if (typeof maybeError.details === 'string' && maybeError.details.trim()) return maybeError.details;
    }
    return 'Unknown error';
}

export default function LeadDetailModal({ isOpen, onClose, lead, onLeadUpdate, onLeadDelete }: LeadDetailModalProps) {
    const { user } = useAuth();
    const { currentTenant } = useTenant();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'overview' | 'deals' | 'tasks' | 'meetings' | 'notes' | 'history'>('overview');
    const [isLoading, setIsLoading] = useState(false);
    const [relatedDeals, setRelatedDeals] = useState<any[]>([]);

    const leadScore = calculateLeadScore(lead);
    const nextAction = getNextBestAction(lead);
    const verificationBadge = getVerificationStatus(lead);

    // Quote Creation State
    const [showQuoteForm, setShowQuoteForm] = useState(false);
    const [newQuoteName, setNewQuoteName] = useState('');
    const [newQuoteAmount, setNewQuoteAmount] = useState('');

    // Data States
    const [tasks, setTasks] = useState<Task[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [activities, setActivities] = useState<any[]>([]);

    // Task Creation State
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDueDate, setNewTaskDueDate] = useState('');

    // Meeting Creation State
    const [showMeetingForm, setShowMeetingForm] = useState(false);
    const [meetingTitle, setMeetingTitle] = useState('');
    const [meetingDate, setMeetingDate] = useState('');
    const [meetingTime, setMeetingTime] = useState('');
    // Notes State
    const [leadNotes, setLeadNotes] = useState(lead.notes || '');
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [isEnriching, setIsEnriching] = useState(false);
    const [isValidatingAddress, setIsValidatingAddress] = useState(false);
    const [showEmailComposer, setShowEmailComposer] = useState(false);
    const [emailDraft, setEmailDraft] = useState<{ to: string; subject: string; body: string } | null>(null);
    const [showEditForm, setShowEditForm] = useState(false);
    const [stageChangeReason, setStageChangeReason] = useState('');
    const [editForm, setEditForm] = useState({
        businessName: lead.businessName || '',
        email: lead.email || '',
        phone: lead.phone || '',
        industry: lead.industry || '',
        location: lead.location || '',
        source: lead.source || 'Manual',
        stage: lead.stage || 'lead',
    });

    useEffect(() => {
        setEditForm({
            businessName: lead.businessName || '',
            email: lead.email || '',
            phone: lead.phone || '',
            industry: lead.industry || '',
            location: lead.location || '',
            source: lead.source || 'Manual',
            stage: lead.stage || 'lead',
        });
        setStageChangeReason('');
    }, [lead]);

    useEffect(() => {
        if (isOpen && lead.id) {
            fetchRelatedData();
        }
    }, [isOpen, lead.id, activeTab]);

    const fetchRelatedData = async () => {
        setIsLoading(true);
        try {
            // Fetch Tasks
            if (activeTab === 'tasks' || activeTab === 'overview') {
                const { tasks: fetchedTasks } = await taskService.getTasks({
                    relatedToLead: lead.id
                });
                setTasks(fetchedTasks);
            }

            // Fetch Activities
            if (activeTab === 'history' || activeTab === 'overview') {
                const { activities: fetchedActivities } = await leadService.getLeadActivities(lead.id);
                setActivities(fetchedActivities);
            }

            if (activeTab === 'deals' || activeTab === 'overview') {
                const { data: deals } = await leadService.getRelatedDeals(lead.id);
                setRelatedDeals(deals || []);
            }
            // Note: Assuming calendarService supports filtering by metadata or explicit column
            // For now, we manually check if we can filter client side from global events or if we need a new service method
            // We'll try to fetch all user events and filter client side for MVP to avoid strict schema dependency immediately,
            // or if we updated logic, use getEvents with filter.
            // But getEvents is user based. We'll stick to Tasks mainly for Phase 2 MVP.

        } catch (error) {
            console.error('Error fetching lead data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateTask = async () => {
        if (!newTaskTitle.trim() || !user) return;

        try {
            const { task, error } = await taskService.createTask(user.id, {
                title: newTaskTitle,
                dueDate: newTaskDueDate,
                relatedToLead: lead.id,
                priority: 'medium',
                assignedTo: user.id // Self assign by default
            });

            if (error) throw new Error(error);

            toast.success('Task created successfully');
            setNewTaskTitle('');
            setNewTaskDueDate('');
            setShowTaskForm(false);
            fetchRelatedData();
        } catch (error) {
            toast.error('Failed to create task');
        }
    };

    const handleToggleTask = async (taskId: string, currentStatus: string) => {
        try {
            const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
            // Optimistic update
            setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus as any } : t));

            await taskService.updateTask(taskId, { status: newStatus as any });
        } catch (error) {
            toast.error('Failed to update task');
            fetchRelatedData(); // Revert on error
        }
    };

    const handleGenerateQuote = async () => {
        if (!newQuoteName.trim() || !user) return;
        setIsLoading(true);
        try {
            // STEP 1: Ensure we have a contact
            const { contactId, error: convertError } = await contactService.convertLeadToContact(lead.id, {
                createCompany: true,
                companyName: lead.businessName
            });

            if (convertError || !contactId) {
                throw new Error(convertError || 'Failed to prepare contact/company for quote');
            }

            const { quote, error } = await quoteService.createQuote(user.id, {
                name: newQuoteName,
                validForDays: 30,
                currency: 'USD',
                contactId: contactId,
            });

            if (error) throw new Error(error);

            if (quote && newQuoteAmount) {
                const amount = parseFloat(newQuoteAmount);
                if (!isNaN(amount) && amount > 0) {
                    await quoteService.addQuoteItem(quote.id, {
                        productName: 'Professional Services',
                        description: newQuoteName,
                        quantity: 1,
                        unitPrice: amount
                    });
                }
            }

            toast.success('Quote generated successfully!');
            setNewQuoteName('');
            setNewQuoteAmount('');
            setShowQuoteForm(false);
            // Optionally redirect to quotes tab
        } catch (error: any) {
            toast.error(error.message || 'Failed to generate quote');
        } finally {
            setIsLoading(false);
        }
    };

    const handleScheduleMeeting = async () => {
        if (!meetingTitle.trim() || !meetingDate || !meetingTime || !user) return;

        try {
            const startTime = new Date(`${meetingDate}T${meetingTime}`);
            const { error } = await calendarService.createVideoCallEvent(
                user.id,
                meetingTitle,
                startTime,
                60, // Default duration
                [], // Attendees
                lead.id // Linked to this lead
            );

            if (error) throw new Error(error);

            toast.success('Meeting scheduled successfully');
            setMeetingTitle('');
            setMeetingDate('');
            setMeetingTime('');
            setShowMeetingForm(false);
            // Ideally fetch meetings here
        } catch (error) {
            toast.error('Failed to schedule meeting');
        }
    };

    const handleConvert = async (dealName: string) => {
        if (!user) return;
        if (!dealName) return;

        try {
            // STEP 1: Convert lead to contact
            // This creates a proper contact record and marks the lead as converted
            const { contactId, error: convertError } = await contactService.convertLeadToContact(lead.id, {
                createCompany: false, // Don't auto-create company (can be added later)
            });

            if (convertError || !contactId) {
                throw new Error(convertError || 'Failed to create contact from lead');
            }

            // STEP 2: Create deal with the new contact
            const { error: dealError } = await dealService.createDeal(user.id, {
                name: dealName,
                contactId: contactId, // ✅ FIXED: Now using real contact_id instead of lead.id
                value: lead.value,
                stage: 'qualified', // Start as qualified since lead was already qualified
                probability: 25, // 25% for qualified stage
                metadata: {
                    originalLeadId: lead.id,
                    convertedAt: new Date().toISOString()
                }
            });

            if (dealError) throw new Error(dealError);

            toast.success(`Lead converted to contact and deal "${dealName}" created.`);

            // Lead status is already updated by convert_lead_to_contact() function
            if (onLeadUpdate) onLeadUpdate({ ...lead, status: 'converted' });
            onClose();
        } catch (error) {
            console.error('Lead conversion error:', error);
            toast.error('Failed to convert lead: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const handleSaveNotes = async () => {
        setIsSavingNotes(true);
        try {
            const { error } = await leadService.updateLead(lead.id, { notes: leadNotes });
            if (error) throw new Error(error);

            // Also log a history item
            if (user) {
                await leadService.addLeadActivity(lead.id, user.id, 'note', 'Note updated');
            }

            toast.success('Notes saved successfully');
            if (onLeadUpdate) onLeadUpdate({ ...lead, notes: leadNotes });
            fetchRelatedData();
        } catch (error) {
            toast.error('Failed to save notes');
        } finally {
            setIsSavingNotes(false);
        }
    };

    const handleEnrich = async () => {
        if (!user) return;
        setIsEnriching(true);
        try {
            const { notes, error } = await leadService.enrichLead(lead.id, user.id);
            if (error) throw new Error(error);

            if (currentTenant?.id) {
                await fetch('/api/leads/enrich', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tenantId: currentTenant.id, leadId: lead.id }),
                }).catch(() => null);
            }

            if (notes) {
                setLeadNotes(notes);
                if (onLeadUpdate) onLeadUpdate({ ...lead, notes });
            }
            toast.success('Business intelligence gathered successfully!');
            fetchRelatedData();
        } catch (error: unknown) {
            toast.error('Research failed: ' + getErrorMessage(error));
        } finally {
            setIsEnriching(false);
        }
    };

    const handleScheduleCall = async () => {
        if (!lead.phone) {
            toast.error('No phone number available');
            return;
        }
        if (!user) {
            toast.error('You must be signed in to create tasks');
            return;
        }
        const { error } = await taskService.createTask(user.id, {
            title: `Call ${lead.businessName}`,
            description: `Phone: ${lead.phone}`,
            relatedToLead: lead.id,
            priority: 'high',
        });
        if (error) {
            toast.error('Failed to create call task');
            return;
        }
        toast.success('Call task created');
        fetchRelatedData();
    };

    const handleCopyEmail = async () => {
        if (!lead.email) return;
        await navigator.clipboard.writeText(lead.email);
        toast.success('Email copied');
    };

    const handleNextAction = () => {
        switch (nextAction.action) {
            case 'Send Outreach Email':
            case 'Find Contact Info':
                handleSendProviderEmail();
                break;
            case 'Qualify Lead':
                handleConvert(lead.businessName);
                break;
            case 'Enrich Data':
                void handleEnrich();
                break;
            case 'Schedule Follow-up':
            case 'Add Value Estimate':
                setActiveTab('tasks');
                setShowTaskForm(true);
                break;
            default:
                break;
        }
    };

    const handleCreateProject = async () => {
        if (!user) return;
        const name = window.prompt('Enter Project Name:', `Project: ${lead.businessName}`);
        if (!name) return;

        try {
            // STEP 1: Ensure we have a contact
            const { contactId, error: convertError } = await contactService.convertLeadToContact(lead.id, {
                createCompany: true,
                companyName: lead.businessName
            });

            if (convertError || !contactId) {
                throw new Error(convertError || 'Failed to prepare contact/company for project');
            }

            // STEP 2: Create project
            const { project, error: projectError } = await projectService.createProject({
                ownerId: user.id,
                ownerName: user.email?.split('@')[0] || 'User',
                name,
                category: 'Client Project',
                status: 'Active',
                currentStage: 'Initiation',
                progress: 0,
                team: [user.id],
                description: `Project initialized from lead discovery. \n\nTarget Business: ${lead.businessName}\nIndustry: ${lead.industry}\nIntelligence: ${lead.notes || 'None'}`,
                clientId: contactId, // Link to the contact
                contractStatus: 'None',
                startDate: new Date().toISOString().split('T')[0]
            });

            if (projectError) throw new Error(projectError);

            toast.success(`Project "${name}" initialized successfully!`);

            // Log activity
            await leadService.addLeadActivity(lead.id, user.id, 'project_created', `Project created: ${name}`, { projectId: project?.id });

            if (onLeadUpdate) onLeadUpdate({ ...lead, status: 'converted' });
            onClose();
        } catch (error: unknown) {
            toast.error('Failed to create project: ' + getErrorMessage(error));
        }
    };

    const handleExecuteFullFlow = async () => {
        const { supabase } = await import('../../../lib/supabase');
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) {
            toast.error("You must be logged in to execute leads");
            return;
        }

        const { tenantService } = await import('../../../services/tenancy/TenantService');
        let tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) {
            const { data: memberships } = await supabase
                .from('tenant_users')
                .select('tenant_id')
                .eq('user_id', authUser.id)
                .limit(1);
            tenantId = memberships?.[0]?.tenant_id || null;
            if (tenantId) {
                tenantService.setCurrentTenant(tenantId);
            }
        }

        if (!tenantId) {
            toast.error("No active organization found");
            return;
        }

        const toastId = toast.loading(`Executing full flow for ${lead.businessName}...`);
        setIsLoading(true);

        try {
            // 1. Validate Address (if not already done)
            if (!lead.isAddressValid && lead.location) {
                toast.loading('Validating address...', { id: toastId });
                const apiKey = getPublicGoogleMapsApiKey();
                const { valid, formattedAddress } = await googleMapsService.validateAddress(lead.location, apiKey);
                if (valid && formattedAddress) {
                    await leadService.updateLead(lead.id, { location: formattedAddress });
                    lead.location = formattedAddress; // Local update for subsequent steps
                }
            }

            // 2. AI Research / Enrichment (if notes are empty)
            if (!lead.notes || lead.notes.length < 10) {
                toast.loading('Gathering AI Market Intelligence...', { id: toastId });
                const { notes } = await leadService.enrichLead(lead.id, authUser.id);
                if (notes) lead.notes = notes;
            }

            // 3. Convert Lead to Client/Contact
            toast.loading('Converting to contact...', { id: toastId });
            const { contactId, error: conversionError } = await contactService.convertLeadToContact(lead.id, {
                createCompany: true,
                companyName: lead.businessName
            });
            if (conversionError) throw new Error(conversionError);
            if (!contactId) throw new Error("Conversion failed to return a contact ID");

            // 4. Create Deal
            toast.loading('Initializing deal...', { id: toastId });
            const { deal, error: dealError } = await dealService.createDeal(authUser.id, {
                name: `${lead.businessName} Deal`,
                value: lead.value || 0,
                stage: 'qualified',
                contactId: contactId
            });
            if (dealError) throw new Error(`Deal step failed: ${dealError}`);
            if (!deal) throw new Error("Deal creation failed");

            // 5. Create Quote
            toast.loading('Generating initial quote...', { id: toastId });
            const { quote, error: quoteError } = await quoteService.createQuote(authUser.id, {
                name: `${lead.businessName} Initial Quote`,
                contactId: contactId,
                dealId: deal.id,
                currency: 'USD',
                validForDays: 30
            });
            if (quoteError) throw new Error(`Quote step failed: ${quoteError}`);
            if (!quote) throw new Error("Quote creation failed");

            // 6. Add initial quote item
            const { error: quoteItemError } = await quoteService.addQuoteItem(quote.id, {
                productName: 'Professional Services',
                description: 'Solutions implementation and strategy',
                quantity: 1,
                unitPrice: lead.value || 0
            });
            if (quoteItemError) throw new Error(`Quote item step failed: ${quoteItemError}`);

            // 7. Create Project
            toast.loading('Launching project board...', { id: toastId });
            const { error: projectError } = await projectService.createProject({
                ownerId: authUser.id,
                ownerName: authUser.user_metadata?.name || authUser.email || 'System',
                name: `${lead.businessName} Implementation`,
                description: `Project for ${lead.businessName} initiated from lead execution flow. \n\nIndustry: ${lead.industry}\nResearch: ${lead.notes || 'Gathered during flow'}`,
                status: 'Active',
                category: lead.industry || 'General',
                currentStage: 'Planning',
                progress: 0,
                team: [authUser.id],
                clientId: contactId,
                startDate: new Date().toISOString().split('T')[0]
            });
            if (projectError) throw new Error(`Project step failed: ${projectError}`);

            toast.success(`Successfully executed full flow for ${lead.businessName}!`, { id: toastId });
            if (onLeadUpdate) onLeadUpdate({ ...lead, status: 'converted', stage: 'converted' });
            setTimeout(() => onClose(), 2000); // Give user a moment to see success
        } catch (err: unknown) {
            const message = getErrorMessage(err);
            console.error("Execution error", err);
            toast.error(`Execution failed: ${message}`, { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendProviderEmail = async () => {
        if (!lead.email) {
            toast.error('Lead does not have an email address');
            return;
        }
        if (!user?.id) {
            toast.error('You must be logged in to send email');
            return;
        }

        const subject = `Strategic proposal for ${lead.businessName}`;
        const body =
            lead.outreachMessage && lead.outreachMessage.trim().length > 0
                ? lead.outreachMessage
                : `Hello ${lead.businessName},\n\nI am reaching out to discuss how we can support your goals in ${lead.industry || 'your industry'}.\n\nPlease let me know if you are available for a short call this week.\n\nRegards,\n${user.email || 'Sales Team'}`;

        setEmailDraft({
            to: lead.email,
            subject,
            body,
        });
        setShowEmailComposer(true);
    };

    const handleValidateAddress = async () => {
        if (!lead.location) {
            toast.error('No address to validate');
            return;
        }

        setIsValidatingAddress(true);
        const toastId = toast.loading("Validating address with Google API...");

        try {
            const apiKey = getPublicGoogleMapsApiKey();
            const { valid, formattedAddress, location, error } = await googleMapsService.validateAddress(lead.location, apiKey);

            if (error) throw new Error(error);

            if (valid && formattedAddress) {
                const updates: Partial<Lead> = {
                    location: formattedAddress,
                    isAddressValid: true,
                    lat: location?.lat,
                    lng: location?.lng
                };

                const { error: updateError } = await leadService.updateLead(lead.id, updates);
                if (updateError) throw new Error(updateError);

                toast.success('Address is valid and deliverable!', { id: toastId });
                if (onLeadUpdate) onLeadUpdate({ ...lead, ...updates });

                // Log activity
                if (user) {
                    await leadService.addLeadActivity(lead.id, user.id, 'verification', 'Address validated via Google Maps');
                }
            } else {
                toast.error('Address could not be fully validated. Please check the details.', { id: toastId });
            }
        } catch (error: unknown) {
            console.error("Validation error", error);
            toast.error('Validation failed: ' + getErrorMessage(error), { id: toastId });
        } finally {
            setIsValidatingAddress(false);
        }
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const colors: any = {
            new: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
            contacted: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
            qualified: 'bg-green-500/10 text-green-500 border-green-500/20',
            lost: 'bg-red-500/10 text-red-500 border-red-500/20',
        };
        return (
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[status.toLowerCase()] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                {status.toUpperCase()}
            </span>
        );
    };

    const handleSaveLeadEdit = async () => {
        setIsLoading(true);
        try {
            const stageChanged = editForm.stage !== (lead.stage || 'lead');
            const { error } = await leadService.updateLead(lead.id, {
                businessName: editForm.businessName,
                email: editForm.email,
                phone: editForm.phone,
                industry: editForm.industry,
                location: editForm.location,
                source: editForm.source,
                stage: editForm.stage,
                stageReason: stageChanged ? stageChangeReason : undefined,
            });
            if (error) throw new Error(error);
            const updatedLead: Lead = {
                ...lead,
                businessName: editForm.businessName,
                email: editForm.email,
                phone: editForm.phone,
                industry: editForm.industry,
                location: editForm.location,
                source: editForm.source,
                stage: editForm.stage,
                status: editForm.stage === 'lead' ? 'New' : editForm.stage,
            };
            onLeadUpdate?.(updatedLead);
            if (stageChanged && stageChangeReason.trim() && user?.id) {
                await leadService.addLeadActivity(
                    lead.id,
                    user.id,
                    'stage_change',
                    `Stage moved from ${lead.stage || 'lead'} to ${editForm.stage}`,
                    {
                        old_stage: lead.stage || 'lead',
                        new_stage: editForm.stage,
                        reason: stageChangeReason.trim(),
                    }
                );
            }
            toast.success('Lead updated');
            setShowEditForm(false);
            setStageChangeReason('');
        } catch (error: unknown) {
            toast.error('Failed to update lead: ' + getErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteLead = async () => {
        if (!window.confirm(`Delete lead "${lead.businessName}"? This cannot be undone.`)) return;
        setIsLoading(true);
        try {
            const { error } = await leadService.deleteLead(lead.id);
            if (error) throw new Error(error);
            toast.success('Lead deleted');
            onLeadDelete?.(lead.id);
            onClose();
        } catch (error: unknown) {
            toast.error('Failed to delete lead: ' + getErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <DetailDrawer
            open={isOpen}
            onOpenChange={(open) => { if (!open) onClose(); }}
            title={lead.businessName}
            description={lead.industry || 'Lead details'}
            size="wide"
        >
            <div className="flex flex-col min-h-0">
                <div className="px-3 sm:px-4 pt-2 bg-slate-900">
                    <RecordHeader
                        moduleId="leads"
                        title={lead.businessName}
                        subtitle={lead.industry || undefined}
                        status={
                            <>
                                <StatusBadge status={lead.status || 'New'} />
                                {getStageBadge(lead.stage || 'lead')}
                                {verificationBadge ? (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${verificationBadge.className}`}>
                                        <CheckCircle2 className="w-3 h-3" />
                                        {verificationBadge.label}
                                        {lead.metadata?.verification?.score != null && (
                                            <span className="opacity-80">· {lead.metadata.verification.score}</span>
                                        )}
                                    </span>
                                ) : null}
                                {lead.isVerified && !verificationBadge ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        <CheckCircle2 className="w-3 h-3" />
                                        VERIFIED
                                    </span>
                                ) : null}
                            </>
                        }
                        meta={
                            <>
                                {lead.location ? (
                                    <span className="inline-flex items-center gap-1" title={lead.location}>
                                        <MapPin className="w-3 h-3 text-amber-500" />
                                        {lead.location}
                                    </span>
                                ) : null}
                                {lead.website ? (
                                    <a
                                        href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 hover:text-[var(--brand-blue-400)] transition-colors"
                                    >
                                        <Globe className="w-3 h-3" /> Website
                                    </a>
                                ) : null}
                                {lead.email ? <span>{lead.email}</span> : null}
                            </>
                        }
                        actions={
                            <AskBonnieButton
                                compact
                                mode="summarise"
                                contexts={[
                                    { type: 'Lead', id: lead.id, label: lead.businessName },
                                    ...(lead.industry ? [{ type: 'Industry', label: lead.industry }] : []),
                                ]}
                            />
                        }
                    />
                </div>

                {/* Header actions */}
                <div className="px-3 sm:px-4 py-2 border-b border-slate-800 flex flex-col lg:flex-row justify-between items-start gap-2 bg-slate-900">
                    <div className="min-w-0 text-xs text-slate-500 lg:pt-2">
                        Quick actions for this lead
                    </div>

                    {/* Actions */}
                    <div className="w-full lg:w-auto flex flex-col items-start lg:items-end gap-1.5 rounded-lg border border-white/5 bg-slate-900/40 px-2 py-1.5">
                        <div className="self-start">
                            <span className="inline-flex h-5 items-center rounded-full border border-white/5 bg-slate-950/70 px-2 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">
                                Quick actions
                            </span>
                        </div>
                        <CRMActionChips
                            items={[
                                {
                                    label: 'Email',
                                    icon: Mail,
                                    tone: 'indigo',
                                    onClick: handleSendProviderEmail,
                                    disabled: !lead.email,
                                },
                                {
                                    label: 'Schedule',
                                    icon: Calendar,
                                    tone: 'amber',
                                    onClick: handleScheduleCall,
                                    disabled: !lead.phone,
                                },
                                {
                                    label: 'Call',
                                    icon: Phone,
                                    tone: 'teal',
                                    onClick: () => {
                                        if (!lead.phone) {
                                            toast.error('No phone number on file.');
                                            return;
                                        }
                                        window.open(`tel:${lead.phone}`, '_self');
                                    },
                                    disabled: !lead.phone,
                                },
                            ]}
                        />
                        <div className="flex w-full flex-wrap items-center gap-1.5 lg:justify-end">
                            <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEnrich}
                            isLoading={isEnriching}
                            className="border-[var(--brand-blue-500)]/30 text-[var(--brand-blue-400)] hover:bg-[var(--brand-blue-500)]/10"
                        >
                            <Bot className="w-4 h-4 mr-2" />
                            Research
                        </Button>

                        {lead.status !== 'converted' && (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                    const name = window.prompt('Enter Deal Name:', lead.businessName);
                                    if (name) handleConvert(name);
                                }}
                                className="bg-amber-600 hover:bg-amber-500 shadow-amber-500/10 border-amber-500/20"
                            >
                                <Zap className="w-4 h-4 mr-2" />
                                Convert
                            </Button>
                        )}

                        <Dropdown
                            trigger={
                                <Button variant="outline" size="sm" className="px-2">
                                    <MoreVertical className="w-4 h-4" />
                                </Button>
                            }
                            items={[
                                {
                                    label: showEditForm ? 'Close Edit' : 'Edit Lead',
                                    icon: <FileText className="w-4 h-4" />,
                                    onClick: () => setShowEditForm(!showEditForm)
                                },
                                {
                                    label: 'Quick Task',
                                    icon: <CheckCircle2 className="w-4 h-4 text-yellow-500" />,
                                    onClick: () => {
                                        setActiveTab('tasks');
                                        setShowTaskForm(true);
                                    }
                                },
                                {
                                    label: 'Convert to Project',
                                    icon: <Layout className="w-4 h-4 text-[var(--brand-blue-500)]" />,
                                    onClick: handleCreateProject
                                },
                                {
                                    label: 'Generate Quote',
                                    icon: <FileText className="w-4 h-4 text-indigo-400" />,
                                    onClick: () => setShowQuoteForm(true)
                                },
                                {
                                    label: 'Convert to Deal',
                                    icon: <Zap className="w-4 h-4 text-amber-500" />,
                                    onClick: () => {
                                        const name = window.prompt('Enter Deal Name:', lead.businessName);
                                        if (name) handleConvert(name);
                                    }
                                },
                                {
                                    label: 'Pipeline View',
                                    icon: <ArrowRight className="w-4 h-4" />,
                                    onClick: () => {
                                        onClose();
                                        router.push(`/dashboard/deals?createFromLead=1&leadId=${encodeURIComponent(lead.id)}`);
                                    }
                                },
                                {
                                    label: 'Validate Address',
                                    icon: <MapPin className="w-4 h-4 text-blue-400" />,
                                    onClick: handleValidateAddress
                                },
                                {
                                    label: 'Execute Full Flow',
                                    icon: <Zap className="w-4 h-4 text-indigo-400" />,
                                    onClick: handleExecuteFullFlow,
                                    variant: 'default'
                                },
                                ...(onLeadDelete
                                    ? [{
                                        label: 'Delete Lead',
                                        icon: <AlertCircle className="w-4 h-4 text-rose-400" />,
                                        onClick: handleDeleteLead,
                                        variant: 'danger' as const,
                                    }]
                                    : []),
                            ]}
                        />
                        </div>
                    </div>
                </div>

                {/* Quick Quote Form Overlay/Inline */}
                {showQuoteForm && (
                    <div className="px-4 py-3 bg-indigo-900/20 border-b border-indigo-500/30 flex flex-wrap items-center gap-3">
                        <FileText className="w-5 h-5 text-indigo-400" />
                        <Input
                            placeholder="Quote Name (e.g. Website Redesign)"
                            value={newQuoteName}
                            onChange={(e) => setNewQuoteName(e.target.value)}
                            className="w-full sm:w-64"
                            autoFocus
                        />
                        <Input
                            placeholder="Amount (Opt)"
                            type="number"
                            value={newQuoteAmount}
                            onChange={(e) => setNewQuoteAmount(e.target.value)}
                            className="w-full sm:w-32"
                        />
                        <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0 ml-auto">
                            <Button variant="ghost" size="sm" onClick={() => setShowQuoteForm(false)}>Cancel</Button>
                            <Button size="sm" className="bg-indigo-600" onClick={handleGenerateQuote} isLoading={isLoading}>Generate</Button>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="px-4 sm:px-6 border-b border-slate-800 bg-slate-900/50 flex gap-4 sm:gap-6 overflow-x-auto scrollbar-hide">
                    {['overview', 'deals', 'history', 'tasks', 'meetings', 'notes'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab
                                ? 'border-[var(--brand-blue-500)] text-white'
                                : 'border-transparent text-slate-400 hover:text-slate-300'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
                    {showEditForm && (
                        <Card className="p-4 mb-5 border-[var(--brand-blue-500)]/30 bg-[var(--brand-blue-900)]/10">
                            <h3 className="text-sm font-semibold text-white mb-3">Edit lead details</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Input
                                    label="Business name"
                                    value={editForm.businessName}
                                    onChange={(e) => setEditForm((f) => ({ ...f, businessName: e.target.value }))}
                                />
                                <Input
                                    label="Email"
                                    value={editForm.email}
                                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                                />
                                <Input
                                    label="Phone"
                                    value={editForm.phone}
                                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                                />
                                <Input
                                    label="Industry"
                                    value={editForm.industry}
                                    onChange={(e) => setEditForm((f) => ({ ...f, industry: e.target.value }))}
                                />
                                <Input
                                    label="Location"
                                    value={editForm.location}
                                    onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                                />
                                <Input
                                    label="Source"
                                    value={editForm.source}
                                    onChange={(e) => setEditForm((f) => ({ ...f, source: e.target.value }))}
                                />
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-slate-300">Pipeline stage</label>
                                    <select
                                        value={editForm.stage}
                                        onChange={(e) => setEditForm((f) => ({ ...f, stage: e.target.value }))}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue-500)]/50 transition-all"
                                    >
                                        <option value="lead">Lead</option>
                                        <option value="qualified">Qualified</option>
                                        <option value="proposal">Proposal</option>
                                        <option value="negotiation">Negotiation</option>
                                        <option value="won">Won</option>
                                        <option value="lost">Lost</option>
                                    </select>
                                    <label className="block text-sm font-medium text-slate-300 mt-3">Reason for change</label>
                                    <textarea
                                        value={stageChangeReason}
                                        onChange={(e) => setStageChangeReason(e.target.value)}
                                        placeholder="Optional, but helpful when moving the lead backward for re-qualification."
                                        className="w-full min-h-[92px] bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue-500)]/50 transition-all resize-y"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <Button variant="ghost" size="sm" onClick={() => setShowEditForm(false)}>Cancel</Button>
                                <Button size="sm" onClick={handleSaveLeadEdit} isLoading={isLoading}>Save lead</Button>
                            </div>
                        </Card>
                    )}

                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <GhostIntelligence lead={lead} onAction={handleSendProviderEmail} />

                            <Card className="p-5 border-slate-800 bg-slate-900/40">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                    <div>
                                        <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Lead completeness</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className={`text-3xl font-bold ${getScoreColor(leadScore)}`}>{leadScore}</span>
                                            <span className="text-slate-500 text-sm">/ 100</span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleNextAction}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-slate-950/60 hover:bg-slate-800 transition-colors ${nextAction.color}`}
                                    >
                                        {nextAction.icon}
                                        <div className="text-left">
                                            <p className="text-sm font-semibold text-white">{nextAction.action}</p>
                                            <p className="text-[11px] text-slate-500">{nextAction.reason}</p>
                                        </div>
                                    </button>
                                </div>
                                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-[var(--brand-blue-500)] to-[var(--brand-blue-300)] transition-all duration-500"
                                        style={{ width: `${leadScore}%` }}
                                    />
                                </div>
                            </Card>

                            <CRMActionChips
                                items={[
                                    {
                                        label: 'Email',
                                        icon: Send,
                                        tone: 'indigo',
                                        onClick: handleSendProviderEmail,
                                        disabled: !lead.email,
                                    },
                                    {
                                        label: 'Schedule',
                                        icon: PhoneCall,
                                        tone: 'amber',
                                        onClick: handleScheduleCall,
                                        disabled: !lead.phone,
                                    },
                                    {
                                        label: 'Call',
                                        icon: Phone,
                                        tone: 'teal',
                                        onClick: () => {
                                            if (!lead.phone) return;
                                            window.open(`tel:${lead.phone}`, '_self');
                                        },
                                        disabled: !lead.phone,
                                    },
                                ]}
                            />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-6 space-y-4">
                                <h3 className="text-lg font-semibold text-white mb-4">Contact Info</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-slate-300">
                                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                                            <Mail className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <span>{lead.email || 'No email'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-300">
                                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                                            <Phone className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <span>{lead.phone || 'No phone'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-300">
                                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                                            <Globe className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <div className="flex-1 overflow-hidden truncate">
                                            {lead.website ? (
                                                <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="text-[var(--brand-blue-400)] hover:text-[var(--brand-blue-300)] transition-colors">
                                                    {lead.website}
                                                </a>
                                            ) : (
                                                <span className="text-slate-500 italic text-sm">No website available</span>
                                            )}
                                        </div>
                                    </div>
                                    {lead.location && (
                                        <div className="flex items-start gap-3 text-slate-300 group">
                                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                                                <MapPin className="w-4 h-4 text-amber-500" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs text-slate-500 uppercase font-bold tracking-tighter mb-0.5">Address</span>
                                                <span className="text-sm leading-relaxed whitespace-pre-wrap">{lead.location}</span>
                                                {lead.isAddressValid && (
                                                    <span className="text-xs text-emerald-400 flex items-center gap-1 mt-1 font-mono uppercase font-bold">
                                                        <CheckSquare className="w-2.5 h-2.5" /> Google Verified
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Card>

                            {lead.isVerified && (
                                <Card className="p-6 border-emerald-500/20 bg-emerald-500/5">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                            AI Verification
                                        </h3>
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Trust Score</span>
                                            <div className="text-2xl font-bold text-emerald-400">{lead.trustScore}%</div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 transition-all duration-1000"
                                                style={{ width: `${lead.trustScore}%` }}
                                            />
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <div className="p-3 bg-slate-900/50 rounded-lg border border-white/5">
                                                <p className="text-sm text-slate-300 italic leading-relaxed">
                                                    <span className="text-emerald-400 font-bold not-italic font-mono mr-2 uppercase tracking-tighter">Technical Audit:</span>
                                                    {lead.verificationNotes || "Data matches typical patterns for a legitimate business in this region."}
                                                </p>
                                            </div>

                                            {lead.sdrInsight && (
                                                <div className="p-3 bg-[var(--brand-blue-500)]/5 rounded-lg border border-[var(--brand-blue-500)]/10">
                                                    <p className="text-sm text-slate-200 leading-relaxed">
                                                        <span className="text-[var(--brand-blue-400)] font-bold font-mono mr-2 uppercase tracking-tighter">SDR Strategy:</span>
                                                        {lead.sdrInsight}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-widest font-bold">
                                            <Zap className="w-3 h-3 text-yellow-500" />
                                            Authenticity Confirmed by AlphaClone Senior SDR
                                        </div>
                                    </div>
                                </Card>
                            )}

                            <div className="space-y-6">
                                <Card className="p-6 bg-indigo-900/10 border-indigo-500/20">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                            <Target className="w-5 h-5 text-indigo-400" />
                                            Conversion Intelligence
                                        </h3>
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs text-slate-400 uppercase tracking-widest font-black mb-1">Response Probability</span>
                                            <div className="text-3xl font-black text-indigo-400">
                                                {lead.responseProbability || lead.intelligenceScore || 0}%
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                                style={{ width: `${lead.responseProbability || lead.intelligenceScore || 0}%` }}
                                            />
                                        </div>
                                        
                                        <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                                            <span className="text-xs font-black text-indigo-400 uppercase tracking-widest block mb-2">AlphaClone Strategy Analysis</span>
                                            <p className="text-sm text-slate-300 leading-relaxed">
                                                {lead.hookAnalysis || "The Sales Agent predicts a high response rate based on industry intent and pain point alignment. Use the pattern-interrupting hook below for maximum conversion."}
                                            </p>
                                        </div>
                                    </div>
                                </Card>

                                <Card className="p-6">
                                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                        <Bot className="w-5 h-5 text-[var(--brand-blue-400)]" />
                                        AI Deep Research
                                    </h3>
                                    <div className="p-4 bg-slate-900 border border-white/5 rounded-lg">
                                        <p className="text-slate-300 text-sm leading-relaxed">
                                            {lead.notes || "No AI research available yet. Run research to gather market intelligence."}
                                        </p>
                                    </div>
                                </Card>

                                {lead.outreachHook && (
                                    <Card className="p-6 border-purple-500/30 bg-indigo-500/5">
                                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                            <Zap className="w-5 h-5 text-purple-400" />
                                            Strategic Hook
                                        </h3>
                                        <div className="p-4 bg-slate-900/50 rounded-lg border border-purple-500/20">
                                            <p className="text-purple-200 text-sm font-medium italic">
                                                "{lead.outreachHook}"
                                            </p>
                                        </div>
                                        {lead.strategy && (
                                            <div className="mt-3 flex items-center gap-2">
                                                <Badge variant="neutral" className="bg-purple-500/20 border-purple-500/30 text-purple-300 text-xs py-0">
                                                    STRATEGY: {lead.strategy.replace('_', ' ')}
                                                </Badge>
                                            </div>
                                        )}
                                    </Card>
                                )}

                                {( (lead.techStack && lead.techStack.length > 0) || (lead.painPoints && lead.painPoints.length > 0) || lead.valueProposition) && (
                                    <Card className="p-6 bg-slate-900/40">
                                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                            <Database className="w-5 h-5 text-blue-400" />
                                            Business Intelligence
                                        </h3>
                                        <div className="grid grid-cols-1 gap-5">
                                            {lead.valueProposition && (
                                                <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                                                    <span className="text-xs text-blue-400 uppercase font-bold tracking-widest block mb-1">Tailored Value Prop</span>
                                                    <p className="text-sm text-slate-300 leading-relaxed">{lead.valueProposition}</p>
                                                </div>
                                            )}
                                            
                                            {lead.techStack && lead.techStack.length > 0 && (
                                                <div>
                                                    <span className="text-xs text-slate-500 uppercase font-bold tracking-widest block mb-2">Tech Stack</span>
                                                    <div className="flex flex-wrap gap-2">
                                                        {lead.techStack.map((tech, i) => (
                                                            <Badge key={i} variant="blue" className="bg-blue-500/10 border-blue-500/20 text-blue-400 font-mono text-xs">
                                                                {tech}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {lead.painPoints && lead.painPoints.length > 0 && (
                                                <div>
                                                    <span className="text-xs text-slate-500 uppercase font-bold tracking-widest block mb-2">Pain Points</span>
                                                    <div className="space-y-2">
                                                        {lead.painPoints.map((point, i) => (
                                                            <div key={i} className="flex items-start gap-2 text-sm text-slate-300 bg-slate-900/50 p-2 rounded border border-white/5">
                                                                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                                {point}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                )}

                                {lead.outreachMessage && (
                                    <Card className="p-6 bg-slate-900/40 border-slate-800">
                                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                            <Send className="w-5 h-5 text-[var(--brand-blue-400)]" />
                                            Outreach Draft
                                        </h3>
                                        <div className="p-4 bg-slate-950 border border-slate-700/50 rounded-lg">
                                            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap italic">
                                                "{lead.outreachMessage}"
                                            </p>
                                        </div>
                                        <div className="mt-4 flex justify-end">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-xs border-slate-700 hover:bg-slate-800"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(lead.outreachMessage || '');
                                                    toast.success('Draft copied to clipboard');
                                                }}
                                            >
                                                Copy Draft
                                            </Button>
                                        </div>
                                    </Card>
                                )}
                            </div>
                        </div>
                        </div>
                    )}

                    {activeTab === 'deals' && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white">Related Deals</h3>
                            {relatedDeals.length === 0 ? (
                                <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                                    <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                    <p>No deals linked to this lead yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {relatedDeals.map((deal) => (
                                        <Card key={deal.id} className="p-4 flex items-center justify-between gap-3 border-slate-800">
                                            <div>
                                                <p className="font-medium text-white">{deal.name || deal.title}</p>
                                                <p className="text-xs text-slate-500 capitalize">{deal.stage || deal.status}</p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    onClose();
                                                    router.push(`/dashboard/deals?dealId=${encodeURIComponent(deal.id)}`);
                                                }}
                                            >
                                                Open <ArrowRight className="w-4 h-4 ml-1" />
                                            </Button>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'tasks' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                                <h3 className="text-lg font-semibold text-white">Tasks</h3>
                                <Button size="sm" onClick={() => setShowTaskForm(true)} className="bg-[var(--brand-blue-600)] w-full sm:w-auto">
                                    <Plus className="w-4 h-4 mr-2" /> Add Task
                                </Button>
                            </div>

                            {/* Task Form */}
                            {showTaskForm && (
                                <Card className="p-4 mb-4 border-[var(--brand-blue-500)]/30 bg-[var(--brand-blue-900)]/10">
                                    <div className="space-y-3">
                                        <Input
                                            placeholder="What needs to be done?"
                                            value={newTaskTitle}
                                            onChange={(e) => setNewTaskTitle(e.target.value)}
                                            autoFocus
                                        />
                                        <div className="flex gap-3">
                                            <Input
                                                type="date"
                                                value={newTaskDueDate}
                                                onChange={(e) => setNewTaskDueDate(e.target.value)}
                                                className="w-48"
                                            />
                                            <div className="flex-1 flex justify-end gap-2">
                                                <Button variant="ghost" onClick={() => setShowTaskForm(false)}>Cancel</Button>
                                                <Button onClick={handleCreateTask}>Save Task</Button>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            )}

                            {/* Task List */}
                            <div className="space-y-2">
                                {tasks.length === 0 && !showTaskForm ? (
                                    <div className="text-center py-12 text-slate-500">
                                        <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No tasks yet. Create one to get started.</p>
                                    </div>
                                ) : (
                                    tasks.map(task => (
                                        <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-900/50 hover:bg-slate-900 rounded-lg border border-slate-800 group transition-colors">
                                            <button
                                                onClick={() => handleToggleTask(task.id, task.status)}
                                                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${task.status === 'completed' ? 'bg-[var(--brand-blue-500)] border-[var(--brand-blue-500)]' : 'border-slate-600 hover:border-[var(--brand-blue-500)]'}`}
                                            >
                                                {task.status === 'completed' && <CheckSquare className="w-3 h-3 text-white" />}
                                            </button>
                                            <span className={`flex-1 ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                                {task.title}
                                            </span>
                                            {task.dueDate && (
                                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {format(new Date(task.dueDate), 'MMM d')}
                                                </span>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'meetings' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                                <h3 className="text-lg font-semibold text-white">Meetings</h3>
                                <Button size="sm" onClick={() => setShowMeetingForm(true)} className="bg-[var(--brand-blue-600)] w-full sm:w-auto">
                                    <Plus className="w-4 h-4 mr-2" /> Schedule Meeting
                                </Button>
                            </div>

                            {showMeetingForm && (
                                <Card className="p-4 mb-4 border-[var(--brand-blue-500)]/30 bg-[var(--brand-blue-900)]/10">
                                    <div className="space-y-3">
                                        <Input
                                            placeholder="Meeting Title"
                                            value={meetingTitle}
                                            onChange={(e) => setMeetingTitle(e.target.value)}
                                            autoFocus
                                        />
                                        <div className="flex gap-3">
                                            <Input
                                                type="date"
                                                value={meetingDate}
                                                onChange={(e) => setMeetingDate(e.target.value)}
                                                className="w-1/2"
                                            />
                                            <Input
                                                type="time"
                                                value={meetingTime}
                                                onChange={(e) => setMeetingTime(e.target.value)}
                                                className="w-1/2"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2">
                                            <Button variant="ghost" onClick={() => setShowMeetingForm(false)}>Cancel</Button>
                                            <Button onClick={handleScheduleMeeting}>Schedule</Button>
                                        </div>
                                    </div>
                                </Card>
                            )}

                            {/* Placeholder for list */}
                            <div className="text-center py-12 text-slate-500">
                                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>Scheduled meetings will appear on your main calendar.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notes' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                                <h3 className="text-base sm:text-lg font-semibold text-white">Lead Intelligence & Notes</h3>
                                <Button size="sm" onClick={handleSaveNotes} isLoading={isSavingNotes} className="bg-[var(--brand-blue-600)] w-full sm:w-auto">
                                    Save Changes
                                </Button>
                            </div>
                            <textarea
                                className="w-full h-[300px] bg-slate-900 border border-slate-800 rounded-2xl p-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue-500)]/50 transition-all font-mono text-sm leading-relaxed"
                                placeholder="Record meeting outcomes, strategic observations, or lead requirements here..."
                                value={leadNotes}
                                onChange={(e) => setLeadNotes(e.target.value)}
                            />
                            <div className="flex items-center gap-2 text-xs text-slate-500 italic mt-2">
                                <Bot className="w-4 h-4 text-[var(--brand-blue-400)]" />
                                <span>These notes are visible to all members of your team with access to this lead.</span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Activity Timeline</h3>
                            <div className="relative border-l-2 border-slate-800 ml-4 pl-8 space-y-8">
                                {activities.map((activity) => (
                                    <div key={activity.id} className="relative">
                                        <div className="absolute -left-[41px] top-0 w-5 h-5 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center">
                                            <div className={`w-2 h-2 rounded-full ${activity.type === 'stage_change' ? 'bg-[var(--brand-blue-500)]' : 'bg-blue-500'}`} />
                                        </div>
                                        <div className="glass-panel p-4 rounded-2xl border border-white/5">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="font-medium text-white">{activity.description}</p>
                                                <span className="text-xs text-slate-500">{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</span>
                                            </div>
                                            {activity.metadata?.old_stage && (
                                                <div className="space-y-2 mt-2 text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="neutral" className="text-xs opacity-60">{activity.metadata.old_stage.toUpperCase()}</Badge>
                                                        <ArrowRight className="w-3 h-3 text-slate-600" />
                                                        <Badge variant="blue" className="text-xs text-[var(--brand-blue-400)] border-[var(--brand-blue-500)]/20">{activity.metadata.new_stage.toUpperCase()}</Badge>
                                                    </div>
                                                    {activity.metadata.reason && (
                                                        <p className="text-slate-400 leading-relaxed">
                                                            Reason: {activity.metadata.reason}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {activities.length === 0 && (
                                    <div className="text-center py-12 text-slate-500">
                                        <HistoryIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No activity recorded yet for this lead.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showEmailComposer && user?.id && emailDraft && (
                <ComposeEmailModal
                    isOpen={true}
                    onClose={() => setShowEmailComposer(false)}
                    userId={user.id}
                    initialTo={emailDraft.to}
                    initialSubject={emailDraft.subject}
                    initialBody={emailDraft.body}
                />
            )}
        </DetailDrawer>
    );
}
