'use client';

import {
  ArrowRight,
  Check,
  CircleDollarSign,
  FileCheck2,
  KanbanSquare,
  Mail,
  MessageSquareText,
  ShieldCheck,
  ListFilter,
  ClipboardCheck,
  Users,
  Video,
} from 'lucide-react';

type ProductSystemVisualProps = {
  product: string;
  slug: string;
  compact?: boolean;
};

const PRODUCT_DATA: Record<string, {
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
  icon: typeof Users;
  metrics: { label: string; value: string; detail: string }[];
  rows: { label: string; detail: string; status: string; tone: string }[];
}> = {
  crm: {
    eyebrow: 'Relationship workspace',
    title: 'Every lead, deal, and next action in one view.',
    subtitle: 'The record stays connected from first conversation to paid work.',
    accent: 'cyan',
    icon: Users,
    metrics: [
      { label: 'Open pipeline', value: '$42.8k', detail: '+18% this month' },
      { label: 'Follow-ups due', value: '12', detail: '4 need attention' },
      { label: 'Active customers', value: '38', detail: '92% healthy' },
    ],
    rows: [
      { label: 'Northstar Studio', detail: 'Proposal sent · follow-up tomorrow', status: 'In motion', tone: 'cyan' },
      { label: 'Mosaic Health', detail: 'Discovery call · owner: Alex', status: 'Review', tone: 'amber' },
      { label: 'Lumen Works', detail: 'Won deal · project ready to open', status: 'Ready', tone: 'green' },
    ],
  },
  'lead-management': {
    eyebrow: 'Lead intake and routing',
    title: 'A clear queue from interest to action.',
    subtitle: 'Capture, qualify, assign, and follow up without losing the source context.',
    accent: 'violet',
    icon: ListFilter,
    metrics: [
      { label: 'New this week', value: '47', detail: 'Across 4 sources' },
      { label: 'Needs review', value: '09', detail: 'Prioritised by fit' },
      { label: 'Conversion rate', value: '28%', detail: '+6% this month' },
    ],
    rows: [
      { label: 'Inbound form · Atlas Co.', detail: 'Qualified · budget confirmed', status: 'Assign', tone: 'violet' },
      { label: 'LinkedIn · Mira Chen', detail: 'Reply received · next action drafted', status: 'Follow up', tone: 'cyan' },
      { label: 'Referral · Paloma Labs', detail: 'Needs qualification call', status: 'New', tone: 'amber' },
    ],
  },
  'project-management': {
    eyebrow: 'Client delivery workspace',
    title: 'Delivery starts with the promise you made.',
    subtitle: 'Projects inherit the client, scope, owners, and next milestones from the deal.',
    accent: 'green',
    icon: KanbanSquare,
    metrics: [
      { label: 'Active projects', value: '08', detail: '3 due this week' },
      { label: 'Milestones on track', value: '91%', detail: 'Across all clients' },
      { label: 'Client updates', value: '06', detail: 'Ready to share' },
    ],
    rows: [
      { label: 'Northstar brand sprint', detail: 'Milestone 2 of 4 · 72% complete', status: 'On track', tone: 'green' },
      { label: 'Mosaic onboarding', detail: 'Client review due Friday', status: 'Due soon', tone: 'amber' },
      { label: 'Lumen website launch', detail: 'Scope and billing linked', status: 'Connected', tone: 'cyan' },
    ],
  },
  'ai-agents': {
    eyebrow: 'Bonnie execution desk',
    title: 'Useful AI work with a visible approval trail.',
    subtitle: 'Bonnie prepares the next action, shows its context, and waits for your approval.',
    accent: 'amber',
    icon: ClipboardCheck,
    metrics: [
      { label: 'Drafts prepared', value: '24', detail: 'This week' },
      { label: 'Awaiting approval', value: '05', detail: 'No external sends' },
      { label: 'Actions verified', value: '97%', detail: 'With an activity record' },
    ],
    rows: [
      { label: 'Prepare follow-up sequence', detail: '3 contacts · source and fit attached', status: 'Approve', tone: 'amber' },
      { label: 'Summarise client call', detail: 'Notes, decisions, and tasks ready', status: 'Ready', tone: 'green' },
      { label: 'Create project tasks', detail: 'Based on the signed scope', status: 'Proposed', tone: 'violet' },
    ],
  },
  'video-meetings': {
    eyebrow: 'Meetings and follow-through',
    title: 'The call, notes, and next step stay together.',
    subtitle: 'Meet from the client context and leave the relationship more organised than before.',
    accent: 'cyan',
    icon: Video,
    metrics: [
      { label: 'Upcoming meetings', value: '07', detail: 'Next 7 days' },
      { label: 'Notes captured', value: '19', detail: 'This month' },
      { label: 'Tasks created', value: '31', detail: 'From meeting outcomes' },
    ],
    rows: [
      { label: 'Mosaic Health · discovery', detail: 'Today · 14:00 · notes attached', status: 'Join', tone: 'cyan' },
      { label: 'Northstar Studio · review', detail: 'Tomorrow · agenda shared', status: 'Prepared', tone: 'green' },
      { label: 'Lumen Works · handoff', detail: 'Friday · project context linked', status: 'Ready', tone: 'violet' },
    ],
  },
};

const TONE: Record<string, string> = {
  cyan: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100',
  violet: 'border-violet-300/25 bg-violet-300/10 text-violet-100',
  green: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100',
  amber: 'border-amber-300/25 bg-amber-300/10 text-amber-100',
};

export default function ProductSystemVisual({ product, slug, compact = false }: ProductSystemVisualProps) {
  const data = PRODUCT_DATA[slug] ?? PRODUCT_DATA.crm;
  const Icon = data.icon;
  const metrics = compact ? data.metrics.slice(0, 2) : data.metrics;
  const rows = compact ? data.rows.slice(0, 2) : data.rows;

  return (
    <div className="relative overflow-hidden rounded-[1.35rem] border border-white/15 bg-[#071426] p-2 shadow-[0_30px_100px_-44px_rgba(34,211,238,.7)] sm:p-3">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-300/10 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0a182d]">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5 sm:px-4">
          <div className="flex items-center gap-2.5">
            <div className={`grid h-7 w-7 place-items-center rounded-lg border ${TONE[data.accent]}`}><Icon className="h-3.5 w-3.5" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">AlphaClone / {product}</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-200">{data.eyebrow}</p>
            </div>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-bold text-emerald-200 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Live workspace</span>
        </div>
        <div className="grid lg:grid-cols-[.82fr_1.18fr]">
          <aside className="hidden border-r border-white/10 bg-[#081326] p-4 lg:block">
            <p className="text-[9px] font-black uppercase tracking-[.18em] text-slate-500">Workspace map</p>
            <div className="mt-4 space-y-1.5 text-[11px]">
              {['Overview', product, 'Tasks', 'Activity', 'Connections'].map((item, index) => (
                <div key={item} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${index === 1 ? 'border border-cyan-300/20 bg-cyan-300/10 font-bold text-cyan-100' : 'text-slate-400'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${index === 1 ? 'bg-cyan-300' : 'bg-slate-700'}`} />{item}
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-xl border border-white/10 bg-white/[.03] p-3">
              <p className="text-[9px] font-black uppercase tracking-[.16em] text-slate-500">Connected context</p>
              <div className="mt-3 space-y-2 text-[10px] text-slate-300">
                <span className="flex items-center gap-2"><Mail className="h-3 w-3 text-cyan-300" /> Email</span>
                <span className="flex items-center gap-2"><FileCheck2 className="h-3 w-3 text-emerald-300" /> Contracts</span>
                <span className="flex items-center gap-2"><CircleDollarSign className="h-3 w-3 text-amber-300" /> Billing</span>
              </div>
            </div>
          </aside>
          <section className="p-4 sm:p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-300">{data.eyebrow}</p>
                <h3 className="mt-2 max-w-lg text-base font-bold leading-tight text-white sm:text-xl">{data.title}</h3>
                <p className="mt-1.5 max-w-xl text-[11px] leading-5 text-slate-400">{data.subtitle}</p>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] px-2.5 py-2 text-[10px] font-semibold text-slate-300"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Context verified</span>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {metrics.map((metric) => <div key={metric.label} className="rounded-xl border border-white/10 bg-[#071426] p-3"><p className="text-[10px] text-slate-500">{metric.label}</p><p className="mt-1 text-lg font-bold text-white">{metric.value}</p><p className="mt-0.5 text-[10px] text-emerald-300">{metric.detail}</p></div>)}
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-[#071426] p-3">
              <div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">Next actions</p><p className="mt-1 text-xs font-semibold text-white">Work that is ready to move</p></div><MessageSquareText className="h-4 w-4 text-cyan-300" /></div>
              <div className="mt-3 space-y-2">{rows.map((row) => <div key={row.label} className="flex items-center gap-3 rounded-lg border border-white/[.07] bg-white/[.025] px-3 py-2.5"><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-slate-200">{row.label}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{row.detail}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold ${TONE[row.tone]}`}>{row.status}</span><ArrowRight className="hidden h-3.5 w-3.5 text-slate-600 sm:block" /></div>)}</div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500"><Check className="h-3.5 w-3.5 text-emerald-300" /> Human review stays in the workflow before external action.</div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function ProductFlowRail() {
  return <div className="grid gap-2 sm:grid-cols-4">
    {[['01', 'Capture', 'The request or record enters the workspace.'], ['02', 'Context', 'AlphaClone resolves the right client and history.'], ['03', 'Approve', 'A person reviews consequential external actions.'], ['04', 'Verify', 'The result is checked and recorded.']].map(([step, title, body]) => <div key={step} className="rounded-xl border border-white/10 bg-white/[.03] p-3"><span className="text-[10px] font-black tracking-[.16em] text-cyan-300">{step}</span><p className="mt-2 text-xs font-bold text-white">{title}</p><p className="mt-1 text-[10px] leading-4 text-slate-400">{body}</p></div>)}
  </div>;
}

export function ProductOutcomeStrip({ product }: { product: string }) {
  return <div className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-300/[.05] px-3 py-2.5 text-[10px] font-semibold text-slate-300 sm:px-4"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /><span>{product} is connected to the same approval, execution, and verification trail as the rest of the workspace.</span></div>;
}
