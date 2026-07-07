'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  DollarSign, Users, Mail, CheckCircle2,
  Share2, Brain, BarChart2, Activity,
  Circle, Clock, Globe,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { subDays, format } from 'date-fns';
import {
  StandardStatCard,
  StandardStatusBadge,
  resolveStatusVariant,
  SocialPlatformIcon,
} from '@/components/ui/design-system';

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
interface SocialAccount  { platform: string; followers: number; growth: number }
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
  { name: 'Lead Finder',        desc: 'Finding new leads',   color: 'text-[#adebb3]',   bg: 'bg-[#adebb3]/10' },
  { name: 'Email Agent',        desc: 'Sending follow-ups',  color: 'text-[#00f0ff]',    bg: 'bg-[#00f0ff]/10' },
  { name: 'Social Media Agent', desc: 'Scheduling posts',    color: 'text-[#7f00ff]', bg: 'bg-[#7f00ff]/10' },
  { name: 'Sales Assistant',    desc: 'Qualifying leads',    color: 'text-[#ffb347]',  bg: 'bg-[#ffb347]/10' },
];

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
      if (/lead/i.test(a))    return 'text-[#adebb3]';
      if (/deal/i.test(a))    return 'text-[#3eb489]';
      if (/invoice|pay|bill/i.test(a)) return 'text-[#fb923c]';
      if (/email|campaign/i.test(a)) return 'text-[#00f0ff]';
      if (/contract/i.test(a)) return 'text-[#f87171]';
      if (/task|overdue|alert/i.test(a)) return 'text-[#facc15]';
      return 'text-[#c0c0c0]';
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
    setSocial(((socRows as any[]) || []).map((r: any) => ({
      platform: r.platform,
      followers: r.followers_count || 0,
      growth: r.followers_growth || 0,
    })));

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
        <div className="h-8 w-56 bg-white/5 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {Array(5).fill(0).map((_, i) => <div key={i} className="h-36 bg-white/5 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => <div key={i} className="h-72 bg-white/5 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-3 sm:p-4 md:p-6 pb-24 ac-scroll-full ac-enterprise-module">

      {/* Header */}
      <div className="flex items-start justify-between gap-3.5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#fb923c]">Workspace Home</p>
          <h1 className="mt-1.5 text-3xl md:text-[40px] font-black tracking-tight text-white">Workspace Home</h1>
          <p className="text-sm text-[#c0c0c0] mt-0.5 leading-[1.5]">
            Welcome back, <span className="text-[#adebb3] font-semibold">{user?.name?.split(' ')[0]}</span>!
            {' '}Here’s what’s happening with your business today.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2.5 shrink-0 pt-0.5">
          <button type="button" className="h-12 px-4 rounded-2xl border border-white/5 bg-white/[0.04] text-sm font-semibold text-white hover:bg-white/[0.06] transition-colors">
            + Add Widget
          </button>
          <button type="button" className="h-12 w-12 rounded-2xl border border-white/5 bg-white/[0.04] text-white hover:bg-white/[0.06] transition-colors">
            ⋯
          </button>
        </div>
      </div>

      {/* ── hero cards ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-3">
        <div className="dashboard-panel-soft rounded-[28px] px-6 pt-[22px] pb-6 border border-[#4ade80]/12 shadow-[0_24px_80px_-36px_rgba(74,222,128,0.3)]">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[18px] font-bold text-white">Business Health Score</h3>
              <p className="mt-1 text-xs text-[#94a3b8]">Performance across the workspace</p>
            </div>
            <span className="text-[#94a3b8]">ⓘ</span>
          </div>
          <div className="relative mx-auto mt-5 flex h-[290px] w-[290px] items-center justify-center rounded-full">
            <div className="absolute inset-0 rounded-full border-[18px] border-white/[0.03]" />
            <div
              className="absolute inset-0 rounded-full border-[18px] border-transparent border-t-[#fb923c] border-r-[#4ade80] border-b-[#fb923c] border-l-[#4ade80] rotate-45"
              style={{ clipPath: 'inset(0 round 9999px)' }}
            />
            <div className="absolute inset-[22px] rounded-full border border-white/5" />
            <div className="relative text-center">
              <div className="text-6xl font-black tracking-tight text-white">{Math.max(72, Math.min(99, 78 + Math.round((stats.revenue / 1000000) * 10)))}%</div>
              <div className="mt-2 text-lg font-semibold text-[#4ade80]">Excellent</div>
            </div>
          </div>
          <div className="mt-3.5 text-center text-sm text-slate-400">Your business is performing great.</div>
          <button type="button" onClick={() => router.push('/dashboard/analytics')} className="mx-auto mt-3.5 flex items-center gap-2 text-sm font-semibold text-[#4ade80]">
            View full analysis <span>→</span>
          </button>
        </div>

        <div className="dashboard-panel-soft rounded-[28px] px-6 pt-[22px] pb-6 border border-[#fb923c]/12 shadow-[0_24px_80px_-36px_rgba(251,146,60,0.28)]">
          <div className="flex items-start justify-between gap-3.5">
            <div>
              <h3 className="text-[18px] font-bold text-white">Revenue Analytics</h3>
              <p className="mt-1 text-xs text-[#94a3b8]">Last 30 days</p>
              <div className="mt-4 text-4xl font-black tracking-tight text-white">R{compact(stats.revenue)}</div>
              <div className="mt-1.5 text-sm font-semibold text-[#4ade80]">
                ↑ {Math.abs(pctChange(stats.revenue, stats.revenuePrev))}% vs last 30 days
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <button type="button" className="h-11 rounded-2xl border border-white/5 bg-white/[0.04] px-4 text-sm text-slate-300">
                Last 30 Days
              </button>
              <button type="button" className="h-11 w-11 rounded-2xl border border-white/5 bg-white/[0.04] text-slate-300">
                ⌄
              </button>
            </div>
          </div>
          <div className="mt-[22px] h-[315px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="bizRevGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4ade80" stopOpacity={0.36} />
                      <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="bizPrevGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="dashboard-chart-grid" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="dashboard-chart-tooltip backdrop-blur-md p-3 rounded-lg shadow-xl">
                          <p className="text-[10px] text-[#c0c0c0] font-black uppercase tracking-wider mb-1">{label}</p>
                          {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center gap-2 mt-1">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke }} />
                              <span className="text-xs text-[#c0c0c0] font-medium">{entry.name}:</span>
                              <span className="text-xs text-[#f5f5f5] font-black">R{entry.value?.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="thisMonth" stroke="#4ade80" strokeWidth={2.5} fill="url(#bizRevGradient)" dot={false} name="This Month" />
                  <Area type="monotone" dataKey="lastMonth" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 5" fill="url(#bizPrevGradient)" dot={false} name="Last Month" />
                </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── 5 Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <StandardStatCard label="Total Revenue"    value={`R${compact(stats.revenue)}`}      delta={pctChange(stats.revenue, stats.revenuePrev)}      icon={DollarSign}    themeColor="orange" onClick={() => router.push('/dashboard/finance')} />
        <StandardStatCard label="New Leads"        value={compact(stats.leads)}              delta={pctChange(stats.leads, stats.leadsPrev)}        icon={Users}         themeColor="blue"   onClick={() => router.push('/dashboard/crm')} />
        <StandardStatCard label="Email Sent"       value={compact(stats.emailsSent)}         delta={pctChange(stats.emailsSent, stats.emailsSentPrev)}   icon={Mail}          themeColor="emerald" onClick={() => router.push('/dashboard/mail')} />
        <StandardStatCard label="Deals Closed"     value={compact(stats.dealsClosed)}        delta={pctChange(stats.dealsClosed, stats.dealsClosedPrev)}  icon={BarChart2}     themeColor="rose"   onClick={() => router.push('/dashboard/deals')} />
        <StandardStatCard label="Tasks Completed"  value={`${taskPct}%`}                    delta={taskPct - 80}                                           icon={CheckCircle2}  themeColor="amber"  onClick={() => router.push('/dashboard/tasks')} />
      </div>

      {/* ── Middle: Pipeline | AI Agents ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* Revenue chart */}
        <div className="dashboard-panel-soft rounded-2xl p-5 space-y-3 border border-[#f87171]/15 shadow-[0_20px_60px_-34px_rgba(248,113,113,0.28)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#f5f5f5]">Sales Pipeline</h3>
              <p className="text-[11px] text-[#94a3b8]">Deal progression</p>
            </div>
            <button onClick={() => router.push('/dashboard/deals')} className="text-[11px] text-[#00f0ff] font-bold">View all</button>
          </div>
          <div className="space-y-3">
            {pipeline.map(s => {
              const w = Math.round((s.count / maxPipe) * 100);
              const conv = pipeline[0].count > 0 ? Math.round((s.count / pipeline[0].count) * 100) : (s.stage === 'New Leads' ? 100 : 0);
              return (
                <div key={s.stage}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#e5e7eb] font-medium">{s.stage}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#f5f5f5] font-black">{compact(s.count)}</span>
                      <span className="text-[#94a3b8] text-[10px]">{conv}%</span>
                    </div>
                  </div>
                  <div className="h-6 bg-[#1f2937] rounded-lg overflow-hidden border border-white/5">
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
        <div className="dashboard-panel-soft rounded-2xl p-5 space-y-3 border border-[#facc15]/12 shadow-[0_20px_60px_-34px_rgba(250,204,21,0.24)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#f5f5f5]">AI Agents</h3>
              <p className="text-[11px] text-[#94a3b8]">Running autonomously</p>
            </div>
            <button onClick={() => router.push('/dashboard/sales-agent')} className="text-[11px] text-[#adebb3] font-bold">View all</button>
          </div>
          <div className="space-y-2.5">
            {AGENTS.map(a => (
              <div key={a.name} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                <div className={`w-9 h-9 rounded-xl ${a.bg} flex items-center justify-center ${a.color}`}>
                  <Brain className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#f5f5f5]">{a.name}</p>
                  <p className="text-[10px] text-[#94a3b8]">{a.desc}</p>
                </div>
                <StandardStatusBadge variant="success">Active</StandardStatusBadge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom: Tasks | Social | Activity ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* Tasks */}
        <div className="dashboard-panel-soft rounded-2xl p-5 space-y-3 border border-[#facc15]/12">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#f5f5f5]">Tasks</h3>
            <button onClick={() => router.push('/dashboard/tasks')} className="text-[11px] text-[#adebb3] font-bold">View all</button>
          </div>
          <div className="space-y-1.5">
            {tasks.length === 0 ? (
              <p className="text-xs text-[#94a3b8] py-8 text-center">No open tasks — you're all caught up 🎉</p>
            ) : tasks.map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors">
                <Circle className="w-4 h-4 text-[#94a3b8] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#e5e7eb] truncate">{t.title}</p>
                  {t.due_date && (
                    <p className="text-[10px] text-[#94a3b8] flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(t.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  )}
                </div>
                <StandardStatusBadge variant={resolveStatusVariant(t.priority)}>
                  {t.priority || 'medium'}
                </StandardStatusBadge>
              </div>
            ))}
          </div>
        </div>

        {/* Social Media */}
        <div className="dashboard-panel-soft rounded-2xl p-5 space-y-3 border border-[#f87171]/12">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#f5f5f5]">Social Media Overview</h3>
            <button onClick={() => router.push('/dashboard/business/social')} className="text-[11px] text-[#00f0ff] font-bold">View all</button>
          </div>
          {social.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <Share2 className="w-8 h-8 text-[#94a3b8] mx-auto" />
              <p className="text-xs text-[#94a3b8]">No social accounts connected yet</p>
              <button onClick={() => router.push('/dashboard/settings')} className="text-xs text-[#adebb3] font-semibold">
                Connect accounts →
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {social.map(acc => (
                <div key={acc.platform} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-white/10 transition-colors duration-300">
                  <div className="flex items-center gap-3">
                    <SocialPlatformIcon platform={acc.platform} showBackground size="sm" />
                    <div>
                      <p className="text-xs font-bold text-[#f5f5f5] capitalize">{acc.platform}</p>
                      <p className="text-[11px] text-[#c0c0c0]">{compact(acc.followers)} Followers</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold ${acc.growth >= 0 ? 'text-[#adebb3]' : 'text-[#f87171]'}`}>
                    {acc.growth >= 0 ? '+' : ''}{acc.growth}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="dashboard-panel-soft rounded-2xl p-5 space-y-3 border border-[#fb923c]/12">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#f5f5f5]">Recent Activities</h3>
            <button onClick={() => router.push('/dashboard/analytics')} className="text-[11px] text-[#adebb3] font-bold">View all</button>
          </div>
          <div className="space-y-1">
            {activities.length === 0 ? (
              <p className="text-xs text-[#94a3b8] py-8 text-center">No recent activity</p>
            ) : activities.map(a => (
              <div key={a.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors">
                <div className={`w-6 h-6 rounded-full bg-[#1f2937] flex items-center justify-center shrink-0 mt-0.5 ${a.iconColor}`}>
                  <Activity className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#e5e7eb] leading-snug">{a.description}</p>
                  <p className="text-[10px] text-[#94a3b8] mt-0.5">
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
