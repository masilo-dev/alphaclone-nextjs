import type { SupabaseClient } from '@supabase/supabase-js';
import {
  periodPresetToIsoRange,
  type MetricPeriodPreset,
} from '@/lib/metrics/dateRange';
import {
  DASHBOARD_COLORS,
  type DashboardFeedItem,
  type OverviewStatsResponse,
  type DeltaColor,
  type DeltaDir,
} from '@/types/dashboardStats';

const DEFAULT_PERIOD: MetricPeriodPreset = 'last_30_days';

function periodRange(period: MetricPeriodPreset = DEFAULT_PERIOD) {
  return periodPresetToIsoRange(period);
}

function inPeriod(iso: string, startIso: string, endIso: string): boolean {
  return iso >= startIso && iso <= endIso;
}

function formatDelta(
  current: number,
  previous: number,
): { delta?: string; deltaDir?: DeltaDir; deltaColor?: DeltaColor } {
  if (previous === 0) {
    if (current === 0) return {};
    return { delta: '—', deltaDir: 'up', deltaColor: 'green' };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  return {
    delta: `${Math.abs(pct)}%`,
    deltaDir: pct >= 0 ? 'up' : 'down',
    deltaColor: pct >= 0 ? 'green' : 'red',
  };
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

function formatPct(n: number): string {
  return `${Math.round(n)}%`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

async function safeRows<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  tenantId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra?: (q: any) => any,
  limit = 500,
): Promise<T[]> {
  try {
    let q = supabase.from(table).select(select).eq('tenant_id', tenantId).limit(limit);
    if (extra) q = extra(q);
    const { data, error } = await q;
    if (error) return [];
    return (data as unknown as T[]) || [];
  } catch {
    return [];
  }
}

async function activityFeed(
  supabase: SupabaseClient,
  tenantId: string,
  entityTypes: string[],
  dot: string,
): Promise<DashboardFeedItem[]> {
  const rows = await safeRows<{
    action: string;
    entity_type: string;
    created_at: string;
    metadata?: { name?: string; title?: string };
  }>(
    supabase,
    'audit_logs',
    'action, entity_type, created_at, metadata',
    tenantId,
    (q) => q.in('entity_type', entityTypes).order('created_at', { ascending: false }).limit(10),
    10,
  );
  return rows.slice(0, 5).map((r) => ({
    dot,
    text: `${r.action || r.entity_type} — ${r.metadata?.name || r.metadata?.title || r.entity_type}`.slice(0, 48),
    time: timeAgo(r.created_at),
  }));
}

function monthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthLabel(key: string): string {
  const [, m] = key.split('-');
  return MONTHS[Number(m) - 1] ?? key;
}

export const extendedHubStats = {
  async getDealsStats(
    supabase: SupabaseClient,
    tenantId: string,
    period: MetricPeriodPreset = DEFAULT_PERIOD,
  ): Promise<OverviewStatsResponse> {
    const { startIso, endIso, previousStartIso, previousEndIso, comparisonLabel } = periodRange(period);
    const deals = await safeRows<{
      stage: string;
      value?: number;
      created_at: string;
      actual_close_date?: string;
      updated_at?: string;
    }>(supabase, 'deals', 'stage, value, created_at, actual_close_date, updated_at', tenantId);

    const open = deals.filter((d) => !['closed_won', 'closed_lost'].includes(d.stage));
    const openValue = open.reduce((s, d) => s + Number(d.value || 0), 0);
    const wonInPeriod = deals.filter(
      (d) => d.stage === 'closed_won' && inPeriod(d.actual_close_date || d.updated_at || d.created_at, startIso, endIso),
    );
    const wonPrev = deals.filter(
      (d) =>
        d.stage === 'closed_won' &&
        inPeriod(d.actual_close_date || d.updated_at || d.created_at, previousStartIso, previousEndIso),
    );
    const lostInPeriod = deals.filter(
      (d) => d.stage === 'closed_lost' && inPeriod(d.updated_at || d.created_at, startIso, endIso),
    );
    const winRate =
      wonInPeriod.length + lostInPeriod.length > 0
        ? (wonInPeriod.length / (wonInPeriod.length + lostInPeriod.length)) * 100
        : 0;
    const avgDeal = open.length > 0 ? openValue / open.length : 0;
    const stalled = open.filter((d) => {
      const ref = d.updated_at || d.created_at;
      return Date.now() - new Date(ref).getTime() > 7 * 86400000;
    }).length;

    const stageMap: Record<string, number> = {};
    open.forEach((d) => {
      stageMap[d.stage] = (stageMap[d.stage] || 0) + 1;
    });

    const keys = monthKeys(6);
    const wonByMonth: Record<string, number> = {};
    keys.forEach((k) => { wonByMonth[k] = 0; });
    deals.filter((d) => d.stage === 'closed_won').forEach((d) => {
      const k = (d.actual_close_date || d.created_at).slice(0, 7);
      if (wonByMonth[k] !== undefined) wonByMonth[k]++;
    });

    const feed = await activityFeed(supabase, tenantId, ['deal'], DASHBOARD_COLORS.blue);

    return {
      metrics: [
        { label: 'Pipeline value', value: formatMoney(openValue), comparisonText: comparisonLabel },
        { label: 'Active deals', value: open.length, ...formatDelta(open.length, deals.filter((d) => inPeriod(d.created_at, previousStartIso, previousEndIso) && !['closed_won', 'closed_lost'].includes(d.stage)).length), comparisonText: comparisonLabel },
        { label: 'Win rate', value: formatPct(winRate), deltaColor: winRate >= 30 ? 'green' : 'amber', comparisonText: comparisonLabel },
        { label: 'Avg deal size', value: formatMoney(avgDeal), comparisonText: comparisonLabel },
      ],
      metricsRowB: [
        { label: 'Won in period', value: wonInPeriod.length, ...formatDelta(wonInPeriod.length, wonPrev.length), comparisonText: comparisonLabel },
        { label: 'Lost in period', value: lostInPeriod.length, deltaColor: lostInPeriod.length > 0 ? 'red' : 'green', comparisonText: comparisonLabel },
        { label: 'Stalled deals', value: stalled, deltaColor: stalled > 0 ? 'amber' : 'green', comparisonText: 'No movement 7+ days' },
        { label: 'Weighted forecast', value: formatMoney(openValue * (winRate / 100)), comparisonText: 'Pipeline × win rate' },
      ],
      mainChart: keys.map((k) => ({ label: monthLabel(k), value: wonByMonth[k] || 0 })),
      breakdown: Object.entries(stageMap).map(([label, value], i) => ({
        label,
        value,
        color: [DASHBOARD_COLORS.blue, DASHBOARD_COLORS.amber, DASHBOARD_COLORS.green, DASHBOARD_COLORS.red, DASHBOARD_COLORS.teal][i] || DASHBOARD_COLORS.slate,
      })),
      donut: [
        { label: 'Open', value: open.length, color: DASHBOARD_COLORS.blue },
        { label: 'Won', value: deals.filter((d) => d.stage === 'closed_won').length, color: DASHBOARD_COLORS.green },
        { label: 'Lost', value: deals.filter((d) => d.stage === 'closed_lost').length, color: DASHBOARD_COLORS.red },
      ],
      pills: Object.entries(stageMap).slice(0, 4).map(([label, value], i) => ({
        label,
        value,
        color: [DASHBOARD_COLORS.blue, DASHBOARD_COLORS.amber, DASHBOARD_COLORS.green, DASHBOARD_COLORS.red][i],
      })),
      feed,
    };
  },

  async getTasksStats(
    supabase: SupabaseClient,
    tenantId: string,
    period: MetricPeriodPreset = DEFAULT_PERIOD,
  ): Promise<OverviewStatsResponse> {
    const { startIso, endIso, previousStartIso, previousEndIso, comparisonLabel } = periodRange(period);
    const today = new Date().toISOString().slice(0, 10);
    const tasks = await safeRows<{
      status?: string;
      priority?: string;
      due_date?: string;
      completed_at?: string;
      updated_at?: string;
      created_at: string;
      assigned_to?: string;
    }>(supabase, 'tasks', 'status, priority, due_date, completed_at, updated_at, created_at, assigned_to', tenantId);

    const open = tasks.filter((t) => t.status !== 'completed');
    const overdue = open.filter((t) => t.due_date && t.due_date < today).length;
    const dueToday = open.filter((t) => t.due_date?.slice(0, 10) === today).length;
    const completedInPeriod = tasks.filter(
      (t) => t.status === 'completed' && inPeriod(t.completed_at || t.updated_at || t.created_at, startIso, endIso),
    ).length;
    const completedPrev = tasks.filter(
      (t) => t.status === 'completed' && inPeriod(t.completed_at || t.updated_at || t.created_at, previousStartIso, previousEndIso),
    ).length;
    const highPriority = open.filter((t) => ['high', 'urgent'].includes(String(t.priority).toLowerCase())).length;
    const blocked = open.filter((t) => t.status === 'blocked').length;
    const unassigned = open.filter((t) => !t.assigned_to).length;
    const completionRate = tasks.length > 0 ? (tasks.filter((t) => t.status === 'completed').length / tasks.length) * 100 : 0;

    const statusMap: Record<string, number> = { Open: 0, 'In progress': 0, Blocked: 0, Done: 0 };
    tasks.forEach((t) => {
      const s = String(t.status || 'pending').toLowerCase();
      if (s === 'completed') statusMap.Done++;
      else if (s === 'blocked') statusMap.Blocked++;
      else if (s === 'in_progress') statusMap['In progress']++;
      else statusMap.Open++;
    });

    const priorityMap: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
    open.forEach((t) => {
      const p = String(t.priority || 'medium').toLowerCase();
      if (p === 'high' || p === 'urgent') priorityMap.High++;
      else if (p === 'low') priorityMap.Low++;
      else priorityMap.Medium++;
    });

    const feed = await activityFeed(supabase, tenantId, ['task'], DASHBOARD_COLORS.amber);

    return {
      metrics: [
        { label: 'Open tasks', value: open.length, comparisonText: comparisonLabel },
        { label: 'Overdue', value: overdue, deltaColor: overdue > 0 ? 'red' : 'green', comparisonText: comparisonLabel },
        { label: 'Due today', value: dueToday, deltaColor: 'teal', comparisonText: comparisonLabel },
        { label: 'Completed in period', value: completedInPeriod, ...formatDelta(completedInPeriod, completedPrev), comparisonText: comparisonLabel },
      ],
      metricsRowB: [
        { label: 'High priority', value: highPriority, deltaColor: highPriority > 0 ? 'amber' : 'green', comparisonText: comparisonLabel },
        { label: 'Blocked', value: blocked, deltaColor: blocked > 0 ? 'red' : 'green', comparisonText: comparisonLabel },
        { label: 'Unassigned', value: unassigned, deltaColor: unassigned > 0 ? 'amber' : 'green', comparisonText: comparisonLabel },
        { label: 'Completion rate', value: formatPct(completionRate), deltaColor: completionRate > 70 ? 'green' : 'amber', comparisonText: comparisonLabel },
      ],
      mainChart: Object.entries(statusMap).map(([label, value]) => ({ label, value })),
      breakdown: Object.entries(priorityMap).map(([label, value], i) => ({
        label: `${label} priority`,
        value,
        color: [DASHBOARD_COLORS.red, DASHBOARD_COLORS.amber, DASHBOARD_COLORS.green][i],
      })),
      donut: Object.entries(statusMap).map(([label, value], i) => ({
        label,
        value,
        color: [DASHBOARD_COLORS.blue, DASHBOARD_COLORS.amber, DASHBOARD_COLORS.red, DASHBOARD_COLORS.green][i],
      })),
      pills: Object.entries(priorityMap).map(([label, value], i) => ({
        label: `${label} priority`,
        value,
        color: [DASHBOARD_COLORS.red, DASHBOARD_COLORS.amber, DASHBOARD_COLORS.green][i],
      })),
      feed,
    };
  },

  async getQuotesStats(
    supabase: SupabaseClient,
    tenantId: string,
    period: MetricPeriodPreset = DEFAULT_PERIOD,
  ): Promise<OverviewStatsResponse> {
    const { startIso, endIso, previousStartIso, previousEndIso, comparisonLabel } = periodRange(period);
    const quotes = await safeRows<{
      status?: string;
      total_amount?: number;
      amount?: number;
      created_at: string;
      sent_at?: string;
    }>(supabase, 'quotes', 'status, total_amount, amount, created_at, sent_at', tenantId);

    const amount = (q: (typeof quotes)[0]) => Number(q.total_amount ?? q.amount ?? 0);
    const pipeline = quotes.reduce((s, q) => s + amount(q), 0);
    const sent = quotes.filter((q) => q.status === 'sent' || q.sent_at).length;
    const accepted = quotes.filter((q) => ['accepted', 'converted', 'approved'].includes(String(q.status))).length;
    const prevPeriod = quotes.filter((q) => inPeriod(q.created_at, previousStartIso, previousEndIso));
    const conversion = sent > 0 ? (accepted / sent) * 100 : 0;
    const outstanding = quotes.filter((q) => q.status === 'sent').reduce((s, q) => s + amount(q), 0);
    const draft = quotes.filter((q) => q.status === 'draft').length;
    const expired = quotes.filter((q) => q.status === 'expired').length;
    const avgSize = quotes.length > 0 ? pipeline / quotes.length : 0;

    const statusMap: Record<string, number> = {};
    quotes.forEach((q) => {
      const s = String(q.status || 'draft');
      statusMap[s] = (statusMap[s] || 0) + 1;
    });

    const feed = await activityFeed(supabase, tenantId, ['quote', 'quotation'], DASHBOARD_COLORS.green);

    return {
      metrics: [
        { label: 'Quote pipeline', value: formatMoney(pipeline), comparisonText: comparisonLabel },
        { label: 'Sent', value: sent, ...formatDelta(sent, prevPeriod.filter((q) => q.status === 'sent').length), comparisonText: comparisonLabel },
        { label: 'Accepted', value: accepted, deltaColor: accepted > 0 ? 'green' : 'amber', comparisonText: comparisonLabel },
        { label: 'Conversion rate', value: formatPct(conversion), deltaColor: conversion > 25 ? 'green' : 'amber', comparisonText: comparisonLabel },
      ],
      metricsRowB: [
        { label: 'Draft quotes', value: draft, comparisonText: comparisonLabel },
        { label: 'Expired', value: expired, deltaColor: expired > 0 ? 'amber' : 'green', comparisonText: comparisonLabel },
        { label: 'Outstanding value', value: formatMoney(outstanding), comparisonText: 'Awaiting response' },
        { label: 'Avg quote size', value: formatMoney(avgSize), comparisonText: comparisonLabel },
      ],
      mainChart: Object.entries(statusMap).slice(0, 6).map(([label, value]) => ({ label, value })),
      breakdown: Object.entries(statusMap).map(([label, value], i) => ({
        label,
        value,
        color: [DASHBOARD_COLORS.blue, DASHBOARD_COLORS.green, DASHBOARD_COLORS.amber, DASHBOARD_COLORS.red][i] || DASHBOARD_COLORS.slate,
      })),
      donut: Object.entries(statusMap).slice(0, 4).map(([label, value], i) => ({
        label,
        value,
        color: [DASHBOARD_COLORS.green, DASHBOARD_COLORS.amber, DASHBOARD_COLORS.blue, DASHBOARD_COLORS.red][i],
      })),
      pills: [
        { label: 'Draft', value: draft, color: DASHBOARD_COLORS.blue },
        { label: 'Sent', value: sent, color: DASHBOARD_COLORS.amber },
        { label: 'Won', value: accepted, color: DASHBOARD_COLORS.green },
      ],
      feed,
    };
  },

  async getLeadsStats(
    supabase: SupabaseClient,
    tenantId: string,
    period: MetricPeriodPreset = DEFAULT_PERIOD,
  ): Promise<OverviewStatsResponse> {
    const { startIso, endIso, previousStartIso, previousEndIso, comparisonLabel } = periodRange(period);
    const leads = await safeRows<{ status?: string; source?: string; created_at: string }>(
      supabase, 'leads', 'status, source, created_at', tenantId,
    );

    const newInPeriod = leads.filter((l) => inPeriod(l.created_at, startIso, endIso)).length;
    const newPrev = leads.filter((l) => inPeriod(l.created_at, previousStartIso, previousEndIso)).length;
    const qualified = leads.filter((l) => ['qualified', 'mql', 'sql'].includes(String(l.status).toLowerCase())).length;
    const converted = leads.filter((l) => ['converted', 'won', 'customer'].includes(String(l.status).toLowerCase())).length;
    const qualRate = leads.length > 0 ? (qualified / leads.length) * 100 : 0;

    const sourceMap: Record<string, number> = { Referral: 0, Outreach: 0, Inbound: 0, Other: 0 };
    leads.forEach((l) => {
      const src = String(l.source || '').toLowerCase();
      if (src.includes('referral')) sourceMap.Referral++;
      else if (src.includes('outreach') || src.includes('cold')) sourceMap.Outreach++;
      else if (src.includes('website') || src.includes('inbound')) sourceMap.Inbound++;
      else sourceMap.Other++;
    });

    const statusMap: Record<string, number> = {};
    leads.forEach((l) => {
      const s = String(l.status || 'new');
      statusMap[s] = (statusMap[s] || 0) + 1;
    });

    const keys = monthKeys(6);
    const byMonth: Record<string, number> = {};
    keys.forEach((k) => { byMonth[k] = 0; });
    leads.forEach((l) => {
      const k = l.created_at.slice(0, 7);
      if (byMonth[k] !== undefined) byMonth[k]++;
    });

    const feed = await activityFeed(supabase, tenantId, ['lead'], DASHBOARD_COLORS.blue);

    return {
      metrics: [
        { label: 'New leads', value: newInPeriod, ...formatDelta(newInPeriod, newPrev), comparisonText: comparisonLabel },
        { label: 'Qualified leads', value: qualified, deltaColor: qualRate > 20 ? 'green' : 'amber', comparisonText: comparisonLabel },
        { label: 'Converted leads', value: converted, comparisonText: comparisonLabel },
        { label: 'Qualification rate', value: formatPct(qualRate), comparisonText: comparisonLabel },
      ],
      metricsRowB: [
        { label: 'Total in pipeline', value: leads.length, comparisonText: comparisonLabel },
        { label: 'Inbound', value: sourceMap.Inbound, comparisonText: comparisonLabel },
        { label: 'Outreach sourced', value: sourceMap.Outreach, comparisonText: comparisonLabel },
        { label: 'Referrals', value: sourceMap.Referral, comparisonText: comparisonLabel },
      ],
      mainChart: keys.map((k) => ({ label: monthLabel(k), value: byMonth[k] || 0 })),
      breakdown: Object.entries(sourceMap).map(([label, value], i) => ({
        label,
        value,
        color: [DASHBOARD_COLORS.blue, DASHBOARD_COLORS.amber, DASHBOARD_COLORS.green, DASHBOARD_COLORS.red][i],
      })),
      donut: Object.entries(statusMap).slice(0, 4).map(([label, value], i) => ({
        label,
        value,
        color: [DASHBOARD_COLORS.green, DASHBOARD_COLORS.amber, DASHBOARD_COLORS.blue, DASHBOARD_COLORS.red][i],
      })),
      pills: Object.entries(sourceMap).map(([label, value], i) => ({
        label,
        value,
        color: [DASHBOARD_COLORS.blue, DASHBOARD_COLORS.amber, DASHBOARD_COLORS.green, DASHBOARD_COLORS.red][i],
      })),
      feed,
    };
  },

  async getCalendarStats(
    supabase: SupabaseClient,
    tenantId: string,
    period: MetricPeriodPreset = DEFAULT_PERIOD,
  ): Promise<OverviewStatsResponse> {
    const { startIso, endIso, comparisonLabel } = periodRange(period);
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000).toISOString();
    const events = await safeRows<{
      status?: string;
      start_time?: string;
      end_time?: string;
      created_at: string;
    }>(supabase, 'calendar_events', 'status, start_time, end_time, created_at', tenantId);

    const upcoming = events.filter((e) => e.start_time && e.start_time >= now.toISOString() && e.start_time <= in7).length;
    const inPeriodEvents = events.filter((e) => e.start_time && inPeriod(e.start_time, startIso, endIso));
    const completed = inPeriodEvents.filter((e) => e.status === 'completed' || (e.end_time && e.end_time < now.toISOString())).length;
    const scheduled = inPeriodEvents.length;

    const typeMap: Record<string, number> = { Scheduled: 0, Completed: 0, Cancelled: 0 };
    inPeriodEvents.forEach((e) => {
      const s = String(e.status || 'scheduled').toLowerCase();
      if (s === 'cancelled') typeMap.Cancelled++;
      else if (s === 'completed' || (e.end_time && e.end_time < now.toISOString())) typeMap.Completed++;
      else typeMap.Scheduled++;
    });

    const feed = await activityFeed(supabase, tenantId, ['meeting', 'calendar', 'event'], DASHBOARD_COLORS.indigo);

    return {
      metrics: [
        { label: 'Upcoming meetings', value: upcoming, comparisonText: comparisonLabel },
        { label: 'This period', value: scheduled, comparisonText: comparisonLabel },
        { label: 'Completed', value: completed, deltaColor: 'green', comparisonText: comparisonLabel },
        { label: 'Scheduled', value: scheduled, comparisonText: comparisonLabel },
      ],
      metricsRowB: [
        { label: 'Cancelled', value: typeMap.Cancelled, deltaColor: typeMap.Cancelled > 0 ? 'amber' : 'green', comparisonText: comparisonLabel },
        { label: 'Completion rate', value: formatPct(scheduled > 0 ? (completed / scheduled) * 100 : 0), comparisonText: comparisonLabel },
      ],
      mainChart: Object.entries(typeMap).map(([label, value]) => ({ label, value })),
      breakdown: Object.entries(typeMap).map(([label, value], i) => ({
        label,
        value,
        color: [DASHBOARD_COLORS.blue, DASHBOARD_COLORS.green, DASHBOARD_COLORS.red][i],
      })),
      donut: Object.entries(typeMap).map(([label, value], i) => ({
        label,
        value,
        color: [DASHBOARD_COLORS.blue, DASHBOARD_COLORS.green, DASHBOARD_COLORS.red][i],
      })),
      pills: Object.entries(typeMap).map(([label, value], i) => ({
        label,
        value,
        color: [DASHBOARD_COLORS.blue, DASHBOARD_COLORS.green, DASHBOARD_COLORS.red][i],
      })),
      feed,
    };
  },

  async getAccountingStats(
    supabase: SupabaseClient,
    tenantId: string,
    period: MetricPeriodPreset = DEFAULT_PERIOD,
  ): Promise<OverviewStatsResponse> {
    const { startIso, endIso, previousStartIso, previousEndIso, comparisonLabel } = periodRange(period);
    const [invoices, expenses] = await Promise.all([
      safeRows<{ total?: number; status?: string; created_at: string; paid_at?: string }>(
        supabase, 'business_invoices', 'total, status, created_at, paid_at', tenantId,
      ),
      safeRows<{ amount?: number; created_at: string }>(
        supabase, 'expenses', 'amount, created_at', tenantId,
      ),
    ]);

    const periodInvoices = invoices.filter((i) => inPeriod(i.created_at, startIso, endIso));
    const prevInvoices = invoices.filter((i) => inPeriod(i.created_at, previousStartIso, previousEndIso));
    const revenue = periodInvoices.reduce((s, i) => s + Number(i.total || 0), 0);
    const prevRevenue = prevInvoices.reduce((s, i) => s + Number(i.total || 0), 0);
    const collected = periodInvoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.total || 0), 0);
    const periodExpenses = expenses.filter((e) => inPeriod(e.created_at, startIso, endIso));
    const expenseTotal = periodExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const netCash = collected - expenseTotal;
    const overdue = invoices.filter((i) => i.status === 'overdue').length;
    const outstanding = invoices
      .filter((i) => ['sent', 'overdue', 'draft'].includes(String(i.status)))
      .reduce((s, i) => s + Number(i.total || 0), 0);

    const statusMap: Record<string, number> = { Paid: 0, Pending: 0, Overdue: 0, Draft: 0 };
    invoices.forEach((i) => {
      const s = String(i.status || 'draft').toLowerCase();
      if (s === 'paid') statusMap.Paid++;
      else if (s === 'overdue') statusMap.Overdue++;
      else if (s === 'sent') statusMap.Pending++;
      else statusMap.Draft++;
    });

    const keys = monthKeys(6);
    const revenueByMonth: Record<string, number> = {};
    keys.forEach((k) => { revenueByMonth[k] = 0; });
    invoices.filter((i) => i.status === 'paid' && i.paid_at).forEach((i) => {
      const k = i.paid_at!.slice(0, 7);
      if (revenueByMonth[k] !== undefined) revenueByMonth[k] += Number(i.total || 0);
    });

    const feed = await activityFeed(supabase, tenantId, ['invoice', 'expense', 'payment'], DASHBOARD_COLORS.green);

    return {
      metrics: [
        { label: 'Total revenue', value: formatMoney(revenue), ...formatDelta(revenue, prevRevenue), comparisonText: comparisonLabel },
        { label: 'Collected payments', value: formatMoney(collected), comparisonText: comparisonLabel },
        { label: 'Expenses', value: formatMoney(expenseTotal), deltaColor: 'amber', comparisonText: comparisonLabel },
        { label: 'Net cash flow', value: formatMoney(netCash), deltaColor: netCash >= 0 ? 'green' : 'red', comparisonText: comparisonLabel },
      ],
      metricsRowB: [
        { label: 'Outstanding balance', value: formatMoney(outstanding), deltaColor: outstanding > 0 ? 'amber' : 'green', comparisonText: comparisonLabel },
        { label: 'Overdue invoices', value: overdue, deltaColor: overdue > 0 ? 'red' : 'green', comparisonText: comparisonLabel },
      ],
      mainChart: keys.map((k) => ({ label: monthLabel(k), value: revenueByMonth[k] || 0 })),
      breakdown: Object.entries(statusMap).map(([label, value], i) => ({
        label,
        value,
        color: [DASHBOARD_COLORS.green, DASHBOARD_COLORS.amber, DASHBOARD_COLORS.red, DASHBOARD_COLORS.blue][i],
      })),
      donut: Object.entries(statusMap).map(([label, value], i) => ({
        label,
        value,
        color: [DASHBOARD_COLORS.green, DASHBOARD_COLORS.amber, DASHBOARD_COLORS.red, DASHBOARD_COLORS.blue][i],
      })),
      pills: [
        { label: 'Paid', value: statusMap.Paid, color: DASHBOARD_COLORS.green },
        { label: 'Pending', value: statusMap.Pending, color: DASHBOARD_COLORS.amber },
        { label: 'Overdue', value: statusMap.Overdue, color: DASHBOARD_COLORS.red },
      ],
      feed,
    };
  },

  async getCampaignsStats(
    supabase: SupabaseClient,
    tenantId: string,
    period: MetricPeriodPreset = DEFAULT_PERIOD,
  ): Promise<OverviewStatsResponse> {
    const { startIso, endIso, previousStartIso, previousEndIso, comparisonLabel } = periodRange(period);
    const [campaigns, outreach] = await Promise.all([
      safeRows<{ status?: string; created_at: string }>(supabase, 'email_campaigns', 'status, created_at', tenantId),
      safeRows<{ status?: string; created_at: string; opened_at?: string }>(
        supabase, 'lead_outreach_log', 'status, created_at, opened_at', tenantId,
        (q) => q.gte('created_at', startIso).lte('created_at', endIso),
      ),
    ]);

    const active = campaigns.filter((c) => ['active', 'sending', 'scheduled'].includes(String(c.status).toLowerCase())).length;
    const paused = campaigns.filter((c) => ['paused', 'draft'].includes(String(c.status).toLowerCase())).length;
    const emailsSent = outreach.length;
    const opened = outreach.filter((r) => r.opened_at || r.status === 'opened').length;
    const replied = outreach.filter((r) => r.status === 'replied' || r.status === 'reply').length;
    const openRate = emailsSent > 0 ? (opened / emailsSent) * 100 : 0;
    const replyRate = emailsSent > 0 ? (replied / emailsSent) * 100 : 0;

    const prevOutreach = await safeRows<{ created_at: string }>(
      supabase, 'lead_outreach_log', 'created_at', tenantId,
      (q) => q.gte('created_at', previousStartIso).lte('created_at', previousEndIso),
    );

    const statusMap: Record<string, number> = { Active: 0, Paused: 0, Completed: 0 };
    campaigns.forEach((c) => {
      const s = String(c.status || '').toLowerCase();
      if (['active', 'sending', 'scheduled'].includes(s)) statusMap.Active++;
      else if (['paused', 'draft'].includes(s)) statusMap.Paused++;
      else statusMap.Completed++;
    });

    const feed = await activityFeed(supabase, tenantId, ['campaign', 'email'], DASHBOARD_COLORS.amber);

    return {
      metrics: [
        { label: 'Active campaigns', value: active, comparisonText: comparisonLabel },
        { label: 'Messages sent', value: emailsSent, ...formatDelta(emailsSent, prevOutreach.length), comparisonText: comparisonLabel },
        { label: 'Open rate', value: formatPct(openRate), deltaColor: openRate > 20 ? 'green' : 'amber', comparisonText: comparisonLabel },
        { label: 'Reply rate', value: formatPct(replyRate), deltaColor: replyRate > 5 ? 'green' : 'amber', comparisonText: comparisonLabel },
      ],
      metricsRowB: [
        { label: 'Open rate', value: formatPct(openRate), deltaColor: openRate > 20 ? 'green' : 'amber', comparisonText: comparisonLabel },
        { label: 'Paused or failed campaigns', value: paused, comparisonText: comparisonLabel },
        { label: 'Replies', value: replied, comparisonText: comparisonLabel },
      ],
      mainChart: Object.entries(statusMap).map(([label, value]) => ({ label, value })),
      breakdown: Object.entries(statusMap).map(([label, value], i) => ({
        label,
        value,
        color: [DASHBOARD_COLORS.green, DASHBOARD_COLORS.amber, DASHBOARD_COLORS.blue][i],
      })),
      donut: Object.entries(statusMap).map(([label, value], i) => ({
        label,
        value,
        color: [DASHBOARD_COLORS.green, DASHBOARD_COLORS.amber, DASHBOARD_COLORS.blue][i],
      })),
      pills: [
        { label: 'Sent', value: emailsSent, color: DASHBOARD_COLORS.blue },
        { label: 'Opened', value: opened, color: DASHBOARD_COLORS.green },
        { label: 'Replied', value: replied, color: DASHBOARD_COLORS.teal },
      ],
      feed,
    };
  },
};
