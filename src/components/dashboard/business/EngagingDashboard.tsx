'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User } from '../../../types';
import {
    AlertCircle,
    Briefcase,
    Calendar,
    BarChart2,
    FileText,
    UserPlus,
    Zap,
    Sun,
    Sunset,
    Moon,
    Globe,
    Linkedin,
    TrendingUp,
    Users as UsersIcon,
    DollarSign,
    Target,
    Database,
    Layers,
    Activity,
    CheckSquare,
    MessageCircle,
    Mail,
    Video,
    Bot,
    MessageSquare
} from 'lucide-react';
import { MomentumHUD } from '../MomentumHUD';

// ─── Greeting Helpers ────────────────────────────────────────────────
function getGreeting(): { text: string; Icon: React.FC<any> } {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return { text: 'Good morning', Icon: Sun };
    if (h >= 12 && h < 17) return { text: 'Good afternoon', Icon: Sun };
    if (h >= 17 && h < 21) return { text: 'Good evening', Icon: Sunset };
    return { text: 'Good night', Icon: Moon };
}

interface QuickAction {
    id: string;
    title: string;
    description: string;
    icon: React.FC<any>;
    color: string;
    action: () => void;
}

const EngagingDashboard: React.FC<{ user: User; stats?: any }> = ({ user, stats }) => {
    const greeting = useMemo(() => getGreeting(), []);
    const firstName = useMemo(() => (user.name || user.email || 'there').split(' ')[0], [user.name, user.email]);
    const welcomeMessage = useMemo(() => {
        const messages = [
            `Welcome back, ${firstName}.`,
            `Ready to build today, ${firstName}?`,
            `${firstName}, let's make progress.`,
            `Time to grow your business, ${firstName}.`,
            `Let's achieve your goals, ${firstName}.`,
        ];
        const seed = firstName.length + new Date().getDay();
        return messages[seed % messages.length];
    }, [firstName]);

    const router = useRouter();

    const currencyFormatter = useMemo(
        () => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
        []
    );

    const quickActions: QuickAction[] = useMemo(() => [
        {
            id: 'new-client',
            title: 'Add Client',
            description: 'Grow your network',
            icon: UserPlus,
            color: 'bg-blue-500',
            action: () => router.push('/dashboard/crm?quickAdd=true')
        },
        {
            id: 'new-invoice',
            title: 'Invoices',
            description: 'Billing and invoices',
            icon: FileText,
            color: 'bg-green-500',
            action: () => router.push('/dashboard/accounting')
        },
        {
            id: 'schedule-meeting',
            title: 'Meetings',
            description: 'Connect with clients',
            icon: Calendar,
            color: 'bg-indigo-500',
            action: () => router.push('/dashboard/business/calendar')
        },
        {
            id: 'view-reports',
            title: 'Reports',
            description: 'Track your progress',
            icon: BarChart2,
            color: 'bg-orange-500',
            action: () => router.push('/dashboard/business/reports')
        },
        {
            id: 'social-media-manager',
            title: 'Social Hub',
            description: 'Create and schedule posts',
            icon: Globe,
            color: 'bg-cyan-500',
            action: () => router.push('/dashboard/business/social')
        },
        {
            id: 'linkedin-manager',
            title: 'LinkedIn',
            description: 'Manage LinkedIn posting',
            icon: Linkedin,
            color: 'bg-sky-500',
            action: () => router.push('/dashboard/business/linkedin')
        },
        {
            id: 'email-campaigns',
            title: 'Email Bot',
            description: 'Send marketing flows',
            icon: Mail,
            color: 'bg-teal-500',
            action: () => router.push('/dashboard/business/campaigns')
        },
        {
            id: 'video-calls',
            title: 'Video Rooms',
            description: 'Start live calls',
            icon: Video,
            color: 'bg-rose-500',
            action: () => router.push('/dashboard/business/meetings')
        },
        {
            id: 'whatsapp-bot',
            title: 'WhatsApp',
            description: 'Automate WhatsApp chatbot',
            icon: MessageSquare,
            color: 'bg-emerald-500',
            action: () => router.push('/dashboard/business/whatsapp')
        },
        {
            id: 'ai-chat',
            title: 'AI Copilot',
            description: 'Talk to growth AI',
            icon: Bot,
            color: 'bg-purple-500',
            action: () => router.push('/dashboard/sales-agent?tab=chat')
        },
        {
            id: 'accounting-ledger',
            title: 'Accounting',
            description: 'Ledger and PnL statements',
            icon: DollarSign,
            color: 'bg-amber-500',
            action: () => router.push('/dashboard/accounting')
        },
        {
            id: 'tasks-list',
            title: 'Tasks',
            description: 'Organize your schedule',
            icon: CheckSquare,
            color: 'bg-pink-500',
            action: () => router.push('/dashboard/tasks')
        }
    ], [router]);

    return (
        <div className="px-2 py-3 sm:p-6 max-w-7xl mx-auto space-y-3 sm:space-y-6">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-semibold text-white truncate">
                        {greeting?.text || 'Hello'}, {firstName}
                    </h1>
                    <p className="text-slate-400 mt-1 text-sm sm:text-base">{welcomeMessage}</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <button 
                        onClick={() => router.push('/dashboard/crm?quickAdd=true')}
                        className="px-3 py-2 sm:px-4 bg-slate-800 border border-slate-700 rounded-lg text-xs sm:text-sm font-medium text-white hover:bg-slate-700 transition-colors shadow-sm active:scale-95"
                    >
                        Quick Add
                    </button>
                    <button 
                        onClick={() => router.push('/dashboard/business/projects?new=true')}
                        className="px-3 py-2 sm:px-4 bg-teal-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-teal-700 transition-colors shadow-lg shadow-teal-500/20 active:scale-95"
                    >
                        New Project
                    </button>
                </div>
            </div>

            {/* KPI Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-slate-900/50 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-5 hover:border-teal-500/30 transition-colors group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-teal-500/10 transition-colors" />
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
                            <DollarSign className="w-6 h-6 text-teal-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-400">Total Revenue</p>
                            <h3 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
                                {currencyFormatter.format(stats?.totalRevenue || 0)}
                            </h3>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15 }}
                    className="bg-slate-900/50 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-5 hover:border-blue-500/30 transition-colors group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-blue-500/10 transition-colors" />
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                            <UsersIcon className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-400">Total Clients</p>
                            <h3 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
                                {stats?.clientCount || 0}
                            </h3>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-slate-900/50 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-5 hover:border-purple-500/30 transition-colors group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-purple-500/10 transition-colors" />
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                            <Target className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-400">Total Leads</p>
                            <h3 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
                                {stats?.totalLeads || 0}
                            </h3>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.25 }}
                    className="bg-slate-900/50 border border-slate-800 rounded-xl sm:rounded-2xl p-3 sm:p-5 hover:border-orange-500/30 transition-colors group relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-orange-500/10 transition-colors" />
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                            <TrendingUp className="w-6 h-6 text-orange-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-400">Forecast</p>
                            <h3 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
                                {currencyFormatter.format(stats?.salesForecast || 0)}
                            </h3>
                        </div>
                    </div>
                </motion.div>
            </div>
            
            {/* Database Engine Summary — desktop only (mobile uses KPI row above) */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="hidden md:block bg-slate-900/40 border border-slate-800 rounded-2xl p-5 hover:border-teal-500/20 transition-all group"
            >
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20">
                            <Database className="w-4 h-4 text-teal-400" />
                        </div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Database Engine Summary</h3>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-green-500/5 border border-green-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-black text-green-500 uppercase tracking-tighter">System Optimal</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-6">
                    <div className="flex flex-col group/item cursor-default">
                        <span className="text-2xl font-black text-white group-hover/item:text-teal-400 transition-colors">{stats?.totalLeads || 0}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <Layers className="w-3 h-3 text-slate-600" />
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Leads</span>
                        </div>
                    </div>
                    <div className="flex flex-col group/item cursor-default">
                        <span className="text-2xl font-black text-white group-hover/item:text-blue-400 transition-colors">{stats?.clientCount || 0}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <UsersIcon className="w-3 h-3 text-slate-600" />
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Clients</span>
                        </div>
                    </div>
                    <div className="flex flex-col group/item cursor-default">
                        <span className="text-2xl font-black text-white group-hover/item:text-purple-400 transition-colors">{stats?.activeProjects || 0}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <Briefcase className="w-3 h-3 text-slate-600" />
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Projects</span>
                        </div>
                    </div>
                    <div className="flex flex-col group/item cursor-default">
                        <span className="text-2xl font-black text-white group-hover/item:text-amber-400 transition-colors">{stats?.overdueInvoices || 0}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <AlertCircle className="w-3 h-3 text-slate-600" />
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Overdue</span>
                        </div>
                    </div>
                    <div className="flex flex-col group/item cursor-default">
                        <span className="text-2xl font-black text-white group-hover/item:text-teal-400 transition-colors">{stats?.activeCampaigns || 0}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <Zap className="w-3 h-3 text-slate-600" />
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Campaigns</span>
                        </div>
                    </div>
                    <div className="flex flex-col group/item cursor-default">
                        <span className="text-2xl font-black text-white group-hover/item:text-blue-400 transition-colors">{stats?.totalTasks || 0}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <CheckSquare className="w-3 h-3 text-slate-600" />
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tasks</span>
                        </div>
                    </div>
                    <div className="flex flex-col group/item cursor-default">
                        <span className="text-2xl font-black text-white group-hover/item:text-indigo-400 transition-colors">{stats?.unreadMessages || 0}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <MessageCircle className="w-3 h-3 text-slate-600" />
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Messages</span>
                        </div>
                    </div>
                    <div className="flex flex-col group/item cursor-default">
                        <span className="text-2xl font-black text-white group-hover/item:text-rose-400 transition-colors">{stats?.activity24h || 0}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <Activity className="w-3 h-3 text-slate-600" />
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Events</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Detailed Stats Row — tablet+ */}
            <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Campaigns</p>
                    <p className="text-lg font-bold text-white mt-1">{stats?.activeCampaigns || 0}</p>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Upcoming Meetings</p>
                    <p className="text-lg font-bold text-white mt-1">{stats?.upcomingMeetings || 0}</p>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Unread Messages</p>
                    <p className="text-lg font-bold text-white mt-1">{stats?.unreadMessages || 0}</p>
                </div>
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Task Progress</p>
                    <p className="text-lg font-bold text-white mt-1">{stats?.completedTasks || 0} / {stats?.totalTasks || 0}</p>
                </div>
            </div>

            {/* Momentum Dashboard */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
            >
                <MomentumHUD
                    score={stats?.momentumScore ?? 0}
                    streak={stats?.loginStreak ?? 1}
                    activity24h={stats?.activity24h ?? 0}
                    newLeads={stats?.newLeads24h ?? 0}
                    actionsCompleted={stats?.completedTasks ?? 0}
                    rewardsUnlocked={stats?.rewardsUnlocked ?? 0}
                    variant="global"
                />
            </motion.div>

            {/* Quick Actions — native-style PWA app launcher */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-slate-900/40 rounded-3xl p-4 sm:p-5 border border-slate-800/80"
            >
                <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-teal-400" />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Apps</span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-600">{quickActions.length} tools</span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-x-1.5 sm:gap-x-2 gap-y-3 sm:gap-y-4">
                    {quickActions.slice(0, 8).map((action, index) => (
                        <motion.button
                            key={action.id}
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.05 + index * 0.025, type: 'spring', stiffness: 320, damping: 22 }}
                            onClick={action.action}
                            className="flex flex-col items-center gap-1.5 group select-none touch-manipulation active:scale-90 transition-transform duration-150"
                        >
                            <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-[15px] sm:rounded-[17px] ${action.color} flex items-center justify-center relative overflow-hidden shadow-lg shadow-black/40 ring-1 ring-white/10 group-hover:ring-white/25 transition-all`}>
                                {/* glossy top highlight like a real app icon */}
                                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
                                <action.icon className="w-[22px] h-[22px] text-white relative z-10 drop-shadow-sm" strokeWidth={2.1} />
                            </div>
                            <span className="text-[10.5px] font-medium text-slate-300 group-hover:text-white leading-tight text-center line-clamp-1 w-full px-0.5 transition-colors">
                                {action.title}
                            </span>
                        </motion.button>
                    ))}
                </div>
            </motion.div>

        </div>
    );
};

export default EngagingDashboard;

