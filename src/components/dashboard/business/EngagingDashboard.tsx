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
    MessageSquare,
    Inbox,
    ArrowRight,
    CheckCircle2,
    Clock3,
    ChevronRight,
    CalendarCheck2,
    MessagesSquare
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

    const starterSteps = useMemo(() => [
        {
            step: '1',
            title: 'Set up your workspace',
            description: 'Finish onboarding so your company, services, and team data are ready.',
            href: '/dashboard/business/onboarding',
            icon: CheckCircle2,
        },
        {
            step: '2',
            title: 'Open the inbox',
            description: 'Review Zoho Mail or the unified inbox so replies stay connected to clients.',
            href: '/dashboard/business/messages',
            icon: Inbox,
        },
        {
            step: '3',
            title: 'Start team chat',
            description: 'Use chat for internal coordination and hand off follow-ups without clutter.',
            href: '/dashboard/business/team',
            icon: MessageSquare,
        },
        {
            step: '4',
            title: 'Review tasks',
            description: 'Turn conversations into clear next actions and see updates in one place.',
            href: '/dashboard/tasks',
            icon: ArrowRight,
        }
    ], []);

    const workspaceLinks = useMemo(() => [
        {
            title: 'Open team chat',
            href: '/dashboard/business/team',
            icon: MessageSquare,
            note: 'Keep internal updates in one place',
        },
        {
            title: 'Open inbox',
            href: '/dashboard/business/messages',
            icon: Mail,
            note: 'Reply to client mail with context',
        },
        {
            title: 'Open Zoho Mail',
            href: '/dashboard/zoho/mail',
            icon: Inbox,
            note: 'Review mail inside the platform',
        },
        {
            title: 'Review tasks',
            href: '/dashboard/tasks',
            icon: CheckSquare,
            note: 'Turn updates into clear follow-up work',
        },
    ], []);

    const isNewWorkspace = useMemo(() => {
        return [
            stats?.totalLeads,
            stats?.clientCount,
            stats?.activeProjects,
            stats?.totalTasks,
            stats?.unreadMessages,
            stats?.activeCampaigns,
        ].every((value) => Number(value || 0) === 0);
    }, [stats]);

    const todayActions = useMemo(() => [
        {
            time: 'Now',
            title: 'Finish setup',
            detail: 'Open onboarding and confirm your workspace basics.',
            href: '/dashboard/business/onboarding',
            icon: CheckCircle2,
        },
        {
            time: 'Next',
            title: 'Check messages',
            detail: `${Number(stats?.unreadMessages || 0)} unread messages and replies waiting.`,
            href: '/dashboard/business/messages',
            icon: MessagesSquare,
        },
        {
            time: 'Then',
            title: 'Clear tasks',
            detail: `${Number(stats?.totalTasks || 0)} tasks are ready to review.`,
            href: '/dashboard/tasks',
            icon: CalendarCheck2,
        },
    ], [stats]);

    return (
        <div className="px-2 py-3 sm:p-6 max-w-7xl mx-auto space-y-3 sm:space-y-6">

            {isNewWorkspace && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-3xl border border-teal-500/20 bg-gradient-to-br from-teal-500/15 via-slate-900 to-slate-950 p-5 sm:p-6"
                >
                    <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.18),transparent_65%)]" />
                    <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="max-w-2xl">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock3 className="w-4 h-4 text-teal-400" />
                                <span className="text-[11px] font-black uppercase tracking-[0.28em] text-teal-400">New tenant setup</span>
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-black text-white">Continue setup and launch your workspace</h2>
                            <p className="text-sm sm:text-base text-slate-300 mt-2 max-w-xl">
                                Start with onboarding, then connect inbox, chat, and tasks so the business OS feels ready instead of empty.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 shrink-0">
                            <button
                                onClick={() => router.push('/dashboard/business/onboarding')}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-500 px-5 py-4 text-sm font-black text-white shadow-xl shadow-teal-500/25 hover:bg-teal-400 active:scale-95 transition-all"
                            >
                                Continue setup
                                <ChevronRight className="w-4 h-4" />
                            </button>
                            <div className="text-[11px] text-slate-400 text-center md:text-right">Takes you straight to the first setup steps.</div>
                        </div>
                    </div>
                </motion.div>
            )}

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

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="bg-slate-900/55 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5"
            >
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black uppercase tracking-[0.28em] text-teal-400">Start here</span>
                            <span className="text-[11px] text-slate-500">Step-by-step setup</span>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">If you just landed here, follow these steps in order. It keeps the workspace simple and the next click obvious.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {starterSteps.map((step) => {
                        const StepIcon = step.icon;
                        return (
                            <button
                                key={step.step}
                                onClick={() => router.push(step.href)}
                                className="group text-left rounded-2xl border border-slate-800 bg-slate-950/50 hover:bg-slate-900 transition-all p-4 flex items-start gap-4"
                            >
                                <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                                    <span className="text-[11px] font-black text-teal-400">{step.step}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <StepIcon className="w-4 h-4 text-slate-400" />
                                        <h3 className="text-sm font-semibold text-white truncate">{step.title}</h3>
                                    </div>
                                    <p className="text-sm text-slate-400 mt-1 leading-relaxed">{step.description}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-slate-900/50 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5"
            >
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.28em] text-sky-400">Today&apos;s first 3 actions</div>
                        <p className="text-sm text-slate-400 mt-1">A short list to get momentum without clutter.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
                    <div className="space-y-3">
                        {starterSteps.slice(0, 3).map((step) => {
                            const StepIcon = step.icon;
                            return (
                                <button
                                    key={step.step}
                                    onClick={() => router.push(step.href)}
                                    className="group w-full text-left rounded-2xl border border-slate-800 bg-slate-950/50 hover:bg-slate-900 transition-all p-4 flex items-start gap-4"
                                >
                                    <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                                        <span className="text-[11px] font-black text-sky-400">{step.step}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <StepIcon className="w-4 h-4 text-slate-400" />
                                            <h3 className="text-sm font-semibold text-white truncate">{step.title}</h3>
                                        </div>
                                        <p className="text-sm text-slate-400 mt-1 leading-relaxed">{step.description}</p>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-500 mt-1 shrink-0 group-hover:text-sky-400 transition-colors" />
                                </button>
                            );
                        })}
                    </div>

                    <div className="w-full lg:w-[320px] rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock3 className="w-4 h-4 text-teal-400" />
                            <h3 className="text-sm font-semibold text-white">Activity timeline</h3>
                        </div>

                        <div className="space-y-4">
                            {todayActions.map((item, index) => {
                                const ItemIcon = item.icon;
                                return (
                                    <button
                                        key={item.title}
                                        onClick={() => router.push(item.href)}
                                        className="w-full flex items-start gap-3 text-left group"
                                    >
                                        <div className="flex flex-col items-center shrink-0">
                                            <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                                                <ItemIcon className="w-4 h-4 text-sky-400" />
                                            </div>
                                            {index < todayActions.length - 1 && <div className="w-px h-8 bg-slate-800 mt-2" />}
                                        </div>
                                        <div className="min-w-0 flex-1 pb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{item.time}</span>
                                                <h4 className="text-sm font-semibold text-white truncate">{item.title}</h4>
                                            </div>
                                            <p className="text-sm text-slate-400 mt-1 leading-relaxed">{item.detail}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.11 }}
                className="bg-slate-900/45 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5"
            >
                <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.28em] text-sky-400">Connected work</div>
                        <p className="text-sm text-slate-400 mt-1">Business OS shortcuts that keep chat, inbox, and tasks tied together.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    {workspaceLinks.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.title}
                                onClick={() => router.push(item.href)}
                                className="group rounded-2xl border border-slate-800 bg-slate-950/55 hover:bg-slate-900 transition-all p-4 text-left flex items-start gap-3"
                            >
                                <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                                    <Icon className="w-4 h-4 text-sky-400" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-white truncate">{item.title}</div>
                                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.note}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </motion.div>

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
