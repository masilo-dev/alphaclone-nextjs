'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  Users, Zap, CheckSquare, MessageCircle, FileText, Calendar, Settings,
  Mail, Bot, Sparkles, Activity, HelpCircle, Bell, Sun, Moon, Coffee,
  LayoutDashboard, Briefcase, BarChart3, Receipt, Phone, Video,
  Trophy, Cpu, ShoppingBag, Clock, AlertCircle, ChevronRight, Plus, Flame, Brain
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { User, DashboardStat, Project } from '../../types';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import DailyBrief from './DailyBrief';
import RevenueMomentumCard from './RevenueMomentumCard';
import { AIPredictiveWidget } from './AIPredictiveWidget';
import { IntegratedIntelligencePanel } from './IntegratedIntelligencePanel';
import { CelebrationOverlay } from '../ui/CelebrationOverlay';
import { paymentService } from '@/services/paymentService';
import { contractService } from '@/services/contractService';
import { notificationService, type Notification } from '../../services/dashboardService';
import { ModuleStatCards, type ModuleStat } from './common/ModuleStatCards';
import { Button } from '../ui/UIComponents';
import { EmptyStatePlaceholder } from '../ui/EmptyStatePlaceholder';

interface Module {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  accent: string;      // tailwind color class for icon
  bg: string;          // tailwind bg class for container
  badge?: number;
}

const MODULES: Module[] = [
  { label: 'CRM',            icon: Users,         href: '/dashboard/crm',              accent: 'text-blue-400',   bg: 'bg-blue-500/15' },
  { label: 'Deals',          icon: Zap,           href: '/dashboard/deals',            accent: 'text-emerald-400',bg: 'bg-emerald-500/15' },
  { label: 'Projects',       icon: Briefcase,     href: '/dashboard/projects',         accent: 'text-violet-400', bg: 'bg-violet-500/15' },
  { label: 'Tasks',          icon: CheckSquare,   href: '/dashboard/tasks',            accent: 'text-orange-400', bg: 'bg-orange-500/15' },
  { label: 'Invoicing',      icon: FileText,      href: '/dashboard/finance',          accent: 'text-green-400',  bg: 'bg-green-500/15' },
  { label: 'Quotes',         icon: Receipt,       href: '/dashboard/quotes',           accent: 'text-teal-400',   bg: 'bg-teal-500/15' },
  { label: 'Contracts',      icon: FileText,      href: '/dashboard/contracts',        accent: 'text-indigo-400', bg: 'bg-indigo-500/15' },
  { label: 'Expenses',       icon: ShoppingBag,   href: '/dashboard/finance',          accent: 'text-rose-400',   bg: 'bg-rose-500/15' },
  { label: 'Accounting',     icon: BarChart3,     href: '/dashboard/accounting',       accent: 'text-cyan-400',   bg: 'bg-cyan-500/15' },
  { label: 'Messages',       icon: MessageCircle, href: '/dashboard/messages',         accent: 'text-sky-400',    bg: 'bg-sky-500/15' },
  { label: 'WhatsApp',       icon: Phone,         href: '/dashboard/business/whatsapp', accent: 'text-green-400',  bg: 'bg-green-500/15' },
  { label: 'Social',         icon: Sparkles,      href: '/dashboard/business/social',   accent: 'text-pink-400',   bg: 'bg-pink-500/15' },
  { label: 'Campaigns',      icon: Mail,          href: '/dashboard/business/campaigns', accent: 'text-amber-400',  bg: 'bg-amber-500/15' },
  { label: 'Gamification (Beta)',   icon: Trophy,        href: '/dashboard/gamification',     accent: 'text-yellow-400', bg: 'bg-yellow-500/15' },
  { label: 'AI Agents',      icon: Cpu,           href: '/dashboard/sales-agent',      accent: 'text-purple-400', bg: 'bg-purple-500/15' },
  { label: 'Bonnie AI',      icon: Brain,         href: '/dashboard/bonnie',           accent: 'text-teal-400',   bg: 'bg-teal-500/15' },
  { label: 'Analytics',      icon: Activity,      href: '/dashboard/analytics',        accent: 'text-blue-400',   bg: 'bg-blue-500/15' },
  { label: 'Settings',       icon: Settings,      href: '/dashboard/settings',         accent: 'text-slate-400',  bg: 'bg-slate-500/15' },
];

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 6)  return { text: 'Burning midnight oil', Icon: Moon };
  if (h < 12) return { text: 'Good morning',          Icon: Coffee };
  if (h < 17) return { text: 'Good afternoon',        Icon: Sun };
  if (h < 21) return { text: 'Good evening',          Icon: Zap };
  return       { text: 'Working late',                 Icon: Moon };
};

interface HomeTabProps {
  user: User;
  currentStats: DashboardStat[];
  filteredProjects: Project[];
  isLoadingProjects: boolean;
  updateProjectStage: (id: string, stage: any) => void;
  STAGES: string[];
  onProjectClick: (id: string) => void;
  momentumScore?: number;
  loginStreak?: number;
  activity24h?: number;
  newLeads24h?: number;
  databaseStats?: any;
  handlePayClick?: (invoice: any) => void;
}

const HomeTab: React.FC<HomeTabProps> = ({
  user, currentStats, filteredProjects, isLoadingProjects,
  databaseStats, handlePayClick,
  momentumScore = 0,
  loginStreak = 0,
  activity24h = 0,
  newLeads24h = 0,
}) => {
  const router = useRouter();
  const { currentTenant } = useTenant();
  const { text: greeting, Icon: GreetIcon } = useMemo(() => getGreeting(), []);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (!user?.id || !currentTenant?.id) return;
    notificationService.getNotifications(user.id, currentTenant.id).then(({ notifications }) => {
      if (notifications) {
        setUnreadNotifications(notifications.filter((n: Notification) => !n.read).length);
      }
    });
  }, [user?.id, currentTenant?.id]);

  const [quickStats, setQuickStats] = useState({ leads: 0, deals: 0, tasks: 0, unpaidInvoices: 0 });
  const [trendStats, setTrendStats] = useState({ leads: 0, deals: 0, tasks: 0, invoices: 0 });
  const [periodNew, setPeriodNew] = useState({ leads: 0, deals: 0, tasks: 0, invoices: 0 });
  const [activity, setActivity] = useState<any[]>([]);
  const [celebration, setCelebration] = useState({ show: false, message: '' });
  const [clientInvoices, setClientInvoices] = useState<any[]>([]);
  const [clientContracts, setClientContracts] = useState<any[]>([]);
  const [loadingClientData, setLoadingClientData] = useState(false);

  useEffect(() => {
    if (user.role === 'client') {
      setLoadingClientData(true);
      Promise.all([
        paymentService.getUserInvoices(user.id),
        contractService.getUserContracts(user.id, user.role)
      ]).then(([{ invoices }, { contracts }]) => {
        setClientInvoices(invoices || []);
        setClientContracts(contracts || []);
      }).catch(console.error).finally(() => setLoadingClientData(false));
    }
  }, [user.id, user.role]);

  useEffect(() => {
    if (!currentTenant?.id) return;
    const tid = currentTenant.id;
    const d30 = new Date();
    d30.setDate(d30.getDate() - 30);
    const d60 = new Date();
    d60.setDate(d60.getDate() - 60);
    const iso30 = d30.toISOString();
    const iso60 = d60.toISOString();

    const pctChange = (recent: number, prior: number) => {
      if (prior === 0) return recent > 0 ? 100 : 0;
      return Math.round(((recent - prior) / prior) * 100);
    };

    Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
      supabase.from('deals').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).neq('stage', 'closed_won').neq('stage', 'closed_lost'),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).neq('status', 'completed'),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('status', 'sent'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).gte('created_at', iso30),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).gte('created_at', iso60).lt('created_at', iso30),
      supabase.from('deals').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).gte('created_at', iso30),
      supabase.from('deals').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).gte('created_at', iso60).lt('created_at', iso30),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).gte('created_at', iso30),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).gte('created_at', iso60).lt('created_at', iso30),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('status', 'sent').gte('created_at', iso30),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('status', 'sent').gte('created_at', iso60).lt('created_at', iso30),
    ]).then(([leads, deals, tasks, inv, leadsR, leadsP, dealsR, dealsP, tasksR, tasksP, invR, invP]) => {
      const lr = leadsR.count || 0;
      const lp = leadsP.count || 0;
      const dr = dealsR.count || 0;
      const dp = dealsP.count || 0;
      const tr = tasksR.count || 0;
      const tp = tasksP.count || 0;
      const ir = invR.count || 0;
      const ip = invP.count || 0;
      setQuickStats({
        leads: leads.count || 0,
        deals: deals.count || 0,
        tasks: tasks.count || 0,
        unpaidInvoices: inv.count || 0,
      });
      setPeriodNew({ leads: lr, deals: dr, tasks: tr, invoices: ir });
      setTrendStats({
        leads: pctChange(lr, lp),
        deals: pctChange(dr, dp),
        tasks: pctChange(tr, tp),
        invoices: pctChange(ip, ir),
      });
    }).catch(() => {});

    supabase.from('activity_log')
      .select('*')
      .eq('tenant_id', tid)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }: { data: any[] | null }) => setActivity(data || []));
  }, [currentTenant?.id]);

  const homeStats = useMemo<ModuleStat[]>(() => [
    { label: 'Open Leads', value: quickStats.leads, sub: `${periodNew.leads} new · 30d`, trend: trendStats.leads, Icon: Users, accent: 'blue' },
    { label: 'Active Deals', value: quickStats.deals, sub: `${periodNew.deals} new · 30d`, trend: trendStats.deals, Icon: Zap, accent: 'emerald' },
    { label: 'Pending Tasks', value: quickStats.tasks, sub: `${periodNew.tasks} new · 30d`, trend: trendStats.tasks, Icon: CheckSquare, accent: 'orange' },
    { label: 'Unpaid Invoices', value: quickStats.unpaidInvoices, sub: `${periodNew.invoices} new sent · 30d`, trend: trendStats.invoices, Icon: Receipt, accent: 'rose' },
  ], [quickStats, trendStats, periodNew]);
  const memoryCount = Number(
    databaseStats?.memoryCount ??
    databaseStats?.knowledgeCount ??
    databaseStats?.documents ??
    databaseStats?.totalDocuments ??
    0
  );
  const commandStats = [
    { label: 'Momentum', value: `${Math.round(momentumScore)}%`, icon: Zap, color: 'text-teal-400' },
    { label: 'Day Streak', value: `${loginStreak}d`, icon: Flame, color: loginStreak > 0 ? 'text-orange-400' : 'text-slate-500' },
    { label: '24h Activity', value: activity24h, icon: Activity, color: 'text-blue-400' },
    { label: 'Memory', value: memoryCount || 'Live', icon: Brain, color: 'text-purple-400' },
  ];
  const primaryModules = MODULES.slice(0, 12);
  const secondaryModules = MODULES.slice(12);
  const starterSteps = [
    {
      step: '1',
      title: 'Finish onboarding',
      description: 'Set up your workspace, services, and defaults.',
      href: '/dashboard/onboarding',
      icon: LayoutDashboard,
    },
    {
      step: '2',
      title: 'Open the inbox',
      description: 'Check messages and keep replies tied to clients.',
      href: '/dashboard/messages',
      icon: Mail,
    },
    {
      step: '3',
      title: 'Review tasks',
      description: 'Turn replies into follow-up work and due dates.',
      href: '/dashboard/tasks',
      icon: CheckSquare,
    },
    {
      step: '4',
      title: 'Add contacts',
      description: 'Bring in clients or leads before you start outreach.',
      href: '/dashboard/crm',
      icon: Users,
    },
  ];

  // Client portal view
  if (user.role === 'client') {
    return (
      <div className="space-y-6 pb-24">
        <div className="bg-slate-900/80 border border-white/5 rounded-3xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-black text-xl">
              {user.name?.[0]?.toUpperCase() || 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-semibold text-white">{user.name}</span>
                <span className="px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-[11px] font-bold text-teal-400 uppercase">Client Partner</span>
              </div>
              <p className="text-[13px] text-slate-500">{user.email}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <span className="text-[13px] font-bold uppercase tracking-wider text-slate-400">Active Agreements</span>
          {clientContracts.length > 0 ? clientContracts.map(c => (
            <div key={c.id} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <h4 className="text-[15px] font-semibold text-white">{c.title}</h4>
                <p className="text-[13px] text-slate-500">{c.type}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${c.status === 'fully_signed' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>{c.status.replace('_', ' ')}</span>
            </div>
          )) : (
            <div className="p-5 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl text-center text-[13px] text-slate-500">No active agreements.</div>
          )}
        </div>

        <div className="space-y-3">
          <span className="text-[13px] font-bold uppercase tracking-wider text-slate-400">Outstanding Invoices</span>
          {clientInvoices.filter(i => i.status !== 'paid').map(inv => (
            <div key={inv.id} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[15px] font-semibold text-white">Invoice #{inv.number || inv.id.slice(0, 6)}</span>
                <p className="text-[13px] text-slate-500">Due: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[17px] font-semibold text-white">${Number(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                {handlePayClick && <Button variant="primary" size="sm" onClick={() => handlePayClick(inv)} className="bg-emerald-600 hover:bg-emerald-500 text-[11px] font-black uppercase px-3 py-1.5 h-auto">Pay</Button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Admin / Tenant Admin view
  return (
    <div className="space-y-4 pb-24 ac-scroll-full ac-enterprise-module">
      <CelebrationOverlay isOpen={celebration.show} title="Done!" message={celebration.message} onClose={() => setCelebration(p => ({ ...p, show: false }))} />

      {/* Greeting */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <GreetIcon className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-[13px] text-slate-400 opacity-55">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          </div>
          <h2 className="text-[15px] font-semibold text-white truncate">{greeting}, {user.name?.split(' ')[0]}</h2>
        </div>
        <button onClick={() => router.push('/dashboard/notifications')} className="relative w-9 h-9 flex items-center justify-center rounded-full bg-slate-800 border border-white/5">
          <Bell className="w-4 h-4 text-slate-300" />
          {unreadNotifications > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[11px] h-[11px] px-0.5 bg-red-500 rounded-full flex items-center justify-center text-[7px] font-black text-white">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        {commandStats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-slate-900 border border-white/5 rounded-xl px-3 py-2.5 flex items-center gap-2 min-w-0">
              <Icon className={`w-4 h-4 shrink-0 ${s.color}`} />
              <div className="min-w-0">
                <div className="text-[15px] font-black text-white leading-none truncate">{s.value}</div>
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider truncate mt-1">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-900/55 border border-white/5 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.28em] text-teal-400">Start here</div>
            <p className="text-sm text-slate-400 mt-1">Follow these steps if you just landed and want the next click to be obvious.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {starterSteps.map((step) => {
            const StepIcon = step.icon;
            return (
              <button
                key={step.step}
                onClick={() => router.push(step.href)}
                className="group text-left rounded-2xl border border-slate-800 bg-slate-950/55 hover:bg-slate-900 transition-all p-4 flex items-start gap-4"
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
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)] gap-4 items-start">
        <div className="space-y-3">
          <div className="mb-2">
            <ModuleStatCards stats={homeStats} className="grid-cols-1 min-[576px]:grid-cols-2 lg:grid-cols-4" />
          </div>

          <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-3">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Workspace Modules</span>
              <button onClick={() => router.push('/dashboard/settings')} className="text-[11px] text-teal-400 font-bold">Manage</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {primaryModules.map((mod, idx) => {
                const Icon = mod.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => router.push(mod.href)}
                    className="h-12 px-2 rounded-xl bg-slate-950/70 border border-white/5 hover:border-teal-500/30 active:scale-[0.98] transition-all flex items-center gap-2 min-w-0"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <span className={`w-7 h-7 rounded-lg ${mod.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4 h-4 ${mod.accent}`} />
                    </span>
                    <span className="text-[11px] font-bold text-slate-300 truncate">{mod.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {secondaryModules.map((mod, idx) => {
                const Icon = mod.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => router.push(mod.href)}
                    className="h-9 px-2 rounded-lg bg-slate-950/40 border border-white/5 hover:border-white/10 transition-all flex items-center gap-1.5 min-w-0"
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${mod.accent}`} />
                    <span className="text-[10px] font-bold text-slate-400 truncate">{mod.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Recent Activity</span>
            <button onClick={() => router.push('/dashboard/analytics')} className="text-[12px] text-teal-400 font-bold">View all</button>
          </div>
          <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
            {activity.length === 0 && (
              <EmptyStatePlaceholder
                icon={Activity}
                title="No activity yet"
                description="Connect your email or add a lead to see workspace activity here."
                action={{ label: 'Go to Analytics', onClick: () => router.push('/dashboard/analytics') }}
                compact
              />
            )}
            {activity.slice(0, 4).map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <Activity className="w-3.5 h-3.5 text-teal-400" />
                </div>
                <span className="flex-1 text-[13px] text-slate-300 truncate">{item.description || item.action}</span>
                <span className="text-[11px] text-slate-500 opacity-55 flex-shrink-0">
                  {item.created_at ? new Date(item.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
            ))}
            <button onClick={() => router.push('/dashboard/analytics')} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors">
              <span className="text-[12px] text-teal-400 font-bold">Open activity center</span>
              <ChevronRight className="w-4 h-4 text-teal-400" />
            </button>
          </div>
        </div>
      </div>

      <DailyBrief />

      {/* Revenue */}
      <RevenueMomentumCard />

      {/* AI Intelligence */}
      <IntegratedIntelligencePanel />

      {/* AI Predictive */}
      <AIPredictiveWidget onActionComplete={(msg) => setCelebration({ show: true, message: msg })} />
    </div>
  );
};

export default HomeTab;
