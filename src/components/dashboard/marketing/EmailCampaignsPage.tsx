'use client';

import React, { useEffect, useMemo, useState } from 'react';
import CampaignBuilderShell from '@/components/dashboard/business/CampaignBuilder';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ModuleOverviewChrome } from '@/components/ui/os/ModuleOverviewChrome';
import {
  Sparkles, Users, Clock, Target, Eye, Send, CheckCircle2,
  PlayCircle, AlertTriangle, FileText, Languages, Repeat, Star,
  Shield, TrendingUp, Zap, ChevronRight, ChevronLeft, Rocket, Brain,
  HandCoins, MessageSquareHeart, Bot, Award, PieChart, Plus,
} from 'lucide-react';

interface EmailCampaignsPageProps {
  userId: string;
}

type CampaignListEntry = {
  id: string;
  name: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'queued' | 'sending' | 'sent' | 'paused' | 'cancelled';
  recipients: number;
  opened: number;
  clicked: number;
  replied: number;
  updatedAt: string;
  createdAt: string;
  startedAt?: string | null;
  scheduledAt?: string | null;
  sentAt?: string | null;
};

const statusLabel: Record<CampaignListEntry['status'], string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  queued: 'Almost ready',
  sending: 'Sending now',
  sent: 'Sent ✅',
  paused: 'Paused',
  cancelled: 'Cancelled',
};

const statusTone: Record<CampaignListEntry['status'], string> = {
  draft: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  scheduled: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  queued: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  sending: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  sent: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  paused: 'bg-slate-600/15 text-slate-400 border-slate-600/30',
  cancelled: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

type WizardStep = {
  id: number;
  title: string;
  subtitle: string;
  Icon: typeof Sparkles;
  tone: string;
  zeroTech: string;
  doneWhen: string;
};

const WIZARD_STEPS: WizardStep[] = [
  { id: 1,  title: 'Goal picker',  subtitle: 'Why are you sending this email?', Icon: Target, tone: 'text-violet-300', zeroTech: 'No marketing words. Pick: "tell people something", "get a reply", or "sell a simple thing".', doneWhen: 'You can say in one sentence what this email should make happen.' },
  { id: 2,  title: 'Name it',       subtitle: 'Give the campaign a short label.', Icon: FileText, tone: 'text-sky-300',    zeroTech: 'This is only for you (customers never see it). Example: "April welcome follow-up".', doneWhen: 'You can find it in a list 30 days from now without guessing.' },
  { id: 3,  title: 'Who gets it',   subtitle: 'Pick exactly who should receive it.',   Icon: Users,     tone: 'text-emerald-300',zeroTech: 'Use a saved group, or pick people one by one. When in doubt, send to fewer people first.', doneWhen: 'List shows less than 1000 people, and you know why each person is on it.' },
  { id: 4,  title: 'Quick-start template', subtitle: 'Start from a human-written pattern.', Icon: Rocket, tone: 'text-fuchsia-300', zeroTech: 'Pick Update, Follow-up, Welcome back, or Blank. Never stare at a blank page.', doneWhen: 'You picked a starting template, not an empty box.' },
  { id: 5,  title: 'Write like a person', subtitle: 'One short paragraph from you is all you need.', Icon: MessageSquareHeart, tone: 'text-amber-300', zeroTech: 'Write exactly how you would write a real colleague. AI will make it longer, but the voice should be yours.', doneWhen: 'A friend would read it and say, "this sounds like you."' },
  { id: 6,  title: 'Minimum 100-word rule', subtitle: 'AI always expands to 100+ words.', Icon: Brain, tone: 'text-indigo-300', zeroTech: 'Short messages get ignored. The AI button makes it thorough without extra work.', doneWhen: 'Word counter says 100+ words, and you did not have to do the typing.' },
  { id: 7,  title: 'Subject line', subtitle: 'Write 3 short options, AI picks the best.', Icon: Star,   tone: 'text-teal-300', zeroTech: 'No "clever marketing". Tell them what is inside. Example: "Re: next step for Acme".', doneWhen: 'You have 3 short subjects, none of them use ALL CAPS or emojis.' },
  { id: 8,  title: 'Translation/language', subtitle: 'Send in the language they speak.', Icon: Languages, tone: 'text-orange-300', zeroTech: 'Write in English first, then press "Translate". It stays human, not robotic.', doneWhen: 'Preview matches the country/industry for the people on the list.' },
  { id: 9,  title: 'When to send', subtitle: 'Tuesday/Wednesday mornings are safest.', Icon: Clock,  tone: 'text-rose-300', zeroTech: '"Send now" or "next Tuesday 10am" — the system picks the best hour for each person automatically.', doneWhen: 'You picked Send Now OR a future date/time after 9am before 3pm local time.' },
  { id: 10, title: '3-day follow-up (auto)', subtitle: 'People are busy. Remind them once.', Icon: Repeat, tone: 'text-violet-300', zeroTech: 'Turn ON: short friendly "just making sure you saw this" after 3 days if no reply. NOT spam, one follow-up max.', doneWhen: 'Auto-follow-up switch is ON with "just checking in" selected, or you intentionally turned it OFF.' },
  { id: 11, title: 'Proofread + preview', subtitle: 'Send a test copy to yourself first.', Icon: Eye, tone: 'text-sky-300', zeroTech: 'Every campaign. Open the email on your phone. If it looks weird, fix it before real people see it.', doneWhen: 'You clicked "Send test to me" and the email looks clean in your inbox / phone.' },
  { id: 12, title: 'Personalization (just first name)', subtitle: 'Adds a human touch, nothing creepy.', Icon: Award, tone: 'text-emerald-300', zeroTech: 'Use "Hi {{firstName}}" — nothing more. More looks salesy, this just looks friendly.', doneWhen: 'First name is the only dynamic field; preview shows your name correctly when testing.' },
  { id: 13, title: 'Unsubscribe + spam safety', subtitle: 'One click to leave — required by law.', Icon: Shield, tone: 'text-red-300',   zeroTech: 'Always leave the unsubscribe link. It protects your account and builds trust. You do not have to do anything here, it is already on.', doneWhen: 'Unsubscribe link is ON and visible in the test preview at the bottom.' },
  { id: 14, title: 'Send to 10 real people first', subtitle: 'Small batch = no surprises.', Icon: TrendingUp, tone: 'text-fuchsia-300', zeroTech: '10 actual customers or warm leads. Wait 24 hours. If nobody unsubscribed or complained, continue.', doneWhen: 'First 10-person batch has been sent, 24h passed, 0 complaints/unsubs, 0 bounces.' },
  { id: 15, title: 'Launch to everyone', subtitle: 'Send or schedule the full list.', Icon: PlayCircle, tone: 'text-teal-300', zeroTech: 'Once the 10-person test looks great, press launch. If it is a big list, the system spreads it out over time automatically.', doneWhen: 'You pressed Launch, and the status bar shows "Sending".' },
  { id: 16, title: 'Read what they wrote back', subtitle: 'Replies show up in the Outreach Reach Inbox.', Icon: Send, tone: 'text-emerald-300', zeroTech: 'Replies thread automatically by person so you never lose context. Click "Replied" on the left sidebar in Outreach to answer them.', doneWhen: 'Every positive reply gets answered within 24 hours or moved to a Next-Step task.' },
];

export default function EmailCampaignsPage({ userId }: EmailCampaignsPageProps) {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [completed, setCompleted] = useState<Set<number>>(new Set([1]));
  const [openDraft, setOpenDraft] = useState<boolean>(false);
  const [mockList, setMockList] = useState<CampaignListEntry[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setMockList([
        { id: 'm1', name: 'Spring product update', subject: 'A quick update from the team', status: 'sent', recipients: 342, opened: 161, clicked: 38, replied: 14, updatedAt: '2026-07-22T10:12:00Z', createdAt: '2026-07-19T09:00:00Z', sentAt: '2026-07-22T14:00:00Z' },
        { id: 'm2', name: 'Welcome follow-up sequence', subject: 'Day 3 — one clear next step', status: 'sending', recipients: 118, opened: 29, clicked: 9, replied: 6, updatedAt: new Date(Date.now() - 45*60_000).toISOString(), createdAt: '2026-08-05T12:00:00Z', startedAt: new Date(Date.now() - 2*3600_000).toISOString() },
        { id: 'm3', name: 'Re-engage warm leads', subject: 'Still exploring better workflows?', status: 'scheduled', recipients: 89, opened: 0, clicked: 0, replied: 0, updatedAt: new Date(Date.now() - 5*3600_000).toISOString(), createdAt: '2026-08-09T10:30:00Z', scheduledAt: new Date(Date.now() + 30*3600_000).toISOString() },
        { id: 'm4', name: 'Founder onboarding intro', subject: 'Welcome aboard ✨', status: 'draft', recipients: 0, opened: 0, clicked: 0, replied: 0, updatedAt: new Date(Date.now() - 20*60_000).toISOString(), createdAt: new Date(Date.now() - 24*3600_000).toISOString() },
      ]);
    }, 350);
    return () => clearTimeout(t);
  }, []);

  const selected = useMemo(() => mockList?.find(m => m.id === selectedId) || null, [mockList, selectedId]);

  const mark = (step: number, val: boolean) => {
    setCompleted(c => {
      const n = new Set(c);
      if (val) n.add(step); else n.delete(step);
      return n;
    });
  };

  const progress = Math.min(100, Math.round((completed.size / WIZARD_STEPS.length) * 100));

  return (
    <ModuleOverviewChrome moduleId="outreach" activeHref="/dashboard/business/campaigns">
      <div className="rounded-2xl border border-white/10 bg-[#0c1015]/60 overflow-hidden shadow-[0_8px_40px_-24px_rgba(0,0,0,0.5)]">
        {/* Hero / zero-tech header */}
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-fuchsia-500/30 via-violet-500/30 to-sky-500/30 border border-white/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-fuchsia-300" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">Campaign builder — zero-tech, 16 guided steps</p>
              <p className="text-[11px] text-slate-400 truncate">Pick who, write like you, ship. No marketing degree or coding required.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-slate-950/60">
              <span className="text-[11px] text-slate-400">Progress</span>
              <div className="w-32 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-emerald-400 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <Badge variant="outline" className="border-white/10 text-slate-200 h-5 text-[10px] px-1.5 py-0">
                {completed.size}/{WIZARD_STEPS.length}
              </Badge>
            </div>
            <Button
              size="sm"
              onClick={() => { setOpenDraft(true); }}
              className="h-8 px-3 rounded-lg bg-gradient-to-r from-violet-500 via-fuchsia-500 to-emerald-400 text-white text-xs font-black shadow-lg shadow-fuchsia-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              New campaign
            </Button>
          </div>
        </header>

        {/* 3-panel Gmail-style layout */}
        <div className="grid grid-cols-12 min-h-[74vh] divide-x divide-white/5">
          {/* PANEL 1: Wizard Steps 1-16 (zero-tech plain English) */}
          <aside className="col-span-5 xl:col-span-3 bg-slate-950/30 overflow-y-auto">
            <div className="px-2 pt-3 pb-4">
              <div className="px-2 pb-2 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">16-step wizard</p>
                <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-300 text-[10px] px-1.5 py-0 h-4">
                  <Bot className="w-3 h-3 mr-1" />
                  AI guides you
                </Badge>
              </div>
              <ol className="space-y-1">
                {WIZARD_STEPS.map((step, idx) => {
                  const isActive = activeStep === step.id;
                  const isDone = completed.has(step.id);
                  const { Icon } = step;
                  return (
                    <li key={step.id}>
                      <button
                        onClick={() => { setActiveStep(step.id); }}
                        className={[
                          'w-full text-left rounded-lg px-2 py-2 border transition-colors',
                          isActive
                            ? 'bg-white/10 border-white/10'
                            : isDone
                              ? 'bg-emerald-500/[0.05] border-transparent hover:bg-white/5'
                              : 'bg-transparent border-transparent hover:bg-white/5',
                        ].join(' ')}
                      >
                        <div className="flex items-start gap-2">
                          <div className="shrink-0 pt-0.5">
                            {isDone ? (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" />
                              </span>
                            ) : (
                              <span className={[
                                'inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-black',
                                isActive ? 'bg-violet-500/20 border-violet-500/40 text-violet-200' : 'bg-slate-900/80 border-white/5 text-slate-400',
                              ].join(' ')}>
                                {String(idx + 1)}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Icon className={`w-3.5 h-3.5 shrink-0 ${step.tone}`} />
                              <p className={`text-xs font-semibold truncate ${isActive || isDone ? 'text-white' : 'text-slate-300'}`}>
                                {step.title}
                              </p>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-snug mt-0.5 line-clamp-2">
                              {step.subtitle}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>

          {/* PANEL 2: Campaigns list / Middle pane (like Gmail threads list) */}
          <section className="col-span-7 xl:col-span-4 border-r border-white/5 bg-slate-950/10 flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-white/5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Your campaigns</p>
                <Badge variant="outline" className="border-white/5 text-slate-400 text-[10px] px-1.5 py-0 h-4">
                  {mockList ? `${mockList.length} total` : 'Loading…'}
                </Badge>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {mockList === null ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-lg border border-white/5 bg-slate-900/40 animate-[pulse_1.6s_ease-in-out_infinite] backdrop-blur-sm saturate-50 opacity-60" />
                  ))}
                </div>
              ) : mockList.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <div className="mx-auto h-12 w-12 rounded-2xl border border-dashed border-white/10 bg-gradient-to-br from-fuchsia-500/10 to-sky-500/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-fuchsia-300" />
                  </div>
                  <p className="text-sm font-semibold text-white">No campaigns yet</p>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                    Use the 16-step wizard on the left. Start with <span className="text-fuchsia-300">Step 1: Goal picker</span> — it is designed so you can do your first campaign without knowing any marketing words.
                  </p>
                </div>
              ) : (
                <ul>
                  {mockList.map(c => {
                    const active = selectedId === c.id;
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => { setSelectedId(c.id); setOpenDraft(true); }}
                          className={[
                            'w-full text-left px-3 py-3 border-b border-white/5 transition-colors',
                            active ? 'bg-white/10' : 'hover:bg-white/5',
                          ].join(' ')}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="min-w-0 flex items-center gap-1.5">
                              <Eye className="w-3 h-3 text-slate-500 shrink-0" />
                              <p className={`text-xs font-semibold truncate ${active ? 'text-white' : 'text-slate-200'}`}>
                                {c.name}
                              </p>
                            </div>
                            <Badge variant="outline" className={statusTone[c.status] + ' text-[10px] px-1.5 h-4 py-0'}>
                              {statusLabel[c.status]}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">{c.subject}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800/70 text-slate-300">{c.recipients} people</span>
                            {c.opened > 0 && <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300">{c.opened} opened</span>}
                            {c.clicked > 0 && <span className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300">{c.clicked} clicked</span>}
                            {c.replied > 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">{c.replied} replied</span>}
                            {c.status === 'scheduled' && c.scheduledAt ? (
                              <span className="ml-auto px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 tabular-nums">
                                <Clock className="w-3 h-3 inline mr-0.5 align-[-1px]" />
                                {new Date(c.scheduledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            ) : c.status === 'sent' && c.sentAt ? (
                              <span className="ml-auto px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 tabular-nums">
                                <CheckCircle2 className="w-3 h-3 inline mr-0.5 align-[-1px]" />
                                {new Date(c.sentAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {/* Quick-starts (mini-cards) */}
            <div className="border-t border-white/5 bg-slate-950/30 px-3 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Start instantly — three patterns</p>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { Icon: MegaphoneFallback, label: 'Share an update', bg: 'from-sky-500/20 to-cyan-500/10', tone: 'text-sky-300 border-sky-500/30' },
                  { Icon: HandCoins, label: 'Follow up warm leads', bg: 'from-violet-500/20 to-fuchsia-500/10', tone: 'text-violet-300 border-violet-500/30' },
                  { Icon: Repeat, label: 'Welcome people back', bg: 'from-emerald-500/20 to-teal-500/10', tone: 'text-emerald-300 border-emerald-500/30' },
                ].map(q => {
                  const { Icon } = q;
                  return (
                    <button
                      key={q.label}
                      onClick={() => { setActiveStep(4); setOpenDraft(true); mark(1, true); mark(2, true); mark(3, true); mark(4, true); }}
                      className={`rounded-xl border bg-gradient-to-br ${q.bg} ${q.tone} p-2.5 text-left hover:brightness-110 transition`}
                    >
                      <Icon className="w-3.5 h-3.5 mb-1.5" />
                      <p className="text-[11px] font-bold leading-tight text-slate-100">{q.label}</p>
                      <p className="text-[9.5px] text-slate-400/90 leading-tight mt-0.5">Click to open builder →</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* PANEL 3: Detail / Preview / Live Builder */}
          <section className="col-span-12 xl:col-span-5 bg-slate-950/20 flex flex-col min-h-0">
            {!openDraft ? (
              <div className="flex-1 p-4 overflow-y-auto">
                {/* Active step card */}
                {(() => {
                  const step = WIZARD_STEPS.find(s => s.id === activeStep) || WIZARD_STEPS[0];
                  const StepIcon = step.Icon;
                  const isDone = completed.has(step.id);
                  return (
                    <div className="max-w-md mx-auto space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-5 shadow-xl shadow-black/40">
                        <div className="flex items-start gap-3 mb-3">
                          <div className={`h-11 w-11 rounded-xl border border-white/10 flex items-center justify-center bg-gradient-to-br from-white/5 to-transparent ${step.tone}`}>
                            <StepIcon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <Badge variant="outline" className="border-white/10 text-slate-400 text-[10px] px-1.5 h-4 mb-1">
                              Step {step.id} of {WIZARD_STEPS.length}
                            </Badge>
                            <h3 className="text-base font-black text-white leading-snug">{step.title}</h3>
                            <p className="text-xs text-slate-300 mt-0.5">{step.subtitle}</p>
                          </div>
                        </div>
                        <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/60 p-3 mb-3">
                          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">In plain English</p>
                          <p className="text-[13px] text-slate-200 leading-relaxed">{step.zeroTech}</p>
                        </div>
                        <div className="rounded-xl border border-white/5 bg-emerald-500/[0.04] p-3 mb-4">
                          <p className="text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Done when this is true:
                          </p>
                          <p className="text-xs text-emerald-200/90 leading-relaxed">{step.doneWhen}</p>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setActiveStep(a => Math.max(1, a - 1))}
                              disabled={step.id <= 1}
                              className="h-8 px-2.5 rounded-lg border border-white/10 text-slate-300 hover:text-white text-xs disabled:opacity-40"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              Prev
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setActiveStep(a => Math.min(WIZARD_STEPS.length, a + 1))}
                              disabled={step.id >= WIZARD_STEPS.length}
                              className="h-8 px-2.5 rounded-lg border border-white/10 text-slate-300 hover:text-white text-xs disabled:opacity-40"
                            >
                              Next
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant={isDone ? 'outline' : 'ghost'}
                              onClick={() => mark(step.id, !isDone)}
                              className={[
                                'h-8 px-3 rounded-lg text-xs',
                                isDone
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:text-emerald-200'
                                  : 'border border-white/10 text-slate-300 hover:text-white',
                              ].join(' ')}
                            >
                              {isDone ? (<><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Marked done</>) : (<>Mark done</>)}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => { setOpenDraft(true); mark(step.id, true); }}
                              className="h-8 px-3 rounded-lg text-xs font-black bg-gradient-to-r from-fuchsia-500 via-violet-500 to-sky-500 text-white shadow-lg shadow-fuchsia-500/15"
                            >
                              <Sparkles className="w-3.5 h-3.5 mr-1" />
                              Open builder →
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Selected campaign summary */}
                      {selected ? (
                        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-wider text-slate-500">Selected campaign</p>
                              <p className="text-sm font-black text-white truncate">{selected.name}</p>
                            </div>
                            <Badge variant="outline" className={statusTone[selected.status] + ' text-[10px] px-1.5 py-0 h-4'}>
                              {statusLabel[selected.status]}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5 text-center">
                            <div className="rounded-lg bg-slate-900/70 border border-white/5 p-2">
                              <p className="text-[9px] uppercase tracking-widest text-slate-500">Sent</p>
                              <p className="text-[13px] font-black text-slate-200 tabular-nums">{selected.recipients}</p>
                            </div>
                            <div className="rounded-lg bg-slate-900/70 border border-white/5 p-2">
                              <p className="text-[9px] uppercase tracking-widest text-sky-400">Open</p>
                              <p className="text-[13px] font-black text-sky-300 tabular-nums">{selected.opened}</p>
                            </div>
                            <div className="rounded-lg bg-slate-900/70 border border-white/5 p-2">
                              <p className="text-[9px] uppercase tracking-widest text-violet-400">Click</p>
                              <p className="text-[13px] font-black text-violet-300 tabular-nums">{selected.clicked}</p>
                            </div>
                            <div className="rounded-lg bg-slate-900/70 border border-white/5 p-2">
                              <p className="text-[9px] uppercase tracking-widest text-emerald-400">Reply</p>
                              <p className="text-[13px] font-black text-emerald-300 tabular-nums">{selected.replied}</p>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-300 text-[10px] px-1.5 h-4">
                      <Bot className="w-3 h-3 mr-1" />
                      Live composer
                    </Badge>
                    <p className="text-xs text-slate-300 truncate">
                      {selected ? `Editing: ${selected.name}` : 'New campaign draft — 16-step wizard is guiding you'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setOpenDraft(false)}
                    className="h-8 w-8 p-0 rounded-lg border border-white/10 text-slate-400 hover:text-white"
                  >
                    <ChevronRight className="w-4 h-4 -rotate-45" />
                  </Button>
                </div>
                <div className="min-h-0 flex-1 bg-white/0">
                  <CampaignBuilderShell userId={userId} />
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Footer progress bar + reassurance */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 bg-slate-950/30 px-4 py-2.5">
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-emerald-400" />
            Every campaign: unsubscribe ON · 1 follow-up MAX · 10-person small-batch test recommended before full launch.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setActiveStep(1)} className="h-8 px-3 rounded-lg border border-white/10 text-slate-300 hover:text-white text-xs">
              <PieChart className="w-3.5 h-3.5 mr-1" />
              Restart wizard
            </Button>
            <Button size="sm" onClick={() => { setOpenDraft(true); WIZARD_STEPS.forEach(s => mark(s.id, true)); }} className="h-8 px-3 rounded-lg text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/15">
              <Rocket className="w-3.5 h-3.5 mr-1" />
              Open full builder
            </Button>
          </div>
        </footer>
      </div>
    </ModuleOverviewChrome>
  );
}

const MegaphoneFallback = (p: { className?: string }) => <AlertTriangle {...p} />;
