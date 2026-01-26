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
    TrendingUp
} from 'lucide-react';
import { User } from '../../../types';
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

interface BusinessDashboardProps {
    user: User;
    onLogout: () => void;
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const BusinessDashboard: React.FC<BusinessDashboardProps> = ({ user, onLogout, activeTab, setActiveTab }) => {
    const { currentTenant } = useTenant();
    const [sidebarOpen, setSidebarOpen] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth >= 768;
        }
        return true;
    });

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
    }, [user, currentTenant]);

    const [notification, setNotification] = useState<string | null>(null);

    // Trial Logic
    const isTrialExpired = React.useMemo(() => {
        // Safe check: If trialEndsAt is null/undefined, return false (Existing Tenants are SAFE)
        if (!currentTenant?.trialEndsAt) return false;

        const now = new Date();
        const trialEnd = new Date(currentTenant.trialEndsAt);
        return now > trialEnd && currentTenant.subscriptionStatus === 'trial';
    }, [currentTenant]);

    // Map routes to display content
    const renderBusinessContent = () => {
        // ... switch statement ...

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
                return <MeetingsPage user={user} />;

            // New Routes
            case '/dashboard/crm':
                // Pass empty projects for now or implement fetching
                return <CRMTab
                    projects={[]}
                    declineProject={() => { }}
                    openContractGenerator={() => { }}
                    openVideoCall={() => { }}
                />;
            case '/dashboard/tasks':
                return <TasksTab userId={user.id} userRole={user.role} />;
            case '/dashboard/sales-agent':
                return <SalesAgent />;
            case '/dashboard/leads':
                return <DealsTab userId={user.id} userRole={user.role} />;

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
        { label: 'Projects', href: '/dashboard/business/projects', icon: FileText },
        { label: 'Calendar', href: '/dashboard/business/calendar', icon: Briefcase },
        { label: 'Messages', href: '/dashboard/business/messages', icon: Bell }, // Kept Bell icon as Messages
        { label: 'Team', href: '/dashboard/business/team', icon: Users },
        { label: 'Finance', href: '/dashboard/business/billing', icon: CreditCard },
        { label: 'Settings', href: '/dashboard/business/settings', icon: Settings },
    ];

    return (
        <div className="flex h-screen bg-slate-950 text-white overflow-hidden font-sans selection:bg-teal-500/30">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`${sidebarOpen
                ? 'w-72 translate-x-0'
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
                            <span className={`${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 hidden md:block'} flex-1 text-left whitespace-nowrap`}>{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-800 bg-slate-900">
                    <button
                        onClick={onLogout}
                        className={`flex items-center gap-3 text-slate-400 hover:text-red-400 w-full ${sidebarOpen ? 'px-4' : 'justify-center px-2'} py-3 rounded-xl hover:bg-red-500/10 transition-colors group active:scale-95`}
                    >
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className={`${sidebarOpen ? 'block' : 'hidden'}`}>Log Out</span>
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
                            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
                        >
                            <Menu className="w-6 h-6" />
                        </button>

                        <h2 className="text-lg md:text-xl font-semibold text-white truncate">
                            {getPageTitle()}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Removed Assistant Button as requested ("remove the recording button") */}

                        <div className="hidden md:block w-px h-6 bg-slate-800 mx-2" />

                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
                            <img
                                src={currentTenant?.logoUrl || user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=random`}
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
        </div>
    );
};

export default BusinessDashboard;
