import React, { useEffect, useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
    LayoutDashboard,
    Users,
    Briefcase,
    Settings,
    Globe,
    CreditCard,
    FileText,
    Bell,
    LogOut,
    Menu,
    CheckSquare,
    Bot,
    TrendingUp,
    Video,
    ShieldCheck,
    FileCheck,
    BarChart3,
    BookOpen,
    Receipt,
    RefreshCw,
    MessageCircle,
    X,
    Minimize2,
} from 'lucide-react';
import { SlackIntegration } from '../integrations/SlackIntegration';
import { Project, User } from '../../../types';
import { projectService } from '../../../services/projectService';
import { useTenant } from '../../../contexts/TenantContext';
import { dailyService } from '../../../services/dailyService';
import { callSignalingService } from '../../../services/video/CallSignalingService';
import { supabase } from '../../../lib/supabase';
import toast from 'react-hot-toast';
import { useBackgroundTasks } from '../../../contexts/BackgroundTaskContext';
import { useMeetingSession } from '@/hooks/useMeetingSession';
import { loadMeetingForJoin, type PlatformMeetingProvider } from '@/services/instantMeetingService';

// Components
import BusinessHome from './BusinessHome';
import ProjectsPage from './ProjectsPage';
import TeamPage from './TeamPage';
// Lazy load heavier tabs that aren't needed on dashboard mount
const MessagesPage = React.lazy(() => import('./MessagesPage'));
const CalendarPage = React.lazy(() => import('./CalendarPage'));
const BillingPage = React.lazy(() => import('./BillingPage'));
const EnhancedBillingPage = React.lazy(() => import('./EnhancedBillingPage'));
const ReportsPage = React.lazy(() => import('./ReportsPage'));
const SettingsPage = React.lazy(() => import('./SettingsPage'));
const MeetingsPage = React.lazy(() => import('./MeetingsPage'));
const ReferralsPage = React.lazy(() => import('./ReferralsPage'));
const BookingTab = React.lazy(() => import('./BookingTab'));
// New CRM Components - Lazy loaded to prevent Error #306
const CRMTab = React.lazy(() => import('../CRMTab'));
const TasksTab = React.lazy(() => import('../TasksTab'));
import SalesAgent from '../SalesAgent';
const DealsTab = React.lazy(() => import('../DealsTab'));
const QuotesTab = React.lazy(() => import('../QuotesTab'));
const ClientsPage = React.lazy(() => import('./ClientsPage'));
import AlphaCloneContractModal from '../../contracts/AlphaCloneContractModal';
import ContractDashboard from '../../contracts/ContractDashboard';
import DocumentHub from '../../documents/DocumentHub';
// Accounting Components - Lazy loaded to prevent module resolution issues
const AccountingDashboard = React.lazy(() => import('../accounting/AccountingDashboard'));
const MailTab = React.lazy(() => import('../MailTab'));
const CustomVideoRoom = React.lazy(() => import('../video/CustomVideoRoom'));
const MicrosoftMeetingEmbed = React.lazy(() => import('../video/MicrosoftMeetingEmbed'));
// New Components
const TaskScheduler = React.lazy(() => import('./TaskScheduler'));
const UnifiedInboxView = React.lazy(() => import('./UnifiedInboxView'));
const ZohoCRMIntegration = React.lazy(() => import('../zoho/ZohoCRMIntegration'));
const BusinessPerformanceDashboard = React.lazy(() => import('./BusinessPerformanceDashboard'));


const QuotaManager = React.lazy(() => import('./QuotaManager'));

const PagesTab = React.lazy(() => import('@/components/pages/PagesTab'));
const ContactSubmissionsTab = React.lazy(() => import('../ContactSubmissionsTab'));
const FormsHub = React.lazy(() => import('./FormsHub'));
const CampaignBuilder = React.lazy(() => import('./CampaignBuilder'));
const FacebookIntegrationTab = React.lazy(() => import('../facebook/FacebookIntegrationTab'));
const ExpenseTrackerTab = React.lazy(() => import('./ExpenseTrackerTab'));
const WorkflowDashboard = React.lazy(() => import('../engine/WorkflowDashboard'));
const SMSCampaignTab = React.lazy(() => import('../engine/SMSCampaignTab'));
const SocialMediaComposer = React.lazy(() => import('../engine/SocialMediaComposer'));
const LinkedInManagementTab = React.lazy(() => import('../social/LinkedInManagementTab'));
const WhatsAppManagementPage = React.lazy(() => import('../WhatsAppManagementPage'));
const InstagramIntegrationTab = React.lazy(() => import('../social/InstagramIntegrationTab'));
const XIntegrationTab = React.lazy(() => import('../social/XIntegrationTab'));

const IngestionPanel = React.lazy(() => import('../engine/IngestionPanel'));
const SocialCommandCenter = React.lazy(() => import('../social/SocialCommandCenter'));
const MarketplacePage = React.lazy(() => import('../MarketplacePage'));
const TeamsPage = React.lazy(() => import('./TeamsPage'));

const CashFlowForecastTab = React.lazy(() => import('./CashFlowForecastTab'));
const ClientOnboardingTab = React.lazy(() => import('./ClientOnboardingTab'));
const DocumentVaultTab = React.lazy(() => import('./DocumentVaultTab'));
const TaxEstimatorTab = React.lazy(() => import('./TaxEstimatorTab'));
const DeepDeskView = React.lazy(() => import('../tickets/DeepDeskView'));
const ContactsList = React.lazy(() => import('../crm/ContactsList'));
const SalesForecastTab = React.lazy(() => import('../SalesForecastTab'));
const AnalyticsTab = React.lazy(() => import('../AnalyticsTab'));
const AccountsPage = React.lazy(() => import('../crm/AccountsPage'));
const SalesConsole = React.lazy(() => import('../crm/SalesConsole'));
const CRMReportsTab = React.lazy(() => import('../crm/CRMReportsTab'));
const BankingCenterPage = React.lazy(() => import('../accounting/BankingCenterPage'));
const BillsPayablePage = React.lazy(() => import('../accounting/BillsPayablePage'));
const PeriodClosePage = React.lazy(() => import('../accounting/PeriodClosePage'));
const SequenceBuilder = React.lazy(() => import('../marketing/SequenceBuilder'));
const DeliverabilityPanel = React.lazy(() => import('../marketing/DeliverabilityPanel'));
const ExecutiveDashboard = React.lazy(() => import('../ExecutiveDashboard'));
const FinanceTab = React.lazy(() => import('../FinanceTab'));

import SalesHub from '../hubs/SalesHub';
import MoneyHub from '../hubs/MoneyHub';
import MarketingHub from '../hubs/MarketingHub';
import InsightsHub from '../hubs/InsightsHub';
import DocumentsHub from '../hubs/DocumentsHub';

const SALES_HUB_ROUTES = new Set([
  '/dashboard/crm',
  '/dashboard/crm/console',
  '/dashboard/crm/accounts',
  '/dashboard/crm/reports',
  '/dashboard/leads',
  '/dashboard/deals',
  '/dashboard/contacts',
  '/dashboard/crm/unified-contacts',
  '/dashboard/forecast',
  '/dashboard/tasks',
]);

const MONEY_HUB_ROUTES = new Set([
  '/dashboard/accounting',
  '/dashboard/accounting/banking',
  '/dashboard/accounting/bills',
  '/dashboard/accounting/period-close',
  '/dashboard/business/billing',
  '/dashboard/business/expenses',
  '/dashboard/business/quotes',
  '/dashboard/business/cash-flow',
  '/dashboard/finance',
]);

const MARKETING_HUB_ROUTES = new Set([
  '/dashboard/business/campaigns',
  '/dashboard/business/forms',
  '/dashboard/business/social',
  '/dashboard/business/unified-inbox',
  '/dashboard/marketing/sequences',
  '/dashboard/marketing/deliverability',
  '/dashboard/business/facebook',
  '/dashboard/business/linkedin',
  '/dashboard/business/x',
]);

const INSIGHTS_HUB_ROUTES = new Set([
  '/dashboard/analytics',
  '/dashboard/performance',
  '/dashboard/executive',
  '/dashboard/business/reports',
]);

const DOCUMENTS_HUB_ROUTES = new Set([
  '/dashboard/business/documents',
  '/dashboard/business/vault',
  '/dashboard/contracts',
  '/dashboard/business/contracts',
]);

const ALL_HUB_ROUTES = new Set([
  ...SALES_HUB_ROUTES,
  ...MONEY_HUB_ROUTES,
  ...MARKETING_HUB_ROUTES,
  ...INSIGHTS_HUB_ROUTES,
  ...DOCUMENTS_HUB_ROUTES,
]);

function isHubRoute(tab: string): boolean {
  return ALL_HUB_ROUTES.has(tab);
}

function wrapInHub(tab: string, content: React.ReactNode): React.ReactNode {
  if (SALES_HUB_ROUTES.has(tab)) return <SalesHub>{content}</SalesHub>;
  if (MONEY_HUB_ROUTES.has(tab)) return <MoneyHub>{content}</MoneyHub>;
  if (MARKETING_HUB_ROUTES.has(tab)) return <MarketingHub>{content}</MarketingHub>;
  if (INSIGHTS_HUB_ROUTES.has(tab)) return <InsightsHub>{content}</InsightsHub>;
  if (DOCUMENTS_HUB_ROUTES.has(tab)) return <DocumentsHub>{content}</DocumentsHub>;
  return content;
}

import { TrialBanner } from '../TrialBanner';
import BonnieWidget from '../bonnie/BonnieWidget';
import BonnieFullView from '../bonnie/BonnieFullView';

import Sidebar from '@/components/dashboard/Sidebar';
import BottomNav from '../BottomNav';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { TENANT_ADMIN_NAV_ITEMS } from '@/constants';
import { PLAN_PRICING } from '../../../services/tenancy/types';
import { WidgetErrorBoundary } from '../WidgetErrorBoundary';
import NotificationCenter from '../NotificationCenter';
import CommandPalette from '../CommandPalette';
import EnhancedGlobalSearch from '../EnhancedGlobalSearch';
import ProductTour from '../../onboarding/ProductTour';
import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';
import { normalizeBusinessRoute } from '@/lib/normalizeDashboardRoute';
import { presenceService } from '@/services/presenceService';
import MissedCallsNotification from '../MissedCallsNotification';

/** Full-bleed tabs: no outer padding; use overflow-hidden only where the child manages its own scroll (mail, projects, etc.). Home + CRM scroll with the main column — not listed here. */
const DASHBOARD_EDGE_TO_EDGE_TABS: string[] = [
    '/dashboard/mail',
    '/dashboard/business/projects',
    '/dashboard/tasks',
    '/dashboard/sales-agent',
    '/dashboard/zoho/mail',
    '/dashboard/business/messages',
];

interface BusinessDashboardProps {
    user: User;
    onLogout: () => void;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    currentTenant?: any; // optional — component fetches via useTenant() context
}

export default function BusinessDashboard({ currentTenant: propTenant, user, onLogout, setActiveTab, activeTab }: BusinessDashboardProps) {
    const router = useRouter();
    const { t, language, setLanguage } = useLanguage();
    const route = useMemo(
        () => normalizeBusinessRoute(activeTab, user.role),
        [activeTab, user.role],
    );
    const { currentTenant: contextTenant, isLoading: tenantLoading, getDashboardStats } = useTenant();
    const currentTenant = propTenant || contextTenant;
    const hasBootstrappedRef = useRef(Boolean(propTenant || contextTenant));
    if (currentTenant) {
        hasBootstrappedRef.current = true;
    }
    const [activeSection, setActiveSection] = useState('profile');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
    const [showProductTour, setShowProductTour] = useState(false);
    const [unreadMessageCount, setUnreadMessageCount] = useState(0);
    const {
        activeMeetingCallId,
        isMeetingMinimized,
        startMeeting,
        endMeeting,
        setIsMeetingMinimized,
        toggleMeetingMinimized,
    } = useMeetingSession(`${user.id}:${currentTenant?.id || 'no-tenant'}`);
    const [activeMeetingProvider, setActiveMeetingProvider] = useState<PlatformMeetingProvider | null>(null);
    const [activeMeetingJoinUrl, setActiveMeetingJoinUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!activeMeetingCallId) {
            setActiveMeetingProvider(null);
            setActiveMeetingJoinUrl(null);
            return;
        }

        let cancelled = false;
        void loadMeetingForJoin(activeMeetingCallId).then(({ provider, joinUrl, error }) => {
            if (cancelled) return;
            if (error) {
                toast.error(error);
                endMeeting();
                return;
            }
            setActiveMeetingProvider(provider);
            setActiveMeetingJoinUrl(joinUrl);
        });

        return () => {
            cancelled = true;
        };
    }, [activeMeetingCallId, endMeeting]);
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            // Keep sidebar expanded by default on tablet and desktop so navigation labels stay visible.
            setSidebarOpen(window.innerWidth >= 768);
        }
    }, []);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                setCommandPaletteOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    React.useEffect(() => {
        if (!user?.id || typeof window === 'undefined') return;
        const key = `business_tour_completed_${user.id}`;
        if (!localStorage.getItem(key) && activeTab === '/dashboard') {
            const timer = window.setTimeout(() => setShowProductTour(true), 900);
            return () => window.clearTimeout(timer);
        }
    }, [user?.id, activeTab]);

    // Initialize MS Teams-like Presence
    React.useEffect(() => {
        if (user?.id) {
            presenceService.initializePresence(user.id, 'online');
            return () => {
                presenceService.cleanup(user.id);
            };
        }
    }, [user?.id]);

    // Live unread direct-message count for the sidebar/bottom-nav badges.
    React.useEffect(() => {
        if (!currentTenant?.id) return;
        let active = true;
        const fetchUnread = async () => {
            const { count } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', currentTenant.id)
                .eq('recipient_id', user.id)
                .is('read_at', null);
            if (active) setUnreadMessageCount(count || 0);
        };
        fetchUnread();
        const interval = setInterval(fetchUnread, 30000);
        return () => { active = false; clearInterval(interval); };
    }, [currentTenant?.id, user.id]);

    // -- PERSISTENT VIDEO CALL STATE --
    const { tasks: bgTasks } = useBackgroundTasks();
    const activeBgTasksCount = (bgTasks || []).filter(t => t.status === 'running').length;

    // Explicitly typed handlers
    const handleJoinCall = (callId: string) => {
        startMeeting(callId);
    };
    const handleInitiateCallToClient = async (clientId: string) => {
        const toastId = toast.loading('Initiating secure call...');
        try {
            // 1. Fetch Client Details
            const { client, error: clientError } = await (await import('../../../services/businessClientService')).businessClientService.getClient(clientId);
            if (clientError || !client) throw new Error(clientError || 'Client not found');

            if (!client.email) {
                toast.error('Client has no email address. Cannot initiate call.', { id: toastId });
                return;
            }

            // 2. Find Recipient User ID by Email
            const { data: users, error: userError } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', client.email)
                .single();

            if (userError || !users) {
                toast.error('Client is not a registered user on the platform.', { id: toastId });
                return;
            }

            // 3. Create Video Room
            const { call, error: roomError } = await dailyService.createVideoCall({
                hostId: user.id,
                title: `Call with ${client.name}`,
                isPublic: false
            });

            if (roomError || !call || !call.daily_room_url) {
                throw new Error(roomError || 'Failed to create room');
            }

            // 4. Send Signal
            await callSignalingService.sendCallSignal(users.id, {
                callerId: user.id,
                callerName: user.name,
                roomUrl: call.daily_room_url,
                roomId: call.id
            });

            toast.success('Calling client...', { id: toastId });

            // 5. Join Room
            handleJoinCall(call.id);

        } catch (error) {
            console.error('Call failed:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to start call.', { id: toastId });
        }
    };

    // Contract Modal State
    const [showContractModal, setShowContractModal] = useState(false);
    const [selectedProjectForContract, setSelectedProjectForContract] = useState<any>(null);

    const [notification, setNotification] = useState<string | null>(null);

    const handleOpenContract = (project?: any) => {
        setSelectedProjectForContract(project || undefined);
        setShowContractModal(true);
    };

    // Fetch projects using useQuery for caching and sharing with TasksTab
    const { data: projectData, isLoading: loadingProjects } = useQuery({
        queryKey: ['projects', user.id],
        queryFn: () => projectService.getProjects(user.id, user.role),
        staleTime: 5 * 60 * 1000,
        enabled: !!user.id && !!currentTenant,
    });

    const {
        data: dashboardStats,
        error: dashboardStatsError,
    } = useQuery({
        queryKey: ['dashboard-stats', currentTenant?.id, user.id],
        queryFn: async () => {
            if (!currentTenant?.id) return null;
            const result = await getDashboardStats(currentTenant.id, user.id);
            if (result.error) {
                throw new Error(result.error);
            }
            return result.stats;
        },
        enabled: !!currentTenant?.id && !!user.id,
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    });

    const projects = projectData?.projects || [];

    // Check for Due Tasks on Load
    React.useEffect(() => {
        const checkTasks = async () => {
            if (!user?.id || !currentTenant) return;

            try {
                const { taskService } = await import('../../../services/taskService');
                const { tasks } = await taskService.getUpcomingTasks(user.id);

                const today = new Date();
                const dueTasks = (tasks || []).filter(t => {
                    if (!t.dueDate) return false;
                    const due = new Date(t.dueDate);
                    return due.setHours(0, 0, 0, 0) <= today.setHours(0, 0, 0, 0) && t.status !== 'completed';
                });

                if (dueTasks.length > 0) {
                    setNotification(`You have ${dueTasks.length} tasks due today!`);
                }
            } catch {
                console.error('Failed to checked tasks');
            }
        };

        checkTasks();
    }, [user, currentTenant]);

    React.useEffect(() => {
        if (dashboardStatsError) {
            toast.error('Could not load workspace summary.');
        }
    }, [dashboardStatsError]);



    // Map routes to display content (uses normalized route — not affected by language changes)
    const renderBusinessContent = (tab: string) => {
        // const plan = currentTenant?.subscription_plan || 'free';
        // const planFeatures = PLAN_PRICING[plan as keyof typeof PLAN_PRICING]?.features;

        const LockedFeature = ({ feature }: { feature: string }) => (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in-up">
                <div className="w-20 h-20 bg-teal-500/10 rounded-full flex items-center justify-center mb-6">
                    <ShieldCheck className="w-10 h-10 text-teal-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{feature} is Locked</h3>
                <p className="text-slate-400 max-w-md mb-8">
                    The full CRM suite, including Leads and Pipelines, is available on our Pro and Enterprise plans. Upgrade to supercharge your sales workflow.
                </p>
                <div className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('/dashboard/business/settings')}
                        className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-teal-900/20"
                    >
                        View Upgrade Options
                    </button>
                </div>
            </div>
        );

        switch (tab) {
            case '/dashboard':
            case '/dashboard/business':
                return <BusinessHome user={user} stats={dashboardStats} />;
            case '/dashboard/projects':
            case '/dashboard/business/projects':
                return <ProjectsPage user={user} />;
            case '/dashboard/business/team':
                return <TeamPage user={user} />;
            case '/dashboard/messages':
            case '/dashboard/business/messages':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
                        <MessagesPage user={user} />
                    </React.Suspense>
                );
            case '/dashboard/calendar':
            case '/dashboard/business/calendar':
                return (
                    <React.Suspense fallback={<div className="p-8"><TableSkeleton rows={10} columns={7} /></div>}>
                        <CalendarPage user={user} />
                    </React.Suspense>
                );
            case '/dashboard/business/booking':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
                        <BookingTab />
                    </React.Suspense>
                );
            case '/dashboard/business/teams':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
                        <TeamsPage user={user} setActiveTab={setActiveTab} />
                    </React.Suspense>
                );
            case '/dashboard/billing':
            case '/dashboard/business/billing':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
                        <EnhancedBillingPage user={user} />
                    </React.Suspense>
                );
            case '/dashboard/business/reports':
                return (
                    <React.Suspense fallback={<div className="p-8"><TableSkeleton rows={4} columns={2} /></div>}>
                        <ReportsPage user={user} />
                    </React.Suspense>
                );
            case '/dashboard/performance':
                return (
                    <React.Suspense fallback={<TableSkeleton />}>
                        <BusinessPerformanceDashboard />
                    </React.Suspense>
                );
            case '/dashboard/settings':
            case '/dashboard/business/settings':
                return (
                    <React.Suspense fallback={<div className="p-8"><TableSkeleton rows={8} columns={2} /></div>}>
                        <SettingsPage user={user} />
                    </React.Suspense>
                );
            case '/dashboard/business/meetings':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
                        <MeetingsPage user={user} onJoinRoom={handleJoinCall} />
                    </React.Suspense>
                );

            // New Routes
            case '/dashboard/crm':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                        <CRMTab user={user} />
                    </React.Suspense>
                );
            case '/dashboard/deals':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                        <DealsTab user={user} />
                    </React.Suspense>
                );
            case '/dashboard/business/referrals':
                return <ReferralsPage user={user} tenant={currentTenant} />;
            case '/dashboard/leads':
            case '/dashboard/contacts':
            case '/dashboard/business/clients':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                        <ClientsPage
                            user={user}
                        />
                    </React.Suspense>
                );
            case '/dashboard/crm/unified-contacts':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                        <ContactsList />
                    </React.Suspense>
                );
            case '/dashboard/forecast':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
                        <SalesForecastTab />
                    </React.Suspense>
                );
            case '/dashboard/analytics':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
                        <AnalyticsTab />
                    </React.Suspense>
                );
            case '/dashboard/executive':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
                        <ExecutiveDashboard />
                    </React.Suspense>
                );
            case '/dashboard/crm/console':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
                        <SalesConsole />
                    </React.Suspense>
                );
            case '/dashboard/crm/accounts':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                        <AccountsPage />
                    </React.Suspense>
                );
            case '/dashboard/crm/reports':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
                        <CRMReportsTab />
                    </React.Suspense>
                );
            case '/dashboard/accounting/banking':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
                        <BankingCenterPage />
                    </React.Suspense>
                );
            case '/dashboard/accounting/bills':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
                        <BillsPayablePage />
                    </React.Suspense>
                );
            case '/dashboard/accounting/period-close':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
                        <PeriodClosePage />
                    </React.Suspense>
                );
            case '/dashboard/marketing/sequences':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
                        <SequenceBuilder />
                    </React.Suspense>
                );
            case '/dashboard/marketing/deliverability':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
                        <div className="p-4"><DeliverabilityPanel /></div>
                    </React.Suspense>
                );
            case '/dashboard/tasks':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
                        <TasksTab user={user} />
                    </React.Suspense>
                );
            case '/dashboard/sales-agent':
                return <SalesAgent />;
            case '/dashboard/contracts':
            case '/dashboard/business/contracts':
                return <ContractDashboard user={user} initialTab="details" />;
            // Duplicate DocumentHub removed to allow EnhancedDocumentSystem to take precedence
            case '/dashboard/business/quotes':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
                        <QuotesTab user={user} />
                    </React.Suspense>
                );
            case '/dashboard/business/tasks':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
                        <TaskScheduler />
                    </React.Suspense>
                );

            case '/dashboard/business/quotas':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
                        <QuotaManager />
                    </React.Suspense>
                );
            case '/dashboard/business/documents':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
                        <DocumentHub user={user} />
                    </React.Suspense>
                );
            case '/dashboard/business/pages':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
                        <PagesTab />
                    </React.Suspense>
                );
            case '/dashboard/business/contact-submissions':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={3} />}>
                        <ContactSubmissionsTab />
                    </React.Suspense>
                );
            case '/dashboard/business/forms':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={3} />}>
                        <FormsHub />
                    </React.Suspense>
                );
            case '/dashboard/business/campaigns':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
                        <CampaignBuilder userId={user.id} />
                    </React.Suspense>
                );
            case '/dashboard/marketplace':
                return (
                    <React.Suspense fallback={<div className="p-8"><TableSkeleton rows={6} columns={3} /></div>}>
                        <MarketplacePage />
                    </React.Suspense>
                );
            case '/dashboard/business/facebook':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={3} />}>
                        <FacebookIntegrationTab user={user} tenant={currentTenant} />
                    </React.Suspense>
                );
            case '/dashboard/business/expenses':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
                        <ExpenseTrackerTab />
                    </React.Suspense>
                );
            case '/dashboard/automations':
            case '/dashboard/business/workflows':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
                        <WorkflowDashboard />
                    </React.Suspense>
                );
            case '/dashboard/business/sms':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
                        <SMSCampaignTab tenant={currentTenant} />
                    </React.Suspense>
                );
            case '/dashboard/business/social':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={4} columns={3} />}>
                        <SocialMediaComposer />
                    </React.Suspense>
                );
            case '/dashboard/business/linkedin':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={3} />}>
                        <LinkedInManagementTab />
                    </React.Suspense>
                );
            case '/dashboard/business/instagram':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={3} />}>
                        <InstagramIntegrationTab />
                    </React.Suspense>
                );
            case '/dashboard/business/x':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
                        <XIntegrationTab />
                    </React.Suspense>
                );

            case '/dashboard/business/whatsapp':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={3} />}>
                        <WhatsAppManagementPage />
                    </React.Suspense>
                );

            case '/dashboard/business/ingestion':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
                        <IngestionPanel />
                    </React.Suspense>
                );
            case '/dashboard/business/social-command':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
                        <SocialCommandCenter />
                    </React.Suspense>
                );

            case '/dashboard/mail':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={4} columns={1} />}>
                        <MailTab user={user} />
                    </React.Suspense>
                );

            case '/dashboard/zoho/mail':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} />}>
                        <div className="h-full p-3 md:p-5">
                            <UnifiedInboxView defaultProvider="zoho" />
                        </div>
                    </React.Suspense>
                );

            case '/dashboard/zoho/crm':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={3} />}>
                        <ZohoCRMIntegration />
                    </React.Suspense>
                );

            // Accounting Routes
            case '/dashboard/accounting':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={10} columns={5} />}>
                        <AccountingDashboard />
                    </React.Suspense>
                );

            case '/dashboard/business/unified-inbox':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
                        <div className="h-full p-3 md:p-5">
                            <UnifiedInboxView />
                        </div>
                    </React.Suspense>
                );

            case '/dashboard/business/cash-flow':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
                        <CashFlowForecastTab />
                    </React.Suspense>
                );

            case '/dashboard/business/onboarding':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
                        <ClientOnboardingTab />
                    </React.Suspense>
                );

            case '/dashboard/business/vault':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
                        <DocumentVaultTab />
                    </React.Suspense>
                );

            case '/dashboard/business/tax-estimator':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
                        <TaxEstimatorTab />
                    </React.Suspense>
                );

            case '/dashboard/business/bonnie':
                return (
                    <React.Suspense fallback={<TableSkeleton />}>
                        <BonnieFullView />
                    </React.Suspense>
                );

            case '/dashboard/business/tickets':
                return (
                    <React.Suspense fallback={<TableSkeleton />}>
                        <DeepDeskView />
                    </React.Suspense>
                );

            // Finance tab for tenant_admin (shared with admin/client via FinanceTab)
            case '/dashboard/finance':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={6} />}>
                        <FinanceTab user={user} />
                    </React.Suspense>
                );

            default:
                return (
                    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-8">
                        <p className="text-slate-400 text-sm mb-4">{t('This section could not be loaded.')}</p>
                        <button
                            type="button"
                            onClick={() => setActiveTab('/dashboard')}
                            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold"
                        >
                            {t('Back to Dashboard')}
                        </button>
                    </div>
                );
        }
    };

    const moduleContent = useMemo(
        () => wrapInHub(route, renderBusinessContent(route)),
        [route, user.id, currentTenant?.id, dashboardStats],
    );

    // Get current page title
    const getPageTitle = () => {
        switch (route) {
            case '/dashboard': return t('Dashboard');
            case '/dashboard/crm': return t('CRM');
            case '/dashboard/leads': return t('Leads');
            case '/dashboard/deals': return t('Deals');
            case '/dashboard/contacts':
            case '/dashboard/business/clients': return t('Contacts');
            case '/dashboard/crm/unified-contacts': return t('Unified Contacts');
            case '/dashboard/forecast': return t('Sales Forecast');
            case '/dashboard/analytics': return t('Insights');
            case '/dashboard/executive': return t('Executive Dashboard');
            case '/dashboard/crm/console': return t('Sales Console');
            case '/dashboard/crm/accounts': return t('Accounts');
            case '/dashboard/crm/reports': return t('CRM Reports');
            case '/dashboard/accounting/banking': return t('Banking');
            case '/dashboard/accounting/bills': return t('Bills Payable');
            case '/dashboard/accounting/period-close': return t('Period Close');
            case '/dashboard/marketing/sequences': return t('Sequences');
            case '/dashboard/marketing/deliverability': return t('Deliverability');
            case '/dashboard/projects':
            case '/dashboard/business/projects': return t('Projects');
            case '/dashboard/business/team': return t('Team Management');
            case '/dashboard/messages':
            case '/dashboard/business/messages': return t('Messages');
            case '/dashboard/calendar':
            case '/dashboard/business/calendar': return t('Calendar');
            case '/dashboard/billing':
            case '/dashboard/business/billing': return t('Billing');
            case '/dashboard/business/reports': return t('Analytics & Reports');
            case '/dashboard/performance': return t('Business OS Performance');
            case '/dashboard/settings':
            case '/dashboard/business/settings': return t('Settings');
            case '/dashboard/contracts':
            case '/dashboard/business/contracts': return t('Contracts');
            case '/dashboard/business/documents': return t('Document Hub');
            case '/dashboard/business/pages': return t('Pages');
            case '/dashboard/business/contact-submissions': return t('Contact Submissions');
            case '/dashboard/business/forms': return t('Branded Forms');
            case '/dashboard/business/campaigns': return t('Campaigns');
            case '/dashboard/business/facebook': return t('Facebook');
            case '/dashboard/business/expenses': return t('Expense Tracker');
            case '/dashboard/automations':
            case '/dashboard/business/workflows': return t('Workflow Builder');
            case '/dashboard/business/sms': return t('SMS Campaigns');
            case '/dashboard/business/social': return t('Social Media');
            case '/dashboard/business/linkedin': return t('LinkedIn Manager');
            case '/dashboard/business/instagram': return t('Instagram');
            case '/dashboard/business/x': return t('X (Twitter) Manager');
            case '/dashboard/business/whatsapp': return t('WhatsApp Accounts');

            case '/dashboard/business/unified-inbox': return t('Unified Inbox');
            case '/dashboard/business/cash-flow': return t('Cash Flow Forecast');
            case '/dashboard/business/onboarding': return t('Client Onboarding');
            case '/dashboard/business/vault': return t('Document Vault');
            case '/dashboard/business/tax-estimator': return t('Tax Estimator');

            case '/dashboard/business/ingestion': return t('Lead Ingestion');
            case '/dashboard/business/quotes': return t('Quotes & Proposals');
            case '/dashboard/business/booking': return t('Scheduling & Booking');
            case '/dashboard/business/teams': return t('MS Teams');
            case '/dashboard/business/social-command': return t('Social Command Center');
            case '/dashboard/tasks': return t('Tasks');
            case '/dashboard/sales-agent': return t('AI Growth');
            case '/dashboard/business/bonnie': return t('Bonnie AI Console');
            case '/dashboard/business/tickets': return t('Deep-Desk Support');
            case '/dashboard/accounting': return t('Accounting Dashboard');
            case '/dashboard/mail': return t('Mail');
            case '/dashboard/zoho/mail': return t('Zoho Mail');
            case '/dashboard/zoho/crm': return t('Zoho CRM Sync');
            case '/dashboard/marketplace': return t('Integration Marketplace');
            default: return t('AlphaClone');
        }
    };

    // Show loading state only on first workspace bootstrap (never flash back mid-session).
    if (!hasBootstrappedRef.current && tenantLoading && !currentTenant) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950">
                <div id="main-content" className="text-center">
                    <div className="text-slate-400 text-lg animate-pulse">{t('Loading Workspace...')}</div>
                </div>
            </div>
        );
    }

    // Show error state if no tenant after loading completes
    if (!currentTenant) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950">
                <div id="main-content" className="text-center max-w-md p-8">
                    <div className="text-slate-300 text-xl mb-4">{t('No Organization Found')}</div>
                    <div className="text-slate-400 mb-6">
                        {user.role === 'client'
                            ? t("You don't have access to this business dashboard. If you're a business owner, please contact support.")
                            : t('Unable to load your organization. This may be a temporary issue.')}
                    </div>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors font-medium border border-teal-400/20"
                        >
                            {t('Retry Loading')}
                        </button>
                        <button
                            onClick={() => onLogout()}
                            className="text-slate-500 hover:text-slate-400 text-sm transition-colors py-1"
                        >
                            {t('Log out and switch account')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Use external nav items instead of local redundant array

    return (
        <div className="flex min-w-0 bg-slate-950 text-white overflow-hidden font-sans selection:bg-teal-500/30 w-full max-w-full ac-business-root [height:100dvh]">
            <div data-tour="navigation" className="flex-shrink-0">
            <Sidebar
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                user={user}
                navItems={TENANT_ADMIN_NAV_ITEMS}
                activeTab={route}
                setActiveTab={setActiveTab}
                unreadMessageCount={unreadMessageCount}
                onLogout={onLogout}
            />
            </div>

            {/* Main Content */}
            {/* Removed radial gradient for strict mobile view cleanliness as requested to avoid 'motion' feel if any */}
            <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-slate-950 ac-business-main">

                <TrialBanner />

                {/* Task Notification Banner (Ephemeral) */}
                {notification && (
                    <div className="bg-teal-600/10 border-b border-teal-500/20 px-4 py-2 flex items-center justify-between backdrop-blur-sm sticky top-0 z-20">
                        <div className="flex items-center gap-2 text-teal-100 text-sm font-medium">
                            <CheckSquare className="w-4 h-4 text-teal-400" />
                            <span>{notification}</span>
                        </div>
                        <button
                            className="text-teal-400 hover:text-white text-xs font-bold"
                            onClick={() => {
                                setNotification(null);
                                setActiveTab('/dashboard/tasks');
                            }}
                        >
                            View Tasks
                        </button>
                    </div>
                )}

                {/* Header */}
                <header className="h-16 border-b border-slate-800/50 flex items-center justify-between px-4 md:px-8 bg-slate-950/95 sticky top-0 z-10 w-full ac-business-header">
                    {/* Left: Menu & Mobile Logo */}
                    <div className="flex items-center gap-4">
                        {/* Mobile Menu Toggle removed - BottomNav handles it */}

                        <div className="flex items-center gap-2 sm:gap-3 md:hidden">
                            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center overflow-hidden relative flex-shrink-0">
                                {currentTenant?.logo_url ? (
                                    <Image
                                        src={currentTenant.logo_url}
                                        alt="Logo"
                                        fill
                                        className="object-cover"
                                        sizes="32px"
                                    />
                                ) : (
                                    <span className="text-teal-400 font-bold text-lg">{currentTenant?.name?.charAt(0) || 'A'}</span>
                                )}
                            </div>
                            {!isHubRoute(route) && (
                                <h1 className="pwa-page-title text-white/90 whitespace-nowrap truncate max-w-[150px] sm:max-w-none">{getPageTitle()}</h1>
                            )}
                        </div>

                        {/* Breadcrumb or Title for Desktop — hidden inside hubs (HubShell shows title) */}
                        {!isHubRoute(route) && (
                        <div className="hidden md:block">
                            <h1 className="text-lg font-bold text-white/90 tracking-tight">
                                {getPageTitle()}
                            </h1>
                        </div>
                        )}
                    </div>

                    {/* Right: Actions, Notifications, Profile */}
                    <div className="flex items-center gap-3 sm:gap-4">
                        {activeBgTasksCount > 0 && (
                            <div className="flex items-center gap-2 bg-slate-800/50 text-teal-400 px-3 py-1.5 rounded-full text-xs font-semibold animate-pulse border border-teal-500/30">
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span className="hidden sm:inline">{activeBgTasksCount} Task(s)</span>
                            </div>
                        )}
                        {activeMeetingCallId && (
                            <button
                                onClick={() => setIsMeetingMinimized(false)}
                                className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 text-teal-300 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-teal-500/20 transition-colors"
                                title="Return to active meeting"
                            >
                                <Video className="w-3.5 h-3.5" />
                                {isMeetingMinimized ? 'Return to Meeting' : 'Meeting Active'}
                            </button>
                        )}

                        <div className="hidden sm:block w-px h-6 bg-slate-800 mx-1" />

                        <div className="flex items-center gap-3 sm:gap-4">
                            <div data-tour="global-search" className="hidden sm:block">
                                <EnhancedGlobalSearch
                                    user={user}
                                    onNavigate={(path) => setActiveTab(path)}
                                />
                            </div>
                            <MissedCallsNotification
                                userId={user.id}
                                onCallBack={(callerId) => {
                                    const roomId = `room-${callerId.slice(0, 8)}`;
                                    toast.success('Calling back...');
                                    router.push(`/dashboard/call/${roomId}`);
                                }}
                            />
                            <div data-tour="business-notifications">
                            <NotificationCenter userId={user.id} tenantId={currentTenant.id} />
                            </div>
                            <div className="hidden sm:flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 rounded-full pl-2 pr-1 py-1">
                                <Globe className="w-3.5 h-3.5 text-slate-400" />
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value as typeof language)}
                                    aria-label="Language"
                                    className="bg-transparent text-[11px] font-semibold text-slate-300 outline-none cursor-pointer pr-1"
                                >
                                    {LANGUAGES.map((lang) => (
                                        <option key={lang.code} value={lang.code} className="bg-slate-900">{lang.label}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={() => setActiveTab('/dashboard/business/settings')}
                                title="Settings"
                                aria-label="Settings"
                                className="hidden sm:flex w-10 h-10 rounded-full bg-slate-800 border border-slate-700/60 items-center justify-center text-slate-300 hover:text-white hover:border-teal-500/40 transition-all active:scale-95"
                            >
                                <Settings className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setActiveTab('/dashboard/business/settings')}
                                title="Profile & settings"
                                aria-label="Profile and settings"
                                className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700/50 overflow-hidden shadow-lg shadow-teal-500/10 ring-2 ring-transparent hover:ring-teal-500/50 transition-all cursor-pointer group relative active:scale-95"
                            >
                                <Image
                                    src={user.avatar || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.email || user.name || 'user'}`}
                                    alt="Profile"
                                    fill
                                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                                    sizes="40px"
                                />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Dynamic Content Area */}
                <div
                    className={`flex-1 min-h-0 ac-business-scroll ${
                        DASHBOARD_EDGE_TO_EDGE_TABS.includes(route)
                            ? 'overflow-hidden p-0'
                            : 'overflow-y-auto overflow-x-hidden p-4 md:p-8 dashboard-content-padding'
                    }`}
                >
                    <WidgetErrorBoundary title="Business Dashboard Error">
                        <div
                            key={route}
                            className={`w-full min-w-0 ${
                                DASHBOARD_EDGE_TO_EDGE_TABS.includes(route)
                                    ? 'h-full min-h-0 max-md:pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))]'
                                    : 'min-h-full'
                            }`}
                        >
                            {moduleContent}
                        </div>
                    </WidgetErrorBoundary>
                </div>
            </main>

            {/* Contract Modal */}
            {showContractModal && (
                <AlphaCloneContractModal
                    isOpen={showContractModal}
                    onClose={() => setShowContractModal(false)}
                    project={selectedProjectForContract}
                    user={user}
                />
            )}

            {activeMeetingCallId && (
                <React.Suspense fallback={null}>
                    {!isMeetingMinimized && (
                        <button
                            onClick={() => setIsMeetingMinimized(true)}
                            className="fixed top-20 right-4 z-[130] inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/90 border border-white/15 text-xs font-semibold text-slate-100 hover:bg-slate-800 transition-colors"
                            title="Run meeting in background"
                        >
                            <Minimize2 className="w-3.5 h-3.5" />
                            Background mode
                        </button>
                    )}
                    {activeMeetingProvider === 'teams' && activeMeetingJoinUrl ? (
                        <div className="fixed inset-0 z-[120] bg-slate-950">
                            <MicrosoftMeetingEmbed
                                meetingLink={activeMeetingJoinUrl}
                                displayName={user.name || user.email || 'Host'}
                            />
                        </div>
                    ) : (
                        <CustomVideoRoom
                            user={user}
                            callId={activeMeetingCallId}
                            onLeave={endMeeting}
                            isMinimized={isMeetingMinimized}
                            onToggleMinimize={toggleMeetingMinimized}
                        />
                    )}
                </React.Suspense>
            )}

            {/* Mobile Bottom Navigation */}
            <BottomNav
                activeTab={route}
                onNavigate={(href) => setActiveTab(href)}
                onToggleMenu={() => setSidebarOpen(true)}
                unreadCount={unreadMessageCount}
                userRole="tenant_admin"
            />

            {route !== '/dashboard/business/bonnie' && <BonnieWidget />}

            <CommandPalette
                isOpen={commandPaletteOpen}
                onClose={() => setCommandPaletteOpen(false)}
                userId={user.id}
                onCreateTask={() => setActiveTab('/dashboard/tasks')}
                onCreateProject={() => setActiveTab('/dashboard/business/projects')}
                onCreateInvoice={() => setActiveTab('/dashboard/business/billing')}
            />

            <ProductTour
                isOpen={showProductTour}
                onComplete={() => {
                    setShowProductTour(false);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem(`business_tour_completed_${user.id}`, '1');
                    }
                }}
                userRole="tenant_admin"
            />

        </div>
    );
}
