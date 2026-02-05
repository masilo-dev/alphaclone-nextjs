import React, { useState } from 'react';
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
    ShieldCheck
} from 'lucide-react';
import { Project, User } from '../../../types';
import { projectService } from '../../../services/projectService';
import { useTenant } from '../../../contexts/TenantContext';
// Components
import BusinessHome from './BusinessHome';
import ClientsPage from './ClientsPage';
import ProjectsPage from './ProjectsPage';
import TeamPage from './TeamPage';
import MessagesPage from './MessagesPage';
import CalendarPage from './CalendarPage';
import BillingPage from './BillingPage';
import ReportsPage from './ReportsPage';
import SettingsPage from './SettingsPage';
import MeetingsPage from './MeetingsPage';
// New CRM Components
import CRMTab from '../CRMTab';
import TasksTab from '../TasksTab';
import SalesAgent from '../SalesAgent';
import DealsTab from '../DealsTab';
import AlphaCloneContractModal from '../../contracts/AlphaCloneContractModal';
import ContractDashboard from '../../contracts/ContractDashboard';

interface BusinessDashboardProps {
    user: User;
    onLogout: () => void;
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const BusinessDashboard: React.FC<BusinessDashboardProps> = ({ user, onLogout, activeTab, setActiveTab }) => {
    const { currentTenant, isLoading: tenantLoading } = useTenant();
    const [sidebarOpen, setSidebarOpen] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth >= 768;
        }
        return true;
    });

    // -- PERSISTENT VIDEO CALL STATE --
    const [activeCallUrl, setActiveCallUrl] = useState<string | null>(null);
    const [isCallMinimized, setIsCallMinimized] = useState(false);

    // Explicitly typed handlers
    const handleJoinCall = (url: string) => {
        if (!url) return;
        setActiveCallUrl(url);
        setIsCallMinimized(false);
    };

    const handleLeaveCall = () => {
        setActiveCallUrl(null);
        setIsCallMinimized(false);
    };

    // Contract Modal State
    const [showContractModal, setShowContractModal] = useState(false);
    const [selectedProjectForContract, setSelectedProjectForContract] = useState<any>(null);

    const handleOpenContract = (project?: any) => {
        // If no project passed, create dummy one for standalone contract
        setSelectedProjectForContract(project || {
            id: 'new',
            name: 'New Project',
            ownerId: user.id, // Self as owner proxy if direct
            ownerName: 'Client Name',
            budget: 0
        });
        setShowContractModal(true);
    };

    // Check for Due Tasks on Load
    React.useEffect(() => {
        const checkTasks = async () => {
            // Import services dynamically if needed or assume user context
            if (!user?.id || !currentTenant) return;

            try {
                // Dynamically import task service to avoid circular deps if any
                const { taskService } = await import('../../../services/taskService');
                const { tasks } = await taskService.getUpcomingTasks(user.id);

                // Filter for tasks due today or overdue
                const today = new Date();
                const dueTasks = tasks.filter(t => {
                    if (!t.dueDate) return false;
                    const due = new Date(t.dueDate);
                    // Check if due date is today or earlier (and not completed)
                    return due.setHours(0, 0, 0, 0) <= today.setHours(0, 0, 0, 0) && t.status !== 'completed';
                });

                if (dueTasks.length > 0) {
                    // Small delay to let UI settle
                    setTimeout(() => {
                        // Simple alert or toast - for now we use a custom toast if available, or just console
                        // In a real app we'd use a toast library. Let's assume we can trigger a browser notification or a UI banner.
                        // Since we don't have a global toast context visible here, I'll add a local state for a notification banner.
                        setNotification(`You have ${dueTasks.length} tasks due today!`);
                    }, 1000);
                }
            } catch (err) {
                console.error('Failed to checked tasks', err);
            }
        };

        checkTasks();

        // Fetch projects for context in other tabs (CRM, etc)
        const loadProjects = async () => {
            if (!currentTenant) return;
            setLoadingProjects(true);
            try {
                const { projects: data } = await projectService.getProjects(user.id, user.role);
                setProjects(data || []);
            } catch (err) {
                console.error('Failed to load projects in BusinessDashboard', err);
            } finally {
                setLoadingProjects(false);
            }
        };

        loadProjects();
    }, [user, currentTenant]);

    const [notification, setNotification] = useState<string | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);

    // Trial Logic - DISABLED as per user request for full access
    const isTrialExpired = React.useMemo(() => {
        return false; // Force enable full access
        /*
        // Safe check: If trialEndsAt is null/undefined, return false (Existing Tenants are SAFE)
        if (!currentTenant?.trialEndsAt) return false;

        const now = new Date();
        const trialEnd = new Date(currentTenant.trialEndsAt);
        return now > trialEnd && currentTenant.subscriptionStatus === 'trial';
        */
    }, [currentTenant]);

    // Map routes to display content
    const renderBusinessContent = () => {
        const plan = currentTenant?.subscription_plan || 'free';
        const { PLAN_PRICING } = require('../../../services/tenancy/types');
        const planFeatures = PLAN_PRICING[plan as keyof typeof PLAN_PRICING]?.features;

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
                        onClick={() => setActiveTab('/dashboard/business/billing')}
                        className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-teal-900/20"
                    >
                        View Upgrade Options
                    </button>
                </div>
            </div>
        );

        switch (activeTab) {
            case '/dashboard':
                return <BusinessHome user={user} />;
            case '/dashboard/business/clients':
                return <ClientsPage user={user} />;
            case '/dashboard/business/projects':
                return <ProjectsPage user={user} />;
            case '/dashboard/business/team':
                return <TeamPage user={user} />;
            case '/dashboard/business/messages':
                return <MessagesPage user={user} />;
            case '/dashboard/business/calendar':
                return <CalendarPage user={user} />;
            case '/dashboard/business/billing':
                return <BillingPage user={user} />;
            case '/dashboard/business/reports':
                return <ReportsPage user={user} />;
            case '/dashboard/business/settings':
                return <SettingsPage user={user} />;
            case '/dashboard/business/meetings':
                return <MeetingsPage user={user} onJoinRoom={handleJoinCall} />;

            // New Routes
            case '/dashboard/crm':
                return <CRMTab
                    projects={projects}
                    declineProject={() => { }}
                    openContractGenerator={handleOpenContract}
                    openVideoCall={handleJoinCall}
                />;
            case '/dashboard/tasks':
                return <TasksTab userId={user.id} userRole={user.role} />;
            case '/dashboard/sales-agent':
                return <SalesAgent />;
            case '/dashboard/leads':
                return <DealsTab userId={user.id} userRole={user.role} />;
            case '/dashboard/business/contracts':
                return <ContractDashboard user={user} />;

            default:
                return <BusinessHome user={user} />;
        }
    };

    // Get current page title
    const getPageTitle = () => {
        switch (activeTab) {
            case '/dashboard': return 'AlphaClone Home';
            case '/dashboard/business/clients': return 'Client Directory';
            case '/dashboard/business/projects': return 'Projects';
            case '/dashboard/business/team': return 'Team Management';
            case '/dashboard/business/messages': return 'Messages';
            case '/dashboard/business/calendar': return 'Calendar';
            case '/dashboard/business/billing': return 'Invoices & Billing';
            case '/dashboard/business/reports': return 'Analytics & Reports';
            case '/dashboard/business/settings': return 'Settings';
            case '/dashboard/business/contracts': return 'Contracts';
            case '/dashboard/crm': return 'CRM';
            case '/dashboard/tasks': return 'Tasks';
            case '/dashboard/sales-agent': return 'Sales Agent';
            case '/dashboard/leads': return 'Leads & Pipelines';
            default: return 'AlphaClone';
        }
    };

    const navItems = [
        { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
        { label: 'CRM', href: '/dashboard/crm', icon: Users },
        { label: 'Leads', href: '/dashboard/leads', icon: TrendingUp },
        { label: 'Sales Agent', href: '/dashboard/sales-agent', icon: Bot },
        { label: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare },
        { label: 'Meetings', href: '/dashboard/business/meetings', icon: Video },
        { label: 'Projects', href: '/dashboard/business/projects', icon: FileText },
        { label: 'Contracts', href: '/dashboard/business/contracts', icon: FileCheck },
        { label: 'Calendar', href: '/dashboard/business/calendar', icon: Briefcase },
        { label: 'Messages', href: '/dashboard/business/messages', icon: Bell },
        { label: 'Team', href: '/dashboard/business/team', icon: Users },
        { label: 'Finance', href: '/dashboard/business/billing', icon: CreditCard },
        { label: 'Settings', href: '/dashboard/business/settings', icon: Settings },
    ];

    // Show loading state while tenant context initializes
    if (tenantLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950">
                <div id="main-content" className="text-center">
                    <div className="text-slate-400 text-lg">Loading your workspace...</div>
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
                        Unable to load your organization. This may be a temporary issue.
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-950 text-white overflow-hidden font-sans selection:bg-teal-500/30 w-full max-w-full">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`${sidebarOpen
                ? 'w-72 translate-x-0 pb-24 md:pb-0'
                : 'w-0 -translate-x-full md:w-16 md:translate-x-0'
                } bg-slate-900 border-r border-slate-800 flex flex-col fixed md:relative z-50 h-full transition-all duration-300 shadow-2xl overflow-hidden`}>
                <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-900">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                            {/* Replaced Icon with Logo Placeholder if needed, sticking to Briefcase for now but title is AlphaClone */}
                            <Briefcase className="w-5 h-5 text-teal-400" />
                        </div>
                        <span className={`font-bold text-white text-lg tracking-tight transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                            AlphaClone
                        </span>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5 custom-scrollbar">
                    {navItems.map((item, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                setActiveTab(item.href);
                                // Auto-close sidebar on mobile after navigation
                                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                                    setSidebarOpen(false);
                                }
                            }}
                            title={!sidebarOpen ? item.label : undefined}
                            className={`w-full flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center px-2'} py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden active:scale-95
                         ${activeTab === item.href
                                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            {activeTab === item.href && <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />}
                            <item.icon className={`w-5 h-5 flex-shrink-0 ${activeTab === item.href ? 'text-white' : 'group-hover:text-teal-400 transition-colors'}`} />
                            <span className={`${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden md:block'} flex-1 text-left whitespace-nowrap text-sm font-medium`}>{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-800 bg-slate-900 mt-auto">
                    <button
                        onClick={onLogout}
                        className={`flex items-center gap-3 text-slate-400 hover:text-red-400 w-full ${sidebarOpen ? 'px-4' : 'justify-center px-2'} py-3 rounded-xl hover:bg-red-500/10 transition-colors group active:scale-95`}
                    >
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className={`${sidebarOpen ? 'block' : 'hidden md:hidden'} text-sm font-medium`}>Log Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            {/* Removed radial gradient for strict mobile view cleanliness as requested to avoid 'motion' feel if any */}
            <main className="flex-1 flex flex-col min-w-0 bg-slate-950">

                {/* Trial Expiration Banner */}
                {isTrialExpired && (
                    <div className="bg-red-600/10 border-b border-red-500/20 px-4 py-2 flex items-center justify-between backdrop-blur-sm sticky top-0 z-20">
                        <div className="flex items-center gap-2 text-red-100 text-sm font-medium">
                            <CreditCard className="w-4 h-4 text-red-400" />
                            <span>Trial Expired - View Only Mode</span>
                        </div>
                        <button
                            className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-bold shadow-lg shadow-red-900/20"
                            onClick={() => setActiveTab('/dashboard/business/billing')}
                        >
                            Upgrade Now
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
                <header className="h-16 border-b border-slate-800/50 flex items-center justify-between px-4 md:px-8 bg-slate-950/95 sticky top-0 z-10">
                    <div className="flex items-center gap-4 flex-1">
                        {/* Mobile Menu Toggle */}
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="md:hidden p-2 text-white hover:text-teal-400 transition-colors rounded-lg hover:bg-slate-800"
                        >
                            <Menu className="w-6 h-6" />
                        </button>

                        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-white truncate max-w-[150px] sm:max-w-none">
                            {getPageTitle()}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Removed Assistant Button as requested ("remove the recording button") */}

                        <div className="hidden md:block w-px h-6 bg-slate-800 mx-2" />

                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
                            <img
                                src={currentTenant?.logo_url || user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=random`}
                                alt="Profile"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>
                </header>

                {/* Dynamic Content Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    {renderBusinessContent()}
                </div>
            </main>

            {/* Persistent Video Room Overlay */}
            {activeCallUrl && (
                <div className={isCallMinimized ? 'pointer-events-none fixed inset-0 z-[200]' : 'fixed inset-0 z-[100]'}>
                    <div className={isCallMinimized ? 'pointer-events-auto' : 'h-full w-full'}>
                        <React.Suspense fallback={null}>
                            {(() => {
                                // Dynamic import
                                const CustomVideoRoom = React.lazy(() => import('../video/CustomVideoRoom'));
                                return (
                                    <CustomVideoRoom
                                        user={user}
                                        roomUrl={activeCallUrl}
                                        onLeave={handleLeaveCall}
                                        // Business Dashboard has simpler sidebar, but we can pass dummy toggles if needed or implement sidebar toggle
                                        isMinimized={isCallMinimized}
                                        onToggleMinimize={() => setIsCallMinimized(!isCallMinimized)}
                                    />
                                );
                            })()}
                        </React.Suspense>
                    </div>
                </div>
            )}
            {/* Contract Modal */}
            {showContractModal && selectedProjectForContract && (
                <AlphaCloneContractModal
                    isOpen={showContractModal}
                    onClose={() => setShowContractModal(false)}
                    project={selectedProjectForContract}
                    user={user}
                />
            )}
        </div>
    );
};

export default BusinessDashboard;
