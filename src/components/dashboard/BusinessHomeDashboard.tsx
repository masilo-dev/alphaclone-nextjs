'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  DollarSign, Users, Mail, Target, CheckCircle2,
  TrendingUp, TrendingDown, Share2,
  Brain, BarChart2, Activity, ChevronRight,
  Linkedin, Facebook, Twitter, Instagram, Music2,
  Circle, Clock, Globe,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { subDays, format } from 'date-fns';

/* ─── helpers ─────────────────────────────────────── */
const compact = (n: number) =>
  new Intl.NumberFormat(undefined, {
    notation: n >= 1_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(n);

const pctChange = (curr: number, prev: number) =>
  prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

const safeQuery = async <T = unknown>(
  fn: () => PromiseLike<{ data: T | null; count?: number | null; error: any }>
): Promise<{ data: T | null; count: number }> => {
  try {
    const { data, count } = await fn();
    return { data, count: count ?? 0 };
  } catch {
    return { data: null, count: 0 };
  }
};

/* ─── types ───────────────────────────────────────── */
interface HomeStats {
  revenue: number; revenuePrev: number;
  leads: number;   leadsPrev: number;
  emailsSent: number; emailsSentPrev: number;
  dealsClosed: number; dealsClosedPrev: number;
  tasksCompleted: number; tasksTotal: number;
}

interface PipelineStage { stage: string; count: number; color: string }
interface SocialAccount  { platform: string; followers: number; growth: number; icon: React.ReactNode; color: string }
interface ActivityItem   { id: string; description: string; created_at: string; iconColor: string }
interface Task           { id: string; title: string; priority: string; due_date: string | null }
interface ChartPoint     { date: string; thisMonth: number; lastMonth: number }

/* ─── static config ───────────────────────────────── */
const INIT_PIPELINE: PipelineStage[] = [
  { stage: 'New Leads',  count: 0, color: '#6366f1' },
  { stage: 'Contacted',  count: 0, color: '#0ea5e9' },
  { stage: 'Qualified',  count: 0, color: '#f59e0b' },
  { stage: 'Proposal',   count: 0, color: '#f97316' },
  { stage: 'Closed Won', count: 0, color: '#10b981' },
];

const STAGE_MAP: Record<string, string> = {
  lead: 'New Leads', contacted: 'Contacted', qualified: 'Qualified',
  proposal: 'Proposal', closed_won: 'Closed Won',
};

const AGENTS = [
  { name: 'Lead Finder',        desc: 'Finding new leads',   color: 'text-teal-400',   bg: 'bg-teal-500/10' },
  { name: 'Email Agent',        desc: 'Sending follow-ups',  color: 'text-sky-400',    bg: 'bg-sky-500/10' },
  { name: 'Social Media Agent', desc: 'Scheduling posts',    color: 'text-violet-400', bg: 'bg-violet-500/10' },
  { name: 'Sales Assistant',    desc: 'Qualifying leads',    color: 'text-amber-400',  bg: 'bg-amber-500/10' },
];

const PLATFORM_META: Record<string, { icon: React.ReactNode; color: string }> = {
  linkedin:  { icon: <Linkedin  className="w-5 h-5" />, color: 'text-sky-400'    },
  facebook:  { icon: <Facebook  className="w-5 h-5" />, color: 'text-blue-500'   },
  instagram: { icon: <Instagram className="w-5 h-5" />, color: 'text-pink-400'   },
  x:         { icon: <Twitter   className="w-5 h-5" />, color: 'text-slate-200'  },
  tiktok:    { icon: <Music2    className="w-5 h-5" />, color: 'text-rose-400'   },
};

const PRIORITY_CLASS: Record<string, string> = {
  high:   'bg-red-500/10 text-red-400 border border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  low:    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
};

/* ─── sub-components ──────────────────────────────── */
function StatCard({ label, value, delta, iconBg, Icon, href }: {
  label: string; value: string; delta: number;
  iconBg: string; Icon: React.ElementType; href: string;
}) {
  const router = useRouter();
  const up = delta >= 0;
  return (
    <button
      onClick={() => router.push(href)}
      className="group text-left bg-slate-900 border border-white/5 rounded-2xl p-5 hover:border-teal-500/30 transition-all space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-teal-400 transition-colors" />
      </div>
      <div>
        <p className="text-2xl font-black text-white tracking-tight">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
      <div className={`flex items-center gap-1 text-xs font-bold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {up ? '+' : ''}{delta}% vs last 30 days
      </div>
    </button>
  );
}

/* ─── main ────────────────────────────────────────── */
export default function BusinessHomeDashboard() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<HomeStats>({
    revenue: 0, revenuePrev: 0, leads: 0, leadsPrev: 0,
    emailsSent: 0, emailsSentPrev: 0, dealsClosed: 0, dealsClosedPrev: 0,
    tasksCompleted: 0, tasksTotal: 0,
  });
  const [pipeline, setPipeline] = useState<PipelineStage[]>(INIT_PIPELINE);
  const [chart, setChart]       = useState<ChartPoint[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [social, setSocial]     = useState<SocialAccount[]>([]);
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async (tid: string) => {
    setLoading(true);

    const now   = new Date();
    const d30   = subDays(now, 30).toISOString();
    const d60   = subDays(now, 60).toISOString();

    /* ── stats ── */
    const [
      leadsNow,   leadsPrv,
      closedNow,  closedPrv,
      tasksTot,   tasksDone,
      revNow,     revPrv,
    ] = await Promise.all([
      safeQuery(() => (supabase as any).from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).gte('created_at', d30)),
      safeQuery(() => (supabase as any).from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).gte('created_at', d60).lt('created_at', d30)),
      safeQuery(() => (supabase as any).from('deals').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('stage', 'closed_won').gte('updated_at', d30)),
      safeQuery(() => (supabase as any).from('deals').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('stage', 'closed_won').gte('updated_at', d60).lt('updated_at', d30)),
      safeQuery(() => (supabase as any).from('tasks').select('id', { count: 'exact', head: true }).eq('tenant_id', tid)),
      safeQuery(() => (supabase as any).from('tasks').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).eq('status', 'completed')),
      safeQuery(() => (supabase as any).from('business_invoices').select('total').eq('tenant_id', tid).eq('status', 'paid').gte('created_at', d30)),
      safeQuery(() => (supabase as any).from('business_invoices').select('total').eq('tenant_id', tid).eq('status', 'paid').gte('created_at', d60).lt('created_at', d30)),
    ]);

    const sumTotals = (r: { data: any }) =>
      ((r.data || []) as any[]).reduce((s, x) => s + (Number(x.total) || 0), 0);

    setStats({
      leads:         leadsNow.count,
      leadsPrev:     leadsPrv.count,
      dealsClosed:   closedNow.count,
      dealsClosedPrev: closedPrv.count,
      tasksTotal:    tasksTot.count,
      tasksCompleted: tasksDone.count,
      revenue:       sumTotals(revNow),
      revenuePrev:   sumTotals(revPrv),
      emailsSent:    0,
      emailsSentPrev: 0,
    });

    /* ── pipeline ── */
    const { data: dealRows } = await safeQuery(() =>
      (supabase as any).from('deals').select('stage').eq('tenant_id', tid)
    );
    const stageCounts: Record<string, number> = {};
    ((dealRows as any[]) || []).forEach((d: any) => {
      const label = STAGE_MAP[d.stage] ?? d.stage;
      if (label) stageCounts[label] = (stageCounts[label] || 0) + 1;
    });
    setPipeline(INIT_PIPELINE.map(s => ({ ...s, count: stageCounts[s.stage] || 0 })));

    /* ── revenue chart (last 14 days vs prior 14) ── */
    const { data: invRows } = await safeQuery(() =>
      (supabase as any).from('business_invoices')
        .select('total, created_at')
        .eq('tenant_id', tid).eq('status', 'paid')
        .gte('created_at', subDays(now, 28).toISOString())
    );
    const days14 = Array.from({ length: 14 }, (_, i) => subDays(now, 13 - i));
    const byDay: Record<string, { thisMonth: number; lastMonth: number }> = {};
    days14.forEach(d => { byDay[format(d, 'MMM d')] = { thisMonth: 0, lastMonth: 0 }; });
    ((invRows as any[]) || []).forEach((inv: any) => {
      const daysAgo = Math.floor((now.getTime() - new Date(inv.created_at).getTime()) / 86400000);
      const key = format(new Date(inv.created_at), 'MMM d');
      if (!byDay[key]) return;
      if (daysAgo <= 14) byDay[key].thisMonth += Number(inv.total) || 0;
      else               byDay[key].lastMonth  += Number(inv.total) || 0;
    });
    setChart(days14.map(d => ({ date: format(d, 'MMM d'), ...byDay[format(d, 'MMM d')] })));

    /* ── activity ── */
    const { data: actRows } = await safeQuery(() =>
      (supabase as any).from('activity_log')
        .select('id, description, action, created_at')
        .eq('tenant_id', tid)
        .order('created_at', { ascending: false }).limit(5)
    );
    const colorForAction = (a: string) => {
      if (/lead/i.test(a))    return 'text-teal-400';
      if (/deal/i.test(a))    return 'text-emerald-400';
      if (/invoice|pay/i.test(a)) return 'text-green-400';
      if (/email|campaign/i.test(a)) return 'text-sky-400';
      if (/contract/i.test(a)) return 'text-violet-400';
      return 'text-slate-400';
    };
    setActivities(((actRows as any[]) || []).map((r: any) => ({
      id:          r.id,
      description: r.description || r.action || 'Activity',
      created_at:  r.created_at,
      iconColor:   colorForAction(r.action || r.description || ''),
    })));

    /* ── social accounts ── */
    const { data: socRows } = await safeQuery(() =>
      (supabase as any).from('social_accounts')
        .select('platform, followers_count, followers_growth')
        .eq('tenant_id', tid).limit(5)
    );
    setSocial(((socRows as any[]) || []).map((r: any) => {
      const meta = PLATFORM_META[r.platform?.toLowerCase()] ?? { icon: <Globe className="w-5 h-5" />, color: 'text-slate-400' };
      return { platform: r.platform, followers: r.followers_count || 0, growth: r.followers_growth || 0, ...meta };
    }));

    /* ── tasks ── */
    const { data: taskRows } = await safeQuery(() =>
      (supabase as any).from('tasks')
        .select('id, title, priority, due_date')
        .eq('tenant_id', tid).neq('status', 'completed')
        .order('due_date', { ascending: true, nullsFirst: false }).limit(4)
    );
    setTasks((taskRows as any[]) || []);

    setLoading(false);
  }, []);

  useEffect(() => {
    if (currentTenant?.id) load(currentTenant.id);
  }, [currentTenant?.id, load]);

  /* ── derived ── */
  const taskPct   = stats.tasksTotal > 0 ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 100) : 0;
  const maxPipe   = Math.max(...pipeline.map(s => s.count), 1);
  const dateLabel = `${format(subDays(new Date(), 30), 'MMM d')} – ${format(new Date(), 'MMM d, yyyy')}`;

  /* ── skeleton ── */
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4 animate-pulse">
        <div className="h-8 w-56 bg-slate-800 rounded" />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {Array(5).fill(0).map((_, i) => <div key={i} className="h-36 bg-slate-800 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => <div key={i} className="h-72 bg-slate-800 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 pb-24 ac-scroll-full ac-enterprise-module">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Welcome back, <span className="text-teal-400 font-semibold">{user?.name?.split(' ')[0]}</span>!
            {' '}Your AI business is running smoothly.
          </p>
        </div>
        <span className="text-xs text-slate-500 shrink-0 hidden sm:block pt-1">{dateLabel}</span>
      </div>

      {/* ── 5 Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard label="Total Revenue"    value={`R${compact(stats.revenue)}`}      delta={pctChange(stats.revenue,      stats.revenuePrev)}      Icon={DollarSign}    iconBg="bg-violet-600" href="/dashboard/finance" />
        <StatCard label="New Leads"        value={compact(stats.leads)}              delta={pctChange(stats.leads,        stats.leadsPrev)}        Icon={Users}         iconBg="bg-blue-600"   href="/dashboard/crm" />
        <StatCard label="Email Sent"       value={compact(stats.emailsSent)}         delta={pctChange(stats.emailsSent,   stats.emailsSentPrev)}   Icon={Mail}          iconBg="bg-emerald-600" href="/dashboard/mail" />
        <StatCard label="Deals Closed"     value={compact(stats.dealsClosed)}        delta={pctChange(stats.dealsClosed,  stats.dealsClosedPrev)}  Icon={BarChart2}     iconBg="bg-amber-600"  href="/dashboard/deals" />
        <StatCard label="Tasks Completed"  value={`${taskPct}%`}                    delta={taskPct - 80}                                           Icon={CheckCircle2}  iconBg="bg-teal-600"   href="/dashboard/tasks" />
      </div>

      {/* ── Middle: Chart | Pipeline | AI Agents ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* Revenue chart */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Revenue Overview</h3>
              <p className="text-[11px] text-slate-500">This Month vs Last Month</p>
            </div>
            <button onClick={() => router.push('/dashboard/finance')} className="text-[11px] text-teal-400 font-bold">View all</button>
          </div>
          <p className="text-2xl font-black text-teal-400">R{compact(stats.revenue)}</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} interval={3} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Line type="monotone" dataKey="thisMonth" stroke="#14b8a6" strokeWidth={2.5} dot={false} name="This Month" />
                <Line type="monotone" dataKey="lastMonth" stroke="#334155" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Last Month" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pipeline funnel */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Sales Pipeline</h3>
              <p className="text-[11px] text-slate-500">Deal progression</p>
            </div>
            <button onClick={() => router.push('/dashboard/deals')} className="text-[11px] text-teal-400 font-bold">View all</button>
          </div>
          <div className="space-y-3">
            {pipeline.map(s => {
              const w = Math.round((s.count / maxPipe) * 100);
              const conv = pipeline[0].count > 0 ? Math.round((s.count / pipeline[0].count) * 100) : (s.stage === 'New Leads' ? 100 : 0);
              return (
                <div key={s.stage}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">{s.stage}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-black">{compact(s.count)}</span>
                      <span className="text-slate-500 text-[10px]">{conv}%</span>
                    </div>
                  </div>
                  <div className="h-6 bg-slate-800 rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg transition-all duration-700"
                      style={{ width: `${Math.max(w, s.count > 0 ? 8 : 0)}%`, backgroundColor: s.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Agents */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">AI Agents</h3>
              <p className="text-[11px] text-slate-500">Running autonomously</p>
            </div>
            <button onClick={() => router.push('/dashboard/sales-agent')} className="text-[11px] text-teal-400 font-bold">View all</button>
          </div>
          <div className="space-y-2.5">
            {AGENTS.map(a => (
              <div key={a.name} className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-xl border border-white/5">
                <div className={`w-9 h-9 rounded-xl ${a.bg} flex items-center justify-center ${a.color}`}>
                  <Brain className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">{a.name}</p>
                  <p className="text-[10px] text-slate-500">{a.desc}</p>
                </div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom: Tasks | Social | Activity ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* Tasks */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Tasks</h3>
            <button onClick={() => router.push('/dashboard/tasks')} className="text-[11px] text-teal-400 font-bold">View all</button>
          </div>
          <div className="space-y-1.5">
            {tasks.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No open tasks — you're all caught up 🎉</p>
            ) : tasks.map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/60 transition-colors">
                <Circle className="w-4 h-4 text-slate-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">{t.title}</p>
                  {t.due_date && (
                    <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(t.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  )}
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md shrink-0 ${PRIORITY_CLASS[t.priority] || PRIORITY_CLASS.medium}`}>
                  {t.priority || 'medium'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Social Media */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Social Media Overview</h3>
            <button onClick={() => router.push('/dashboard/business/social')} className="text-[11px] text-teal-400 font-bold">View all</button>
          </div>
          {social.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <Share2 className="w-8 h-8 text-slate-700 mx-auto" />
              <p className="text-xs text-slate-500">No social accounts connected yet</p>
              <button onClick={() => router.push('/dashboard/settings')} className="text-xs text-teal-400 font-semibold">
                Connect accounts →
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {social.map(acc => (
                <div key={acc.platform} className="flex items-center justify-between p-3 bg-slate-800/60 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <span className={acc.color}>{acc.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-white capitalize">{acc.platform}</p>
                      <p className="text-[11px] text-slate-400">{compact(acc.followers)} Followers</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold ${acc.growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {acc.growth >= 0 ? '+' : ''}{acc.growth}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Recent Activities</h3>
            <button onClick={() => router.push('/dashboard/analytics')} className="text-[11px] text-teal-400 font-bold">View all</button>
          </div>
          <div className="space-y-1">
            {activities.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No recent activity</p>
            ) : activities.map(a => (
              <div key={a.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-800/40 transition-colors">
                <div className={`w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 ${a.iconColor}`}>
                  <Activity className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-200 leading-snug">{a.description}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {a.created_at
                      ? new Date(a.created_at).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
                      : '–'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
