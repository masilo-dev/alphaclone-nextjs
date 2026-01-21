import React, { useState } from 'react';
import {
    LayoutDashboard,
    Users,
    Briefcase,
    Settings,
    CreditCard,
    FileText,
    Bell,
    Search,
    LogOut,
    Mic,
    Menu
} from 'lucide-react';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
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

interface BusinessDashboardProps {
    user: User;
    onLogout: () => void;
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const BusinessDashboard: React.FC<BusinessDashboardProps> = ({ user, onLogout, activeTab, setActiveTab }) => {
    const { currentTenant } = useTenant();
    const [isVoiceActive, setIsVoiceActive] = useState(false);

    // Map routes to display content
    const renderBusinessContent = () => {
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

            default:
                return <BusinessHome user={user} />;
        }
    };

    // Get current page title
    const getPageTitle = () => {
        switch (activeTab) {
            case '/dashboard': return 'Business Home';
            case '/dashboard/business/clients': return 'My Clients';
            case '/dashboard/business/projects': return 'Projects';
            case '/dashboard/business/team': return 'Team';
            case '/dashboard/business/messages': return 'Messages';
            case '/dashboard/business/calendar': return 'Calendar';
            case '/dashboard/business/billing': return 'Invoices & Billing';
            case '/dashboard/business/reports': return 'Reports';
            case '/dashboard/business/settings': return 'Settings';
            default: return 'Business Home';
        }
    };

    return (
        <div className="flex h-screen bg-slate-950 text-white overflow-hidden font-sans">
            {/* Sidebar - Navigation is now handled by parent Dashboard component */}
            <div className="hidden">
                {/* Sidebar removed - using parent navigation */}
            </div>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">

                {/* Header */}
                <header className="h-16 border-b border-slate-800/50 flex items-center justify-between px-8 backdrop-blur-md bg-slate-950/50 sticky top-0 z-10">
                    <div className="flex items-center gap-4 flex-1">
                        <h2 className="text-xl font-semibold text-white">
                            {getPageTitle()}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Voice Agent Trigger */}
                        <button
                            onClick={() => setIsVoiceActive(!isVoiceActive)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${isVoiceActive
                                ? 'bg-teal-500/20 border-teal-500 text-teal-400 animate-pulse'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-teal-500/50'
                                }`}
                        >
                            <Mic className="w-4 h-4" />
                            <span className="text-sm font-medium">Assistant</span>
                        </button>

                        <div className="w-px h-6 bg-slate-800 mx-2" />

                        <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1 right-1 w-2 h-2 bg-teal-500 rounded-full" />
                        </button>

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
                <div className="flex-1 overflow-y-auto p-8">
                    {renderBusinessContent()}
                </div>
            </main>
        </div>
    );
};

const MetricCard = ({ label, value, trend, icon: Icon, color }: any) => (
    <div className="bg-slate-900/50 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-slate-900/50 group">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl bg-slate-950 border border-slate-800 group-hover:border-slate-700 transition-colors ${color}`}>
                <Icon className="w-5 h-5" />
            </div>
            {trend && (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${trend.startsWith('+') ? 'bg-teal-500/10 text-teal-400' : 'bg-red-500/10 text-red-400'}`}>
                    {trend}
                </span>
            )}
        </div>
        <div className="space-y-1">
            <h3 className="text-slate-400 text-sm font-medium">{label}</h3>
            <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        </div>
    </div>
);

// Helper for icon (DollarSign was missing in imports)
import { DollarSign } from 'lucide-react';

export default BusinessDashboard;
