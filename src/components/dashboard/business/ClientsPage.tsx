import { Input as AlphaCloneInput } from '@/components/ui/input';
import { Select as AlphaCloneSelect } from '@/components/ui/select';
import { Textarea as AlphaCloneTextarea } from '@/components/ui/textarea';
import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import Link from 'next/link';
import { offlineService } from '@/services/offlineService';
import { usePullToRefreshListener } from '@/components/common/DashboardScrollRegion';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { businessClientService, BusinessClient } from '../../../services/businessClientService';
import { clientActivityService } from '../../../services/clientActivityService';
import { fileImportService } from '../../../services/fileImportService';
import { resolveCanonicalPath } from '@/lib/dashboard/canonicalRoutes';
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
    MessageCircle,
    Receipt,
    ChevronLeft,
    FileSpreadsheet,
    Grid3X3,
    CheckCircle2,
        Clock,
    Send,
    DollarSign,
    UserCheck,
    CheckSquare,
    Square,
    Briefcase,
    FileCheck,
    ExternalLink,
    Copy,
    Globe
} from 'lucide-react';
import AIOutreachModal from './AIOutreachModal';
import { dashboardTimer } from '@/lib/dashboard/performance';
import { Button, Input, Badge, Dropdown, Card } from '../../ui/UIComponents';
import { WORKSPACE } from '@/constants/design';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { RecordHeader, AskBonnieButton } from '@/components/ui/os';
import { BusinessContextPanel } from '@/components/dashboard/crm/BusinessContextPanel';
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
import { formatDistanceToNow } from 'date-fns';
import { BatchOutreachFAB } from './BatchOutreachFAB';
import { BatchOutreachPanel } from './BatchOutreachPanel';
import { HelpDisclosure } from '@/components/ui/workspace/HelpDisclosure';
import { ContextualBulkBar, TableSkeleton } from '@/components/ui/workspace';
import { resolveContactDeepLink } from '@/lib/crm/resolveContactDeepLink';
import ClientPortalAccessPanel from './ClientPortalAccessPanel';
import { useQueryClient } from '@tanstack/react-query';
import { tenantQueryKeys } from '@/lib/cache/tenantQueryKeys';

const KanbanBoard = lazy(() => import('../crm/KanbanBoard'));
const DealsTab = lazy(() => import('../DealsTab'));
const ContactsList = lazy(() => import('../crm/ContactsList'));
const UnifiedContactsList = lazy(() => import('../crm/UnifiedContactsList'));

type ContactDirectoryView = 'sales' | 'email' | 'unified';

interface ClientsPageProps {
    user: User;
}

const ClientsPage: React.FC<ClientsPageProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const queryClient = useQueryClient();
    const router = useRouter();
    const rawPathname = usePathname() || '';
    const pathname = resolveCanonicalPath(rawPathname);

    const initialCached = currentTenant ? (
        queryClient.getQueryData<{ clients: BusinessClient[]; total: number; cursor: { createdAt: string; id: string } | null; hasMore: boolean; page: number }>(
            ['crm', 'clients', currentTenant.id, user.id, false, 'all', '']
        ) ||
        queryClient.getQueryData<{ clients: BusinessClient[] }>(
            tenantQueryKeys.clients(currentTenant.id, 'default')
        )
    ) : null;

    const [clients, setClients] = useState<BusinessClient[]>(() => initialCached?.clients || []);
    const [filteredClients, setFilteredClients] = useState<BusinessClient[]>([]);
    const [searchTerm, setSearchTerm] = useState(() =>
        typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('search') || ''
    );
    const [selectedStage, setSelectedStage] = useState<string>(() =>
        typeof window === 'undefined' ? 'all' : new URLSearchParams(window.location.search).get('stage') || 'all'
    );
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingClient, setEditingClient] = useState<BusinessClient | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [loading, setLoading] = useState<boolean>(() => !initialCached || initialCached.clients.length === 0);
    const clientRequestSequence = useRef(0);
    const clientsSnapshotRef = useRef<BusinessClient[]>([]);
    const loadedTenantRef = useRef<string | null>(null);
    const previousSearchRef = useRef(searchTerm);
    const [totalCount, setTotalCount] = useState<number>(() => (initialCached as any)?.total || initialCached?.clients?.length || 0);
    const [viewMode, setViewMode] = useState<'list' | 'board' | 'micro'>('list');
    const [showProposalModal, setShowProposalModal] = useState(false);
    const [selectedClientForProposal, setSelectedClientForProposal] = useState<BusinessClient | null>(null);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [selectedClientForInvoice, setSelectedClientForInvoice] = useState<BusinessClient | null>(null);
    const [showCommunicationModal, setShowCommunicationModal] = useState(false);
    const [selectedClientForCommunication, setSelectedClientForCommunication] = useState<BusinessClient | null>(null);
    const [selectedClient, setSelectedClient] = useState<BusinessClient | null>(null);
    const [portalAccessClient, setPortalAccessClient] = useState<BusinessClient | null>(null);
    const [clientTimeline, setClientTimeline] = useState<any>(null);
    const [timelineLoading, setTimelineLoading] = useState(false);
    type ClientDetailTab = 'timeline' | 'projects' | 'invoices' | 'contracts' | 'portal' | 'messages' | 'notes' | 'properties';
    const [activeTab, setActiveTab] = useState<ClientDetailTab>('timeline');
    const [clientProjects, setClientProjects] = useState<any[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [clientContracts, setClientContracts] = useState<any[]>([]);
    const [contractsLoading, setContractsLoading] = useState(false);
    const [portalUrl, setPortalUrl] = useState<string | null>(null);
    const [portalUrlLoading, setPortalUrlLoading] = useState(false);
    const [invitingClient, setInvitingClient] = useState(false);
    const [clientMessages, setClientMessages] = useState<Array<{ id: string; created_at: string; author_name: string; content: string; is_client: boolean }>>([]);
    const clientMessagesRequest = useRef(0);
    const [clientMessageDraft, setClientMessageDraft] = useState('');
    const [clientMessageSending, setClientMessageSending] = useState(false);
    const [copiedPortalUrl, setCopiedPortalUrl] = useState(false);
    const [newNoteTitle, setNewNoteTitle] = useState('');
    const [newNoteDescription, setNewNoteDescription] = useState('');
    const [noteSubmitting, setNoteSubmitting] = useState(false);
    const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
    const [showOutreachModal, setShowOutreachModal] = useState(false);
    const [showOutreachPanel, setShowOutreachPanel] = useState(false);
    const [page, setPage] = useState(1);
    const [clientCursor, setClientCursor] = useState<{ createdAt: string; id: string } | null>(null);
    const [showArchived, setShowArchived] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [directoryView, setDirectoryView] = useState<ContactDirectoryView>(() =>
        pathname === '/dashboard/crm/unified-contacts' ? 'unified' : 'sales'
    );

    const openContactDetail = useCallback((client: BusinessClient) => {
        setSelectedClient(client);
        setViewMode('list');
    }, []);

    const searchParams = useSearchParams();
    const stageParam = searchParams?.get('stage');
    const contactParam = searchParams?.get('contact') ?? searchParams?.get('contactId');
    const clientTabParam = searchParams?.get('clientTab');
    const directoryParam = searchParams?.get('directory');
    const PAGE_SIZE = 50;

    useEffect(() => {
        const timer = window.setTimeout(() => {
            const params = new URLSearchParams(window.location.search);
            if ((params.get('search') || '') === searchTerm.trim()
                && (params.get('stage') || 'all') === selectedStage) return;
            if (searchTerm.trim()) params.set('search', searchTerm.trim());
            else params.delete('search');
            if (selectedStage !== 'all') params.set('stage', selectedStage);
            else params.delete('stage');
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }, 350);
        return () => window.clearTimeout(timer);
    }, [searchTerm, selectedStage, pathname, router]);

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

    const loadClientProjects = useCallback(async (clientId: string) => {
        if (!currentTenant?.id) return;
        setProjectsLoading(true);
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('id, name, status, progress, updated_at, budget')
                .eq('tenant_id', currentTenant.id)
                .eq('client_id', clientId)
                .order('updated_at', { ascending: false });
            if (!error && data) {
                setClientProjects(data);
            }
        } catch (err) {
            console.error('Failed to load client projects:', err);
        } finally {
            setProjectsLoading(false);
        }
    }, [currentTenant?.id]);

    const loadClientContracts = useCallback(async (clientId: string) => {
        if (!currentTenant?.id) return;
        setContractsLoading(true);
        try {
            const { data, error } = await supabase
                .from('contracts')
                .select('id, title, status, value, created_at, expires_at')
                .eq('tenant_id', currentTenant.id)
                .eq('client_id', clientId)
                .order('created_at', { ascending: false });
            if (!error && data) {
                setClientContracts(data);
            }
        } catch (err) {
            console.error('Failed to load client contracts:', err);
        } finally {
            setContractsLoading(false);
        }
    }, [currentTenant?.id]);

    const loadClientPortalUrl = useCallback(async (clientId: string) => {
        if (!currentTenant?.id) return;
        setPortalUrlLoading(true);
        try {
            const res = await fetch(
                `/api/client-finance/portal-link/${clientId}?tenantId=${encodeURIComponent(currentTenant.id)}`
            );
            if (res.ok) {
                const data = await res.json();
                if (data.url) setPortalUrl(data.url);
            }
        } catch (err) {
            console.error('Failed to fetch portal link:', err);
        } finally {
            setPortalUrlLoading(false);
        }
    }, [currentTenant?.id]);

    const loadClientMessages = useCallback(async (clientId: string) => {
        if (!currentTenant?.id) return;
        const request = ++clientMessagesRequest.current;
        try {
            const response = await fetch(`/api/tenant/${currentTenant.id}/clients/${clientId}/messages`, { cache: 'no-store' });
            if (!response.ok) throw new Error('Messages could not be loaded');
            const result = await response.json();
            if (request === clientMessagesRequest.current) setClientMessages(result.messages || []);
        } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Messages could not be loaded'); }
    }, [currentTenant?.id]);

    const handleTabChange = useCallback((tab: ClientDetailTab) => {
        setActiveTab(tab);
        if (!selectedClient?.id) return;
        if (tab === 'projects' && clientProjects.length === 0) {
            void loadClientProjects(selectedClient.id);
        } else if (tab === 'contracts' && clientContracts.length === 0) {
            void loadClientContracts(selectedClient.id);
        } else if (tab === 'portal' && !portalUrl) {
            void loadClientPortalUrl(selectedClient.id);
        } else if (tab === 'messages') {
            void loadClientMessages(selectedClient.id);
        }
    }, [selectedClient, clientProjects.length, clientContracts.length, portalUrl, loadClientProjects, loadClientContracts, loadClientPortalUrl, loadClientMessages]);

    useEffect(() => {
        if (activeTab !== 'messages' || !selectedClient?.id) return;
        const id = selectedClient.id;
        const interval = setInterval(() => { void loadClientMessages(id); }, 20_000);
        return () => clearInterval(interval);
    }, [activeTab, selectedClient?.id, loadClientMessages]);

    const clientMessageRequest=useRef<{id:string;content:string;clientId:string}|null>(null);
    const sendClientMessage = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!currentTenant?.id || !selectedClient?.id || !clientMessageDraft.trim() || clientMessageSending) return;
        if(!clientMessageRequest.current || clientMessageRequest.current.content!==clientMessageDraft || clientMessageRequest.current.clientId!==selectedClient.id) clientMessageRequest.current={id:crypto.randomUUID(),content:clientMessageDraft,clientId:selectedClient.id};
        setClientMessageSending(true);
        try {
            const response = await fetch(`/api/tenant/${currentTenant.id}/clients/${selectedClient.id}/messages`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: clientMessageDraft,requestId:clientMessageRequest.current.id }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || 'Message could not be sent');
            clientMessageRequest.current=null;
            setClientMessageDraft('');
            await loadClientMessages(selectedClient.id);
            if(result.replayed) toast.success('Message already saved');
            else if (!result.notification?.sent) toast(`Message saved, but email was not sent: ${result.notification?.error || 'delivery unavailable'}`);
            else toast.success('Message saved; email notification accepted');
        } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Message could not be sent'); }
        finally { setClientMessageSending(false); }
    };

    useEffect(() => {
        clientMessagesRequest.current += 1;
        if (selectedClient?.id) {
            void loadClientTimeline(selectedClient.id);
            const openMessages = contactParam === selectedClient.id && clientTabParam === 'messages';
            setActiveTab(openMessages ? 'messages' : 'timeline');
            if (openMessages) void loadClientMessages(selectedClient.id);
            setClientProjects([]);
            setClientContracts([]);
            setPortalUrl(null);
            setCopiedPortalUrl(false);
            setClientMessages([]);
            clientMessageRequest.current=null;
            setClientMessageDraft('');
        } else {
            setClientTimeline(null);
            setClientProjects([]);
            setClientContracts([]);
            setPortalUrl(null);
            setCopiedPortalUrl(false);
        }
    }, [selectedClient, loadClientTimeline, loadClientMessages, contactParam, clientTabParam]);

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClient?.id || !newNoteTitle.trim()) return;

        setNoteSubmitting(true);
        try {
            const title = newNoteTitle.trim();
            const description = newNoteDescription.trim();

            if (!offlineService.isOnline() && currentTenant?.id) {
                await offlineService.init();
                await offlineService.enqueueMutation(
                    { tenantId: currentTenant.id, userId: user.id },
                    'note.create',
                    {
                        clientId: selectedClient.id,
                        title,
                        description,
                        createdBy: user.id,
                    },
                );
                setClientTimeline((current: { activities?: Array<Record<string, unknown>> } | null) => ({
                    ...(current || { activities: [] }),
                    activities: [
                        {
                            id: `offline-${Date.now()}`,
                            activity_type: 'note',
                            title,
                            description,
                            created_at: new Date().toISOString(),
                            created_by: user.id,
                            metadata: { offlineQueued: true },
                        },
                        ...(current?.activities || []),
                    ],
                }));
                toast.success('Note saved offline — it will sync when you reconnect.');
                setNewNoteTitle('');
                setNewNoteDescription('');
                return;
            }

            const { activity, error } = await clientActivityService.addClientNote(
                selectedClient.id,
                title,
                description,
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
        if (loadedTenantRef.current !== currentTenant.id) {
            loadedTenantRef.current = currentTenant.id;
            clientsSnapshotRef.current = [];
            setClients([]);
            setSelectedClient(null);
        }
        const endTimer = dashboardTimer('crm-clients-page');
        const requestId = ++clientRequestSequence.current;
        const cacheKey = ['crm', 'clients', currentTenant.id, user.id, showArchived, selectedStage, searchTerm.trim().toLowerCase()];
        const cached = isInitial
            ? queryClient.getQueryData<{ clients: BusinessClient[]; total: number; cursor: { createdAt: string; id: string } | null; hasMore: boolean; page: number }>(cacheKey)
            : null;
        if (cached) {
            clientsSnapshotRef.current = cached.clients;
            setClients(cached.clients);
            setPage(cached.page || 1);
            setTotalCount(cached.total);
            setClientCursor(cached.cursor);
            setHasMore(cached.hasMore);
            setLoading(false);
        } else if (isInitial) {
            setLoading(true);
        }

        const targetPage = isInitial ? 1 : page + 1;
        const { clients: data, pageInfo, error } = await businessClientService.getClientsCursorPage(currentTenant.id, {
            limit: PAGE_SIZE, cursor: isInitial ? null : clientCursor, showArchived, search: searchTerm, stage: selectedStage,
        });
        if (requestId !== clientRequestSequence.current) {
            endTimer();
            return;
        }
        if (error) {
            if (!cached) toast.error(error);
            setLoading(false);
            endTimer();
            return;
        }

        if (isInitial) {
            const previousPage = cached?.page || 1;
            const next = previousPage > 1
                ? [...data, ...cached!.clients.filter(client => !data.some(fresh => fresh.id === client.id))]
                : data;
            clientsSnapshotRef.current = next;
            setClients(next);
            setPage(previousPage);
            setTotalCount(pageInfo.total);
            const nextCursor = previousPage > 1 ? cached!.cursor : pageInfo.nextCursor;
            const nextHasMore = previousPage > 1 ? cached!.hasMore : pageInfo.hasMore;
            setClientCursor(nextCursor);
            setHasMore(nextHasMore);
            queryClient.setQueryData(cacheKey, { clients: next, total: pageInfo.total, cursor: nextCursor, hasMore: nextHasMore, page: previousPage });
            queryClient.setQueryData(tenantQueryKeys.clients(currentTenant.id, 'default'), { clients: next });
        } else {
            const seen = new Set(clientsSnapshotRef.current.map(client => client.id));
            const next = [...clientsSnapshotRef.current, ...data.filter(client => !seen.has(client.id))];
            clientsSnapshotRef.current = next;
            setClients(next);
            setPage(targetPage);
            queryClient.setQueryData(cacheKey, { clients: next, total: totalCount, cursor: pageInfo.nextCursor, hasMore: pageInfo.hasMore, page: targetPage });
        }

        if (!isInitial) {
            setClientCursor(pageInfo.nextCursor);
            setHasMore(pageInfo.hasMore);
        }
        setLoading(false);
        endTimer();
    }, [currentTenant, user.id, queryClient, page, totalCount, clientCursor, showArchived, selectedStage, searchTerm]);

    useEffect(() => {
        if (!currentTenant) return;
        if (['/dashboard/crm', '/dashboard/leads', '/dashboard/deals'].includes(pathname)) {
            setLoading(false);
            return;
        }
        void loadClients(true);
    }, [currentTenant, pathname, showArchived, selectedStage]);

    // Debounced server fetch when user types into the search bar
    useEffect(() => {
        if (!currentTenant) return;
        if (previousSearchRef.current === searchTerm) return;
        previousSearchRef.current = searchTerm;
        const timer = setTimeout(() => {
            void loadClients(true);
        }, 350);
        return () => clearTimeout(timer);
    }, [searchTerm, currentTenant]);

    usePullToRefreshListener(() => loadClients(true), Boolean(currentTenant));

    useEffect(() => {
        if (stageParam) {
            setSelectedStage(stageParam);
        }
    }, [stageParam]);

    useEffect(() => {
        if (!contactParam || !currentTenant?.id) return;

        if (pathname === '/dashboard/leads') {
            router.replace(
                `/dashboard/crm/unified-contacts?contactId=${encodeURIComponent(contactParam)}`,
                { scroll: false }
            );
            return;
        }

        let cancelled = false;
        const resolveDeepLink = async () => {
            const resolved = await resolveContactDeepLink(
                supabase,
                currentTenant.id,
                contactParam,
                clients.map((client) => ({ id: client.id, crmContactId: client.crmContactId }))
            );
            if (cancelled) return;

            if (resolved.kind === 'business_client') {
                const match =
                    clients.find((client) => client.id === resolved.clientId) ||
                    (await businessClientService.getClient(resolved.clientId)).client;
                if (match) {
                    setSelectedClient(match);
                    setViewMode('list');
                    setDirectoryView('sales');
                }
                return;
            }

            if (resolved.kind === 'contacts_only') {
                router.replace(
                    `/dashboard/contacts?directory=email&contactId=${encodeURIComponent(resolved.contactId)}`,
                    { scroll: false }
                );
                return;
            }

            if (resolved.kind === 'lead') {
                router.replace(
                    `/dashboard/leads?leadId=${encodeURIComponent(resolved.leadId)}`,
                    { scroll: false }
                );
            }
        };

        void resolveDeepLink();
        return () => {
            cancelled = true;
        };
    }, [contactParam, clients, currentTenant?.id, pathname, router]);

    useEffect(() => {
        if (searchParams?.get('add') === 'true') {
            setShowAddModal(true);
            const params = new URLSearchParams(searchParams.toString());
            params.delete('add');
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
    }, [searchParams, pathname, router]);

    useEffect(() => {
        if (directoryParam === 'email') setDirectoryView('email');
        else if (directoryParam === 'sales') setDirectoryView('sales');
        else if (directoryParam === 'unified') setDirectoryView('unified');
        else if (pathname === '/dashboard/crm/unified-contacts' && !directoryParam) {
            setDirectoryView('unified');
        }
    }, [directoryParam, pathname]);

    const contactsBasePath =
        pathname === '/dashboard/crm/unified-contacts'
            ? '/dashboard/crm/unified-contacts'
            : pathname === '/dashboard/business/clients'
              ? '/dashboard/business/clients'
              : '/dashboard/contacts';

    const setDirectoryViewAndUrl = (view: ContactDirectoryView) => {
        setDirectoryView(view);
        router.replace(`${contactsBasePath}?directory=${view}`, { scroll: false });
    };

    const directorySwitcher = (
        <div>
            <div className={`${WORKSPACE.tab.base} flex w-full gap-1 sm:w-fit`} role="group" aria-label="Contact directory view">
                <button
                    type="button"
                    onClick={() => setDirectoryViewAndUrl('unified')}
                    aria-pressed={directoryView === 'unified'}
                    className={`${WORKSPACE.tab.base} flex-1 sm:flex-none ${directoryView === 'unified' ? WORKSPACE.tab.active : ''}`}
                >
                    Unified
                </button>
                <button
                    type="button"
                    onClick={() => setDirectoryViewAndUrl('sales')}
                    aria-pressed={directoryView === 'sales'}
                    className={`${WORKSPACE.tab.base} flex-1 sm:flex-none ${directoryView === 'sales' ? WORKSPACE.tab.active : ''}`}
                >
                    Sales pipeline
                </button>
                <button
                    type="button"
                    onClick={() => setDirectoryViewAndUrl('email')}
                    aria-pressed={directoryView === 'email'}
                    className={`${WORKSPACE.tab.base} flex-1 sm:flex-none ${directoryView === 'email' ? WORKSPACE.tab.active : ''}`}
                >
                    Email list
                </button>
            </div>
        </div>
    );

    useEffect(() => {
        let filtered = clients;
        if (selectedStage !== 'all') {
            filtered = filtered.filter((c) => c.salesStage === selectedStage);
        }
        if (searchTerm.trim()) {
            const term = searchTerm.trim().toLowerCase();
            filtered = filtered.filter((c) =>
                (c.name && c.name.toLowerCase().includes(term)) ||
                (c.email && c.email.toLowerCase().includes(term)) ||
                (c.phone && c.phone.toLowerCase().includes(term)) ||
                (c.industry && c.industry.toLowerCase().includes(term)) ||
                (c.location && c.location.toLowerCase().includes(term))
            );
        }
        setFilteredClients(filtered);
    }, [clients, selectedStage, searchTerm]);

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
        if (filteredClients.length > 500) toast('Selected the first 500 loaded contacts.');
    };

    const renderBulkSelectRow = () => (
        <div className="flex items-center justify-between px-1">
            <button
                type="button"
                onClick={toggleSelectAllFiltered}
                className="inline-flex items-center gap-2 type-caption font-semibold text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)]"
            >
                {allFilteredClientsSelected ? (
                    <CheckSquare className="w-4 h-4 text-[var(--brand-blue-400)]" />
                ) : (
                    <Square className="w-4 h-4" />
                )}
                {allFilteredClientsSelected ? 'Deselect all loaded contacts' : `Select ${Math.min(filteredClients.length, 500)} loaded contacts${filteredClients.length > 500 ? ' (limit 500)' : ''}`}
            </button>
            {selectedClientIds.length > 0 && (
                <button
                    type="button"
                    onClick={() => setSelectedClientIds([])}
                    className="type-caption text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)]"
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
        <div className="flex items-center justify-center min-h-[320px] rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)]/50">
            <div className="text-[var(--ws-text-muted)] type-ui font-medium">Loading...</div>
        </div>
    );

    if (pathname === '/dashboard/crm') {
        return (
            <div className="space-y-6 w-full min-w-0 min-h-[60vh]">
                <CRMTab user={user} />
            </div>
        );
    }

    if (pathname === '/dashboard/leads') {
        return (
            <div className="w-full min-w-0 min-h-[60vh]">
                <Suspense fallback={crmSectionFallback}>
                    <KanbanBoard />
                </Suspense>
            </div>
        );
    }

    if (pathname === '/dashboard/deals') {
        return (
            <div className="w-full min-w-0 min-h-[60vh]">
                <Suspense fallback={crmSectionFallback}>
                    <DealsTab user={user} />
                </Suspense>
            </div>
        );
    }

    const isContactsRoute = [
        '/dashboard/contacts',
        '/dashboard/business/clients',
        '/dashboard/clients',
        '/dashboard/crm/unified-contacts',
        '/dashboard/leads',
    ].includes(pathname);

    if (isContactsRoute && directoryView === 'email') {
        return (
            <div className="space-y-3 w-full min-w-0 ac-scroll-full ac-enterprise-module">
                {directorySwitcher}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h1 className="text-lg font-semibold text-[var(--ws-text-primary)]">Email contacts</h1>
                        <p className="type-card-description text-[var(--ws-text-muted)]">Select a contact to open its details without leaving this list.</p>
                    </div>
                </div>
                <Suspense fallback={crmSectionFallback}>
                    <ContactsList highlightContactId={contactParam} />
                </Suspense>
            </div>
        );
    }

    if (isContactsRoute && directoryView === 'unified') {
        return (
            <div className="space-y-3 w-full min-w-0 ac-scroll-full ac-enterprise-module">
                {directorySwitcher}
                <Suspense fallback={crmSectionFallback}>
                    <UnifiedContactsList
                        highlightContactId={contactParam}
                        onOpenClient={async (clientId) => {
                            const { client } = await businessClientService.getClient(clientId);
                            if (client) openContactDetail(client);
                        }}
                        onOpenContact={(contactId) => {
                            router.push(`/dashboard/contacts?directory=email&contactId=${encodeURIComponent(contactId)}`, { scroll: false });
                        }}
                    />
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
                {isContactsRoute && directorySwitcher}
                {/* Simplified Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <h2 className="text-lg sm:text-xl font-semibold text-[var(--ws-text-primary)] tracking-tight">Customers</h2>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge variant="blue">{totalCount || clients.length} total</Badge>
                            <p className="text-[var(--ws-text-muted)] type-caption font-bold uppercase tracking-wide">CRM</p>
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

                {/* Simple Client List */}
                <div className="space-y-2">
                    {filteredClients.map(client => (
                        <div key={client.id} className="p-3 bg-[var(--ws-surface-primary)] border border-[var(--ws-border)] rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--brand-blue-500)] to-[var(--brand-blue-700)] flex items-center justify-center font-bold text-[var(--text-inverse)] type-caption">
                                    {(client.name || '?').charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-[var(--ws-text-primary)] type-ui">{client.name}</h3>
                                    <p className="type-card-description text-[var(--ws-text-muted)]">{client.email || client.phone || 'No contact'}</p>
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
            <div className="space-y-4 sm:space-y-6 w-full min-w-0 ac-scroll-full ac-enterprise-module">
                {directorySwitcher}
                <div className="pt-2">
                    <TableSkeleton rows={8} columns={5} />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3 w-full min-w-0 ac-scroll-full ac-enterprise-module">
            {directorySwitcher}
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-semibold text-[var(--ws-text-primary)] tracking-tight">Contacts</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="blue">{totalCount || clients.length} total</Badge>
                        <p className="text-[var(--ws-text-muted)] type-caption font-bold uppercase tracking-wide">Pipeline</p>
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
                    <div className="flex bg-[var(--ws-surface-primary)] border border-[var(--ws-border)] rounded-xl overflow-hidden p-1">
                        <button
                            onClick={() => setViewMode('list')}
                            title="List view"
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[var(--brand-blue-500)] text-[var(--text-inverse)] shadow-lg shadow-[var(--brand-blue-500)]/20' : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] hover:bg-[var(--ws-hover)]'}`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('board')}
                            title="Card view"
                            className={`p-2 rounded-lg transition-all ${viewMode === 'board' ? 'bg-[var(--brand-blue-500)] text-[var(--text-inverse)] shadow-lg shadow-[var(--brand-blue-500)]/20' : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] hover:bg-[var(--ws-hover)]'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('micro')}
                            title="Micro grid view"
                            className={`p-2 rounded-lg transition-all ${viewMode === 'micro' ? 'bg-[var(--brand-blue-500)] text-[var(--text-inverse)] shadow-lg shadow-[var(--brand-blue-500)]/20' : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] hover:bg-[var(--ws-hover)]'}`}
                        >
                            <Grid3X3 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <ContextualBulkBar
                selectedCount={selectedClientIds.length}
                itemLabel={{ singular: 'contact', plural: 'contacts' }}
                onClearSelection={() => setSelectedClientIds([])}
                actions={
                    <>
                <Button
                    variant="outline"
                    size="sm"
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
                    Archive
                </Button>
                <Button
                    variant="outline"
                    size="sm"
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
                    Email
                </Button>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowOutreachModal(true)}
                    icon={<Users className="w-4 h-4" />}
                    className="bg-[var(--brand-blue-600)] hover:bg-[var(--brand-blue-500)] shadow-sm"
                >
                    Outreach
                </Button>
                    </>
                }
            />

            {viewMode === 'micro' ? (
                /* ── MICRO VIEW: tiny pill chips with full contact slide-in ── */
                <div className="space-y-4">
                    {/* Search + Filter */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ws-text-muted)]" />
                            <AlphaCloneInput type="text" placeholder="Search contacts..."
                                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 transition-all"
                            />
                        </div>
                        <AlphaCloneSelect value={selectedStage} onChange={e => setSelectedStage(e.target.value)}
                            className="px-3 py-2">
                            <option value="all">All Stages</option>
                            <option value="lead">Lead</option>
                            <option value="prospect">Prospect</option>
                            <option value="customer">Customer</option>
                            <option value="lost">Lost</option>
                        </AlphaCloneSelect>
                    </div>

                    {renderBulkSelectRow()}

                    {/* Micro grid — tiny chips */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                        {filteredClients.map(client => {
                            const initials = (client.name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                            const isSelected = selectedClientIds.includes(client.id);
                            const stageDot: Record<string, string> = {
                                lead: 'bg-cyan-400', prospect: 'bg-blue-400',
                                customer: 'bg-[var(--success-500)]', lost: 'bg-[var(--error-500)]'
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
                                    className={`group relative flex flex-col items-center gap-1.5 p-2 rounded-xl bg-[var(--ws-panel)]/70 border transition-all text-center ${isSelected ? 'border-[var(--brand-blue-500)]/60 bg-[var(--brand-blue-500)]/10' : 'border-[var(--ws-border)] hover:border-[var(--brand-blue-500)]/50 hover:bg-[var(--ws-surface-secondary)]/80'}`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggleClientSelection(client.id)}
                                        className="absolute top-1 left-1 min-w-9 min-h-9 flex items-center justify-center text-[var(--ws-text-muted)] hover:text-[var(--brand-blue-400)]"
                                        aria-label={`Select ${client.name}`}
                                        role="checkbox"
                                        aria-checked={isSelected}
                                    >
                                        {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-[var(--brand-blue-400)]" /> : <Square className="w-3.5 h-3.5" />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openContactDetail(client)}
                                    title={`${client.name}\n${client.industry || ''}\n${client.salesStage}`}
                                    className="flex flex-col items-center gap-1.5 w-full hover:-translate-y-0.5 transition-transform cursor-pointer"
                                >
                                    {/* Avatar */}
                                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${stageGrad[client.salesStage] || 'from-[var(--brand-blue-500)] to-[var(--brand-blue-700)]'} flex items-center justify-center font-bold text-[var(--text-inverse)] type-caption relative`}>
                                        {initials}
                                        <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${stageDot[client.salesStage] || 'bg-slate-500'}`} />
                                    </div>
                                    {/* Name truncated to ~8 chars */}
                                    <p className="type-card-description font-semibold text-[var(--ws-text-secondary)] group-hover:text-[var(--ws-text-primary)] leading-tight w-full truncate">
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
                    <div className="flex items-center gap-4 type-caption text-[var(--ws-text-muted)] border-t border-[var(--ws-border)]/50 pt-2">
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
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ws-text-muted)]" />
                            <AlphaCloneInput
                                type="text"
                                placeholder="Search contacts..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 transition-all"
                            />
                        </div>
                        <AlphaCloneSelect
                            value={selectedStage}
                            onChange={(e) => setSelectedStage(e.target.value)}
                            className="px-3 py-2 transition-all"
                        >
                            <option value="all">All Stages</option>
                            <option value="lead">Lead</option>
                            <option value="prospect">Prospect</option>
                            <option value="customer">Customer</option>
                            <option value="lost">Lost</option>
                        </AlphaCloneSelect>
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
                                        onOpen={openContactDetail}
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
                <div className="flex flex-col lg:flex-row gap-4 min-h-[min(72dvh,680px)] lg:min-h-0 max-h-[min(92dvh,880px)] lg:max-h-none lg:h-[min(88dvh,900px)] overflow-hidden">
                    {/* Left Pane: Search + List */}
                    <div className={`flex flex-col gap-3 sm:gap-4 min-h-0 h-full ${selectedClient ? 'hidden lg:flex w-full lg:w-1/3 lg:max-w-[350px]' : 'w-full'} overflow-hidden`}>
                        <div className="flex flex-col gap-4 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--ws-text-muted)]" />
                                <AlphaCloneInput
                                    type="text"
                                    placeholder="Search clients..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 sm:py-2.5 transition-all font-medium"
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
                                        className={`h-8 px-3 rounded-full type-caption font-semibold whitespace-nowrap transition-all border ${
                                            selectedStage === stage.value
                                                ? 'bg-[var(--brand-blue-600)] text-[var(--text-inverse)] border-[var(--brand-blue-600)] shadow-sm shadow-[var(--brand-blue-600)]/10'
                                                : 'bg-[var(--ws-surface-primary)] text-[var(--ws-text-muted)] border-[var(--ws-border)] hover:text-[var(--ws-text-primary)] hover:bg-[var(--ws-hover)]'
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
                                className="type-caption font-semibold uppercase tracking-wide text-[var(--ws-text-muted)] hover:text-[var(--brand-blue-400)] transition-colors"
                            >
                                {selectedClientIds.length > 0 ? 'Deselect All' : `Select All (Max 500)`}
                            </button>
                            {selectedClientIds.length >= 500 && (
                                <span className="type-caption font-semibold text-amber-500 uppercase tracking-tighter leading-tight max-w-[80px] text-right">Batch Limit Reached</span>
                            )}
                        </div>

                        <div className="flex-1 ac-scroll-pane space-y-2 pr-2 custom-scrollbar">
                            {filteredClients.map(client => (
                                <div
                                    key={client.id}
                                    className={`group p-3 rounded-xl cursor-pointer transition-all border flex items-center gap-3 ${selectedClient?.id === client.id ? 'bg-[var(--brand-blue-500)]/10 border-[var(--brand-blue-500)] shadow-sm shadow-[var(--brand-blue-500)]/20' : 'bg-[var(--ws-surface-primary)] border-[var(--ws-border)] hover:bg-[var(--ws-hover)] hover:border-[var(--ws-border-strong)]'}`}
                                    onClick={() => openContactDetail(client)}
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
                                            className="w-4 h-4 rounded border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] text-[var(--brand-blue-600)] focus:ring-[var(--brand-blue-500)]/20"
                                        />
                                        <div className="w-9 h-9 rounded-full bg-[var(--ws-surface-secondary)] border border-[var(--ws-border)] flex items-center justify-center font-semibold text-[var(--ws-text-secondary)] type-caption shrink-0">
                                            {(client.name || '?').charAt(0)}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-[var(--ws-text-primary)] type-ui truncate">{client.name}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="px-2 py-0.5 rounded-full type-caption font-bold tracking-tight bg-[var(--ws-surface-secondary)] border border-[var(--ws-border)] text-[var(--brand-blue-400)] uppercase">
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
                                        className="text-[var(--brand-blue-500)] hover:text-[var(--brand-blue-400)] font-bold uppercase tracking-wide type-caption"
                                    >
                                        Load More Contacts
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Pane: Details */}
                    <div className={`flex-1 min-h-[min(68dvh,640px)] lg:min-h-0 min-w-0 ${!selectedClient ? 'hidden lg:flex' : 'flex'} flex-col ac-workspace-panel rounded-lg overflow-hidden`}>
                        {selectedClient ? (
                            <div className="flex flex-col flex-1 min-h-0 overflow-hidden animate-in fade-in duration-300">
                                <div className="lg:hidden flex items-center justify-between px-3 py-2.5 border-b border-[var(--ws-border)] bg-[var(--ws-toolbar)] sticky top-0 z-10 shrink-0">
                                    <button onClick={() => setSelectedClient(null)} className="flex items-center gap-1.5 text-[var(--brand-blue-400)] text-sm font-medium">
                                        <ChevronLeft className="w-4 h-4" /> Back
                                    </button>
                                    <Badge variant={selectedClient.salesStage === 'customer' ? 'success' : selectedClient.salesStage === 'lost' ? 'error' : 'blue'}>
                                        {selectedClient.salesStage.charAt(0).toUpperCase() + selectedClient.salesStage.slice(1)}
                                    </Badge>
                                </div>

                                <div className="flex flex-1 min-h-0 gap-4">
                                <div className="min-w-0 p-3 sm:p-5 lg:p-6 flex flex-col flex-1 ac-scroll-pane custom-scrollbar">
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
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    icon={<Mail className="w-4 h-4" />}
                                                    onClick={() => {
                                                        setSelectedClientForCommunication(selectedClient);
                                                        setShowCommunicationModal(true);
                                                    }}
                                                >
                                                    Send Email
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    icon={<FilePlus className="w-4 h-4" />}
                                                    onClick={() => {
                                                        setSelectedClientForProposal(selectedClient);
                                                        setShowProposalModal(true);
                                                    }}
                                                >
                                                    Quote / Proposal
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    icon={<DollarSign className="w-4 h-4" />}
                                                    onClick={() => {
                                                        setSelectedClientForInvoice(selectedClient);
                                                        setShowInvoiceModal(true);
                                                    }}
                                                >
                                                    Invoice
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    icon={<Briefcase className="w-4 h-4" />}
                                                    onClick={() => router.push(`/dashboard/projects?clientId=${encodeURIComponent(selectedClient.id)}`)}
                                                >
                                                    Project
                                                </Button>
                                                <Dropdown
                                                    trigger={<Button size="sm" variant="ghost" aria-label={`More actions for ${selectedClient.name}`} className="!p-2 hover:bg-[var(--ws-surface-secondary)] rounded-xl" icon={<MoreVertical className="w-5 h-5 text-[var(--ws-text-muted)]" />} />}
                                                    items={[
                                                        { label: 'Set up client portal', icon: <UserCheck className="w-4 h-4"/>, onClick: () => setPortalAccessClient(selectedClient) },
                                                        { label: 'Create Contract', icon: <FileCheck className="w-4 h-4"/>, onClick: () => router.push(`/dashboard/business/contracts?clientId=${encodeURIComponent(selectedClient.id)}`) },
                                                        { label: 'Schedule Meeting', icon: <Calendar className="w-4 h-4"/>, onClick: () => router.push(`/dashboard/calendar?clientId=${encodeURIComponent(selectedClient.id)}`) },
                                                        { label: 'Open Communications', icon: <MessageCircle className="w-4 h-4"/>, onClick: () => router.push(`/dashboard/comms?clientId=${encodeURIComponent(selectedClient.id)}`) },
                                                        { label: 'Edit Client', icon: <Edit className="w-4 h-4"/>, onClick: () => { setEditingClient(selectedClient); setShowEditModal(true); } },
                                                        { label: showArchived ? 'Unarchive' : 'Archive', icon: showArchived ? <History className="w-4 h-4"/> : <Trash2 className="w-4 h-4"/>, onClick: () => handleArchiveClient(selectedClient.id), variant: showArchived ? 'default' : 'danger' }
                                                    ]}
                                                />
                                            </>
                                        }
                                    />

                                    {/* Tabs Header */}
                                    <div className="flex w-full min-w-0 shrink-0 border-b border-[var(--ws-border)] mb-4 overflow-x-auto [scrollbar-width:none] [&>button]:shrink-0">
                                        <button
                                            onClick={() => handleTabChange('timeline')}
                                            className={`px-4 py-2 border-b-2 type-caption font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                                                activeTab === 'timeline'
                                                    ? 'border-[var(--brand-blue-500)] text-[var(--brand-blue-400)]'
                                                    : 'border-transparent text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)]'
                                            }`}
                                        >
                                            Timeline
                                        </button>
                                        <button
                                            onClick={() => handleTabChange('projects')}
                                            className={`px-4 py-2 border-b-2 type-caption font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                                                activeTab === 'projects'
                                                    ? 'border-[var(--brand-blue-500)] text-[var(--brand-blue-400)]'
                                                    : 'border-transparent text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)]'
                                            }`}
                                        >
                                            Projects {clientProjects.length > 0 ? `(${clientProjects.length})` : ''}
                                        </button>
                                        <button
                                            onClick={() => handleTabChange('invoices')}
                                            className={`px-4 py-2 border-b-2 type-caption font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                                                activeTab === 'invoices'
                                                    ? 'border-[var(--brand-blue-500)] text-[var(--brand-blue-400)]'
                                                    : 'border-transparent text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)]'
                                            }`}
                                        >
                                            Billing ({clientTimeline?.activities?.filter((a: any) => a.activity_type === 'invoice' || a.activity_type === 'payment')?.length || 0})
                                        </button>
                                        <button
                                            onClick={() => handleTabChange('contracts')}
                                            className={`px-4 py-2 border-b-2 type-caption font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                                                activeTab === 'contracts'
                                                    ? 'border-[var(--brand-blue-500)] text-[var(--brand-blue-400)]'
                                                    : 'border-transparent text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)]'
                                            }`}
                                        >
                                            Contracts {clientContracts.length > 0 ? `(${clientContracts.length})` : ''}
                                        </button>
                                        <button
                                            onClick={() => handleTabChange('portal')}
                                            className={`px-4 py-2 border-b-2 type-caption font-bold uppercase tracking-wider whitespace-nowrap transition-colors inline-flex items-center gap-1.5 ${
                                                activeTab === 'portal'
                                                    ? 'border-[var(--brand-blue-500)] text-[var(--brand-blue-400)]'
                                                    : 'border-transparent text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)]'
                                            }`}
                                        >
                                            <span>Client Portal</span>
                                            {selectedClient.financePortalToken && (
                                                <span className="w-2 h-2 rounded-full bg-[var(--success-500)]" title="Portal Active" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleTabChange('messages')}
                                            className={`px-4 py-2 border-b-2 type-caption font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                                                activeTab === 'messages'
                                                    ? 'border-[var(--brand-blue-500)] text-[var(--brand-blue-400)]'
                                                    : 'border-transparent text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)]'
                                            }`}
                                        >
                                            Messages
                                        </button>
                                        <button
                                            onClick={() => handleTabChange('notes')}
                                            className={`px-4 py-2 border-b-2 type-caption font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                                                activeTab === 'notes'
                                                    ? 'border-[var(--brand-blue-500)] text-[var(--brand-blue-400)]'
                                                    : 'border-transparent text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)]'
                                            }`}
                                        >
                                            Notes
                                        </button>
                                        <button
                                            onClick={() => handleTabChange('properties')}
                                            className={`px-4 py-2 border-b-2 type-caption font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                                                activeTab === 'properties'
                                                    ? 'border-[var(--brand-blue-500)] text-[var(--brand-blue-400)]'
                                                    : 'border-transparent text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)]'
                                            }`}
                                        >
                                            Properties
                                        </button>
                                    </div>

                                    {/* Tabs Content */}
                                    <div className="flex-1 ac-scroll-pane pr-1 custom-scrollbar mb-6">
                                        {activeTab === 'messages' && (
                                            <section className="space-y-4" aria-label="Client conversation">
                                                <p className="type-card-description text-[var(--ws-text-secondary)]">A private conversation with this client, available in their client workspace.</p>
                                                <div className="space-y-3 max-h-[50vh] overflow-y-auto" aria-live="polite">
                                                    {clientMessages.length ? clientMessages.map((item) => (
                                                        <div key={item.id} className={`ac-workspace-panel rounded-xl p-4 ${item.is_client ? 'border-l-2 border-cyan-400' : ''}`}>
                                                            <div className="flex justify-between gap-2 type-caption text-[var(--ws-text-secondary)]"><strong>{item.author_name}</strong><time>{new Date(item.created_at).toLocaleString()}</time></div>
                                                            <p className="mt-2 whitespace-pre-wrap break-words type-card-description text-[var(--ws-text-primary)]">{item.content}</p>
                                                        </div>
                                                    )) : <p className="type-card-description text-[var(--ws-text-secondary)]">No messages yet. Start the conversation below.</p>}
                                                </div>
                                                <form onSubmit={sendClientMessage} className="space-y-3">
                                                    <label htmlFor="client-message-draft" className="type-caption font-semibold text-[var(--ws-text-primary)]">Write to the client</label>
                                                    <AlphaCloneTextarea id="client-message-draft" rows={4} maxLength={10000} value={clientMessageDraft} onChange={(event) => setClientMessageDraft(event.target.value)} placeholder="Write a message…" className="w-full p-3 type-card-description" />
                                                    <Button type="submit" size="sm" variant="primary" disabled={!clientMessageDraft.trim() || clientMessageSending} icon={<Send className="h-4 w-4" />}>{clientMessageSending ? 'Sending…' : 'Send message'}</Button>
                                                </form>
                                            </section>
                                        )}
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
                                                    <h3 className="type-caption font-bold text-[var(--ws-text-primary)] uppercase tracking-wider">Add Activity Note</h3>
                                                    <div>
                                                        <Input
                                                            type="text"
                                                            placeholder="Note Title (e.g. Call feedback, Meeting summary)"
                                                            value={newNoteTitle}
                                                            onChange={(e) => setNewNoteTitle(e.target.value)}
                                                            className="text-[var(--ws-text-primary)] placeholder-[var(--ws-text-muted)] type-ui"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <AlphaCloneTextarea
                                                            placeholder="Detailed notes of what you discussed, client sentiment, or action items..."
                                                            value={newNoteDescription}
                                                            onChange={(e) => setNewNoteDescription(e.target.value)}
                                                            className="w-full p-3 min-h-[80px]"
                                                            required
                                                        />
                                                    </div>
                                                    <div className="flex justify-end">
                                                        <Button
                                                            type="submit"
                                                            size="sm"
                                                            isLoading={noteSubmitting}
                                                            className="text-[var(--ws-text-primary)]"
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
                                                                    <h4 className="type-card-title font-bold text-[var(--brand-blue-400)]">{note.title}</h4>
                                                                    <span className="type-ui text-[var(--ws-text-muted)] font-mono">
                                                                        {new Date(note.created_at).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                                <p className="type-card-description text-[var(--ws-text-secondary)] leading-relaxed whitespace-pre-wrap">{note.description}</p>
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
                                                                        <h4 className="type-caption font-bold text-[var(--ws-text-secondary)]">${inv.metadata?.amount?.toLocaleString() || '0.00'}</h4>
                                                                        <Badge variant={isPaid ? 'success' : 'warning'}>
                                                                            {status.toUpperCase()}
                                                                        </Badge>
                                                                    </div>
                                                                    <p className="type-card-description text-[var(--ws-text-muted)] mt-1">{inv.description}</p>
                                                                    {inv.metadata?.due_date && (
                                                                        <span className="type-caption text-[var(--ws-text-muted)] block mt-1 font-mono">Due: {new Date(inv.metadata.due_date).toLocaleDateString()}</span>
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

                                        {activeTab === 'projects' && (
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center mb-2">
                                                    <p className="type-caption font-bold text-[var(--ws-text-muted)] uppercase tracking-wider">
                                                        Client Projects {clientProjects.length > 0 ? `(${clientProjects.length})` : ''}
                                                    </p>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        icon={<Plus className="w-3.5 h-3.5" />}
                                                        onClick={() => router.push(`/dashboard/projects?create=1&clientId=${encodeURIComponent(selectedClient.id)}`)}
                                                    >
                                                        New Project
                                                    </Button>
                                                </div>
                                                {projectsLoading ? (
                                                    <div className="space-y-2">
                                                        <TableSkeleton rows={3} columns={3} />
                                                    </div>
                                                ) : clientProjects.length === 0 ? (
                                                    <EmptyState
                                                        icon={Briefcase}
                                                        title="No projects linked to this client"
                                                        description="Create a project to track milestones, deliverables, and budgets for this client."
                                                        actionLabel="Go to Projects"
                                                        onAction={() => router.push(`/dashboard/projects?create=1&clientId=${encodeURIComponent(selectedClient.id)}`)}
                                                        className="py-10"
                                                    />
                                                ) : (
                                                    clientProjects.map((proj: any) => (
                                                        <div key={proj.id} className="ac-workspace-panel rounded-lg p-4 flex justify-between items-center gap-4">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <Briefcase className="w-4 h-4 text-[var(--brand-blue-400)]" />
                                                                    <h4 className="type-caption font-bold text-[var(--ws-text-secondary)]">{proj.name}</h4>
                                                                    <Badge variant={proj.status === 'completed' ? 'success' : proj.status === 'in_progress' ? 'blue' : 'neutral'}>
                                                                        {proj.status?.replace(/_/g, ' ') || 'active'}
                                                                    </Badge>
                                                                </div>
                                                                {proj.budget && (
                                                                    <p className="type-card-description text-[var(--ws-text-muted)] mt-1 font-mono">
                                                                        Budget: ${Number(proj.budget).toLocaleString()}
                                                                    </p>
                                                                )}
                                                                {proj.updated_at && (
                                                                    <span className="type-caption text-[var(--ws-text-muted)] block mt-1 font-mono">
                                                                        Updated {formatDistanceToNow(new Date(proj.updated_at), { addSuffix: true })}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-[var(--brand-blue-400)] hover:text-[var(--brand-blue-300)]"
                                                                onClick={() => router.push(`/dashboard/projects?projectId=${proj.id}`)}
                                                            >
                                                                View Project
                                                            </Button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}

                                        {activeTab === 'contracts' && (
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center mb-2">
                                                    <p className="type-caption font-bold text-[var(--ws-text-muted)] uppercase tracking-wider">
                                                        Contracts & Agreements {clientContracts.length > 0 ? `(${clientContracts.length})` : ''}
                                                    </p>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        icon={<Plus className="w-3.5 h-3.5" />}
                                                        onClick={() => router.push('/dashboard/business/contracts')}
                                                    >
                                                        New Contract
                                                    </Button>
                                                </div>
                                                {contractsLoading ? (
                                                    <div className="space-y-2">
                                                        <TableSkeleton rows={3} columns={3} />
                                                    </div>
                                                ) : clientContracts.length === 0 ? (
                                                    <EmptyState
                                                        icon={FileCheck}
                                                        title="No contracts found"
                                                        description="Draft proposals and binding agreements for this client."
                                                        actionLabel="Go to Contracts"
                                                        onAction={() => router.push('/dashboard/business/contracts')}
                                                        className="py-10"
                                                    />
                                                ) : (
                                                    clientContracts.map((contract: any) => (
                                                        <div key={contract.id} className="ac-workspace-panel rounded-lg p-4 flex justify-between items-center gap-4">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <FileCheck className="w-4 h-4 text-emerald-400" />
                                                                    <h4 className="type-caption font-bold text-[var(--ws-text-secondary)]">{contract.title}</h4>
                                                                    <Badge variant={contract.status === 'signed' ? 'success' : contract.status === 'pending' ? 'warning' : 'neutral'}>
                                                                        {contract.status || 'draft'}
                                                                    </Badge>
                                                                </div>
                                                                {contract.value && (
                                                                    <p className="type-card-description text-[var(--ws-text-muted)] mt-1 font-mono">
                                                                        Value: ${Number(contract.value).toLocaleString()}
                                                                    </p>
                                                                )}
                                                                {contract.created_at && (
                                                                    <span className="type-caption text-[var(--ws-text-muted)] block mt-1 font-mono">
                                                                        Created {new Date(contract.created_at).toLocaleDateString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-[var(--brand-blue-400)] hover:text-[var(--brand-blue-300)]"
                                                                onClick={() => router.push(`/dashboard/business/contracts?contractId=${contract.id}`)}
                                                            >
                                                                View Contract
                                                            </Button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}

                                        {activeTab === 'portal' && (
                                            <div className="space-y-4">
                                                <div className="ac-workspace-panel rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)] p-5">
                                                    <div className="flex items-start justify-between gap-4 mb-4">
                                                        <div className="flex items-start gap-3">
                                                            <div className="rounded-xl border border-[var(--info-border)] bg-[var(--info-surface)] p-2.5 text-[var(--info-text)]">
                                                                <Globe className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <h3 className="type-ui font-bold text-[var(--ws-text-primary)]">Client Portal & Finance Hub</h3>
                                                                    <Badge variant={selectedClient.financePortalToken || portalUrl ? 'success' : 'warning'}>
                                                                        {selectedClient.financePortalToken || portalUrl ? 'Active' : 'Not Configured'}
                                                                    </Badge>
                                                                </div>
                                                                <p className="type-card-description text-[var(--ws-text-secondary)] mt-1 leading-relaxed">
                                                                    A dedicated, secure workspace for {selectedClient.name} to view active projects, review invoices, sign contracts, and communicate.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {portalUrlLoading ? (
                                                        <div className="py-6 text-center">
                                                            <Clock className="w-5 h-5 animate-spin text-cyan-400 mx-auto mb-2" />
                                                            <p className="type-caption text-[var(--ws-text-muted)]">Loading portal link...</p>
                                                        </div>
                                                    ) : portalUrl ? (
                                                        <div className="space-y-4 pt-2">
                                                            <div>
                                                                <label className="type-caption font-bold uppercase tracking-wider text-[var(--ws-text-muted)] mb-1.5 block">
                                                                    Direct Portal Link
                                                                </label>
                                                                <div className="flex items-center gap-2">
                                                                    <AlphaCloneInput
                                                                        type="text"
                                                                        readOnly
                                                                        value={portalUrl}
                                                                        className="w-full px-3 py-2 font-mono"
                                                                    />
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        icon={copiedPortalUrl ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                                                        onClick={async () => {
                                                                            await navigator.clipboard.writeText(portalUrl);
                                                                            setCopiedPortalUrl(true);
                                                                            toast.success('Portal link copied to clipboard');
                                                                            setTimeout(() => setCopiedPortalUrl(false), 2000);
                                                                        }}
                                                                    >
                                                                        {copiedPortalUrl ? 'Copied' : 'Copy'}
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        icon={<ExternalLink className="w-4 h-4" />}
                                                                        onClick={() => window.open(portalUrl, '_blank')}
                                                                    >
                                                                        Open
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-between items-center pt-2 border-t border-[var(--ws-border)]">
                                                                <span className="type-caption text-[var(--ws-text-muted)]">Need to grant login credentials or reset access?</span>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    icon={<UserCheck className="w-4 h-4" />}
                                                                    onClick={() => setPortalAccessClient(selectedClient)}
                                                                >
                                                                    Manage Access & Credentials
                                                                </Button>
                                                            </div>
                                                            <Button size="sm" variant="outline" disabled={invitingClient || !selectedClient.email}
                                                                onClick={async () => {
                                                                    if (!currentTenant?.id) return;
                                                                    setInvitingClient(true);
                                                                    try {
                                                                        const response = await fetch(`/api/client-finance/invite/${selectedClient.id}`, {
                                                                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({ tenantId: currentTenant.id }),
                                                                        });
                                                                        const result = await response.json().catch(() => ({}));
                                                                        if (!response.ok) throw new Error(result.error || 'Invitation could not be sent');
                                                                        toast.success(`Invitation sent to ${result.recipient}`);
                                                                    } catch (cause) {
                                                                        toast.error(cause instanceof Error ? cause.message : 'Invitation could not be sent');
                                                                    } finally { setInvitingClient(false); }
                                                                }}>
                                                                {invitingClient ? 'Sending invitation…' : 'Email client portal invitation'}
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="pt-2 text-center sm:text-left">
                                                            <p className="type-card-description text-[var(--ws-text-secondary)] mb-4">
                                                                Client portal access has not been generated for this client yet. Set up login credentials or a direct access link to provide self-service billing and project tracking.
                                                            </p>
                                                            <Button
                                                                size="sm"
                                                                variant="primary"
                                                                icon={<UserCheck className="w-4 h-4" />}
                                                                onClick={() => setPortalAccessClient(selectedClient)}
                                                            >
                                                                Configure Client Portal Access
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'properties' && (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="ac-workspace-panel rounded-lg p-4">
                                                        <p className="type-card-description text-[var(--ws-text-muted)] mb-1">Email</p>
                                                        <div className="flex items-center gap-2 text-[var(--ws-text-primary)] type-ui">
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
                                                        <p className="type-card-description text-[var(--ws-text-muted)] mb-1">Phone</p>
                                                        <div className="flex items-center gap-2 text-[var(--ws-text-primary)] type-ui">
                                                            <Phone className="w-4 h-4 text-[var(--brand-blue-500)]" />
                                                            <span className="truncate">{selectedClient.phone || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                    {selectedClient.industry && (
                                                        <div className="ac-workspace-panel rounded-lg p-4">
                                                            <p className="type-card-description text-[var(--ws-text-muted)] mb-1">Industry</p>
                                                            <p className="text-[var(--ws-text-primary)] type-card-description font-semibold">{selectedClient.industry}</p>
                                                        </div>
                                                    )}
                                                    {selectedClient.location && (
                                                        <div className="ac-workspace-panel rounded-lg p-4">
                                                            <p className="type-card-description text-[var(--ws-text-muted)] mb-1">Location</p>
                                                            <p className="text-[var(--ws-text-primary)] type-card-description font-semibold">{selectedClient.location}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {selectedClient.description && (
                                                    <div className="ac-workspace-panel rounded-lg p-4">
                                                        <p className="type-card-description text-[var(--ws-text-muted)] mb-2">Description</p>
                                                        <p className="text-[var(--ws-text-primary)] type-card-description leading-relaxed whitespace-pre-wrap">{selectedClient.description}</p>
                                                    </div>
                                                )}

                                                {selectedClient.customFields && Object.keys(selectedClient.customFields).length > 0 && (
                                                    <div className="ac-workspace-panel rounded-lg p-4">
                                                        <p className="type-card-description text-[var(--ws-text-muted)] mb-3">Custom Fields</p>
                                                        <div className="space-y-2">
                                                            {Object.entries(selectedClient.customFields).map(([key, val]) => (
                                                                <div key={key} className="flex justify-between items-center py-1.5 border-b border-[var(--ws-border)]/40 type-caption">
                                                                    <span className="text-[var(--ws-text-muted)] font-bold uppercase tracking-wider">{key.replace(/_/g, ' ')}</span>
                                                                    <span className="text-[var(--ws-text-secondary)] font-semibold">{String(val)}</span>
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
                                        <h3 className="type-caption font-bold text-[var(--ws-text-muted)] mb-4 uppercase tracking-wider">Quick Actions</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Button variant="secondary" size="sm" onClick={() => { setSelectedClientForProposal(selectedClient); setShowProposalModal(true); }} icon={<FilePlus className="w-4 h-4" />}>Proposal</Button>
                                            <Button variant="outline" size="sm" onClick={() => { setSelectedClientForInvoice(selectedClient); setShowInvoiceModal(true); }} icon={<Receipt className="w-4 h-4" />}>Invoice</Button>
                                            <Button variant="outline" size="sm" onClick={() => handleCallClient(selectedClient)} icon={<Phone className="w-4 h-4" />}>Call</Button>
                                            <Button variant="outline" size="sm" onClick={() => { setSelectedClientForCommunication(selectedClient); setShowCommunicationModal(true); }} icon={<Mail className="w-4 h-4" />}>Email</Button>
                                        </div>
                                    </div>
                                </div>
                                {currentTenant?.id ? (
                                    <BusinessContextPanel
                                        tenantId={currentTenant.id}
                                        entityType="client"
                                        entityId={selectedClient.id}
                                        className="hidden xl:block w-72 shrink-0"
                                    />
                                ) : null}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center bg-transparent text-[var(--ws-text-muted)]">
                                <Users className="w-16 h-16 mb-4 text-[var(--ws-text-muted)]/40" />
                                <p className="text-base font-medium text-[var(--ws-text-secondary)]">Select a client to view details</p>
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

            {portalAccessClient && currentTenant?.id && (
                <ClientPortalAccessPanel
                    client={portalAccessClient}
                    tenantId={currentTenant.id}
                    onClose={() => setPortalAccessClient(null)}
                    onClientUpdated={(updated) => {
                        setClients((current) => current.map((item) => item.id === updated.id ? updated : item));
                        setSelectedClient((current) => current?.id === updated.id ? updated : current);
                        setPortalAccessClient(updated);
                    }}
                />
            )}

            {filteredClients.length === 0 && (
                <div className="text-center py-12 text-[var(--ws-text-muted)]">
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

const ClientCard = ({ client, onOpen, onEdit, onDelete, onCall, onCreateProposal, onCreateInvoice, onSendEmail, showArchived, isSelected, onToggleSelect }: {
    client: BusinessClient;
    onOpen?: (c: BusinessClient) => void;
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
            onClick: () => window.location.href = `/dashboard/calendar?clientId=${encodeURIComponent(client.id)}`
        },
        {
            label: 'View History',
            icon: <History className="w-4 h-4" />,
            onClick: () => onOpen?.(client)
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
        <Card
            hoverEffect
            className={`flex flex-col h-full !p-3 relative transition-all ${isSelected ? 'ring-1 ring-[var(--brand-blue-500)]/50' : ''}`}
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1 min-w-0 mr-2">
                    {onToggleSelect && (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                onToggleSelect(client.id);
                            }}
                            className="flex-shrink-0 min-w-9 min-h-9 flex items-center justify-center text-[var(--ws-text-muted)] hover:text-[var(--brand-blue-400)]"
                            aria-label={`Select ${client.name} for bulk outreach`}
                            role="checkbox"
                            aria-checked={isSelected}
                        >
                            {isSelected ? <CheckSquare className="w-4 h-4 text-[var(--brand-blue-400)]" /> : <Square className="w-4 h-4" />}
                        </button>
                    )}
                    <div className="w-10 h-10 rounded-full shrink-0 bg-gradient-to-br from-[var(--brand-blue-500)] to-[var(--brand-blue-700)] flex items-center justify-center font-bold text-[var(--text-inverse)]">
                        {(client.name || '?').charAt(0)}
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-semibold text-[var(--ws-text-primary)] truncate" title={client.name}>{onOpen ? <button type="button" className="text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400" onClick={() => onOpen(client)}>Open {client.name}</button> : client.name}</h3>
                        {client.industry && <p className="type-card-description text-[var(--ws-text-muted)] truncate">{client.industry}</p>}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={(event) => {
                            event.stopPropagation();
                            onCall(client);
                        }}
                        aria-label={`Call ${client.name}`}
                        className="!p-2 hover:bg-[var(--brand-blue-500)]/10 hover:text-[var(--brand-blue-400)]"
                        icon={<Phone className="w-4 h-4" />}
                    />
                    <div onClick={(event) => event.stopPropagation()}>
                        <Dropdown
                            trigger={
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-label={`More actions for ${client.name}`}
                                    className="!p-2 hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)] text-[var(--ws-text-muted)]"
                                    icon={<MoreVertical className="w-4 h-4" />}
                                />
                            }
                            items={dropdownItems}
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-2 mb-4 flex-1">
                {client.email && (
                    <div className="flex items-center gap-2 type-ui text-[var(--ws-text-muted)]">
                        <Mail className="w-4 h-4 shrink-0" />
                        <span className="truncate" title={client.email}>{client.email}</span>
                    </div>
                )}
                {client.phone && (
                    <div className="flex items-center gap-2 type-ui text-[var(--ws-text-muted)]">
                        <Phone className="w-4 h-4 shrink-0" />
                        <span className="truncate">{client.phone}</span>
                    </div>
                )}
                {client.metadata?.last_contacted_at && (
                    <div className="flex items-center gap-2 type-caption font-semibold uppercase tracking-wide text-[var(--brand-blue-500)]/70 mt-3">
                        <MessageSquare className="w-3 h-3" />
                        <span>Last Contacted: {formatDistanceToNow(new Date(client.metadata.last_contacted_at), { addSuffix: true })}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between mt-auto pt-4 border-t border-[var(--ws-border)]/50">
                <div className="flex items-center gap-2">
                    <Badge variant={stageVariants[client.salesStage as keyof typeof stageVariants] || 'neutral'}>
                        {client.salesStage.charAt(0).toUpperCase() + client.salesStage.slice(1)}
                    </Badge>
                    {client.value > 0 && (
                        <span className="type-ui font-semibold text-[var(--brand-blue-400)]">
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
                        <label className="block type-label font-medium text-[var(--ws-text-secondary)]">Target Stage</label>
                        <AlphaCloneSelect
                            value={formData.salesStage}
                            onChange={(e) => setFormData({ ...formData, salesStage: e.target.value as any })}
                            className="w-full px-4 py-3 text-md transition-all font-medium"
                        >
                            <option value="lead">Lead</option>
                            <option value="prospect">Prospect</option>
                            <option value="customer">Customer</option>
                        </AlphaCloneSelect>
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

                <div className="flex gap-4 pt-4 border-t border-[var(--ws-border)]">
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
                        <label className="block type-label font-medium text-[var(--ws-text-secondary)]">Sales Stage</label>
                        <AlphaCloneSelect
                            value={formData.salesStage}
                            onChange={(e) => setFormData({ ...formData, salesStage: e.target.value as any })}
                            className="w-full px-4 py-3 text-md transition-all"
                        >
                            <option value="lead">Lead</option>
                            <option value="prospect">Prospect</option>
                            <option value="customer">Customer</option>
                            <option value="lost">Lost</option>
                        </AlphaCloneSelect>
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

                <div className="flex gap-4 pt-4 border-t border-[var(--ws-border)]">
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
                            : 'border-[var(--ws-border)] hover:border-slate-600'
                            }`}
                    >
                        <AlphaCloneInput {...getInputProps()} />
                        <Upload className="w-12 h-12 mx-auto mb-4 text-[var(--ws-text-muted)]" />
                        <p className="text-lg font-medium mb-2">
                            {isDragActive ? 'Drop file here' : 'Drag & drop file here'}
                        </p>
                        <p className="type-card-description text-[var(--ws-text-muted)] mb-4">
                            or click to browse
                        </p>
                        <p className="type-card-description text-[var(--ws-text-muted)]">
                            Supports: Excel (.xlsx, .xls), CSV, PDF, Word (.doc, .docx)
                        </p>
                        {importing && <p className="mt-4 text-[var(--brand-blue-400)]">Importing...</p>}
                    </div>
                ) : (
                    <div>
                        <p className="mb-4 text-[var(--ws-text-muted)]">
                            Found {importedClients.length} contacts. Review and confirm import:
                        </p>
                        <div className="max-h-96 overflow-y-auto space-y-2 mb-6">
                            {importedClients.map((client, index) => (
                                <div key={index} className="bg-[var(--ws-surface-secondary)]/50 p-3 rounded-lg">
                                    <p className="font-medium">{client.name || 'No name'}</p>
                                    <p className="type-card-description text-[var(--ws-text-muted)]">{client.email || 'No email'}</p>
                                    {client.phone && <p className="type-card-description text-[var(--ws-text-muted)]">{client.phone}</p>}
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setImportedClients([])}
                                className="flex-1 px-4 py-2 bg-[var(--ws-surface-secondary)] hover:bg-[var(--ws-surface-tertiary)] rounded-lg transition-colors"
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
            const response = await fetch(`/api/tenant/${currentTenant.id}/projects`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                ownerId: user.id,
                ownerName: user.name,
                name: formData.name,
                category: formData.category,
                description: formData.description,
                status: 'Pending',
                currentStage: 'Proposal',
                progress: 0,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                team: [],
                contractStatus: 'None',
                clientId: client.id,
                budget: formData.budget,
                isPublic: false,
                showInPortfolio: false,
                resources: [],
                startDate: new Date().toISOString().slice(0, 10),
            }),
            });
            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                toast.error(`Failed to create proposal: ${result.error || 'Please try again'}`);
            } else {
                if (result.clientNotification && !result.clientNotification.sent) toast(`Proposal saved. Client email was not sent: ${result.clientNotification.skipped || 'delivery unavailable'}`);
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
                    <p className="type-card-description text-[var(--brand-blue-200)]">
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
                        <label className="block type-label font-medium text-[var(--ws-text-secondary)]">Project Category</label>
                        <AlphaCloneSelect
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full px-4 py-3 text-md transition-all"
                        >
                            <option value="Web">Web Development</option>
                            <option value="Mobile">Mobile App</option>
                            <option value="AI">AI / Automation</option>
                            <option value="Consulting">Strategic Consulting</option>
                            <option value="Design">UI/UX Design</option>
                        </AlphaCloneSelect>
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

                <div className="flex gap-4 pt-4 border-t border-[var(--ws-border)]">
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
                    <p className="type-card-description text-[var(--brand-blue-200)]">
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

                <div className="flex gap-4 pt-2 border-t border-[var(--ws-border)]">
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
