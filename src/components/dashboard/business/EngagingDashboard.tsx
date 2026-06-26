'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/contexts/TenantContext';
import { ModuleIntelligenceCard } from '../ModuleIntelligenceCard';
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
import { RevenueLeakagePanel } from '../crm/RevenueLeakagePanel';

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
    const { currentTenant } = useTenant();
    const [onboardingComplete, setOnboardingComplete] = useState(true);

    useEffect(() => {
        const completed =
            localStorage.getItem(`onboarding_completed_${user.id}`) === 'true' ||
            localStorage.getItem(`onboarding_completed_${user.id}`) === 'skipped';
        setOnboardingComplete(completed);
    }, [user.id]);

    const isOwner = useMemo(() => {
        const role = String(user.role || '').toLowerCase();
        return (
            role === 'tenant_admin' ||
            role === 'admin' ||
            role === 'owner' ||
            (!!currentTenant?.admin_user_id && currentTenant.admin_user_id === user.id)
        );
    }, [user.role, user.id, currentTenant?.admin_user_id]);

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
            action: () => router.push('/dashboard/crm/workspace?quickAdd=true')
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

    const showSetupGuide = !isOwner && isNewWorkspace && !onboardingComplete;

    const ownerPrioritySteps = useMemo(() => {
        const items: Array<{ step: string; title: string; description: string; href: string; icon: React.FC<any> }> = [];

        if (Number(stats?.unreadMessages || 0) > 0) {
            items.push({
                step: String(items.length + 1),
                title: 'Reply to messages',
                description: `${stats.unreadMessages} unread — respond while context is fresh.`,
                href: '/dashboard/business/messages',
                icon: MessagesSquare,
            });
        }
        if (Number(stats?.totalTasks || 0) > Number(stats?.completedTasks || 0)) {
            items.push({
                step: String(items.length + 1),
                title: 'Clear open tasks',
                description: `${Number(stats?.totalTasks || 0) - Number(stats?.completedTasks || 0)} tasks still open on your board.`,
                href: '/dashboard/tasks',
                icon: CheckSquare,
            });
        }
        if (Number(stats?.totalLeads || 0) > 0) {
            items.push({
                step: String(items.length + 1),
                title: 'Follow up pipeline',
                description: `${stats.totalLeads} leads in CRM — move the next deal forward.`,
                href: '/dashboard/crm',
                icon: Target,
            });
        }
        if (Number(stats?.activeCampaigns || 0) > 0) {
            items.push({
                step: String(items.length + 1),
                title: 'Review campaigns',
                description: `${stats.activeCampaigns} active campaigns need a quick performance check.`,
                href: '/dashboard/business/campaigns',
                icon: Mail,
            });
        }

        if (items.length === 0) {
            items.push(
                {
                    step: '1',
                    title: 'Find & qualify leads',
                    description: 'Search prospects, score them, and convert qualified interest into deals with value.',
                    href: '/dashboard/leads',
                    icon: Target,
                },
                {
                    step: '2',
                    title: 'Run the deal chain',
                    description: 'Proposal → contract → invoice → project. Check Sales Console for anything skipped.',
                    href: '/dashboard/crm/console',
                    icon: DollarSign,
                },
                {
                    step: '3',
                    title: 'Launch outreach',
                    description: 'Send a campaign or social post, then convert replies into pipeline within 48 hours.',
                    href: '/dashboard/business/campaigns',
                    icon: Mail,
                }
            );
        }

        return items.slice(0, 3);
    }, [stats]);

    const ownerTodayActions = useMemo(() => [
        {
            time: 'Now',
            title: 'Unread messages',
            detail: `${Number(stats?.unreadMessages || 0)} waiting for a reply in inbox.`,
            href: '/dashboard/business/messages',
            icon: MessagesSquare,
        },
        {
            time: 'Next',
            title: 'Pipeline follow-ups',
            detail: `${Number(stats?.totalLeads || 0)} leads and ${Number(stats?.clientCount || 0)} clients in CRM.`,
            href: '/dashboard/crm',
            icon: Target,
        },
        {
            time: 'Then',
            title: 'Tasks and deadlines',
            detail: `${Number(stats?.completedTasks || 0)} of ${Number(stats?.totalTasks || 0)} tasks complete.`,
            href: '/dashboard/tasks',
            icon: CalendarCheck2,
        },
    ], [stats]);

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

    const activePrioritySteps = isOwner ? ownerPrioritySteps : starterSteps.slice(0, 3);
    const activeTimelineActions = isOwner ? ownerTodayActions : todayActions;

    return (
        <div className="px-2 py-3 sm:p-6 max-w-7xl mx-auto space-y-3 sm:space-y-6" data-tour="business-home">

            {showSetupGuide && (
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
                        onClick={() => router.push('/dashboard/crm/workspace?quickAdd=true')}
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

            {isOwner && (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 }}
                >
                    <ModuleIntelligenceCard moduleKey="analyticsDashboard" title="What to improve" />
                </motion.div>
            )}

            {showSetupGuide && (
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
            )}

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-slate-900/50 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5"
            >
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.28em] text-sky-400">
                            {isOwner ? 'Your priorities today' : 'Today&apos;s first 3 actions'}
                        </div>
                        <p className="text-sm text-slate-400 mt-1">
                            {isOwner
                                ? 'Summaries and next steps based on your workspace — no setup walkthrough.'
                                : 'A short list to get momentum without clutter.'}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
                    <div className="space-y-3">
                        {activePrioritySteps.map((step) => {
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
                            <h3 className="text-sm font-semibold text-white">
                                {isOwner ? 'Workspace snapshot' : 'Activity timeline'}
                            </h3>
                        </div>

                        <div className="space-y-4">
                            {activeTimelineActions.map((item, index) => {
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
                                            {index < activeTimelineActions.length - 1 && <div className="w-px h-8 bg-slate-800 mt-2" />}
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
                {([
                    {
                        label: 'Total Revenue',
                        value: currencyFormatter.format(stats?.totalRevenue || 0),
                        sub: 'Collected this period',
                        Icon: DollarSign,
                        trend: Number(stats?.revenueChange),
                        card: 'from-teal-500/10 via-slate-900/60 to-slate-900/40 hover:border-teal-500/40 hover:shadow-teal-500/10',
                        glow: 'bg-teal-500/10 group-hover:bg-teal-500/20',
                        tile: 'from-teal-500/25 to-teal-500/5 border-teal-500/30',
                        iconColor: 'text-teal-300',
                        bar: 'from-teal-400 to-emerald-400',
                    },
                    {
                        label: 'Total Clients',
                        value: (stats?.clientCount || 0).toLocaleString(),
                        sub: 'Active customer accounts',
                        Icon: UsersIcon,
                        trend: Number(stats?.clientChange),
                        card: 'from-blue-500/10 via-slate-900/60 to-slate-900/40 hover:border-blue-500/40 hover:shadow-blue-500/10',
                        glow: 'bg-blue-500/10 group-hover:bg-blue-500/20',
                        tile: 'from-blue-500/25 to-blue-500/5 border-blue-500/30',
                        iconColor: 'text-blue-300',
                        bar: 'from-blue-400 to-sky-400',
                    },
                    {
                        label: 'Total Leads',
                        value: (stats?.totalLeads || 0).toLocaleString(),
                        sub: 'In your pipeline',
                        Icon: Target,
                        trend: Number(stats?.leadChange),
                        card: 'from-purple-500/10 via-slate-900/60 to-slate-900/40 hover:border-purple-500/40 hover:shadow-purple-500/10',
                        glow: 'bg-purple-500/10 group-hover:bg-purple-500/20',
                        tile: 'from-purple-500/25 to-purple-500/5 border-purple-500/30',
                        iconColor: 'text-purple-300',
                        bar: 'from-purple-400 to-fuchsia-400',
                    },
                    {
                        label: 'Forecast',
                        value: currencyFormatter.format(stats?.salesForecast || 0),
                        sub: 'Projected revenue',
                        Icon: TrendingUp,
                        trend: Number(stats?.forecastChange),
                        card: 'from-orange-500/10 via-slate-900/60 to-slate-900/40 hover:border-orange-500/40 hover:shadow-orange-500/10',
                        glow: 'bg-orange-500/10 group-hover:bg-orange-500/20',
                        tile: 'from-orange-500/25 to-orange-500/5 border-orange-500/30',
                        iconColor: 'text-orange-300',
                        bar: 'from-orange-400 to-amber-400',
                    },
                ]).map((kpi, i) => {
                    const KpiIcon = kpi.Icon;
                    const hasTrend = Number.isFinite(kpi.trend) && kpi.trend !== 0;
                    const trendUp = (kpi.trend || 0) > 0;
                    return (
                        <motion.div
                            key={kpi.label}
                            initial={{ opacity: 0, y: 16, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: 0.1 + i * 0.06, type: 'spring', stiffness: 220, damping: 22 }}
                            whileHover={{ y: -4 }}
                            className={`group relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br ${kpi.card} p-4 sm:p-5 shadow-lg shadow-black/20 transition-all duration-300`}
                        >
                            <div className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl transition-colors ${kpi.glow}`} />
                            <div className="relative z-10 flex items-start justify-between gap-3">
                                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border bg-gradient-to-br ${kpi.tile} shadow-inner`}>
                                    <KpiIcon className={`h-6 w-6 ${kpi.iconColor}`} />
                                </div>
                                {hasTrend && (
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums ${trendUp ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                                        {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
                                        {Math.abs(kpi.trend).toFixed(1)}%
                                    </span>
                                )}
                            </div>
                            <div className="relative z-10 mt-4">
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{kpi.label}</p>
                                <h3 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-white tabular-nums">
                                    {kpi.value}
                                </h3>
                                <p className="mt-1 text-xs text-slate-500">{kpi.sub}</p>
                            </div>
                            <div className="relative z-10 mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${[78, 64, 52, 70][i]}%` }}
                                    transition={{ delay: 0.3 + i * 0.06, duration: 0.8, ease: 'easeOut' }}
                                    className={`h-full rounded-full bg-gradient-to-r ${kpi.bar}`}
                                />
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {isOwner && (
                <RevenueLeakagePanel
                    leakageOnly
                    heading="Where revenue is stuck"
                    subheading="Fix skipped steps before they cost you deals, contracts, or cash."
                />
            )}

            {/* Database Engine Summary */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-5 hover:border-teal-500/20 transition-all group"
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

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 sm:gap-6">
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
