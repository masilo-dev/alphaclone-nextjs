'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Search, Send, ChevronRight, Users, PlaySquare, Inbox,
  MailCheck, MailWarning, Mail, MailX, Reply, Archive, Star,
  MoreHorizontal, Filter, RefreshCcw, Loader2, Sparkles, AlertTriangle,
  CheckCircle2, Target, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ModuleOverviewChrome } from '@/components/ui/os/ModuleOverviewChrome';
import { normalizeDeliveryProvider, resolveAutoProvider, type DeliveryEmailProvider } from '@/lib/email/emailProviderOptions';

type OutreachListKey =
  | 'all_people'
  | 'active_sequences'
  | 'replied'
  | 'opened'
  | 'bounced'
  | 'needs_followup';

const OUTREACH_LISTS: Array<{
  id: OutreachListKey; label: string; Icon: typeof Mail; tone: string;
  description: string;
}> = [
  { id: 'all_people', label: 'People reached', Icon: Users, tone: 'text-slate-200', description: 'Everyone we have sent an outreach message to' },
  { id: 'active_sequences', label: 'Active in sequences', Icon: PlaySquare, tone: 'text-violet-400', description: 'Currently enrolled in an automated follow-up plan' },
  { id: 'replied', label: 'Replied', Icon: Reply, tone: 'text-emerald-400', description: 'Contacts who wrote back — time for a human response' },
  { id: 'opened', label: 'Opened, no reply', Icon: MailCheck, tone: 'text-sky-400', description: 'Read the message but have not responded yet' },
  { id: 'bounced', label: 'Bounced / bad emails', Icon: MailWarning, tone: 'text-amber-400', description: 'Failed delivery — needs a new address or correction' },
  { id: 'needs_followup', label: 'Needs next step', Icon: Target, tone: 'text-fuchsia-400', description: 'Replied and classified positive; proposal/demo next' },
];

type OutreachEvent = {
  id: string;
  tenant_id: string;
  sequence_id: string | null;
  campaign_id: string | null;
  contact_id: string | null;
  lead_id: string | null;
  channel: string;
  event_type: string;
  provider: string | null;
  variant: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  created_at: string;
};

type LeadOutreachLog = {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  lead_id?: string | null;
  lead_name?: string | null;
  lead_email?: string | null;
  subject?: string | null;
  body_html?: string | null;
  status?: string | null;
  provider?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ReachThread = {
  threadKey: string;
  normalizedRecipient: string;
  displayName: string;
  email: string | null;
  contactId: string | null;
  leadId: string | null;
  sequenceIds: Set<string>;
  campaignIds: Set<string>;
  channelSet: Set<string>;
  events: OutreachEvent[];
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  repliedCount: number;
  bouncedCount: number;
  complainedCount: number;
  lastActivityAt: string;
  lastOutboundAt: string | null;
  lastReplyAt: string | null;
  classification: 'cold' | 'responding' | 'bounced' | 'warm' | 'positive' | 'unsubscribed';
  needsFollowUp: boolean;
};

const SENT_TYPES = new Set(['sent', 'delivered']);
const OPEN_TYPES = new Set(['open', 'opened', 'viewed']);
const CLICK_TYPES = new Set(['click', 'clicked', 'link_click']);
const REPLY_TYPES = new Set(['reply', 'replied', 'inbound_reply', 'inbound']);
const BOUNCE_TYPES = new Set(['bounce', 'bounced', 'soft_bounce', 'hard_bounce', 'dropped']);
const COMPLAINT_TYPES = new Set(['complaint', 'spam', 'reported_spam']);
const UNSUB_TYPES = new Set(['unsubscribe', 'unsubscribed', 'opt_out']);
const POSITIVE_CLASS = new Set(['interested', 'positive', 'booking', 'demo_requested', 'meeting_requested', 'reply_interested', 'hot', 'warm_lead']);

function normalizeEmail(raw: unknown): string | null {
  const s = String(raw || '').trim().toLowerCase();
  return s.includes('@') ? s : null;
}

function htmlToReadableText(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildThreads(events: OutreachEvent[]): ReachThread[] {
  const map = new Map<string, ReachThread>();
  for (const e of events) {
    const md = (e.metadata || {}) as Record<string, unknown>;
    const explicit = md.normalized_recipient || md.email || md.to || md.recipient;
    const fromReply = md.sender ? normalizeEmail(md.sender) : null;
    let email = normalizeEmail(explicit) || fromReply;
    if (!email && md.enrollment_id) email = `enroll:${String(md.enrollment_id)}`;
    if (!email && e.lead_id) email = `lead:${e.lead_id}`;
    if (!email && e.contact_id) email = `contact:${e.contact_id}`;
    if (!email) email = `ev:${e.id}`;

    const threadKey = email;
    let t = map.get(threadKey);
    if (!t) {
      const name = String(md.recipient_name || md.contact_name || md.lead_name || md.from_name || '').trim();
      t = {
        threadKey,
        normalizedRecipient: email,
        displayName: name || (email.includes('@') ? email.split('@')[0] : email),
        email: email.includes('@') ? email : null,
        contactId: e.contact_id,
        leadId: e.lead_id,
        sequenceIds: new Set(),
        campaignIds: new Set(),
        channelSet: new Set(),
        events: [],
        sentCount: 0, openedCount: 0, clickedCount: 0, repliedCount: 0, bouncedCount: 0, complainedCount: 0,
        lastActivityAt: e.occurred_at || e.created_at,
        lastOutboundAt: null,
        lastReplyAt: null,
        classification: 'cold',
        needsFollowUp: false,
      };
      map.set(threadKey, t);
    }

    t.events.push(e);
    if (e.sequence_id) t.sequenceIds.add(e.sequence_id);
    if (e.campaign_id) t.campaignIds.add(e.campaign_id);
    if (e.channel) t.channelSet.add(e.channel);
    if (e.contact_id && !t.contactId) t.contactId = e.contact_id;
    if (e.lead_id && !t.leadId) t.leadId = e.lead_id;
    const when = e.occurred_at || e.created_at;
    if (when > t.lastActivityAt) t.lastActivityAt = when;

    const et = String(e.event_type || '').toLowerCase();
    if (SENT_TYPES.has(et)) { t.sentCount += 1; if (!t.lastOutboundAt || when > t.lastOutboundAt) t.lastOutboundAt = when; }
    else if (OPEN_TYPES.has(et)) t.openedCount += 1;
    else if (CLICK_TYPES.has(et)) t.clickedCount += 1;
    else if (REPLY_TYPES.has(et)) { t.repliedCount += 1; if (!t.lastReplyAt || when > t.lastReplyAt) t.lastReplyAt = when; }
    else if (BOUNCE_TYPES.has(et)) t.bouncedCount += 1;
    else if (COMPLAINT_TYPES.has(et)) t.complainedCount += 1;

    const cls = typeof md.reply_classification === 'string' ? md.reply_classification.toLowerCase() : '';
    if (REPLY_TYPES.has(et) && POSITIVE_CLASS.has(cls)) t.needsFollowUp = true;
    if (UNSUB_TYPES.has(et) || cls === 'unsubscribe') t.classification = 'unsubscribed';
  }

  const arr = Array.from(map.values());
  for (const t of arr) {
    if (t.classification !== 'unsubscribed') {
      if (t.bouncedCount > 0 && t.repliedCount === 0) t.classification = 'bounced';
      else if (t.needsFollowUp) t.classification = 'positive';
      else if (t.repliedCount > 0) t.classification = 'responding';
      else if (t.openedCount > 0 || t.clickedCount > 0) t.classification = 'warm';
      else t.classification = 'cold';
    }
  }
  return arr.sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1));
}

function outreachLogToEvent(log: LeadOutreachLog): OutreachEvent {
  const when = log.sent_at || log.created_at || log.updated_at || new Date().toISOString();
  return {
    id: `lead_outreach_log:${log.id}`,
    tenant_id: log.tenant_id,
    sequence_id: null,
    campaign_id: null,
    contact_id: null,
    lead_id: log.lead_id || null,
    channel: 'email',
    event_type: String(log.status || 'sent').toLowerCase() === 'failed' ? 'failed' : 'sent',
    provider: log.provider || null,
    variant: null,
    metadata: {
      source: 'lead_outreach_log',
      email: log.lead_email || null,
      to: log.lead_email || null,
      recipient: log.lead_email || null,
      normalized_recipient: normalizeEmail(log.lead_email) || null,
      recipient_name: log.lead_name || null,
      lead_name: log.lead_name || null,
      subject: log.subject || null,
      body_html: log.body_html || null,
    },
    occurred_at: when,
    created_at: log.created_at || when,
  };
}

function formatTimestamp(d: string | null | undefined): { relative: string; absolute: string } {
  if (!d) return { relative: '—', absolute: '' };
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return { relative: String(d).slice(0, 10), absolute: String(d) };
  const diffMins = (Date.now() - dt.getTime()) / 60_000;
  let relative: string;
  if (diffMins < 1) relative = 'just now';
  else if (diffMins < 60) relative = `${Math.round(diffMins)}m ago`;
  else if (diffMins < 60 * 24) relative = `${Math.round(diffMins / 60)}h ago`;
  else if (diffMins < 60 * 24 * 7) relative = `${Math.round(diffMins / (60 * 24))}d ago`;
  else relative = dt.toISOString().slice(0, 10);
  const absolute =
    dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' +
    dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return { relative, absolute };
}

function providerDisplay(provider: unknown): { label: string; className: string } {
  const p = String(provider || '').trim().toLowerCase();
  if (!p) return { label: 'Platform', className: 'bg-slate-500/20 border-slate-500/30 text-slate-200' };
  if (p.includes('microsoft') || p === 'outlook' || p.startsWith('ms')) return { label: 'Microsoft 365', className: 'bg-sky-500/15 border-sky-500/40 text-sky-300' };
  if (p.includes('zoho'))                                  return { label: 'Zoho',            className: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' };
  if (p.includes('sendgrid') || p.includes('twilio'))      return { label: 'SendGrid',        className: 'bg-amber-500/15 border-amber-500/40 text-amber-300' };
  if (p.includes('resend'))                                return { label: 'Resend',          className: 'bg-violet-500/15 border-violet-500/40 text-violet-300' };
  if (p.includes('brevo') || p.includes('sendinblue'))     return { label: 'Brevo',           className: 'bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-300' };
  if (p.includes('smtp'))                                  return { label: 'SMTP relay',      className: 'bg-slate-500/15 border-slate-500/40 text-slate-300' };
  return { label: p.charAt(0).toUpperCase() + p.slice(1), className: 'bg-slate-500/15 border-slate-500/40 text-slate-300' };
}

const CLASS_META: Record<ReachThread['classification'], { label: string; dot: string; badge: string; Icon: typeof Mail }> = {
  cold:        { label: 'Cold',       dot: 'bg-slate-400', badge: 'bg-slate-500/15 text-slate-300 border-slate-500/30', Icon: Mail },
  warm:        { label: 'Engaged',    dot: 'bg-sky-400',   badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',       Icon: MailCheck },
  responding:  { label: 'Replied',    dot: 'bg-emerald-400',badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',Icon: Reply },
  positive:    { label: 'Needs next', dot: 'bg-fuchsia-400',badge: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',Icon: Target },
  bounced:     { label: 'Bounced',    dot: 'bg-amber-400',  badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',  Icon: AlertTriangle },
  unsubscribed:{ label: 'Opted out',  dot: 'bg-rose-400',   badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',    Icon: MailX },
};

function classifyIconForList(list: OutreachListKey): React.ComponentType<any> {
  return OUTREACH_LISTS.find(l => l.id === list)?.Icon || Inbox;
}

export function OutreachInbox() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<OutreachEvent[]>([]);
  const [search, setSearch] = useState('');
  const [activeList, setActiveList] = useState<OutreachListKey>('all_people');
  const [activeThreadKey, setActiveThreadKey] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeProvider, setComposeProvider] = useState<DeliveryEmailProvider>('auto');
  const [sending, setSending] = useState(false);
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [connectedProviders, setConnectedProviders] = useState<
    Array<{ id: DeliveryEmailProvider; label: string; connected: boolean }>
  >([]);

  const tenantId = currentTenant?.id;

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const since = new Date(Date.now() - 90 * 86400_000).toISOString();
      const [{ data: ev }, { data: logs }, { data: providerData }] = await Promise.all([
        supabase
          .from('outreach_events')
          .select('id,tenant_id,sequence_id,campaign_id,contact_id,lead_id,channel,event_type,provider,variant,metadata,occurred_at,created_at')
          .eq('tenant_id', tenantId)
          .gte('occurred_at', since)
          .order('occurred_at', { ascending: false })
          .limit(2000),
        supabase
          .from('lead_outreach_log')
          .select('id,tenant_id,user_id,lead_id,lead_name,lead_email,subject,body_html,status,provider,sent_at,created_at,updated_at')
          .eq('tenant_id', tenantId)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(2000),
        fetch(`/api/settings/email-provider?tenantId=${encodeURIComponent(tenantId)}`)
          .then((r) => r.json().catch(() => ({})))
          .catch(() => ({})),
      ]);
      const logEvents = ((logs || []) as LeadOutreachLog[]).map(outreachLogToEvent);
      setEvents([...(ev || []) as OutreachEvent[], ...logEvents]);
      const raw = (providerData?.connectedProviders || providerData?.providers || []) as
        Array<{ id?: string; provider?: string; label?: string; name?: string; connected?: boolean; enabled?: boolean }>;
      const list: typeof connectedProviders = raw
        .map((p) => {
          const id = normalizeDeliveryProvider(p.id || p.provider || 'auto');
          const label = p.label || p.name || id;
          const connected = p.connected === true || p.enabled === true;
          return { id, label, connected };
        })
        .filter(Boolean);
      setConnectedProviders(list);
      if (providerData?.defaultProvider) {
        setComposeProvider(normalizeDeliveryProvider(providerData.defaultProvider));
      }
    } catch (err) {
      toast.error('Could not load outreach inbox');
    } finally {
      setLoading(false);
    }
  }, [supabase, tenantId]);

  useEffect(() => { load(); }, [load, refreshFlag]);

  const allThreads = useMemo(() => buildThreads(events), [events]);

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = allThreads;
    switch (activeList) {
      case 'replied':          list = list.filter(t => t.repliedCount > 0); break;
      case 'opened':           list = list.filter(t => t.openedCount > 0 && t.repliedCount === 0 && t.bouncedCount === 0); break;
      case 'bounced':          list = list.filter(t => t.bouncedCount > 0); break;
      case 'needs_followup':   list = list.filter(t => t.needsFollowUp); break;
      case 'active_sequences': list = list.filter(t => t.sequenceIds.size > 0 && t.classification !== 'bounced' && t.classification !== 'unsubscribed'); break;
      default: break;
    }
    if (q) list = list.filter(t =>
      t.displayName.toLowerCase().includes(q) ||
      (t.email || '').toLowerCase().includes(q) ||
      t.normalizedRecipient.toLowerCase().includes(q)
    );
    return list;
  }, [allThreads, activeList, search]);

  const activeThread = useMemo(
    () => filteredThreads.find(t => t.threadKey === activeThreadKey) || null,
    [filteredThreads, activeThreadKey]
  );

  const listCounts = useMemo(() => {
    const counts: Record<OutreachListKey, number> = {
      all_people: 0, active_sequences: 0, replied: 0, opened: 0, bounced: 0, needs_followup: 0,
    };
    for (const t of allThreads) {
      counts.all_people += 1;
      if (t.sequenceIds.size > 0 && t.classification !== 'bounced' && t.classification !== 'unsubscribed') counts.active_sequences += 1;
      if (t.repliedCount > 0) counts.replied += 1;
      if (t.openedCount > 0 && t.repliedCount === 0 && t.bouncedCount === 0) counts.opened += 1;
      if (t.bouncedCount > 0) counts.bounced += 1;
      if (t.needsFollowUp) counts.needs_followup += 1;
    }
    return counts;
  }, [allThreads]);

  const openComposerForThread = useCallback((t: ReachThread | null) => {
    if (!t?.email) { toast.error('No email address available for this contact'); return; }
    setComposeTo(t.email);
    setComposeSubject(`Following up — ${t.displayName}`);
    setComposeBody(`Hi ${t.displayName.split(' ')[0] || 'there'},\n\nJust wanted to make sure you saw my last message. Happy to walk through anything that would help on your end.\n\nBest,`);
    setComposerOpen(true);
  }, []);

  const handleSend = useCallback(async () => {
    if (!tenantId || !user?.id) { toast.error('Select a workspace first'); return; }
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) { toast.error('Fill in recipient, subject, and message'); return; }
    setSending(true);
    try {
      const ids =
        connectedProviders.filter(p => p.connected).map(p => p.id).length
          ? connectedProviders.filter(p => p.connected).map(p => p.id)
          : (['auto'] as DeliveryEmailProvider[]);
      const resolved = composeProvider === 'auto'
        ? resolveAutoProvider(ids as DeliveryEmailProvider[], (ids.includes('auto') ? 'auto' : ids[0]) || 'auto')
        : composeProvider;
      const contactMatches =
        activeThread && (activeThread.contactId || activeThread.leadId)
          ? { contactId: activeThread.contactId, leadId: activeThread.leadId }
          : null;
      const allRecipients = composeTo.split(',').map(e => e.trim()).filter(Boolean);
      for (const recipient of allRecipients) {
        const res = await fetch('/api/outreach/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            tenantId,
            leadEmail: recipient,
            leadName: activeThread?.displayName,
            subject: composeSubject.trim(),
            body: composeBody.trim(),
            pitchAngle: 'direct_message',
            autoSend: true,
            consentGranted: true,
            confidenceScore: 100,
            directSend: true,
            skipCrmGate: true,
            entityType: contactMatches?.leadId ? 'lead' : contactMatches?.contactId ? 'contact' : 'client',
            entityId: contactMatches?.leadId || contactMatches?.contactId || null,
            deliveryProviders: resolved !== 'auto' ? [resolved] : undefined,
            preferredProvider: resolved !== 'auto' ? resolved : undefined,
            balanceByDailyLimit: false,
            metadata: {
              source: 'outreach_inbox',
              thread_key: activeThread?.threadKey || null,
            },
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || `Failed to send to ${recipient}`);
        if (data.status === 'queued') throw new Error(`To ${recipient} was queued for approval — check AI Agents or retry.`);
      }
      toast.success(
        allRecipients.length === 1
          ? `Message sent via ${resolved === 'auto' ? 'workspace default' : String(resolved).toUpperCase()}`
          : `${allRecipients.length} messages sent`
      );
      setComposerOpen(false);
      setComposeBody('');
      setRefreshFlag(n => n + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }, [tenantId, user, composeTo, composeSubject, composeBody, composeProvider, connectedProviders, activeThread]);

  const lastEventForThread = useMemo(() => {
    if (!activeThread) return null;
    const sorted = [...activeThread.events].sort(
      (a, b) => new Date(b.occurred_at || b.created_at).getTime() - new Date(a.occurred_at || a.created_at).getTime()
    );
    return sorted[0] || null;
  }, [activeThread]);

  return (
    <ModuleOverviewChrome moduleId="outreach" activeHref="/dashboard/outreach/inbox">
      <div className="rounded-2xl border border-white/10 bg-[#0c1015]/60 overflow-hidden shadow-[0_8px_40px_-24px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500/30 to-sky-500/30 border border-white/10 flex items-center justify-center">
              <Inbox className="w-4 h-4 text-violet-300" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">Outreach reach inbox</p>
              <p className="text-[11px] text-slate-400 truncate">
                {loading ? 'Loading outreach threads…' : `${allThreads.length} contacts · ${events.length} events`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-[min(38ch,52vw)]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="pl-8 h-8 text-xs bg-slate-950/70 border-white/10 focus:border-violet-400/40 placeholder:text-slate-500"
              />
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRefreshFlag(n => n + 1)}
              disabled={loading}
              className="h-8 w-8 p-0 rounded-lg border border-white/10 text-slate-300 hover:text-white"
              title="Refresh"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              size="sm"
              onClick={() => setComposerOpen(true)}
              className="h-8 px-3 rounded-lg bg-gradient-to-r from-violet-500 to-sky-500 hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-violet-500/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              New message
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 min-h-[70vh] divide-x divide-white/5">
          {/* PANEL 1: Lists */}
          <aside className="col-span-3 xl:col-span-2 border-r border-white/5 bg-slate-950/30 py-3 space-y-1 px-2">
            <p className="px-2 pb-1 text-[10px] uppercase tracking-wider text-slate-500">Lists</p>
            {OUTREACH_LISTS.map(({ id, label, Icon, tone, description }) => {
              const active = activeList === id;
              const c = listCounts[id] || 0;
              const ListIcon = classifyIconForList(id);
              return (
                <button
                  key={id}
                  onClick={() => { setActiveList(id); setActiveThreadKey(null); }}
                  title={description}
                  className={[
                    'w-full group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left',
                    active
                      ? 'bg-white/10 border border-white/10'
                      : 'hover:bg-white/5 border border-transparent',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <ListIcon className={`w-3.5 h-3.5 shrink-0 ${tone}`} />
                    <span className={`text-xs truncate ${active ? 'text-white font-semibold' : 'text-slate-300'}`}>
                      {label}
                    </span>
                  </span>
                  <Badge variant="outline" className={[
                    'text-[10px] px-1.5 py-0.5 h-4 min-w-[22px] justify-center',
                    active ? 'border-white/20 text-white' : 'border-white/5 text-slate-400',
                  ].join(' ')}>
                    {c}
                  </Badge>
                </button>
              );
            })}
          </aside>

          {/* PANEL 2: Threads list */}
          <section className="col-span-5 xl:col-span-4 border-r border-white/5 bg-slate-950/10 flex flex-col">
            <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5 flex items-center justify-between">
              <span>
                {OUTREACH_LISTS.find(l => l.id === activeList)?.label}
                {loading ? '…loading' : ` · ${filteredThreads.length}`}
              </span>
              <span className="hidden md:inline-flex items-center gap-1 text-slate-500">
                <Filter className="w-3 h-3" />
                Latest first
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-lg border border-white/5 bg-slate-900/40 animate-[pulse_1.6s_ease-in-out_infinite] backdrop-blur-sm saturate-50 opacity-60" />
                  ))}
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="p-8 space-y-3 text-center">
                  <div className="mx-auto h-12 w-12 rounded-2xl border border-dashed border-white/10 bg-gradient-to-br from-violet-500/10 to-sky-500/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-violet-400" />
                  </div>
                  <p className="text-sm font-semibold text-white">No threads yet in this list</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Run a campaign or send a one-off outreach message from the composer above.
                    Sent deliveries, opens, clicks, and replies will begin threading here automatically so you
                    know who you reached, who responded, and what's next.
                  </p>
                  <ol className="max-w-sm mx-auto text-[11px] text-slate-400 space-y-1 text-left pl-4 list-decimal">
                    <li>Go to <span className="text-violet-300">Campaign outreach</span> and build an email sequence.</li>
                    <li>Or click <span className="text-violet-300">New message</span> to send a one-off.</li>
                    <li>Watch replies land here grouped by contact; click <span className="text-emerald-300">Reply</span> to continue the conversation.</li>
                  </ol>
                </div>
              ) : (
                <ul>
                  {filteredThreads.map((t) => {
                    const meta = CLASS_META[t.classification];
                    const active = activeThreadKey === t.threadKey;
                    const hasReply = t.repliedCount > 0;
                    return (
                      <li key={t.threadKey}>
                        <button
                          onClick={() => setActiveThreadKey(t.threadKey)}
                          className={[
                            'w-full text-left px-3 py-3 border-b border-white/5 transition-colors',
                            active ? 'bg-white/10' : hasReply ? 'bg-emerald-500/[0.04] hover:bg-white/5' : 'hover:bg-white/5',
                          ].join(' ')}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                                <p className={`text-xs font-semibold truncate ${active ? 'text-white' : 'text-slate-200'}`}>
                                  {t.displayName}
                                </p>
                                {t.needsFollowUp ? (
                                  <Badge variant="outline" className="bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-300 px-1.5 h-4 text-[10px] ml-1">Next</Badge>
                                ) : null}
                              </div>
                              <p className="text-[11px] text-slate-400 truncate">{t.email || t.normalizedRecipient}</p>
                              <p className="text-[10.5px] text-slate-500 mt-0.5 line-clamp-1">
                                {t.lastReplyAt
                                  ? `Replied ${formatTimestamp(t.lastReplyAt).relative}`
                                  : t.lastOutboundAt
                                  ? `Last sent ${formatTimestamp(t.lastOutboundAt).relative}`
                                  : `Activity ${formatTimestamp(t.lastActivityAt).relative}`}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1 text-[10px] text-slate-400">
                              {t.sentCount > 0 && <span className="px-1.5 py-0.5 rounded bg-slate-800/70">{t.sentCount}× sent</span>}
                              {t.repliedCount > 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">{t.repliedCount} reply</span>}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* PANEL 3: Message / thread reader */}
          <section className="col-span-4 xl:col-span-6 bg-slate-950/20 flex flex-col min-h-0">
            {!activeThread ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="max-w-md text-center space-y-3">
                  <div className="mx-auto h-14 w-14 rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-sky-500/10 to-violet-500/10 flex items-center justify-center">
                    <MailCheck className="w-6 h-6 text-sky-300" />
                  </div>
                  <p className="text-sm font-semibold text-white">Pick a thread on the left</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Everything outreach — sends, opens, clicks, replies — is grouped per contact.
                    Jump into Replied or Needs next step to continue conversations like a Gmail-style inbox,
                    with one-off sending powered by the same delivery providers already connected.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <header className="px-4 py-3 border-b border-white/5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white truncate">{activeThread.displayName}</p>
                        <Badge variant="outline" className={CLASS_META[activeThread.classification].badge}>
                          {CLASS_META[activeThread.classification].label}
                        </Badge>
                        {activeThread.sequenceIds.size > 0 && (
                          <Badge variant="outline" className="bg-violet-500/10 border-violet-500/30 text-violet-300">
                            {activeThread.sequenceIds.size} sequence{activeThread.sequenceIds.size !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {activeThread.email || activeThread.normalizedRecipient}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2.5 rounded-lg border border-white/10 text-slate-300 hover:text-white text-xs"
                        onClick={() => openComposerForThread(activeThread)}
                      >
                        <Reply className="w-3.5 h-3.5" />
                        Reply
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg border border-white/10 text-slate-400 hover:text-white" title="Archive (no-op UX)">
                        <Archive className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg border border-white/10 text-slate-400 hover:text-white" title="Star (no-op UX)">
                        <Star className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg border border-white/10 text-slate-400 hover:text-white" title="More">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="rounded-lg bg-slate-950/50 border border-white/5 px-2.5 py-1.5">
                      <p className="text-slate-500">Sent</p>
                      <p className="text-slate-100 font-bold">{activeThread.sentCount}</p>
                    </div>
                    <div className="rounded-lg bg-slate-950/50 border border-white/5 px-2.5 py-1.5">
                      <p className="text-slate-500">Opened</p>
                      <p className="text-sky-300 font-bold">{activeThread.openedCount}</p>
                    </div>
                    <div className="rounded-lg bg-slate-950/50 border border-white/5 px-2.5 py-1.5">
                      <p className="text-slate-500">Replied</p>
                      <p className="text-emerald-300 font-bold">{activeThread.repliedCount}</p>
                    </div>
                    <div className="rounded-lg bg-slate-950/50 border border-white/5 px-2.5 py-1.5">
                      <p className="text-slate-500">Last activity</p>
                      <p className="text-slate-200 font-bold" title={formatTimestamp(activeThread.lastActivityAt).absolute}>
                        {formatTimestamp(activeThread.lastActivityAt).relative}
                      </p>
                    </div>
                  </div>
                </header>

                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                  {(() => {
                    const chrono = [...activeThread.events].sort(
                      (a, b) => new Date(a.occurred_at || a.created_at).getTime() - new Date(b.occurred_at || b.created_at).getTime()
                    );
                    return chrono.map((e) => {
                      const et = String(e.event_type || '').toLowerCase();
                      const isReply = REPLY_TYPES.has(et);
                      const md = (e.metadata || {}) as Record<string, unknown>;
                      const replyText = typeof md.reply_text === 'string' ? md.reply_text : '';
                      const sentBody = htmlToReadableText(
                        typeof md.body_html === 'string'
                          ? md.body_html
                          : typeof md.body === 'string'
                            ? md.body
                            : ''
                      );
                      const variant = typeof e.variant === 'string' ? e.variant : '';
                      const subtitle = typeof md.subject === 'string' ? md.subject : variant ? `Variant ${variant}` : '';
                      let icon: React.ComponentType<any> = Zap;
                      let pill = 'bg-slate-500/15 text-slate-300 border-slate-500/30';
                      let label = e.event_type || 'event';
                      if (SENT_TYPES.has(et))        { icon = Mail;           pill = 'bg-sky-500/15 text-sky-300 border-sky-500/30';       label = 'Sent'; }
                      else if (OPEN_TYPES.has(et))  { icon = MailCheck;     pill = 'bg-slate-500/15 text-slate-300 border-slate-500/30'; label = 'Opened'; }
                      else if (CLICK_TYPES.has(et)) { icon = CheckCircle2;  pill = 'bg-violet-500/15 text-violet-300 border-violet-500/30'; label = 'Link clicked'; }
                      else if (REPLY_TYPES.has(et)) { icon = Reply;         pill = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'; label = 'Replied'; }
                      else if (BOUNCE_TYPES.has(et)){ icon = AlertTriangle; pill = 'bg-amber-500/15 text-amber-300 border-amber-500/30';  label = 'Bounced'; }
                      else if (COMPLAINT_TYPES.has(et)) { icon = MailX;    pill = 'bg-rose-500/15 text-rose-300 border-rose-500/30';    label = 'Spam complaint'; }
                      else if (UNSUB_TYPES.has(et)) { icon = MailX;        pill = 'bg-slate-500/15 text-slate-300 border-slate-500/30'; label = 'Unsubscribed'; }
                      const Icon = icon;
                      const ts = formatTimestamp(e.occurred_at || e.created_at);
                      const prov = e.provider ? providerDisplay(e.provider) : null;
                      const replyProv = md.sender ? String(md.sender) : '';
                      const showProviderBadge = prov && (SENT_TYPES.has(et) || OPEN_TYPES.has(et) || CLICK_TYPES.has(et) || BOUNCE_TYPES.has(et));
                      return (
                        <div
                          key={e.id}
                          className={[
                            'rounded-xl border px-3 py-2.5',
                            isReply
                              ? 'bg-emerald-500/[0.04] border-emerald-500/20 ml-auto max-w-[92%]'
                              : 'bg-slate-950/50 border-white/10 max-w-[92%]',
                          ].join(' ')}
                        >
                          <div className="flex items-center justify-between gap-3 mb-1.5">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <Icon className={`w-3.5 h-3.5 shrink-0 ${isReply ? 'text-emerald-300' : 'text-slate-300'}`} />
                              <Badge variant="outline" className={pill}>{label}</Badge>
                              {showProviderBadge ? (
                                <Badge variant="outline" className={prov!.className + ' text-[10px] px-1.5 h-4'}>
                                  via {prov!.label}
                                </Badge>
                              ) : null}
                              {replyProv && isReply ? (
                                <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-300 text-[10px] px-1.5 h-4">
                                  from {replyProv.includes('@') ? replyProv : replyProv}
                                </Badge>
                              ) : null}
                              {subtitle && <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>}
                            </div>
                            <span
                              className="text-[10.5px] text-slate-500 whitespace-nowrap"
                              title={ts.absolute}
                            >
                              {ts.relative} · <span className="tabular-nums text-slate-400">{ts.absolute}</span>
                            </span>
                          </div>
                          {replyText ? (
                            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed rounded-lg bg-slate-950/70 border border-white/5 p-2.5">
                              {replyText.length > 2000 ? `${replyText.slice(0, 2000)}…` : replyText}
                            </p>
                          ) : null}
                          {!replyText && SENT_TYPES.has(et) && sentBody ? (
                            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed rounded-lg bg-slate-950/70 border border-white/5 p-2.5">
                              {sentBody.length > 4000 ? `${sentBody.slice(0, 4000)}…` : sentBody}
                            </p>
                          ) : null}
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* Composer modal */}
      {composerOpen ? (
        <div className="fixed inset-0 z-[1000] bg-slate-950/70 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/95 to-slate-950/95 shadow-2xl shadow-black/60 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 border border-white/10 flex items-center justify-center">
                  <Send className="w-3.5 h-3.5 text-emerald-300" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">New outreach message</p>
                  <p className="text-[11px] text-slate-400">Sending uses the same connected delivery providers already configured.</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setComposerOpen(false)}
                className="h-8 w-8 p-0 rounded-lg border border-white/10 text-slate-400 hover:text-white"
              >
                <ChevronRight className="w-4 h-4 -rotate-45" />
              </Button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-8 space-y-2">
                  <label className="block text-[11px] text-slate-400">To</label>
                  <Input value={composeTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComposeTo(e.target.value)} placeholder="name@company.com" className="bg-slate-950/60 border-white/10 text-xs h-9" />
                </div>
                <div className="col-span-4 space-y-2">
                  <label className="block text-[11px] text-slate-400">Dispatch via</label>
                  <select
                    value={composeProvider}
                    onChange={(e) => setComposeProvider(normalizeDeliveryProvider(e.target.value))}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none h-9"
                  >
                    <option value="auto">Auto (Best deliverability)</option>
                    {(connectedProviders.length ? connectedProviders : [
                      { id: 'outlook' as DeliveryEmailProvider, label: 'Microsoft Outlook 365', connected: false },
                      { id: 'zoho' as DeliveryEmailProvider, label: 'Zoho Mail Enterprise', connected: false },
                      { id: 'sendgrid' as DeliveryEmailProvider, label: 'SendGrid Engine', connected: false },
                    ]).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.label}{p.connected === false && p.id !== 'auto' ? ' (connect first)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] text-slate-400">Subject</label>
                <Input value={composeSubject} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComposeSubject(e.target.value)} placeholder="Short, specific subject line" className="bg-slate-950/60 border-white/10 text-xs h-9" />
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] text-slate-400">Message</label>
                <Textarea
                  value={composeBody}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComposeBody(e.target.value)}
                  rows={9}
                  className="bg-slate-950/60 border-white/10 text-xs leading-relaxed"
                  placeholder="Hi [first name],…"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-slate-500 max-w-sm">
                  After sending, the delivery event will appear in the contact thread above. Any incoming reply from this address threads back here automatically.
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => setComposerOpen(false)} className="h-9 px-3 rounded-lg border border-white/10 text-slate-300 hover:text-white text-xs">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={sending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
                    className="h-9 px-4 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                    {sending ? 'Sending…' : 'Send message'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </ModuleOverviewChrome>
  );
}
