import React, { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
    LayoutDashboard,
    Users,
    Briefcase,
    Settings,
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
    RefreshCw
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
// New Components
const TaskScheduler = React.lazy(() => import('./TaskScheduler'));
const ZohoMailView = React.lazy(() => import('../zoho/ZohoMailView'));
const ZohoCRMIntegration = React.lazy(() => import('../zoho/ZohoCRMIntegration'));


const QuotaManager = React.lazy(() => import('./QuotaManager'));
const DailySummarySystem = React.lazy(() => import('./DailySummarySystem'));
const PagesTab = React.lazy(() => import('@/components/pages/PagesTab'));
const ContactSubmissionsTab = React.lazy(() => import('../ContactSubmissionsTab'));
const CampaignBuilder = React.lazy(() => import('./CampaignBuilder'));
const FacebookIntegrationTab = React.lazy(() => import('../facebook/FacebookIntegrationTab'));
const ExpenseTrackerTab = React.lazy(() => import('./ExpenseTrackerTab'));
const WorkflowDashboard = React.lazy(() => import('../engine/WorkflowDashboard'));
const SMSCampaignTab = React.lazy(() => import('../engine/SMSCampaignTab'));
const SocialMediaComposer = React.lazy(() => import('../engine/SocialMediaComposer'));
const IngestionPanel = React.lazy(() => import('../engine/IngestionPanel'));
const MarketplacePage = React.lazy(() => import('../MarketplacePage'));

import Sidebar from '@/components/dashboard/Sidebar';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { TENANT_ADMIN_NAV_ITEMS } from '@/constants';
import { PLAN_PRICING } from '../../../services/tenancy/types';
import { WidgetErrorBoundary } from '../WidgetErrorBoundary';
import NotificationCenter from '../NotificationCenter';

interface BusinessDashboardProps {
    user: User;
    onLogout: () => void;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    currentTenant?: any; // optional — component fetches via useTenant() context
}

export default function BusinessDashboard({ currentTenant: propTenant, user, onLogout, setActiveTab, activeTab }: BusinessDashboardProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { currentTenant: contextTenant, isLoading: tenantLoading, getDashboardStats } = useTenant();
    const currentTenant = propTenant || contextTenant;
    // Default active section within settings
    const [activeSection, setActiveSection] = useState('profile');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [dashboardStats, setDashboardStats] = useState<any>(null);

    // Sync sidebar on mount to avoid hydration mismatch
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            setSidebarOpen(window.innerWidth >= 1024);
        }
    }, []);

    // -- PERSISTENT VIDEO CALL STATE --
    // Note: Video calls now use dedicated pages (/meet/[id])
    const { tasks: bgTasks } = useBackgroundTasks();
    const activeBgTasksCount = bgTasks.filter(t => t.status === 'running').length;

    // Explicitly typed handlers
    const handleJoinCall = (callId: string) => {
        router.push(`/meet/${callId}`);
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

    const projects = projectData?.projects || [];

    // Check for Due Tasks on Load
    React.useEffect(() => {
        const checkTasks = async () => {
            if (!user?.id || !currentTenant) return;

            try {
                const { taskService } = await import('../../../services/taskService');
                const { tasks } = await taskService.getUpcomingTasks(user.id);

                const today = new Date();
                const dueTasks = tasks.filter(t => {
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

        // Fetch consolidated stats
        if (currentTenant?.id && user?.id && !dashboardStats) {
            getDashboardStats(currentTenant.id, user.id).then((result) => {
                if (result && result.stats) setDashboardStats(result.stats);
            });
        }
    }, [user, currentTenant, dashboardStats, getDashboardStats]);

    const trialInfo = React.useMemo(() => {
        if (!currentTenant?.trial_ends_at || currentTenant.subscription_status !== 'trial') return null;
        const now = new Date();
        const trialEnd = new Date(currentTenant.trial_ends_at);
        const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { daysLeft, expired: daysLeft <= 0 };
    }, [currentTenant]);

    const isTrialExpired = false; // SubscriptionGuard handles full block, here we just show banner

    // Map routes to display content
    const renderBusinessContent = () => {
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

        switch (activeTab) {
            case '/dashboard':
                return <BusinessHome user={user} stats={dashboardStats} />;
            case '/dashboard/business/projects':
                return <ProjectsPage user={user} />;
            case '/dashboard/business/team':
                return <TeamPage user={user} />;
            case '/dashboard/business/messages':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={4} />}>
                        <MessagesPage user={user} />
                    </React.Suspense>
                );
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
            case '/dashboard/leads':
            case '/dashboard/deals':
            case '/dashboard/crm':
            case '/dashboard/contacts':
            case '/dashboard/business/clients':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
                        <ClientsPage
                            user={user}
                        />
                    </React.Suspense>
                );
            case '/dashboard/tasks':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
                        <TasksTab userId={user.id} userRole={user.role} />
                    </React.Suspense>
                );
            case '/dashboard/sales-agent':
                return <SalesAgent />;
            case '/dashboard/business/contracts':
                return <ContractDashboard user={user} initialTab="details" />;
            // Duplicate DocumentHub removed to allow EnhancedDocumentSystem to take precedence
            case '/dashboard/business/quotes':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
                        <QuotesTab userId={user.id} userRole={user.role} />
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
            case '/dashboard/business/ingestion':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
                        <IngestionPanel />
                    </React.Suspense>
                );
            case '/dashboard/business/daily-summary':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
                        <DailySummarySystem />
                    </React.Suspense>
                );

            case '/dashboard/mail':
            case '/dashboard/gmail':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={4} columns={1} />}>
                        <MailTab user={user} />
                    </React.Suspense>
                );

            case '/dashboard/zoho/mail':
                return (
                    <React.Suspense fallback={<TableSkeleton rows={6} />}>
                        <ZohoMailView />
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

            // Finance tab for tenant_admin (shared with admin/client via FinanceTab)
            case '/dashboard/finance': {
                const FinanceTab = React.lazy(() => import('../FinanceTab'));
                return (
                    <React.Suspense fallback={<TableSkeleton rows={8} columns={6} />}>
                        <FinanceTab
                            user={user}
                            filteredInvoices={[]}
                            handlePayClick={() => {}}
                            onCreateInvoice={() => {}}
                        />
                    </React.Suspense>
                );
            }

            default:
                return <BusinessHome user={user} stats={dashboardStats} />;
        }
    };

    // Get current page title
    const getPageTitle = () => {
        switch (activeTab) {
            case '/dashboard': return 'Dashboard';
            case '/dashboard/crm':
            case '/dashboard/contacts':
            case '/dashboard/business/clients': return 'Contacts';
            case '/dashboard/business/projects': return 'Projects';
            case '/dashboard/business/team': return 'Team Management';
            case '/dashboard/business/messages': return 'Messages';
            case '/dashboard/business/calendar': return 'Calendar';
            case '/dashboard/business/billing': return 'Billing';
            case '/dashboard/business/reports': return 'Analytics & Reports';
            case '/dashboard/business/settings': return 'Settings';
            case '/dashboard/business/contracts': return 'Contracts';
            case '/dashboard/business/documents': return 'Document Hub';
            case '/dashboard/business/pages': return 'Pages';
            case '/dashboard/business/contact-submissions': return 'Contact Submissions';
            case '/dashboard/business/campaigns': return 'Campaigns';
            case '/dashboard/business/facebook': return 'Facebook';
            case '/dashboard/business/expenses': return 'Expense Tracker';
            case '/dashboard/automations':
            case '/dashboard/business/workflows': return 'Workflow Builder';
            case '/dashboard/business/sms': return 'SMS Campaigns';
            case '/dashboard/business/social': return 'Social Media';
            case '/dashboard/business/ingestion': return 'Lead Ingestion';
            case '/dashboard/business/quotes': return 'Quotes & Proposals';
            case '/dashboard/business/booking': return 'Scheduling & Booking';
            case '/dashboard/tasks': return 'Tasks';
            case '/dashboard/sales-agent': return 'AI Growth';
            case '/dashboard/deals':
            case '/dashboard/leads': return 'Deals';
            case '/dashboard/accounting': return 'Accounting Dashboard';
            case '/dashboard/mail':
            case '/dashboard/gmail': return 'Mail';
            case '/dashboard/zoho/mail': return 'Zoho Mail';
            case '/dashboard/zoho/crm': return 'Zoho CRM Sync';
            default: return 'AlphaClone';
        }
    };

    // Show loading state while tenant context initializes (only if no cache found)
    if (tenantLoading && !currentTenant) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950">
                <div id="main-content" className="text-center">
                    <div className="text-slate-400 text-lg animate-pulse">Loading Workspace...</div>
                </div>
            </div>
        );
    }

    // Show error state if no tenant after loading completes
    if (!currentTenant) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950">
                <div id="main-content" className="text-center max-w-md p-8">
                    <div className="text-slate-300 text-xl mb-4">No Organization Found</div>
                    <div className="text-slate-400 mb-6">
                        {user.role === 'client'
                            ? "You don't have access to this business dashboard. If you're a business owner, please contact support."
                            : "Unable to load your organization. This may be a temporary issue."}
                    </div>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors font-medium border border-teal-400/20"
                        >
                            Retry Loading
                        </button>
                        <button
                            onClick={() => onLogout()}
                            className="text-slate-500 hover:text-slate-400 text-sm transition-colors py-1"
                        >
                            Log out and switch account
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Use external nav items instead of local redundant array

    return (
        <div className="flex h-screen bg-slate-950 text-white overflow-hidden font-sans selection:bg-teal-500/30 w-full max-w-full">
            <Sidebar
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                user={user}
                navItems={TENANT_ADMIN_NAV_ITEMS}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                unreadMessageCount={0}
                onLogout={onLogout}
            />

            {/* Main Content */}
            {/* Removed radial gradient for strict mobile view cleanliness as requested to avoid 'motion' feel if any */}
            <main className="flex-1 flex flex-col min-w-0 bg-slate-950">

                {/* Trial Countdown Banner */}
                {trialInfo && !trialInfo.expired && trialInfo.daysLeft <= 7 && (
                    <div className={`border-b px-4 py-2 flex items-center justify-between backdrop-blur-sm sticky top-0 z-20 ${
                        trialInfo.daysLeft <= 3
                            ? 'bg-red-600/10 border-red-500/20'
                            : 'bg-amber-600/10 border-amber-500/20'
                    }`}>
                        <div className={`flex items-center gap-2 text-sm font-medium ${
                            trialInfo.daysLeft <= 3 ? 'text-red-100' : 'text-amber-100'
                        }`}>
                            <CreditCard className={`w-4 h-4 ${trialInfo.daysLeft <= 3 ? 'text-red-400' : 'text-amber-400'}`} />
                            <span>
                                {trialInfo.daysLeft === 1
                                    ? 'Trial ends tomorrow — add a payment method to keep access'
                                    : `Trial ends in ${trialInfo.daysLeft} days — no action needed yet`}
                            </span>
                        </div>
                        <button
                            className={`text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-bold ${
                                trialInfo.daysLeft <= 3
                                    ? 'bg-red-500 hover:bg-red-600'
                                    : 'bg-amber-500 hover:bg-amber-600'
                            }`}
                            onClick={() => setActiveTab('/dashboard/business/settings')}
                        >
                            Manage Billing
                        </button>
                    </div>
                )}
                {trialInfo && trialInfo.expired && (
                    <div className="bg-red-600/10 border-b border-red-500/20 px-4 py-2 flex items-center justify-between backdrop-blur-sm sticky top-0 z-20">
                        <div className="flex items-center gap-2 text-red-100 text-sm font-medium">
                            <CreditCard className="w-4 h-4 text-red-400" />
                            <span>Trial Expired — Add payment method to restore full access</span>
                        </div>
                        <button
                            className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-bold"
                            onClick={() => setActiveTab('/dashboard/business/settings')}
                        >
                            Add Payment
                        </button>
                    </div>
                )}

                {/* Task Notification Banner (Ephemeral) */}
                {notification && !isTrialExpired && (
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
                <header className="h-16 border-b border-slate-800/50 flex items-center justify-between px-4 md:px-8 bg-slate-950/95 sticky top-0 z-10 w-full">
                    {/* Left: Menu & Mobile Logo */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="md:hidden p-2 text-white hover:text-teal-400 transition-colors rounded-lg hover:bg-slate-800"
                        >
                            <Menu className="w-6 h-6" />
                        </button>

                        <div className="flex items-center gap-2 sm:gap-3 md:hidden">
                            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center overflow-hidden relative">
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
                        </div>

                        {/* Breadcrumb or Title for Desktop */}
                        <div className="hidden md:block">
                            <h1 className="text-lg font-bold text-white/90 tracking-tight">
                                {getPageTitle()}
                            </h1>
                        </div>
                    </div>

                    {/* Right: Actions, Notifications, Profile */}
                    <div className="flex items-center gap-3 sm:gap-4">
                        {activeBgTasksCount > 0 && (
                            <div className="flex items-center gap-2 bg-slate-800/50 text-teal-400 px-3 py-1.5 rounded-full text-xs font-semibold animate-pulse border border-teal-500/30">
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span className="hidden sm:inline">{activeBgTasksCount} Task(s)</span>
                            </div>
                        )}

                        <div className="hidden sm:block w-px h-6 bg-slate-800 mx-1" />

                        <div className="flex items-center gap-3 sm:gap-4">
                            <NotificationCenter userId={user.id} tenantId={currentTenant.id} />
                            <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700/50 overflow-hidden shadow-lg shadow-teal-500/10 ring-2 ring-transparent hover:ring-teal-500/50 transition-all cursor-pointer group relative">
                                <Image
                                    src={user.avatar || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.email || user.name || 'user'}`}
                                    alt="Profile"
                                    fill
                                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                                    sizes="40px"
                                />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Dynamic Content Area */}
                <div className={`flex-1 ${[
                    '/dashboard/mail',
                    '/dashboard/gmail',
                    '/dashboard/business/projects',
                    '/dashboard/tasks',
                    '/dashboard/sales-agent',
                    '/dashboard/crm',
                    '/dashboard/contacts',
                    '/dashboard/business/clients',
                    '/dashboard/zoho/mail',
                    '/dashboard/zoho/crm'
                ].includes(activeTab) ? 'overflow-hidden p-0' : 'overflow-y-auto p-4 md:p-8 dashboard-content-padding'}`}>
                    <WidgetErrorBoundary title="Business Dashboard Error">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, scale: 0.99, y: 5 }}
                                animate={{ opacity: 1, scale: 1, y: 0, pointerEvents: 'auto' }}
                                exit={{ opacity: 0, scale: 0.99, y: -5, pointerEvents: 'none' }}
                                transition={{ duration: 0.15, ease: "easeOut" }}
                                className="h-full w-full"
                            >
                                {renderBusinessContent()}
                            </motion.div>
                        </AnimatePresence>
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
        </div>
    );
}
