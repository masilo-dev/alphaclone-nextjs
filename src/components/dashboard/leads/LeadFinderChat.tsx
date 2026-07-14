'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  Send,
  Loader2,
  Search,
  Mail,
  CheckCircle2,
  User,
  Building2,
  Star,
  Sparkles,
  Save,
  Zap,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrentTenantSafe } from '@/hooks/useTenantSafe';
import { qualifyLead, type QualificationResult } from '@/lib/leadQualification';
import { OutreachPanel } from '@/components/leads/OutreachPanel';
import type { ParsedLeadIntent } from '@/lib/scraper/parseLeadIntent';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ScraperLead {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  company_website?: string;
  score?: number;
  grade?: string;
  status?: string;
  source?: string;
  industry?: string;
  crm_lead_id?: string;
}

interface RunStatus {
  status: string;
  progress: number;
  current_step?: string;
  source_count?: number;
  enriched_count?: number;
  created_count?: number;
}

const GRADE_STYLES: Record<string, string> = {
  A: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  B: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  C: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  D: 'bg-slate-500/20 text-slate-400 border-slate-500/40',
};

const STEP_LABELS: Record<string, string> = {
  init: 'Initializing',
  scraping: 'Scraping sources',
  extracting: 'Extracting entities',
  enriching: 'Enriching contacts',
  deduplicating: 'Removing duplicates',
  scoring: 'Scoring leads',
  syncing: 'Syncing to CRM',
  done: 'Complete',
};

interface Props {
  onActivity?: () => void;
}

export default function LeadFinderChat({ onActivity }: Props) {
  const tenant = useCurrentTenantSafe();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Describe your ideal **SMB leads** in plain English — niche, city, and who you want to reach. Large corporations and franchise chains are filtered out.\n\nExample: *Find owner-operated dental clinics in Austin*\n\nWhen leads appear, use **Outreach** on any row to open the email composer. Leads are saved to CRM and marked **Contacted** after you send.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<ParsedLeadIntent | null>(null);
  const [activeIntent, setActiveIntent] = useState<ParsedLeadIntent | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [leads, setLeads] = useState<ScraperLead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showOutreach, setShowOutreach] = useState(false);
  const [outreachLeadIds, setOutreachLeadIds] = useState<string[]>([]);
  const completedNotifiedRef = useRef(false);
  const pollAttemptsRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const onActivityRef = useRef(onActivity);
  onActivityRef.current = onActivity;

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, leads, runStatus]);

  const appendMessage = (role: 'user' | 'assistant', content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, role, content },
    ]);
  };

  const notifyActivity = () => onActivityRef.current?.();

  const pollStatusAndLeads = useCallback(
    async (cid: string) => {
      if (!tenant?.id) return false;

      const statusRes = await fetch('/api/scraper-campaigns/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id, action: 'status', campaignId: cid }),
      });
      const statusData = await statusRes.json();
      if (statusData.status) setRunStatus(statusData.status);

      const leadsRes = await fetch('/api/scraper-campaigns/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id, action: 'leads', campaignId: cid }),
      });
      const leadsData = await leadsRes.json();
      if (leadsData.leads?.length) {
        setLeads(leadsData.leads);
        notifyActivity();
      }

      const status = statusData.status;
      const done =
        status?.status === 'completed' ||
        status?.progress >= 100 ||
        status?.current_step === 'done';

      const stalledUnknown =
        status?.status === 'unknown' &&
        (leadsData.leads?.length || 0) > 0;

      return !(done || stalledUnknown);
    },
    [tenant?.id]
  );

  const handleRetryNiche = useCallback(async (attempt: number) => {
    if (!tenant?.id || !activeIntent) return;
    setLoading(true);
    setRetryAttempt(attempt + 1);
    completedNotifiedRef.current = false;
    try {
      const res = await fetch('/api/scraper-campaigns/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          action: 'retry_niche',
          intent: activeIntent,
          retryAttempt: attempt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.reply) {
        setMessages((prev) => [...prev, { id: `r-${Date.now()}`, role: 'assistant', content: data.reply }]);
      }
      if (data.campaignId) {
        setCampaignId(data.campaignId);
        setRunStatus({ status: 'running', progress: 10 });
      }
      if (data.intent) setActiveIntent(data.intent);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, activeIntent]);

  useEffect(() => {
    if (!campaignId || !tenant?.id) return;
    if (runStatus?.status === 'completed' || runStatus?.progress === 100) return;

    const interval = setInterval(async () => {
      pollAttemptsRef.current += 1;
      const stillRunning = await pollStatusAndLeads(campaignId);
      const timedOut = pollAttemptsRef.current >= 18;
      if ((!stillRunning || timedOut) && !completedNotifiedRef.current) {
        completedNotifiedRef.current = true;
        clearInterval(interval);

        const leadsRes = await fetch('/api/scraper-campaigns/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: tenant!.id, action: 'leads', campaignId }),
        });
        const leadsData = await leadsRes.json();
        const count = leadsData.leads?.length || 0;

        if (count === 0 && activeIntent && retryAttempt < 2) {
          setMessages((prev) => [
            ...prev,
            {
              id: `retry-${Date.now()}`,
              role: 'assistant',
              content: `No SMB leads yet for "${activeIntent.niche || activeIntent.industry?.[0] || 'that niche'}". Broadening search (attempt ${retryAttempt + 1})…`,
            },
          ]);
          handleRetryNiche(retryAttempt);
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `complete-${Date.now()}`,
            role: 'assistant',
            content:
              count > 0
                ? `Found ${count} SMB leads. Select → Qualify → Save to CRM → Email or start auto-sequence.`
                : `Couldn't find enough SMB leads for that niche. Try a broader niche, nearby city, or different industry — I never target big corporations.`,
          },
        ]);
      }
    }, 5000);

    pollStatusAndLeads(campaignId);
    return () => clearInterval(interval);
  }, [campaignId, tenant?.id, runStatus?.status, runStatus?.progress, pollStatusAndLeads, activeIntent, retryAttempt, handleRetryNiche]);

  const sendChat = async (text: string) => {
    if (!tenant?.id || !text.trim()) return;

    appendMessage('user', text.trim());
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/scraper-campaigns/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          messages: [...messages, { role: 'user', content: text.trim() }],
          action: 'chat',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');

      if (data.reply) appendMessage('assistant', data.reply);
      if (data.intent) setPendingIntent(data.intent);
      if (data.campaignId) {
        setCampaignId(data.campaignId);
        setPendingIntent(null);
        setRunStatus({ status: 'running', progress: 5 });
        setLeads([]);
        setSelectedIds(new Set());
        completedNotifiedRef.current = false;
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSearch = async () => {
    if (!pendingIntent || !tenant?.id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/scraper-campaigns/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          action: 'run',
          intent: pendingIntent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      appendMessage('assistant', data.reply);
      setCampaignId(data.campaignId);
      setActiveIntent(pendingIntent);
      setPendingIntent(null);
      setRunStatus({ status: 'running', progress: 5 });
      setLeads([]);
      setRetryAttempt(0);
      pollAttemptsRef.current = 0;
      completedNotifiedRef.current = false;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start search');
    } finally {
      setLoading(false);
    }
  };

  const toggleLead = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const qualifySelected = async () => {
    if (!tenant?.id || !campaignId || selectedIds.size === 0) return;
    try {
      const res = await fetch('/api/scraper-campaigns/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          action: 'qualify',
          campaignId,
          leadIds: Array.from(selectedIds),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Qualified ${data.qualified} leads`);
      setLeads((prev) =>
        prev.map((l) =>
          selectedIds.has(l.id) ? { ...l, status: 'qualified' } : l
        )
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Qualify failed');
    }
  };

  const saveToCrm = async () => {
    if (!tenant?.id || !campaignId || selectedIds.size === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/scraper-campaigns/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          action: 'save',
          campaignId,
          leadIds: Array.from(selectedIds),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Saved ${data.count} leads to CRM`);
      notifyActivity();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const startAutoSequence = async () => {
    if (!tenant?.id || selectedIds.size === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/scraper-campaigns/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          action: 'automate',
          leadIds: Array.from(selectedIds),
          channel: 'email',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Email automation queued (Nexus + nurture workflow)');
      appendMessage('assistant', data.message || 'Auto-sequence started for selected leads.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Automation failed');
    } finally {
      setLoading(false);
    }
  };

  const runNexusEnrich = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/scraper-campaigns/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id, action: 'nexus', autoSend: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Nexus enrichment complete');
      appendMessage('assistant', 'Nexus scanned your pipeline for enrichment gaps and campaign opportunities.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Nexus failed');
    } finally {
      setLoading(false);
    }
  };

  const buildOutreachLeads = (targetLeads: ScraperLead[]) =>
    targetLeads
      .filter((l) => l.email || l.company_website)
      .map((lead) => {
        const qualification: QualificationResult = qualifyLead(
          {
            business_name: lead.company || lead.name || 'Unknown',
            email: lead.email,
            phone: lead.phone,
            website: lead.company_website,
            category: lead.industry,
            source: lead.source,
          },
          industry
        );
        if (lead.score && lead.score >= 70) {
          qualification.tier = 'hot';
          qualification.label = '🔥 Hot';
        }
        return {
          scraperLeadId: lead.id,
          business_name: lead.company || lead.name || 'Unknown',
          email: lead.email,
          phone: lead.phone,
          website: lead.company_website,
          category: lead.industry || industry,
          source: lead.source,
          qualification,
        };
      });

  const openOutreachForLeads = async (ids: string[]) => {
    if (!tenant?.id || !campaignId || ids.length === 0) return;

    const targetLeads = leads.filter((l) => ids.includes(l.id));
    const emailable = targetLeads.filter((l) => l.email || l.company_website);
    if (!emailable.length) {
      toast.error('Add an email or website on this lead before outreach.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/scraper-campaigns/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          action: 'prepare_outreach',
          campaignId,
          leadIds: emailable.map((l) => l.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not prepare outreach');

      setLeads((prev) =>
        prev.map((l) => {
          const prepared = (data.prepared as Array<{ id: string; crm_lead_id?: string }> | undefined)?.find(
            (p) => p.id === l.id
          );
          if (!prepared) return l;
          return {
            ...l,
            crm_lead_id: prepared.crm_lead_id || l.crm_lead_id,
            status: l.status === 'contacted' ? l.status : 'synced',
          };
        })
      );

      setOutreachLeadIds(emailable.map((l) => l.id));
      setShowOutreach(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Outreach prep failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOutreachComplete = async (
    results: Array<{ businessName: string; status: 'sent' | 'queued' | 'failed'; scraperLeadId?: string }>
  ) => {
    if (!tenant?.id) return;

    const contactedIds = results
      .filter((r) => (r.status === 'sent' || r.status === 'queued') && r.scraperLeadId)
      .map((r) => r.scraperLeadId as string);

    if (!contactedIds.length) return;

    try {
      const res = await fetch('/api/scraper-campaigns/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          action: 'mark_contacted',
          leadIds: contactedIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setLeads((prev) =>
        prev.map((l) =>
          contactedIds.includes(l.id) ? { ...l, status: 'contacted' } : l
        )
      );
      toast.success(`Marked ${contactedIds.length} lead(s) as contacted in CRM`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not update contacted status');
    }
  };

  const industry = activeIntent?.industry?.[0] || pendingIntent?.industry?.[0] || 'business';

  const outreachLeads = buildOutreachLeads(
    leads.filter((l) => outreachLeadIds.includes(l.id))
  );

  return (
    <div className="flex flex-col min-h-[420px] max-h-[min(72dvh,760px)] ac-workspace-panel rounded-xl border border-slate-800">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/80 bg-slate-900/40">
        <div className="w-9 h-9 rounded-lg bg-teal-500/15 border border-teal-500/25 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-teal-400" />
        </div>
        <div className="min-w-0">
          <h2 className="text-white font-semibold text-sm">Lead search assistant</h2>
          <p className="text-xs text-slate-500 truncate">Natural language → directory scrape → CRM</p>
        </div>
        {runStatus && runStatus.status === 'running' && (
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-400 shrink-0">
            <Loader2 className="w-3 h-3 animate-spin text-teal-400" />
            <span className="hidden sm:inline">
              {STEP_LABELS[runStatus.current_step || ''] || 'Processing'}
            </span>
            <span className="tabular-nums font-medium text-slate-300">{runStatus.progress}%</span>
          </div>
        )}
      </div>

      {/* Messages + leads */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 ac-scroll-full">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-emerald-900/50 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-emerald-400" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-teal-700/80 text-white rounded-br-sm'
                  : 'bg-slate-800/80 text-slate-200 rounded-bl-sm border border-slate-700/50'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-blue-900/50 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-blue-300" />
              </div>
            )}
          </div>
        ))}

        {/* Pending intent card */}
        {pendingIntent && !campaignId && (
          <div className="mx-2 rounded-xl border border-teal-500/25 bg-teal-950/20 p-4 space-y-3">
            <p className="text-sm text-teal-200 font-medium">Search plan</p>
            <p className="text-xs text-slate-400 leading-relaxed">{pendingIntent.summary}</p>
            {pendingIntent.niche && (
              <p className="text-xs text-emerald-400">Niche: {pendingIntent.niche}</p>
            )}
            <p className="text-[10px] text-slate-500">Target: SMB (1–200 employees) · enterprise domains excluded</p>
            <div className="flex flex-wrap gap-1">
              {pendingIntent.sources.map((s) => (
                <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {s}
                </span>
              ))}
              {pendingIntent.location?.city && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  📍 {pendingIntent.location.city}
                </span>
              )}
            </div>
            <button
              onClick={handleStartSearch}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              Start search
            </button>
          </div>
        )}

        {/* Progress bar */}
        {runStatus && runStatus.status === 'running' && (
          <div className="mx-2 space-y-2 ac-workspace-panel p-3">
            <div className="flex justify-between text-xs text-slate-400">
              <span>{STEP_LABELS[runStatus.current_step || ''] || 'Processing'}</span>
              <span className="tabular-nums text-slate-300">{runStatus.progress ?? 5}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div
                className="bg-teal-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${runStatus.progress || 5}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="text-slate-500">Found</div>
                <div className="text-white font-semibold tabular-nums">{runStatus.source_count ?? 0}</div>
              </div>
              <div>
                <div className="text-slate-500">Enriched</div>
                <div className="text-white font-semibold tabular-nums">{runStatus.enriched_count ?? 0}</div>
              </div>
              <div>
                <div className="text-slate-500">CRM</div>
                <div className="text-white font-semibold tabular-nums">{runStatus.created_count ?? 0}</div>
              </div>
            </div>
          </div>
        )}

        {runStatus?.status === 'completed' && leads.length === 0 && activeIntent && retryAttempt < 3 && (
          <div className="mx-2">
            <button
              onClick={() => handleRetryNiche(retryAttempt)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-600/50 text-amber-300 text-sm hover:bg-amber-950/30"
            >
              <RefreshCw className="w-4 h-4" />
              Broaden niche search
            </button>
          </div>
        )}

        {/* Lead results */}
        {leads.length > 0 && (
          <div className="space-y-2 mx-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-slate-300 font-medium">{leads.length} SMB leads</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={qualifySelected}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white disabled:opacity-40"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Qualify
                </button>
                <button
                  onClick={saveToCrm}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-xs text-white disabled:opacity-40"
                >
                  <Save className="w-3 h-3" />
                  Save CRM
                </button>
                <button
                  onClick={() => openOutreachForLeads(Array.from(selectedIds))}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white disabled:opacity-40"
                >
                  <Mail className="w-3 h-3" />
                  Outreach selected
                </button>
                <button
                  onClick={startAutoSequence}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-600 text-xs text-white disabled:opacity-40"
                >
                  <Zap className="w-3 h-3" />
                  Auto-sequence
                </button>
                <button
                  onClick={runNexusEnrich}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-xs text-white"
                >
                  <MessageSquare className="w-3 h-3" />
                  Nexus
                </button>
              </div>
            </div>

            {leads.map((lead) => (
              <div
                key={lead.id}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                  selectedIds.has(lead.id)
                    ? 'border-emerald-500/50 bg-emerald-950/20'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(lead.id)}
                  onChange={() => toggleLead(lead.id)}
                  className="mt-1 rounded border-slate-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium text-sm">
                      {lead.name || lead.company || 'Unknown'}
                    </span>
                    {lead.grade && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded border ${GRADE_STYLES[lead.grade] || ''}`}
                      >
                        {lead.grade}
                      </span>
                    )}
                    {lead.score != null && (
                      <span className="text-xs text-slate-500 flex items-center gap-0.5">
                        <Star className="w-3 h-3" /> {lead.score}
                      </span>
                    )}
                    {lead.status === 'qualified' && (
                      <span className="text-xs text-emerald-400">✓ qualified</span>
                    )}
                    {lead.status === 'contacted' && (
                      <span className="text-xs text-blue-400">✓ contacted</span>
                    )}
                    {lead.status === 'synced' && (
                      <span className="text-xs text-indigo-400">in CRM</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-3">
                    {lead.title && <span>{lead.title}</span>}
                    {lead.company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {lead.company}
                      </span>
                    )}
                    {lead.email && <span>{lead.email}</span>}
                    {lead.phone && <span>{lead.phone}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openOutreachForLeads([lead.id])}
                  disabled={loading || (!lead.email && !lead.company_website)}
                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white disabled:opacity-40"
                  title={!lead.email && !lead.company_website ? 'Need email or website' : 'Open outreach — auto-saves to CRM'}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Outreach
                </button>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-slate-500 text-sm px-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/40">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendChat(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Find owner-operated yoga studios in Denver — SMB only, no chains"
            className="flex-1 rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {showOutreach && outreachLeads.length > 0 && (
        <OutreachPanel
          leads={outreachLeads}
          industry={industry}
          onClose={() => {
            setShowOutreach(false);
            setOutreachLeadIds([]);
          }}
          onSendComplete={handleOutreachComplete}
        />
      )}
    </div>
  );
}
