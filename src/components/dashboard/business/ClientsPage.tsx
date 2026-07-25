import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import Link from 'next/link';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { businessClientService, BusinessClient } from '../../../services/businessClientService';
import { clientActivityService } from '../../../services/clientActivityService';
import { fileImportService } from '../../../services/fileImportService';
import {
    Users,
    Plus,
    Search,
    Upload,
    Mail,
    Phone,
    Building,
    X,
    FileText,
    Download,
    Edit,
    Trash2,
    MoreVertical,
    FilePlus,
    Calendar,
    History,
    MessageSquare,
    Receipt,
    ChevronLeft,
    FileSpreadsheet,
    Grid3X3,
    CheckCircle2,
        Clock,
    Send,
    DollarSign,
    UserCheck,
    Target,
    CheckSquare,
    Square
} from 'lucide-react';
import AIOutreachModal from './AIOutreachModal';
import { Button, Input, Badge, Dropdown, Card } from '../../ui/UIComponents';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { RecordHeader, AskBonnieButton } from '@/components/ui/os';
import EmptyState, { EmptyStateFromPreset } from '@/components/ui/EmptyState';
import { CustomerTimeline } from '@/components/communication/CustomerTimeline';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../../../lib/supabase';
import { startClientVideoCall } from '@/services/instantMeetingService';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import { showActionNextSteps, showInvoiceCreatedWithSendPrompt } from '../../common/showActionNextSteps';
import CRMTab from '../CRMTab';
import { LayoutGrid, List } from 'lucide-react';
import { CommunicationModal } from '../crm/CommunicationModal';
import { launchFunnelService } from '@/services/launchFunnelService';
import { ModuleIntelligenceCard } from '../ModuleIntelligenceCard';
import { ModuleStatCards, type ModuleStat } from '../common/ModuleStatCards';
import { formatDistanceToNow } from 'date-fns';
import { BatchOutreachFAB } from './BatchOutreachFAB';
import { BatchOutreachPanel } from './BatchOutreachPanel';
import { CRMNav } from '../crm/CRMNav';

const KanbanBoard = lazy(() => import('../crm/KanbanBoard'));
const DealsTab = lazy(() => import('../DealsTab'));
const ContactsList = lazy(() => import('../crm/ContactsList'));

type ContactDirectoryView = 'sales' | 'email';

interface ClientsPageProps {
    user: User;
}

const ClientsPage: React.FC<ClientsPageProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const router = useRouter();
    const pathname = usePathname() || '';
    const [clients, setClients] = useState<BusinessClient[]>([]);
    const [filteredClients, setFilteredClients] = useState<BusinessClient[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStage, setSelectedStage] = useState<string>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingClient, setEditingClient] = useState<BusinessClient | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [viewMode, setViewMode] = useState<'list' | 'board' | 'micro'>('list');
    const [showProposalModal, setShowProposalModal] = useState(false);
    const [selectedClientForProposal, setSelectedClientForProposal] = useState<BusinessClient | null>(null);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [selectedClientForInvoice, setSelectedClientForInvoice] = useState<BusinessClient | null>(null);
    const [showCommunicationModal, setShowCommunicationModal] = useState(false);
    const [selectedClientForCommunication, setSelectedClientForCommunication] = useState<BusinessClient | null>(null);
    const [selectedClient, setSelectedClient] = useState<BusinessClient | null>(null);
    const [clientTimeline, setClientTimeline] = useState<any>(null);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'timeline' | 'notes' | 'invoices' | 'properties'>('timeline');
    const [newNoteTitle, setNewNoteTitle] = useState('');
    const [newNoteDescription, setNewNoteDescription] = useState('');
    const [noteSubmitting, setNoteSubmitting] = useState(false);
    const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
    const [showOutreachModal, setShowOutreachModal] = useState(false);
    const [showOutreachPanel, setShowOutreachPanel] = useState(false);
    const [page, setPage] = useState(1);
    const [showArchived, setShowArchived] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [directoryView, setDirectoryView] = useState<ContactDirectoryView>('sales');

    const searchParams = useSearchParams();
    const stageParam = searchParams?.get('stage');
    const contactParam = searchParams?.get('contact') ?? searchParams?.get('contactId');
    const directoryParam = searchParams?.get('directory');
    const PAGE_SIZE = 500;

    const loadClientTimeline = useCallback(async (clientId: string) => {
        setTimelineLoading(true);
        try {
            const { timeline } = await clientActivityService.getClientTimeline(clientId);
            setClientTimeline(timeline);
        } catch (err) {
            console.error('Failed to load client timeline:', err);
        } finally {
            setTimelineLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedClient?.id) {
            void loadClientTimeline(selectedClient.id);
            setActiveTab('timeline'); // Reset tab on change
        } else {
            setClientTimeline(null);
        }
    }, [selectedClient, loadClientTimeline]);

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClient?.id || !newNoteTitle.trim()) return;

        setNoteSubmitting(true);
        try {
            const { activity, error } = await clientActivityService.addClientNote(
                selectedClient.id,
                newNoteTitle.trim(),
                newNoteDescription.trim(),
                user.id
            );

            if (error) {
                toast.error(`Failed to add note: ${error}`);
            } else {
                toast.success('Note added successfully!');
                setNewNoteTitle('');
                setNewNoteDescription('');
                void loadClientTimeline(selectedClient.id);
            }
        } catch (err) {
            console.error('Note add error:', err);
            toast.error('An error occurred.');
        } finally {
            setNoteSubmitting(false);
        }
    };

    const loadClients = useCallback(async (isInitial = true) => {
        if (!currentTenant) return;
        if (isInitial) setLoading(true);

        const targetPage = isInitial ? 1 : page + 1;
        const { clients: data, count } = await businessClientService.getClients(
            currentTenant.id,
            targetPage,
            PAGE_SIZE,
            showArchived,
            searchTerm
        );

        if (isInitial) {
            setClients(data);
            setPage(1);
        } else {
            setClients(prev => [...prev, ...data]);
            setPage(targetPage);
        }

        setTotalCount(count);
        setHasMore(data.length === PAGE_SIZE);
        setLoading(false);
    }, [currentTenant, page, showArchived, searchTerm]);

    useEffect(() => {
        if (!currentTenant) return;
        if (['/dashboard/crm', '/dashboard/leads', '/dashboard/deals'].includes(pathname)) {
            setLoading(false);
            return;
        }
        void loadClients(true);
    }, [currentTenant, pathname, showArchived]); // searchTerm is omitted to avoid re-fetching on every keystroke; we'll use a manual search button or debounce if needed

    useEffect(() => {
        if (stageParam) {
            setSelectedStage(stageParam);
        }
    }, [stageParam]);

    useEffect(() => {
        if (!contactParam || clients.length === 0) return;
        const match = clients.find((c) => c.id === contactParam);
        if (match) {
            setSelectedClient(match);
            setViewMode('list');
            const base =
                pathname === '/dashboard/business/clients' ? '/dashboard/business/clients' : '/dashboard/contacts';
            router.replace(base, { scroll: false });
        }
    }, [contactParam, clients, pathname, router]);

    useEffect(() => {
        if (searchParams?.get('add') === 'true') {
            setShowAddModal(true);
            const params = new URLSearchParams(searchParams.toString());
            params.delete('add');
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
    }, [searchParams, pathname, router]);

    useEffect(() => {
        if (pathname === '/dashboard/crm/unified-contacts') {
            const base = pathname.includes('business') ? '/dashboard/business/clients' : '/dashboard/contacts';
            router.replace(`${base}?directory=email`, { scroll: false });
            return;
        }
        if (directoryParam === 'email') setDirectoryView('email');
        else if (directoryParam === 'sales') setDirectoryView('sales');
    }, [pathname, directoryParam, router]);

    const contactsBasePath =
        pathname === '/dashboard/business/clients' ? '/dashboard/business/clients' : '/dashboard/contacts';

    const setDirectoryViewAndUrl = (view: ContactDirectoryView) => {
        setDirectoryView(view);
        router.replace(`${contactsBasePath}?directory=${view}`, { scroll: false });
    };

    const directorySwitcher = (
        <div className="space-y-2">
            <div className="flex gap-1 p-1 bg-slate-900/80 border border-slate-800 rounded-xl w-full sm:w-fit">
                <button
                    type="button"
                    onClick={() => setDirectoryViewAndUrl('sales')}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                        directoryView === 'sales' ? 'bg-[var(--brand-blue-600)] text-white' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    Sales pipeline
                </button>
                <button
                    type="button"
                    onClick={() => setDirectoryViewAndUrl('email')}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                        directoryView === 'email' ? 'bg-[var(--brand-blue-600)] text-white' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    Email list
                </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
                {directoryView === 'sales'
                    ? 'Clients and prospects in your pipeline — tie to deals, invoices, and outreach.'
                    : 'Imported and campaign contacts for email and SMS. These are separate from sales pipeline records.'}
            </p>
        </div>
    );

    useEffect(() => {
        let filtered = clients;
        if (selectedStage !== 'all') {
            filtered = filtered.filter((c) => c.salesStage === selectedStage);
        }
        setFilteredClients(filtered);
    }, [clients, selectedStage]);

    const totalClientValue = clients.reduce((sum, c) => sum + (c.value || 0), 0);
    const activeClientsCount = clients.filter((c) => c.salesStage !== 'lost').length;
    const customerCount = clients.filter((c) => c.salesStage === 'customer').length;
    const prospectCount = clients.filter((c) => c.salesStage === 'prospect').length;

    const contactStats = useMemo<ModuleStat[]>(
        () => [
            {
                label: 'Total Contacts',
                value: totalCount || clients.length,
                sub: `${customerCount} customers`,
                Icon: Users,
                accent: 'teal',
            },
            {
                label: 'Pipeline Value',
                value: `$${totalClientValue.toLocaleString()}`,
                sub: 'Combined contact value',
                Icon: DollarSign,
                accent: 'emerald',
            },
            {
                label: 'Active',
                value: activeClientsCount,
                sub: 'Excluding lost',
                Icon: UserCheck,
                accent: 'blue',
            },
            {
                label: 'Prospects',
                value: prospectCount,
                sub: `${clients.filter((c) => c.salesStage === 'lead').length} leads`,
                Icon: Target,
                accent: 'purple',
            },
        ],
        [clients, totalCount, totalClientValue, activeClientsCount, customerCount, prospectCount]
    );

    const handleAddClient = async (clientData: Partial<BusinessClient>) => {
        if (!currentTenant) return;

        const { client, error } = await businessClientService.createClient(currentTenant.id, clientData);
        if (!error && client) {
            void launchFunnelService.completeStep('first_contact_captured', user.id, currentTenant.id, {
                source: 'contacts_page',
                clientId: client.id,
            });
            setClients([client, ...clients]);
            setShowAddModal(false);
        }
    };

    const handleEditClient = async (clientId: string, updates: Partial<BusinessClient>) => {
        const { error } = await businessClientService.updateClient(clientId, updates);
        if (!error) {
            setClients(clients.map(c => c.id === clientId ? { ...c, ...updates } : c));
            setShowEditModal(false);
            setEditingClient(null);
            toast.success('Client updated successfully!');

            // Audit Trail
            if (currentTenant) {
                import('../../../services/activityService').then(({ activityService }) => {
                    activityService.logSystemAction(
                        user.id,
                        'EDIT',
                        `Updated client details for ${updates.name || 'a contact'}`,
                        { clientId, updates },
                        currentTenant.id
                    );
                });
            }
        } else {
            toast.error('Failed to update client');
        }
    };

    // ── One-click stage conversion (no modal) ────────────────────────────────
    const STAGE_PIPELINE: { id: string; label: string; next?: string }[] = [
        { id: 'lead',     label: 'Lead',     next: 'prospect' },
        { id: 'prospect', label: 'Prospect', next: 'customer' },
        { id: 'customer', label: 'Customer' },
        { id: 'lost',     label: 'Lost' },
    ];

    const handleStageConvert = async (client: BusinessClient, newStage: string) => {
        const prev = client.salesStage;
        // Optimistic update
        setClients(cs => cs.map(c => c.id === client.id ? { ...c, salesStage: newStage as BusinessClient['salesStage'] } : c));
        if (selectedClient?.id === client.id) setSelectedClient(s => s ? { ...s, salesStage: newStage as BusinessClient['salesStage'] } : s);
        const { error } = await businessClientService.updateClient(client.id, { salesStage: newStage as BusinessClient['salesStage'] });
        if (error) {
            // Rollback on error
            setClients(cs => cs.map(c => c.id === client.id ? { ...c, salesStage: prev as BusinessClient['salesStage'] } : c));
            if (selectedClient?.id === client.id) setSelectedClient(s => s ? { ...s, salesStage: prev as BusinessClient['salesStage'] } : s);
            toast.error('Stage update failed');
        } else {
            toast.success(`${client.name} → ${newStage.charAt(0).toUpperCase() + newStage.slice(1)}`);

            // Audit Trail
            if (currentTenant) {
                import('../../../services/activityService').then(({ activityService }) => {
                    activityService.logSystemAction(
                        user.id,
                        'EDIT',
                        `Converted ${client.name} stage from ${prev} to ${newStage}`,
                        { clientId: client.id, prevStage: prev, newStage },
                        currentTenant.id
                    );
                });
            }
        }
    };

    // ── Export all contacts to Excel ──────────────────────────────────
    const handleExportExcel = async () => {
        if (filteredClients.length === 0) {
            toast.error('No contacts to export');
            return;
        }
        const cleanExportText = (value: string) => {
            let t = String(value || '');
            t = t.replace(/\r\n/g, '\n');
            t = t.replace(/```[\s\S]*?```/g, '');
            t = t.replace(/`([^`]+)`/g, '$1');
            t = t.replace(/^#{1,6}\s+/gm, '');
            t = t.replace(/^\s*[-*+]\s+/gm, '• ');
            t = t.replace(/^\s*\d+\.\s+/gm, '• ');
            t = t.replace(/[*_~#]+/g, '');
            t = t.replace(/[^\S\n]+/g, ' ');
            return t.trim();
        };
        const rows = filteredClients.map(c => ({
            Name: cleanExportText(c.name),
            Email: cleanExportText(c.email || ''),
            Phone: cleanExportText(c.phone || ''),
            Industry: cleanExportText(c.industry || ''),
            Stage: c.salesStage,
            Value: c.value,
            Location: cleanExportText(c.location || ''),
            Website: cleanExportText(c.website || ''),
            Description: cleanExportText(c.description || ''),
            Created: new Date(c.createdAt).toLocaleDateString(),
        }));
        const toCsvValue = (value: unknown) => {
            const raw = value == null ? '' : String(value);
            const escaped = raw.replace(/"/g, '""');
            if (/[",\r\n]/.test(escaped)) return `"${escaped}"`;
            return escaped;
        };

        const headers = Object.keys(rows[0] || {});
        const lines: string[] = [];
        lines.push(headers.map((h) => toCsvValue(h)).join(','));
        rows.forEach((row) => {
            lines.push(headers.map((h) => toCsvValue((row as any)[h])).join(','));
        });

        const csv = lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `alphaclone-contacts-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${filteredClients.length} contacts to CSV`);

        // Audit Trail
        if (currentTenant) {
            import('../../../services/activityService').then(({ activityService }) => {
                activityService.logSystemAction(
                    user.id,
                    'EXPORT',
                    `Exported ${filteredClients.length} contacts to CSV`,
                    { count: filteredClients.length },
                    currentTenant.id
                );
            });
        }
    };

    const handleArchiveClient = async (clientId: string) => {
        const verb = showArchived ? 'unarchive' : 'archive';
        if (!confirm(`Are you sure you want to ${verb} this contact?`)) return;

        const clientToUpdate = clients.find(c => c.id === clientId);
        // Using updateClient directly for archive/unarchive logic if deleteClient is just setting isActive
        const { error } = await businessClientService.updateClient(clientId, { isActive: showArchived });

        if (!error) {
            setClients(clients.filter(c => c.id !== clientId));
            toast.success(`Client ${verb}d successfully!`);

            // Audit Trail
            if (currentTenant) {
                import('../../../services/activityService').then(({ activityService }) => {
                    activityService.logSystemAction(
                        user.id,
                        'EDIT',
                        `${showArchived ? 'Unarchived' : 'Archived'} client: ${clientToUpdate?.name || clientId}`,
                        { clientId, name: clientToUpdate?.name, action: verb },
                        currentTenant.id
                    );
                });
            }
        } else {
            toast.error(`Failed to ${verb} client`);
        }
    };

    const toggleClientSelection = (clientId: string) => {
        setSelectedClientIds((prev) => {
            if (prev.includes(clientId)) return prev.filter((id) => id !== clientId);
            if (prev.length >= 500) {
                toast.error('Maximum 500 contacts can be selected');
                return prev;
            }
            return [...prev, clientId];
        });
    };

    const allFilteredClientsSelected =
        filteredClients.length > 0 && filteredClients.every((c) => selectedClientIds.includes(c.id));

    const toggleSelectAllFiltered = () => {
        if (allFilteredClientsSelected) {
            setSelectedClientIds([]);
            return;
        }
        const batch = filteredClients.slice(0, 500).map((c) => c.id);
        setSelectedClientIds(batch);
        if (filteredClients.length > 500) {
            toast('Selected first 500 contacts (maximum).', { icon: 'ℹ️' });
        }
    };

    const renderBulkSelectRow = () => (
        <div className="flex items-center justify-between px-1">
            <button
                type="button"
                onClick={toggleSelectAllFiltered}
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
                {allFilteredClientsSelected ? (
                    <CheckSquare className="w-4 h-4 text-[var(--brand-blue-400)]" />
                ) : (
                    <Square className="w-4 h-4" />
                )}
                {allFilteredClientsSelected ? 'Deselect all' : `Select all (${Math.min(filteredClients.length, 500)})`}
            </button>
            {selectedClientIds.length > 0 && (
                <button
                    type="button"
                    onClick={() => setSelectedClientIds([])}
                    className="text-xs text-slate-500 hover:text-slate-300"
                >
                    Clear ({selectedClientIds.length})
                </button>
            )}
        </div>
    );

    const handleLoadMore = () => {
        void loadClients(false);
    };

    const handleImportClients = async (importedClients: Partial<BusinessClient>[]) => {
        if (!currentTenant) return;

        const { count, error } = await businessClientService.importClients(currentTenant.id, importedClients);
        if (!error) {
            await loadClients();
            setShowImportModal(false);
            toast.success(`Successfully imported ${count} clients!`);
        } else {
            toast.error(`Error importing clients: ${error}`);
        }
    };

    const handleCallClient = async (client: BusinessClient) => {
        const toastId = toast.loading('Initiating secure call...');

        try {
            const { call, provider, joinUrl, recipientUserId, error } = await startClientVideoCall({
                hostId: user.id,
                hostName: user.name || user.email || 'Host',
                tenantId: currentTenant?.id,
                clientName: client.name,
                clientEmail: client.email,
            });

            if (error || !call) {
                throw new Error(error || 'Failed to create meeting');
            }

            if (provider === 'teams' && joinUrl) {
                window.open(joinUrl, '_blank', 'noopener,noreferrer');
                toast.success('Teams meeting opened — 40 minute session', { id: toastId });
                return;
            }

            toast.success(
                recipientUserId ? 'Calling client…' : 'Meeting room ready — join when your guest arrives.',
                { id: toastId }
            );
            router.push(`/call/${call.id}`);
        } catch (error) {
            console.error('Call failed:', error);
            // Show the actual error message to the user
            toast.error(error instanceof Error ? error.message : 'Failed to start call.', { id: toastId, duration: 5000 });
        }
    };

    const crmSectionFallback = (
        <div className="flex items-center justify-center min-h-[320px] rounded-xl border border-slate-800 bg-slate-900/50">
            <div className="text-slate-400 text-sm font-medium">Loading...</div>
        </div>
    );

    if (pathname === '/dashboard/crm') {
        return (
            <div className="space-y-6 w-full min-w-0 min-h-[60vh]">
                <CRMNav pathname={pathname} />
                <CRMTab user={user} />
            </div>
        );
    }

    if (pathname === '/dashboard/leads') {
        return (
            <div className="space-y-6 w-full min-w-0 min-h-[60vh]">
                <CRMNav pathname={pathname} />
                <Suspense fallback={crmSectionFallback}>
                    <KanbanBoard />
                </Suspense>
            </div>
        );
    }

    if (pathname === '/dashboard/deals') {
        return (
            <div className="space-y-6 w-full min-w-0 min-h-[60vh]">
                <CRMNav pathname={pathname} />
                <Suspense fallback={crmSectionFallback}>
                    <DealsTab user={user} />
                </Suspense>
            </div>
        );
    }

    const isContactsRoute = ['/dashboard/contacts', '/dashboard/business/clients', '/dashboard/clients'].includes(pathname);

    if (isContactsRoute && directoryView === 'email') {
        return (
            <div className="space-y-4 sm:space-y-6 w-full min-w-0 ac-scroll-full ac-enterprise-module">
                <CRMNav pathname={pathname} />
                {directorySwitcher}
                <Suspense fallback={crmSectionFallback}>
                    <ContactsList />
                </Suspense>
            </div>
        );
    }

    // Show the simplified solo view on the free plan; paid plans (starter/pro/
    // enterprise) unlock the full CRM contacts workspace (import/export, board
    // view, batch outreach). Mirrors the `fullCRM` feature flag in PLAN_PRICING.
    const tenantPlan = currentTenant?.subscription_plan || 'free';
    const isSoloOwner = tenantPlan === 'free';

    if (isSoloOwner) {
        return (
            <div className="space-y-4 sm:space-y-6 w-full min-w-0 ac-scroll-full ac-enterprise-module">
                <CRMNav pathname={pathname} />
                {isContactsRoute && directorySwitcher}
                <ModuleIntelligenceCard moduleKey="customerSuccess" title="Customer Success Intelligence" />
                {/* Simplified Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <h2 className="text-lg sm:text-xl font-semibold text-[var(--ws-text-primary)] tracking-tight">Customers</h2>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge variant="blue">{totalCount || clients.length} total</Badge>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">CRM</p>
                        </div>
                    </div>
                    <div className="flex sm:flex-wrap gap-2 items-center overflow-x-auto scrollbar-hide w-full sm:w-auto pb-2 sm:pb-0">
                        <Button
                            onClick={() => setShowAddModal(true)}
                            icon={<Plus className="w-4 h-4" />}
                        >
                            Add Client
                        </Button>
                    </div>
                </div>

                {/* Quick Stats for Solo Owner */}
                <ModuleStatCards stats={contactStats} />

                {/* Simple Client List */}
                <div className="space-y-2">
                    {filteredClients.map(client => (
                        <div key={client.id} className="p-3 bg-slate-900/60 border border-white/5 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--brand-blue-500)] to-[var(--brand-blue-700)] flex items-center justify-center font-bold text-white text-xs">
                                    {(client.name || '?').charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-sm">{client.name}</h3>
                                    <p className="text-xs text-slate-400">{client.email || client.phone || 'No contact'}</p>
                                </div>
                            </div>
                            <Badge variant={client.salesStage === 'customer' ? 'success' : 'blue'}>
                                {client.salesStage}
                            </Badge>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <EmptyState
                    icon={Users}
                    title="Loading contacts"
                    description="We are pulling your latest sales contacts and activity into the workspace."
                />
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6 w-full min-w-0 ac-scroll-full ac-enterprise-module">
            <CRMNav pathname={pathname} />
            {directorySwitcher}
            <ModuleIntelligenceCard moduleKey="customerSuccess" title="Customer Success Intelligence" />
            <ModuleStatCards stats={contactStats} />
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-semibold text-[var(--ws-text-primary)] tracking-tight">Contacts</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="blue">{totalCount || clients.length} total</Badge>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Pipeline</p>
                    </div>
                </div>
                <div className="flex sm:flex-wrap gap-2 items-center overflow-x-auto scrollbar-hide w-full sm:w-auto pb-2 sm:pb-0">
                    <Button
                        variant="outline"
                        onClick={handleExportExcel}
                        icon={<FileSpreadsheet className="w-4 h-4" />}
                        title="Export contacts to CSV"
                    >
                        Export
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setShowImportModal(true)}
                        icon={<Upload className="w-4 h-4" />}
                    >
                        Import
                    </Button>
                    <Button
                        variant={showArchived ? 'primary' : 'outline'}
                        onClick={() => setShowArchived(!showArchived)}
                        icon={<History className="w-4 h-4" />}
                        className={showArchived ? 'bg-amber-600 hover:bg-amber-500' : ''}
                    >
                        {showArchived ? 'Viewing Archived' : 'Show Archived'}
                    </Button>
                    <Button
                        onClick={() => setShowAddModal(true)}
                        icon={<Plus className="w-4 h-4" />}
                    >
                        Add
                    </Button>
                    {/* View mode toggle */}
                    <div className="flex bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-1">
                        <button
                            onClick={() => setViewMode('list')}
                            title="List view"
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[var(--brand-blue-500)] text-white shadow-lg shadow-[var(--brand-blue-500)]/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('board')}
                            title="Card view"
                            className={`p-2 rounded-lg transition-all ${viewMode === 'board' ? 'bg-[var(--brand-blue-500)] text-white shadow-lg shadow-[var(--brand-blue-500)]/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('micro')}
                            title="Micro grid view"
                            className={`p-2 rounded-lg transition-all ${viewMode === 'micro' ? 'bg-[var(--brand-blue-500)] text-white shadow-lg shadow-[var(--brand-blue-500)]/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            <Grid3X3 className="w-4 h-4" />
                        </button>
                    </div>
                    {selectedClientIds.length > 0 && (
                        <>
                        <Button
                            variant="outline"
                            onClick={async () => {
                                if (!confirm(`Archive ${selectedClientIds.length} contact(s)?`)) return;
                                const { error } = await businessClientService.bulkArchiveClients(selectedClientIds);
                                if (error) {
                                    toast.error(error);
                                    return;
                                }
                                setClients(clients.filter(c => !selectedClientIds.includes(c.id)));
                                setSelectedClientIds([]);
                                toast.success('Selected contacts archived');
                            }}
                            icon={<Trash2 className="w-4 h-4" />}
                        >
                            Archive ({selectedClientIds.length})
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                const first = clients.find(c => selectedClientIds.includes(c.id) && c.email);
                                if (!first?.email) {
                                    toast.error('Selected contacts need email addresses');
                                    return;
                                }
                                setSelectedClientForCommunication(first);
                                setShowCommunicationModal(true);
                                toast(`Composing for ${first.name}. Use Outreach for bulk sends.`, { icon: '✉️' });
                            }}
                            icon={<Mail className="w-4 h-4" />}
                        >
                            Email ({selectedClientIds.length})
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => setShowOutreachModal(true)}
                            icon={<Users className="w-4 h-4" />}
                            className="bg-[var(--brand-blue-600)] hover:bg-[var(--brand-blue-500)] shadow-lg shadow-[var(--brand-blue-500)]/20"
                        >
                            Outreach ({selectedClientIds.length})
                        </Button>
                        </>
                    )}
                </div>
            </div>

            {viewMode === 'micro' ? (
                /* ── MICRO VIEW: tiny pill chips with full contact slide-in ── */
                <div className="space-y-4">
                    {/* Search + Filter */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input type="text" placeholder="Search contacts..."
                                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:border-[var(--brand-blue-500)] transition-all text-sm"
                            />
                        </div>
                        <select value={selectedStage} onChange={e => setSelectedStage(e.target.value)}
                            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-md focus:outline-none focus:border-[var(--brand-blue-500)]">
                            <option value="all">All Stages</option>
                            <option value="lead">Lead</option>
                            <option value="prospect">Prospect</option>
                            <option value="customer">Customer</option>
                            <option value="lost">Lost</option>
                        </select>
                    </div>

                    {renderBulkSelectRow()}

                    {/* Micro grid — tiny chips */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                        {filteredClients.map(client => {
                            const initials = (client.name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                            const isSelected = selectedClientIds.includes(client.id);
                            const stageDot: Record<string, string> = {
                                lead: 'bg-cyan-400', prospect: 'bg-blue-400',
                                customer: 'bg-emerald-400', lost: 'bg-rose-400'
                            };
                            const stageGrad: Record<string, string> = {
                                lead: 'from-cyan-500 to-[var(--brand-blue-600)]',
                                prospect: 'from-[var(--brand-blue-500)] to-cyan-600',
                                customer: 'from-emerald-500 to-[var(--brand-blue-600)]',
                                lost: 'from-slate-500 to-slate-700'
                            };
                            return (
                                <div
                                    key={client.id}
                                    className={`group relative flex flex-col items-center gap-1.5 p-2 rounded-xl bg-slate-900/70 border transition-all text-center ${isSelected ? 'border-[var(--brand-blue-500)]/60 bg-[var(--brand-blue-500)]/10' : 'border-slate-800 hover:border-[var(--brand-blue-500)]/50 hover:bg-slate-800/80'}`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggleClientSelection(client.id)}
                                        className="absolute top-1 left-1 text-slate-500 hover:text-[var(--brand-blue-400)]"
                                        aria-label={isSelected ? 'Deselect contact' : 'Select contact'}
                                    >
                                        {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-[var(--brand-blue-400)]" /> : <Square className="w-3.5 h-3.5" />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedClient(client); setViewMode('list'); }}
                                    title={`${client.name}\n${client.industry || ''}\n${client.salesStage}`}
                                    className="flex flex-col items-center gap-1.5 w-full hover:-translate-y-0.5 transition-transform cursor-pointer"
                                >
                                    {/* Avatar */}
                                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${stageGrad[client.salesStage] || 'from-[var(--brand-blue-500)] to-[var(--brand-blue-700)]'} flex items-center justify-center font-bold text-white text-xs relative`}>
                                        {initials}
                                        <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${stageDot[client.salesStage] || 'bg-slate-500'}`} />
                                    </div>
                                    {/* Name truncated to ~8 chars */}
                                    <p className="text-xs font-semibold text-slate-300 group-hover:text-white leading-tight w-full truncate">
                                        {(client.name || '').split(' ')[0]}
                                    </p>
                                    </button>
                                </div>
                            );
                        })}
                        {filteredClients.length === 0 && (
                            <div className="col-span-full">
                                <EmptyState
                                    icon={Users}
                                    title="No contacts match these filters"
                                    description="Try another stage or search term, or add a new contact to start building your pipeline."
                                    className="py-8"
                                />
                            </div>
                        )}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-slate-800/50 pt-2">
                        {[['cyan-400','Lead'],['blue-400','Prospect'],['emerald-400','Customer'],['rose-400','Lost']].map(([color, label]) => (
                            <span key={label} className="flex items-center gap-1">
                                <span className={`w-2 h-2 rounded-full bg-${color}`} />{label}
                            </span>
                        ))}
                        <span className="ml-auto text-slate-600">{filteredClients.length} contacts · click any to open</span>
                    </div>
                </div>
            ) : viewMode === 'board' ? (
                /* ── Compact Bio-Card Grid View ── */
                <div className="space-y-4">
                    {/* Search + Filter row */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search contacts..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:border-[var(--brand-blue-500)] transition-all text-sm"
                            />
                        </div>
                        <select
                            value={selectedStage}
                            onChange={(e) => setSelectedStage(e.target.value)}
                            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:border-[var(--brand-blue-500)] transition-all text-md"
                        >
                            <option value="all">All Stages</option>
                            <option value="lead">Lead</option>
                            <option value="prospect">Prospect</option>
                            <option value="customer">Customer</option>
                            <option value="lost">Lost</option>
                        </select>
                    </div>
                    {renderBulkSelectRow()}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {filteredClients.map(client => {
                            const initials = (client.name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                            const stageColor = client.salesStage === 'customer' ? 'from-emerald-500 to-[var(--brand-blue-600)]'
                                : client.salesStage === 'lost' ? 'from-slate-600 to-slate-700'
                                : client.salesStage === 'prospect' ? 'from-[var(--brand-blue-500)] to-cyan-600'
                                : 'from-[var(--brand-blue-500)] to-cyan-600';
                            return (
                                    <ClientCard
                                        key={client.id}
                                        client={client}
                                        onEdit={(c) => { setEditingClient(c); setShowEditModal(true); }}
                                        onDelete={handleArchiveClient}
                                        onCall={handleCallClient}
                                        onCreateProposal={(c) => { setSelectedClientForProposal(c); setShowProposalModal(true); }}
                                        onCreateInvoice={(c) => { setSelectedClientForInvoice(c); setShowInvoiceModal(true); }}
                                        onSendEmail={(c) => { setSelectedClientForCommunication(c); setShowCommunicationModal(true); }}
                                        showArchived={showArchived}
                                        isSelected={selectedClientIds.includes(client.id)}
                                        onToggleSelect={toggleClientSelection}
                                    />
                            );
                        })}
                        {filteredClients.length === 0 && (
                            <div className="col-span-full">
                                <EmptyStateFromPreset moduleId="clients" />
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-4 min-h-0 max-h-[min(92dvh,880px)] lg:max-h-none lg:h-[min(88dvh,900px)] overflow-hidden">
                    {/* Left Pane: Search + List */}
                    <div className={`flex flex-col gap-3 sm:gap-4 min-h-0 h-full ${selectedClient ? 'hidden lg:flex w-full lg:w-1/3 lg:max-w-[350px]' : 'w-full'} overflow-hidden`}>
                        <div className="flex flex-col gap-4 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search clients..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 sm:py-2.5 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:border-[var(--brand-blue-500)] transition-all text-sm font-medium"
                                />
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none h-8 shrink-0">
                                {[
                                    { value: 'all', label: 'All' },
                                    { value: 'lead', label: 'Leads' },
                                    { value: 'prospect', label: 'Prospects' },
                                    { value: 'customer', label: 'Customers' },
                                    { value: 'lost', label: 'Lost' }
                                ].map((stage) => (
                                    <button
                                        key={stage.value}
                                        onClick={() => setSelectedStage(stage.value)}
                                        className={`h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                                            selectedStage === stage.value
                                                ? 'bg-[var(--brand-blue-600)] text-white border-[var(--brand-blue-600)] shadow-sm shadow-[var(--brand-blue-600)]/10'
                                                : 'bg-slate-900 text-slate-400 border-slate-850 hover:text-white hover:bg-slate-800'
                                        }`}
                                    >
                                        {stage.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-1 shrink-0">
                            <button
                                onClick={() => {
                                    if (selectedClientIds.length > 0) {
                                        setSelectedClientIds([]);
                                    } else {
                                        const batch = filteredClients.slice(0, 500).map(c => c.id);
                                        setSelectedClientIds(batch);
                                        if (filteredClients.length > 500) {
                                            toast.success('Selected first 500 contacts for bulk outreach.');
                                        }
                                    }
                                }}
                                className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-[var(--brand-blue-400)] transition-colors"
                            >
                                {selectedClientIds.length > 0 ? 'Deselect All' : `Select All (Max 500)`}
                            </button>
                            {selectedClientIds.length >= 500 && (
                                <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-tighter leading-tight max-w-[80px] text-right">Batch Limit Reached</span>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {filteredClients.map(client => (
                                <div
                                    key={client.id}
                                    className={`group p-3 rounded-xl cursor-pointer transition-all border flex items-center gap-3 ${selectedClient?.id === client.id ? 'bg-[var(--brand-blue-500)]/10 border-[var(--brand-blue-500)] shadow-sm shadow-[var(--brand-blue-500)]/20' : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'}`}
                                    onClick={() => setSelectedClient(client)}
                                >
                                    {/* ... checkbox and avatar ... */}
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedClientIds.includes(client.id)}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                if (e.target.checked) {
                                                    if (selectedClientIds.length >= 500) {
                                                        toast.error('Maximum 500 contacts for bulk outreach.');
                                                        return;
                                                    }
                                                    setSelectedClientIds([...selectedClientIds, client.id]);
                                                } else {
                                                    setSelectedClientIds(selectedClientIds.filter(id => id !== client.id));
                                                }
                                            }}
                                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-[var(--brand-blue-600)] focus:ring-[var(--brand-blue-500)]/20"
                                        />
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-800 to-slate-700 flex items-center justify-center font-semibold text-slate-350 text-xs shrink-0">
                                            {(client.name || '?').charAt(0)}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-white text-sm truncate">{client.name}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight bg-slate-950 border border-slate-850 text-[var(--brand-blue-400)] uppercase">
                                                {client.salesStage}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {hasMore && (
                                <div className="py-4 flex justify-center">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleLoadMore}
                                        isLoading={loading}
                                        className="text-[var(--brand-blue-500)] hover:text-[var(--brand-blue-400)] font-bold uppercase tracking-wide text-xs"
                                    >
                                        Load More Contacts
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Pane: Details */}
                    <div className={`flex-1 min-h-0 min-w-0 ${!selectedClient ? 'hidden lg:flex' : 'flex'} flex-col ac-workspace-panel rounded-lg overflow-hidden`}>
                        {selectedClient ? (
                            <div className="flex flex-col h-full max-h-[min(85dvh,800px)] lg:max-h-none overflow-hidden animate-in fade-in duration-300">
                                <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
                                    <button onClick={() => setSelectedClient(null)} className="flex items-center gap-2 text-[var(--brand-blue-400)] text-sm font-medium">
                                        <ChevronLeft className="w-5 h-5" /> Back
                                    </button>
                                    <Badge variant={selectedClient.salesStage === 'customer' ? 'success' : selectedClient.salesStage === 'lost' ? 'error' : 'blue'}>
                                        {selectedClient.salesStage.charAt(0).toUpperCase() + selectedClient.salesStage.slice(1)}
                                    </Badge>
                                </div>

                                <div className="p-6 flex flex-col flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                                    <RecordHeader
                                        moduleId="crm"
                                        className="mb-4"
                                        title={selectedClient.name}
                                        subtitle={selectedClient.industry || undefined}
                                        status={
                                            <Badge variant={selectedClient.salesStage === 'customer' ? 'success' : selectedClient.salesStage === 'lost' ? 'error' : 'blue'}>
                                                {selectedClient.salesStage.charAt(0).toUpperCase() + selectedClient.salesStage.slice(1)}
                                            </Badge>
                                        }
                                        meta={
                                            <>
                                                {selectedClient.email ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedClientForCommunication(selectedClient);
                                                            setShowCommunicationModal(true);
                                                        }}
                                                        className="inline-flex items-center gap-1.5 text-[var(--brand-blue-400)] hover:text-[var(--brand-blue-300)] transition-colors"
                                                    >
                                                        <Mail className="w-3.5 h-3.5" />
                                                        {selectedClient.email}
                                                    </button>
                                                ) : null}
                                                {selectedClient.phone ? <span>{selectedClient.phone}</span> : null}
                                            </>
                                        }
                                        actions={
                                            <>
                                                <AskBonnieButton
                                                    compact
                                                    mode="summarise"
                                                    contexts={[
                                                        { type: 'Client', id: selectedClient.id, label: selectedClient.name },
                                                        ...(selectedClient.industry ? [{ type: 'Industry', label: selectedClient.industry }] : []),
                                                    ]}
                                                />
                                                <Dropdown
                                                    trigger={<Button size="sm" variant="ghost" className="!p-2 hover:bg-slate-800 rounded-xl" icon={<MoreVertical className="w-5 h-5 text-slate-400" />} />}
                                                    items={[
                                                        { label: 'Edit', icon: <Edit className="w-4 h-4"/>, onClick: () => { setEditingClient(selectedClient); setShowEditModal(true); } },
                                                        { label: showArchived ? 'Unarchive' : 'Archive', icon: showArchived ? <History className="w-4 h-4"/> : <Trash2 className="w-4 h-4"/>, onClick: () => handleArchiveClient(selectedClient.id), variant: showArchived ? 'default' : 'danger' }
                                                    ]}
                                                />
                                            </>
                                        }
                                    />

                                    {/* Tabs Header */}
                                    <div className="flex border-b border-slate-800 mb-4 overflow-x-auto [scrollbar-width:none]">
                                        <button
                                            onClick={() => setActiveTab('timeline')}
                                            className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                                                activeTab === 'timeline'
                                                    ? 'border-[var(--brand-blue-500)] text-[var(--brand-blue-400)]'
                                                    : 'border-transparent text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            Timeline
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('notes')}
                                            className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                                                activeTab === 'notes'
                                                    ? 'border-[var(--brand-blue-500)] text-[var(--brand-blue-400)]'
                                                    : 'border-transparent text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            Notes
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('invoices')}
                                            className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                                                activeTab === 'invoices'
                                                    ? 'border-[var(--brand-blue-500)] text-[var(--brand-blue-400)]'
                                                    : 'border-transparent text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            Billing ({clientTimeline?.activities?.filter((a: any) => a.activity_type === 'invoice' || a.activity_type === 'payment')?.length || 0})
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('properties')}
                                            className={`px-4 py-2 border-b-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                                                activeTab === 'properties'
                                                    ? 'border-[var(--brand-blue-500)] text-[var(--brand-blue-400)]'
                                                    : 'border-transparent text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            Properties
                                        </button>
                                    </div>

                                    {/* Tabs Content */}
                                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar mb-6">
                                        {activeTab === 'timeline' && selectedClient?.id && (
                                            <CustomerTimeline
                                                clientId={selectedClient.id}
                                                onOpenComms={() => router.push('/dashboard/comms')}
                                            />
                                        )}

                                        {activeTab === 'notes' && (
                                            <div className="space-y-4">
                                                {/* Add Note Form */}
                                                <form onSubmit={handleAddNote} className="ac-workspace-panel rounded-lg p-4 space-y-3">
                                                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Add Activity Note</h3>
                                                    <div>
                                                        <Input
                                                            type="text"
                                                            placeholder="Note Title (e.g. Call feedback, Meeting summary)"
                                                            value={newNoteTitle}
                                                            onChange={(e) => setNewNoteTitle(e.target.value)}
                                                            className="text-white placeholder-slate-500 text-sm"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <textarea
                                                            placeholder="Detailed notes of what you discussed, client sentiment, or action items..."
                                                            value={newNoteDescription}
                                                            onChange={(e) => setNewNoteDescription(e.target.value)}
                                                            className="w-full bg-[var(--ws-toolbar)] border border-[var(--ws-border)] text-white placeholder-slate-500 rounded-lg p-3 text-sm focus:outline-none focus:border-[var(--brand-blue-500)] min-h-[80px]"
                                                            required
                                                        />
                                                    </div>
                                                    <div className="flex justify-end">
                                                        <Button
                                                            type="submit"
                                                            size="sm"
                                                            isLoading={noteSubmitting}
                                                            className="text-white"
                                                            icon={<Send className="w-3.5 h-3.5" />}
                                                        >
                                                            Add Note
                                                        </Button>
                                                    </div>
                                                </form>

                                                {/* Notes Feed */}
                                                <div className="space-y-3 mt-4">
                                                    {clientTimeline?.activities?.filter((a: any) => a.activity_type === 'note').length === 0 ? (
                                                        <EmptyState
                                                            icon={FileText}
                                                            title="No notes yet"
                                                            description="Capture meeting context, follow-ups, and relationship details here."
                                                            className="py-6"
                                                        />
                                                    ) : (
                                                        clientTimeline?.activities?.filter((a: any) => a.activity_type === 'note').map((note: any) => (
                                                            <div key={note.id} className="ac-workspace-panel rounded-lg p-3">
                                                                <div className="flex justify-between items-start gap-2 mb-1">
                                                                    <h4 className="text-xs font-bold text-[var(--brand-blue-400)]">{note.title}</h4>
                                                                    <span className="text-[10px] text-slate-500 font-mono">
                                                                        {new Date(note.created_at).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{note.description}</p>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'invoices' && (
                                            <div className="space-y-3">
                                                {clientTimeline?.activities?.filter((a: any) => a.activity_type === 'invoice' || a.activity_type === 'payment').length === 0 ? (
                                                    <EmptyState
                                                        icon={Receipt}
                                                        title="No billing records yet"
                                                        description="Invoices and payment updates for this contact will appear here."
                                                        className="py-12"
                                                    />
                                                ) : (
                                                    clientTimeline.activities.filter((a: any) => a.activity_type === 'invoice' || a.activity_type === 'payment').map((inv: any) => {
                                                        const status = inv.metadata?.status || 'paid';
                                                        const isPaid = status === 'paid';
                                                        return (
                                                            <div key={inv.id} className="ac-workspace-panel rounded-lg p-4 flex justify-between items-center gap-4">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Receipt className={`w-4 h-4 ${isPaid ? 'text-emerald-500' : 'text-amber-500'}`} />
                                                                        <h4 className="text-sm font-bold text-slate-200">${inv.metadata?.amount?.toLocaleString() || '0.00'}</h4>
                                                                        <Badge variant={isPaid ? 'success' : 'warning'}>
                                                                            {status.toUpperCase()}
                                                                        </Badge>
                                                                    </div>
                                                                    <p className="text-xs text-slate-400 mt-1">{inv.description}</p>
                                                                    {inv.metadata?.due_date && (
                                                                        <span className="text-[10px] text-slate-500 block mt-1 font-mono">Due: {new Date(inv.metadata.due_date).toLocaleDateString()}</span>
                                                                    )}
                                                                </div>
                                                                {inv.metadata?.invoice_id && (
                                                                    <div className="flex gap-2">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="text-[var(--brand-blue-400)] hover:text-[var(--brand-blue-300)]"
                                                                            onClick={() => {
                                                                                window.open(`/api/invoices/${inv.metadata.invoice_id}/pdf?tenantId=${currentTenant?.id}`, '_blank');
                                                                            }}
                                                                        >
                                                                            View PDF
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="text-blue-400 hover:text-blue-300"
                                                                            onClick={() => {
                                                                                window.open(`/api/invoices/${inv.metadata.invoice_id}/pdf?tenantId=${currentTenant?.id}&download=true`, '_blank');
                                                                            }}
                                                                        >
                                                                            Download
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        )}

                                        {activeTab === 'properties' && (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="ac-workspace-panel rounded-lg p-4">
                                                        <p className="text-xs text-slate-400 mb-1">Email</p>
                                                        <div className="flex items-center gap-2 text-white text-sm">
                                                            <Mail className="w-4 h-4 text-[var(--brand-blue-500)]" />
                                                            {selectedClient.email ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedClientForCommunication(selectedClient);
                                                                        setShowCommunicationModal(true);
                                                                    }}
                                                                    className="truncate text-[var(--brand-blue-400)] hover:text-[var(--brand-blue-300)] text-left"
                                                                >
                                                                    {selectedClient.email}
                                                                </button>
                                                            ) : (
                                                                <span className="truncate">N/A</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="ac-workspace-panel rounded-lg p-4">
                                                        <p className="text-xs text-slate-400 mb-1">Phone</p>
                                                        <div className="flex items-center gap-2 text-white text-sm">
                                                            <Phone className="w-4 h-4 text-[var(--brand-blue-500)]" />
                                                            <span className="truncate">{selectedClient.phone || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                    {selectedClient.industry && (
                                                        <div className="ac-workspace-panel rounded-lg p-4">
                                                            <p className="text-xs text-slate-400 mb-1">Industry</p>
                                                            <p className="text-white text-sm font-semibold">{selectedClient.industry}</p>
                                                        </div>
                                                    )}
                                                    {selectedClient.location && (
                                                        <div className="ac-workspace-panel rounded-lg p-4">
                                                            <p className="text-xs text-slate-400 mb-1">Location</p>
                                                            <p className="text-white text-sm font-semibold">{selectedClient.location}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {selectedClient.description && (
                                                    <div className="ac-workspace-panel rounded-lg p-4">
                                                        <p className="text-xs text-slate-400 mb-2">Description</p>
                                                        <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{selectedClient.description}</p>
                                                    </div>
                                                )}

                                                {selectedClient.customFields && Object.keys(selectedClient.customFields).length > 0 && (
                                                    <div className="ac-workspace-panel rounded-lg p-4">
                                                        <p className="text-xs text-slate-400 mb-3">Custom Fields</p>
                                                        <div className="space-y-2">
                                                            {Object.entries(selectedClient.customFields).map(([key, val]) => (
                                                                <div key={key} className="flex justify-between items-center py-1.5 border-b border-slate-800/40 text-xs">
                                                                    <span className="text-slate-400 font-bold uppercase tracking-wider">{key.replace(/_/g, ' ')}</span>
                                                                    <span className="text-slate-200 font-semibold">{String(val)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Quick Actions Footer */}
                                    <div className="mt-auto bg-[var(--ws-toolbar)] pt-6 border-t border-[var(--ws-border)]">
                                        <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">Quick Actions</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Button variant="secondary" size="sm" onClick={() => { setSelectedClientForProposal(selectedClient); setShowProposalModal(true); }} icon={<FilePlus className="w-4 h-4" />}>Proposal</Button>
                                            <Button variant="outline" size="sm" onClick={() => { setSelectedClientForInvoice(selectedClient); setShowInvoiceModal(true); }} icon={<Receipt className="w-4 h-4" />}>Invoice</Button>
                                            <Button variant="outline" size="sm" onClick={() => handleCallClient(selectedClient)} icon={<Phone className="w-4 h-4" />}>Call</Button>
                                            <Button variant="outline" size="sm" onClick={() => { setSelectedClientForCommunication(selectedClient); setShowCommunicationModal(true); }} icon={<Mail className="w-4 h-4" />}>Email</Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center bg-slate-800/10 text-slate-500">
                                <Users className="w-16 h-16 mb-4 text-slate-700" />
                                <p className="text-lg font-medium text-slate-400">Select a client to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Proposal Modal */}
            {showProposalModal && selectedClientForProposal && (
                <CreateProposalModal
                    client={selectedClientForProposal}
                    user={user}
                    onClose={() => {
                        setShowProposalModal(false);
                        setSelectedClientForProposal(null);
                    }}
                    onCreated={() => {
                        setShowProposalModal(false);
                        setSelectedClientForProposal(null);
                        toast.success('Proposal project created!');
                        showActionNextSteps('proposal_project_created', (path) => router.push(path));
                    }}
                />
            )}

            {/* Create Invoice Modal */}
            {showInvoiceModal && selectedClientForInvoice && (
                <CreateClientInvoiceModal
                    client={selectedClientForInvoice}
                    onClose={() => {
                        setShowInvoiceModal(false);
                        setSelectedClientForInvoice(null);
                    }}
                    onCreated={() => {
                        setShowInvoiceModal(false);
                        setSelectedClientForInvoice(null);
                    }}
                />
            )}

            {/* Communication Modal */}
            {showCommunicationModal && selectedClientForCommunication && (
                <CommunicationModal
                    client={selectedClientForCommunication}
                    user={user}
                    onClose={() => {
                        setShowCommunicationModal(false);
                        setSelectedClientForCommunication(null);
                    }}
                    onSent={() => {
                        setShowCommunicationModal(false);
                        setSelectedClientForCommunication(null);
                    }}
                />
            )}

            {filteredClients.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    No clients found. Add your first client to get started!
                </div>
            )}

            {/* Add Client Modal */}
            {showAddModal && (
                <AddClientModal
                    onClose={() => setShowAddModal(false)}
                    onAdd={handleAddClient}
                />
            )}

            {/* Edit Client Modal */}
            {showEditModal && editingClient && (
                <EditClientModal
                    client={editingClient}
                    onClose={() => {
                        setShowEditModal(false);
                        setEditingClient(null);
                    }}
                    onSave={(updates) => handleEditClient(editingClient.id, updates)}
                />
            )}

            {/* Import Modal */}
            {showImportModal && (
                <ImportClientsModal
                    onClose={() => setShowImportModal(false)}
                    onImport={handleImportClients}
                />
            )}

            {/* AI Outreach Modal */}
            <AIOutreachModal
                isOpen={showOutreachModal}
                onClose={() => setShowOutreachModal(false)}
                userId={user.id}
                initialSelectedLeads={selectedClientIds}
                recipientSource="clients"
            />

            {/* Batch Outreach FAB and Panel */}
            <BatchOutreachFAB
                selectedCount={selectedClientIds.length}
                onOpen={() => setShowOutreachPanel(true)}
                onClear={() => setSelectedClientIds([])}
            />

            <BatchOutreachPanel
                isOpen={showOutreachPanel}
                onClose={() => setShowOutreachPanel(false)}
                selectedIds={selectedClientIds}
                recipientSource="clients"
                onSuccess={() => {
                    setSelectedClientIds([]);
                    loadClients(true);
                }}
            />
        </div>
    );
};

const ClientCard = ({ client, onEdit, onDelete, onCall, onCreateProposal, onCreateInvoice, onSendEmail, showArchived, isSelected, onToggleSelect }: {
    client: BusinessClient;
    onEdit: (c: BusinessClient) => void;
    onDelete: (id: string) => void;
    onCall: (c: BusinessClient) => void;
    onCreateProposal: (c: BusinessClient) => void;
    onCreateInvoice: (c: BusinessClient) => void;
    onSendEmail: (c: BusinessClient) => void;
    showArchived?: boolean;
    isSelected?: boolean;
    onToggleSelect?: (id: string) => void;
}) => {
    const stageVariants = {
        lead: 'blue',
        prospect: 'warning',
        customer: 'success',
        lost: 'error'
    } as const;

    const dropdownItems = [
        {
            label: 'Create Proposal',
            icon: <FilePlus className="w-4 h-4" />,
            onClick: () => onCreateProposal(client)
        },
        {
            label: 'Create Invoice',
            icon: <Receipt className="w-4 h-4" />,
            onClick: () => onCreateInvoice(client)
        },
        {
            label: 'Send Email',
            icon: <Mail className="w-4 h-4" />,
            onClick: () => {
                if (client.email) {
                    onSendEmail(client);
                } else {
                    toast.error('No email address on file for this client.');
                }
            }
        },
        {
            label: 'Schedule Meeting',
            icon: <Calendar className="w-4 h-4" />,
            onClick: () => window.location.href = '/dashboard/calendar'
        },
        {
            label: 'View History',
            icon: <History className="w-4 h-4" />,
            onClick: () => window.location.href = '/dashboard/reports'
        },
        {
            label: 'Edit Client',
            icon: <Edit className="w-4 h-4" />,
            onClick: () => onEdit(client)
        },
        {
            label: showArchived ? 'Unarchive Client' : 'Archive Client',
            icon: showArchived ? <History className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />,
            onClick: () => onDelete(client.id),
            variant: showArchived ? 'default' as const : 'danger' as const
        }
    ];

    return (
        <Card hoverEffect className={`flex flex-col h-full !p-3 relative z-10 hover:z-[60] focus-within:z-[60] transition-all ${isSelected ? 'ring-1 ring-[var(--brand-blue-500)]/50' : ''}`}>
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1 min-w-0 mr-2">
                    {onToggleSelect && (
                        <button
                            type="button"
                            onClick={() => onToggleSelect(client.id)}
                            className="flex-shrink-0 text-slate-500 hover:text-[var(--brand-blue-400)]"
                            aria-label={isSelected ? 'Deselect contact' : 'Select contact'}
                        >
                            {isSelected ? <CheckSquare className="w-4 h-4 text-[var(--brand-blue-400)]" /> : <Square className="w-4 h-4" />}
                        </button>
                    )}
                    <div className="w-10 h-10 rounded-full shrink-0 bg-gradient-to-br from-[var(--brand-blue-500)] to-[var(--brand-blue-700)] flex items-center justify-center font-bold text-white">
                        {(client.name || '?').charAt(0)}
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-semibold text-white truncate" title={client.name}>{client.name}</h3>
                        {client.industry && <p className="text-xs text-slate-400 truncate">{client.industry}</p>}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onCall(client)}
                        className="!p-2 hover:bg-[var(--brand-blue-500)]/10 hover:text-[var(--brand-blue-400)]"
                        icon={<Phone className="w-4 h-4" />}
                    />
                    <Dropdown
                        trigger={
                            <Button
                                size="sm"
                                variant="ghost"
                                className="!p-2 hover:bg-slate-700"
                                icon={<MoreVertical className="w-4 h-4" />}
                            />
                        }
                        items={dropdownItems}
                    />
                </div>
            </div>

            <div className="space-y-2 mb-4 flex-1">
                {client.email && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Mail className="w-4 h-4 shrink-0" />
                        <span className="truncate" title={client.email}>{client.email}</span>
                    </div>
                )}
                {client.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Phone className="w-4 h-4 shrink-0" />
                        <span className="truncate">{client.phone}</span>
                    </div>
                )}
                {client.metadata?.last_contacted_at && (
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-blue-500)]/70 mt-3">
                        <MessageSquare className="w-3 h-3" />
                        <span>Last Contacted: {formatDistanceToNow(new Date(client.metadata.last_contacted_at), { addSuffix: true })}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-800/50">
                <div className="flex items-center gap-2">
                    <Badge variant={stageVariants[client.salesStage as keyof typeof stageVariants] || 'neutral'}>
                        {client.salesStage.charAt(0).toUpperCase() + client.salesStage.slice(1)}
                    </Badge>
                    {client.value > 0 && (
                        <span className="text-sm font-semibold text-[var(--brand-blue-400)]">
                            ${client.value.toLocaleString()}
                        </span>
                    )}
                </div>
            </div>
        </Card>
    );
};

const AddClientModal = ({ onClose, onAdd }: any) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        salesStage: 'lead' as any,
        value: 0,
        description: '',
        industry: '',
        location: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAdd(formData);
    };

    return (
        <DetailDrawer open onOpenChange={(open) => { if (!open) onClose(); }} title="Register New Client Entity" size="wide">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Full Name"
                        required
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        icon={<Users className="w-5 h-5" />}
                    />
                    <Input
                        label="Email Address"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        icon={<Mail className="w-5 h-5" />}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Phone Number"
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        icon={<Phone className="w-5 h-5" />}
                    />
                    <Input
                        label="Industry"
                        placeholder="e.g. Technology"
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        icon={<Building className="w-5 h-5" />}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-300">Target Stage</label>
                        <select
                            value={formData.salesStage}
                            onChange={(e) => setFormData({ ...formData, salesStage: e.target.value as any })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue-500)]/50 transition-all font-medium"
                        >
                            <option value="lead">Lead</option>
                            <option value="prospect">Prospect</option>
                            <option value="customer">Customer</option>
                        </select>
                    </div>
                    <Input
                        label="Potential Value ($)"
                        type="number"
                        placeholder="0.00"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                    />
                </div>

                <Input
                    label="Biographical Notes"
                    textarea
                    placeholder="Key client details..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />

                <div className="flex gap-4 pt-4 border-t border-slate-800">
                    <Button variant="ghost" className="flex-1" onClick={onClose}>
                        Abort Registration
                    </Button>
                    <Button type="submit" className="flex-1">
                        Initialize Client Node
                    </Button>
                </div>
            </form>
        </DetailDrawer>
    );
};

const EditClientModal = ({ client, onClose, onSave }: { client: BusinessClient; onClose: () => void; onSave: (updates: Partial<BusinessClient>) => void }) => {
    const [formData, setFormData] = useState({
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        industry: client.industry || '',
        location: client.location || '',
        salesStage: client.salesStage,
        value: client.value,
        description: client.description || ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <DetailDrawer open onOpenChange={(open) => { if (!open) onClose(); }} title="Edit Client Information" size="wide">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Full Name"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        icon={<Users className="w-5 h-5" />}
                    />
                    <Input
                        label="Email Address"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        icon={<Mail className="w-5 h-5" />}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Phone Number"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        icon={<Phone className="w-5 h-5" />}
                    />
                    <Input
                        label="Industry"
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        icon={<Building className="w-5 h-5" />}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-300">Sales Stage</label>
                        <select
                            value={formData.salesStage}
                            onChange={(e) => setFormData({ ...formData, salesStage: e.target.value as any })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue-500)]/50 transition-all"
                        >
                            <option value="lead">Lead</option>
                            <option value="prospect">Prospect</option>
                            <option value="customer">Customer</option>
                            <option value="lost">Lost</option>
                        </select>
                    </div>
                    <Input
                        label="Potential Value ($)"
                        type="number"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                    />
                </div>

                <Input
                    label="Description"
                    textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />

                <div className="flex gap-4 pt-4 border-t border-slate-800">
                    <Button variant="outline" className="flex-1" onClick={onClose}>
                        Discard Changes
                    </Button>
                    <Button type="submit" className="flex-1">
                        Save Identity Updates
                    </Button>
                </div>
            </form>
        </DetailDrawer>
    );
};

const ImportClientsModal = ({ onClose, onImport }: any) => {
    const [importedClients, setImportedClients] = useState<any[]>([]);
    const [importing, setImporting] = useState(false);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: {
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'text/csv': ['.csv'],
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
        },
        onDrop: handleFileDrop
    });

    async function handleFileDrop(files: File[]) {
        if (files.length === 0) return;

        setImporting(true);
        const file = files[0];
        const fileType = file.name.split('.').pop()?.toLowerCase();

        try {
            let result;
            if (fileType === 'xlsx' || fileType === 'xls' || fileType === 'csv') {
                result = await fileImportService.importFromExcel(file);
            } else if (fileType === 'pdf') {
                result = await fileImportService.importFromPDF(file);
            } else if (fileType === 'doc' || fileType === 'docx') {
                result = await fileImportService.importFromWord(file);
            }

            if (result && !result.error) {
                setImportedClients(result.contacts);
            } else {
                toast.error(`Error importing file: ${result?.error}`);
            }
        } catch (error) {
            console.error('Import error:', error);
            toast.error('Error importing file');
        } finally {
            setImporting(false);
        }
    }

    const handleConfirmImport = () => {
        onImport(importedClients);
    };

    return (
        <DetailDrawer open onOpenChange={(open) => { if (!open) onClose(); }} title="Import Clients" size="wide">
                {importedClients.length === 0 ? (
                    <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${isDragActive
                            ? 'border-[var(--brand-blue-500)] bg-[var(--brand-blue-500)]/10'
                            : 'border-slate-700 hover:border-slate-600'
                            }`}
                    >
                        <input {...getInputProps()} />
                        <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                        <p className="text-lg font-medium mb-2">
                            {isDragActive ? 'Drop file here' : 'Drag & drop file here'}
                        </p>
                        <p className="text-sm text-slate-400 mb-4">
                            or click to browse
                        </p>
                        <p className="text-xs text-slate-500">
                            Supports: Excel (.xlsx, .xls), CSV, PDF, Word (.doc, .docx)
                        </p>
                        {importing && <p className="mt-4 text-[var(--brand-blue-400)]">Importing...</p>}
                    </div>
                ) : (
                    <div>
                        <p className="mb-4 text-slate-400">
                            Found {importedClients.length} contacts. Review and confirm import:
                        </p>
                        <div className="max-h-96 overflow-y-auto space-y-2 mb-6">
                            {importedClients.map((client, index) => (
                                <div key={index} className="bg-slate-800/50 p-3 rounded-lg">
                                    <p className="font-medium">{client.name || 'No name'}</p>
                                    <p className="text-sm text-slate-400">{client.email || 'No email'}</p>
                                    {client.phone && <p className="text-sm text-slate-400">{client.phone}</p>}
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setImportedClients([])}
                                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmImport}
                                className="flex-1 px-4 py-2 bg-[var(--brand-blue-500)] hover:bg-[var(--brand-blue-600)] rounded-lg transition-colors"
                            >
                                Import {importedClients.length} Clients
                            </button>
                        </div>
                    </div>
                )}
        </DetailDrawer>
    );
};

const CreateProposalModal = ({ client, user, onClose, onCreated }: { client: BusinessClient; user: User; onClose: () => void; onCreated: () => void }) => {
    const { currentTenant } = useTenant();
    const [formData, setFormData] = useState({
        name: `Proposal for ${client.name}`,
        category: 'Consulting',
        description: `Project proposal for ${client.name}. Generated from Client Nexus.`,
        budget: client.value || 0
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTenant?.id) {
            toast.error('No active workspace selected.');
            return;
        }
        setIsSubmitting(true);
        try {
            const { projectService } = await import('../../../services/projectService');
            const { error } = await projectService.createProject({
                ownerId: user.id,
                ownerName: user.name,
                name: formData.name,
                category: formData.category,
                description: formData.description,
                status: 'Pending',
                currentStage: 'Proposal',
                progress: 0,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                team: [],
                image: '',
                contractStatus: 'None',
                clientId: client.id,
                budget: formData.budget,
                isPublic: false,
                showInPortfolio: false,
                resources: [],
                startDate: new Date().toISOString()
            } as any);

            if (error) {
                toast.error(`Failed to create proposal: ${error}`);
            } else {
                onCreated();
            }
        } catch (err) {
            toast.error('An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DetailDrawer open onOpenChange={(open) => { if (!open) onClose(); }} title="Initialize Project Proposal" size="wide">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="p-4 bg-[var(--brand-blue-500)]/10 border border-[var(--brand-blue-500)]/20 rounded-xl mb-4">
                    <p className="text-sm text-[var(--brand-blue-200)]">
                        Initializing a formal proposal for <strong>{client.name}</strong>. This creates a pending project in your pipeline.
                    </p>
                </div>

                <Input
                    label="Project Title"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-300">Project Category</label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue-500)]/50 transition-all"
                        >
                            <option value="Web">Web Development</option>
                            <option value="Mobile">Mobile App</option>
                            <option value="AI">AI / Automation</option>
                            <option value="Consulting">Strategic Consulting</option>
                            <option value="Design">UI/UX Design</option>
                        </select>
                    </div>
                    <Input
                        label="Projected Budget ($)"
                        type="number"
                        value={formData.budget}
                        onChange={(e) => setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })}
                    />
                </div>

                <Input
                    label="Scope & Objectives"
                    textarea
                    placeholder="Describe the high-level goals of this proposal..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />

                <div className="flex gap-4 pt-4 border-t border-slate-800">
                    <Button variant="ghost" className="flex-1" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" className="flex-1" isLoading={isSubmitting}>
                        Generate Proposal
                    </Button>
                </div>
            </form>
        </DetailDrawer>
    );
};

const CreateClientInvoiceModal = ({ client, onClose, onCreated }: { client: BusinessClient; onClose: () => void; onCreated: () => void }) => {
    const router = useRouter();
    const { currentTenant } = useTenant();
    const [formData, setFormData] = useState({
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        description: `Services for ${client.name}`,
        amount: client.value || 0,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTenant) {
            toast.error('No active tenant. Please refresh the page.');
            return;
        }
        setIsSubmitting(true);
        try {
            const { businessInvoiceService } = await import('../../../services/businessInvoiceService');
            const { error } = await businessInvoiceService.createInvoice(currentTenant.id, {
                invoiceNumber: formData.invoiceNumber,
                clientId: client.id,
                issueDate: new Date().toISOString().split('T')[0],
                dueDate: formData.dueDate,
                lineItems: [
                    {
                        description: formData.description,
                        quantity: 1,
                        rate: formData.amount,
                        amount: formData.amount
                    }
                ],
                subtotal: formData.amount,
                taxRate: 0,
                tax: 0,
                discountAmount: 0,
                total: formData.amount,
                status: 'draft',
                notes: formData.notes,
                isPublic: false
            });

            if (error) {
                toast.error(`Failed to create invoice: ${error}`);
            } else {
                toast.success('Invoice created successfully!');
                showInvoiceCreatedWithSendPrompt((path) => router.push(path));
                onCreated();
            }
        } catch (err) {
            toast.error('An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DetailDrawer open onOpenChange={(open) => { if (!open) onClose(); }} title="Create Invoice" size="wide">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-3 bg-[var(--brand-blue-500)]/10 border border-[var(--brand-blue-500)]/20 rounded-xl">
                    <p className="text-sm text-[var(--brand-blue-200)]">
                        Creating invoice for <strong>{client.name}</strong>
                        {client.email && <span className="text-[var(--brand-blue-400)]"> · {client.email}</span>}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Invoice #"
                        required
                        value={formData.invoiceNumber}
                        onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    />
                    <Input
                        label="Due Date"
                        type="date"
                        required
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    />
                </div>

                <Input
                    label="Description"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />

                <Input
                    label="Amount ($)"
                    type="number"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                />

                <Input
                    label="Notes (optional)"
                    textarea
                    placeholder="Payment terms, additional details..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />

                <div className="flex gap-4 pt-2 border-t border-slate-800">
                    <Button variant="ghost" className="flex-1" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" className="flex-1" isLoading={isSubmitting}>
                        Create Invoice
                    </Button>
                </div>
            </form>
        </DetailDrawer>
    );
};

export default ClientsPage;
