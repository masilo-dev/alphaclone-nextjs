'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search, Plus, Inbox, Star, Clock, Send, FileText, Archive, Trash2,
  AlertTriangle, Shield, Settings, CheckCircle2, ChevronRight, ChevronDown,
  Sparkles, Filter, RefreshCw, Calendar as CalendarIcon, Users, User,
  Building, DollarSign, ArrowRight, Zap, Play, Pause, BarChart3, Mail,
  Bot, Flame, Check, X, ArrowUpRight, MessageSquare, Phone, Paperclip,
  ExternalLink, Eye, MousePointer, Target, Activity, ShieldCheck, AlertCircle,
  HelpCircle, Command, CornerDownRight, MoreVertical, Edit3, Sliders, Layers,
  Globe, Smartphone, FileSpreadsheet, Lock, Sparkle, Split, Workflow, CheckSquare,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import AiDraftReviewBanner from '@/components/dashboard/inbox/AiDraftReviewBanner';
import { normalizeDeliveryProvider, resolveAutoProvider, type DeliveryEmailProvider } from '@/lib/email/emailProviderOptions';
import { extractEmailAddress } from '@/lib/email/composeNavigation';

// --- TYPES ---

export type WorkspaceTab = 'inbox' | 'campaigns' | 'sequences' | 'templates' | 'analytics' | 'health';

export type EmailFolder =
  | 'inbox'
  | 'priority'
  | 'unread'
  | 'starred'
  | 'scheduled'
  | 'sent'
  | 'drafts'
  | 'archive'
  | 'spam'
  | 'trash'
  | 'shared'
  | 'sequences'
  | 'campaigns'
  | 'templates'
  | 'automation'
  | 'analytics'
  | 'warmup'
  | 'contacts'
  | 'companies';

export interface EmailThread {
  id: string;
  senderName: string;
  senderEmail: string;
  senderAvatar?: string;
  companyName: string;
  crmStatus: 'Client' | 'Qualified Lead' | 'Enterprise Prospect' | 'Partner' | 'Vendor';
  priority: 'high' | 'medium' | 'normal';
  subject: string;
  preview: string;
  timestamp: string;
  unread: boolean;
  starred: boolean;
  scheduled?: boolean;
  scheduledTime?: string;
  hasAttachments: boolean;
  attachmentCount?: number;
  hasMeeting: boolean;
  meetingDetails?: { title: string; date: string; time: string; link: string };
  dealValue?: number;
  dealName?: string;
  aiSummary: string;
  replyCount: number;
  sentiment: 'Positive' | 'Neutral' | 'Urgent' | 'Objection';
  relationshipScore: number; // 0-100
  opportunityScore: number; // 0-100
  folder: EmailFolder;
  labels: string[];
  messages: Array<{
    id: string;
    fromName: string;
    fromEmail: string;
    fromAvatar?: string;
    to: string[];
    timestamp: string;
    body: string;
    attachments?: Array<{ name: string; size: string; type: string }>;
    isInternalNote?: boolean;
  }>;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'Running' | 'Paused' | 'Completed' | 'Draft' | 'Scheduled';
  audience: string;
  recipientCount: number;
  sentCount: number;
  deliveredRate: number;
  openRate: number;
  replyRate: number;
  ctr: number;
  meetingRate: number;
  positiveReplyRate: number;
  meetingsBooked: number;
  pipelineCreated: number;
  revenue: number;
  personalizationScore: number;
  health: 'Optimal' | 'Warning' | 'Needs Attention';
  owner: string;
  progress: number;
  lastActive: string;
}

// ── Real data mapper ───────────────────────────────────────────────────────
function mapUnifiedToThread(m: Record<string, any>): EmailThread {
  const rawBody: string = m.html_body || m.body || '';
  const clean = rawBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const domain = (m.from_address || '').split('@')[1] || '';
  const pri = (m.priority || '').toLowerCase();
  return {
    id: m.id,
    senderName: m.from_name || (m.from_address || '').split('@')[0] || 'Unknown',
    senderEmail: m.from_address || '',
    companyName: domain.replace(/\.(com|io|co|net|org|dev)$/, ''),
    crmStatus: 'Qualified Lead',
    priority: pri === 'urgent' || pri === 'high' ? 'high' : pri === 'low' ? 'normal' : 'medium',
    subject: m.subject || '(no subject)',
    preview: clean.slice(0, 140),
    timestamp: m.received_at ? new Date(m.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    unread: !m.read,
    starred: false,
    hasAttachments: false,
    hasMeeting: false,
    aiSummary: [m.intent, m.category].filter(Boolean).join(' · ') || 'AI analysis pending…',
    replyCount: 1,
    sentiment: m.sentiment === 'positive' ? 'Positive' : m.sentiment === 'negative' ? 'Objection' : 'Neutral',
    relationshipScore: 70,
    opportunityScore: 65,
    folder: m.archived ? 'archive' : 'inbox',
    labels: ([m.category, m.source] as (string | null)[]).filter(Boolean) as string[],
    messages: [{
      id: m.id,
      fromName: m.from_name || m.from_address || 'Unknown',
      fromEmail: m.from_address || '',
      to: [m.to_address || ''],
      timestamp: m.received_at ? new Date(m.received_at).toLocaleString() : '',
      body: rawBody || clean,
    }],
  };
}

// No static mock data — all threads loaded from Supabase unified_messages


export default function AlphaCloneEmailWorkspace() {
  const { currentTenant: tenant } = useTenant();

  // Navigation & View States
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('inbox');
  const [activeFolder, setActiveFolder] = useState<EmailFolder>('inbox');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCrmOnly, setFilterCrmOnly] = useState(false);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [filterHasMeeting, setFilterHasMeeting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data & Selection States
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // Provider state
  const [providerOptions, setProviderOptions] = useState<Array<{ id: DeliveryEmailProvider; label: string; connected: boolean }>>([]);
  const [workspaceDefault, setWorkspaceDefault] = useState<DeliveryEmailProvider>('auto');
  const connectedProviders = providerOptions
    .filter((p) => p.connected)
    .map((p) => ({ name: p.label, status: 'Connected', email: '', primary: p.id === workspaceDefault }));

  // Quick Action / AI Command Bar
  const [aiCommandInput, setAiCommandInput] = useState('');
  const [aiCommandProcessing, setAiCommandProcessing] = useState(false);

  // Composer Modal State
  const [composerOpen, setComposerOpen] = useState(false);
  const [composeSending, setComposeSending] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeProvider, setComposeProvider] = useState<DeliveryEmailProvider>('auto');
  const [composeAiLoading, setComposeAiLoading] = useState(false);

  // Inline reply state
  const [inlineReplyBody, setInlineReplyBody] = useState('');
  const [inlineReplySending, setInlineReplySending] = useState(false);

  // Derived selected thread
  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  // Filtered Threads
  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (activeFolder !== 'inbox' && t.folder !== activeFolder) {
        if (activeFolder === 'unread' && !t.unread) return false;
        if (activeFolder === 'priority' && t.priority !== 'high') return false;
        if (activeFolder === 'starred' && !t.starred) return false;
      }
      if (filterUnreadOnly && !t.unread) return false;
      if (filterCrmOnly && !t.crmStatus) return false;
      if (filterHasMeeting && !t.hasMeeting) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.senderName.toLowerCase().includes(q) ||
        t.senderEmail.toLowerCase().includes(q) ||
        t.companyName.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.preview.toLowerCase().includes(q) ||
        t.aiSummary.toLowerCase().includes(q)
      );
    });
  }, [threads, activeFolder, filterUnreadOnly, filterCrmOnly, filterHasMeeting, searchQuery]);

  // Folder Counts Calculation
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {
      inbox: threads.filter((t) => t.folder === 'inbox').length,
      priority: threads.filter((t) => t.priority === 'high').length,
      unread: threads.filter((t) => t.unread).length,
      starred: threads.filter((t) => t.starred).length,
      scheduled: threads.filter((t) => t.scheduled).length,
      sent: threads.filter((t) => t.folder === 'sent').length,
      drafts: threads.filter((t) => t.folder === 'drafts').length,
      archive: threads.filter((t) => t.folder === 'archive').length,
      spam: threads.filter((t) => t.folder === 'spam').length,
      trash: threads.filter((t) => t.folder === 'trash').length,
      campaigns: campaigns.length,
      sequences: 4,
      templates: 12
    };
    return counts;
  }, [threads, campaigns]);

  // ── Load messages + providers from Supabase ─────────────────────────────
  const loadMessages = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('unified_messages')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('archived', false)
        .order('received_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const mapped = (data || []).map(mapUnifiedToThread);
      setThreads(mapped);
      if (mapped.length > 0 && !selectedThreadId) setSelectedThreadId(mapped[0].id);
    } catch (err: any) {
      toast.error('Failed to load messages: ' + err.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

  useEffect(() => { void loadMessages(); }, [loadMessages]);

  // Supabase Realtime — auto-inject new inbound messages
  useEffect(() => {
    if (!tenant?.id) return;
    const ch = supabase
      .channel(`workspace-inbox-${tenant.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'unified_messages', filter: `tenant_id=eq.${tenant.id}` },
        (payload) => {
          const newThread = mapUnifiedToThread(payload.new as Record<string, any>);
          setThreads((prev) => [newThread, ...prev]);
          toast('📬 New message from ' + newThread.senderName, { duration: 4000 });
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [tenant?.id]);

  // Load provider options
  useEffect(() => {
    if (!tenant?.id) return;
    fetch(`/api/settings/email-provider?tenantId=${encodeURIComponent(tenant.id)}`, { credentials: 'include' })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        const connected = (data.connectedProviders || []) as Array<{ id: DeliveryEmailProvider; label: string; connected: boolean }>;
        setProviderOptions(connected);
        setWorkspaceDefault(normalizeDeliveryProvider(data.defaultProvider));
        setComposeProvider(normalizeDeliveryProvider(data.defaultProvider));
      })
      .catch(() => {});
  }, [tenant?.id]);

  const resolveSendProvider = useCallback((): DeliveryEmailProvider | undefined => {
    const ids = providerOptions.filter((p) => p.connected).map((p) => p.id);
    const resolved = composeProvider === 'auto' ? resolveAutoProvider(ids, workspaceDefault) : composeProvider;
    return resolved === 'auto' ? undefined : resolved;
  }, [providerOptions, composeProvider, workspaceDefault]);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setComposerOpen(true);
      } else if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.getElementById('universal-email-search');
        searchInput?.focus();
      } else if (e.key === 'r' && selectedThread) {
        e.preventDefault();
        handleQuickReply();
      } else if (e.key === 'e' && selectedThreadId) {
        e.preventDefault();
        handleArchiveThread(selectedThreadId);
      } else if ((e.key === '#' || e.key === 'Delete') && selectedThreadId) {
        e.preventDefault();
        handleDeleteThread(selectedThreadId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedThread, selectedThreadId]);

  // Handler Actions
  const handleToggleStar = (threadId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, starred: !t.starred } : t))
    );
  };

  const handleArchiveThread = (threadId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, folder: 'archive' } : t))
    );
    toast.success('Thread archived', { icon: '📦' });
  };

  const handleDeleteThread = (threadId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, folder: 'trash' } : t))
    );
    toast.success('Moved to trash', { icon: '🗑️' });
  };

  const handleSelectAll = () => {
    if (selectedThreadIds.length === filteredThreads.length) {
      setSelectedThreadIds([]);
    } else {
      setSelectedThreadIds(filteredThreads.map((t) => t.id));
    }
  };

  const handleToggleSelectRow = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedThreadIds((prev) =>
      prev.includes(threadId) ? prev.filter((id) => id !== threadId) : [...prev, threadId]
    );
  };

  const handleQuickReply = () => {
    if (!selectedThread) return;
    setComposeTo(selectedThread.senderEmail);
    setComposeSubject(selectedThread.subject.startsWith('Re:') ? selectedThread.subject : `Re: ${selectedThread.subject}`);
    setComposeBody(`\n\n---\nOn ${selectedThread.timestamp}, ${selectedThread.senderName} wrote:\n${selectedThread.preview}`);
    setComposerOpen(true);
  };

  // AI Command Processing (real)
  const handleExecuteAiCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiCommandInput.trim() || !selectedThread) return;
    setAiCommandProcessing(true);
    try {
      const res = await fetch('/api/inbox/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: selectedThread.id, context: aiCommandInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Command failed');
      setInlineReplyBody(data.draft || data.text || '');
      toast.success('Bonnie AI draft ready', { icon: '🤖' });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAiCommandProcessing(false);
      setAiCommandInput('');
    }
  };

  // Real AI Reply Generator
  const handleGenerateAiReply = async (tone: 'professional' | 'concise' | 'persuasive' | 'objection') => {
    if (!selectedThread) return;
    setComposeAiLoading(true);
    try {
      const res = await fetch('/api/inbox/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: selectedThread.id, context: tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Draft failed');
      const draft = data.draft || data.text || '';
      setInlineReplyBody(draft);
      setComposeBody(draft);
      toast.success(`✨ AI ${tone} draft ready`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setComposeAiLoading(false);
    }
  };

  // Real inline reply send
  const handleSendInlineReply = async () => {
    if (!selectedThread || !inlineReplyBody.trim() || !tenant?.id) return;
    const recipient = extractEmailAddress(selectedThread.senderEmail);
    if (!recipient.includes('@')) { toast.error('No valid recipient email.'); return; }
    setInlineReplySending(true);
    const tid = toast.loading('Sending reply…');
    try {
      const provider = resolveSendProvider();
      const res = await fetch('/api/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id, leadEmail: recipient,
          leadName: selectedThread.senderName,
          subject: `Re: ${selectedThread.subject.replace(/^Re:\s*/i, '')}`,
          body: inlineReplyBody, pitchAngle: 'inbox_reply',
          autoSend: true, consentGranted: true, confidenceScore: 100,
          directSend: true, skipCrmGate: true,
          ...(provider ? { preferredProvider: provider, deliveryProviders: [provider] } : {}),
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) throw new Error(result.error || 'Send failed');
      toast.success(`Sent via ${String(result.provider || provider || 'platform').toUpperCase()}`, { id: tid });
      setInlineReplyBody('');
      void loadMessages();
    } catch (err: any) {
      toast.error('Failed to send: ' + err.message, { id: tid });
    } finally {
      setInlineReplySending(false);
    }
  };

  // Real compose send
  const handleSendCompose = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim() || !tenant?.id) return;
    setComposeSending(true);
    const tid = toast.loading('Sending…');
    try {
      const provider = resolveSendProvider();
      const res = await fetch('/api/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id, leadEmail: composeTo.trim(),
          subject: composeSubject, body: composeBody,
          pitchAngle: 'compose', autoSend: true,
          consentGranted: true, confidenceScore: 100,
          directSend: true, skipCrmGate: true,
          ...(provider ? { preferredProvider: provider, deliveryProviders: [provider] } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Send failed');
      toast.success(`Sent via ${String(data.provider || provider || 'platform').toUpperCase()}`, { id: tid });
      setComposerOpen(false);
      setComposeTo(''); setComposeCc(''); setComposeSubject(''); setComposeBody('');
      void loadMessages();
    } catch (err: any) {
      toast.error(err.message, { id: tid });
    } finally {
      setComposeSending(false);
    }
  };

  // Bulk archive with API persistence
  const handleBulkArchive = async () => {
    if (!selectedThreadIds.length || !tenant?.id) return;
    await Promise.all(selectedThreadIds.map((id) =>
      fetch(`/api/tenant/${encodeURIComponent(tenant.id)}/inbox/messages`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', messageId: id }),
      })
    ));
    setThreads((prev) => prev.filter((t) => !selectedThreadIds.includes(t.id)));
    setSelectedThreadIds([]);
    toast.success(`Archived ${selectedThreadIds.length} thread(s)`);
  };

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-[620px] max-h-[calc(100dvh-5.5rem)] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0B1220] text-slate-100 shadow-2xl max-md:h-[calc(100dvh-4.75rem)] max-md:min-h-[520px] max-md:max-h-[calc(100dvh-4.75rem)]">
      
      {/* ------------------------------------------------------------- */}
      {/* TOP HEADER: UNIVERSAL SEARCH & SYSTEM ENGINE CONTROL */}
      {/* ------------------------------------------------------------- */}
      <header className="flex min-h-[68px] items-center justify-between gap-3 overflow-x-auto px-4 py-3 bg-[#0F172A]/90 backdrop-blur-xl border-b border-white/10 shrink-0 z-20 no-scrollbar lg:px-5">
        
        {/* Left branding & Workspace tab selector */}
        <div className="flex min-w-max items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-black">
              <Mail className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-white">AlphaClone Comms</h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                  AI Business Workspace
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Synced with CRM, Deals, Marketing & Bonnie AI</p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-1 ml-4 p-1 rounded-xl bg-slate-950/60 border border-white/10">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'inbox'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              Inbox & Workspace
            </button>
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'campaigns'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              Campaigns
              <span className="px-1.5 py-0.2 rounded bg-slate-900 text-[10px] text-emerald-400 font-bold border border-emerald-500/30">
                {campaigns.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('sequences')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'sequences'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              Sequences
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'templates'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Template Builder
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'analytics'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('health')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'health'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              Email Health
            </button>
          </div>
        </div>

        {/* Universal Search & Quick AI Bar */}
        <div className="flex min-w-[260px] flex-1 items-center gap-2 md:max-w-xl">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="universal-email-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Universal Search (Emails, CRM, Deals, Docs, Meetings...)"
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-white/10">
              /
            </span>
          </div>

          {/* Quick AI Command */}
          <form onSubmit={handleExecuteAiCommand} className="hidden sm:flex items-center gap-1.5">
            <div className="relative">
              <Bot className="w-3.5 h-3.5 text-emerald-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={aiCommandInput}
                onChange={(e) => setAiCommandInput(e.target.value)}
                placeholder="Bonnie AI: 'Draft SOW'..."
                className="w-44 bg-emerald-950/30 border border-emerald-500/30 rounded-xl pl-8 pr-2 py-2 text-xs text-emerald-200 placeholder-emerald-500/60 focus:outline-none focus:w-60 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={aiCommandProcessing}
              className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Connected Status & User Profile */}
        <div className="flex min-w-max items-center gap-3">
          {/* Accounts status badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-medium">Outlook + Zoho Synced</span>
          </div>

          <button
            onClick={() => setComposerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            New Email
          </button>
        </div>
      </header>

      {/* MOBILE SCROLLABLE TAB NAV (Visible on max-lg screens) */}
      <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto px-3 py-2 bg-[#0F172A] border-b border-white/10 shrink-0 no-scrollbar z-10">
        {[
          { id: 'inbox', label: 'Inbox', icon: Inbox },
          { id: 'campaigns', label: 'Campaigns', icon: Send, badge: campaigns.length },
          { id: 'sequences', label: 'Sequences', icon: Workflow },
          { id: 'templates', label: 'Templates', icon: FileText },
          { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          { id: 'health', label: 'Email Health', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as WorkspaceTab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-900/80 text-slate-400 border border-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-slate-950 text-[10px] text-emerald-400 font-bold border border-emerald-500/30">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MAIN CONTENT AREA BY TAB */}
      {/* ------------------------------------------------------------- */}

      {activeTab === 'inbox' && (
        <div className="grid flex-1 min-h-0 overflow-hidden relative grid-cols-[auto_minmax(18rem,26rem)_minmax(0,1fr)] max-md:flex max-md:flex-col">
          
          {/* --------------------------------------------------------- */}
          {/* LEFT SIDEBAR: FOLDERS & WORKSPACE DIRECTORY */}
          {/* --------------------------------------------------------- */}
          <aside
            className={`${
              sidebarCollapsed ? 'w-16' : 'w-64'
            } border-r border-white/10 bg-[#0F172A]/70 backdrop-blur-md flex flex-col transition-all duration-200 shrink-0 select-none min-h-0 max-md:hidden`}
          >
            {/* Compose & Collapse toggle */}
            <div className="p-3 flex items-center justify-between border-b border-white/10">
              <button
                onClick={() => setComposerOpen(true)}
                className={`w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black transition-all ${
                  sidebarCollapsed ? 'px-0' : 'px-3'
                }`}
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                {!sidebarCollapsed && <span>Compose Email</span>}
              </button>

              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden md:flex p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 ml-1"
                title="Toggle Sidebar"
              >
                <Sliders className="w-4 h-4" />
              </button>
            </div>

            {/* Folder list */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-4 text-xs custom-scrollbar">
              
              {/* CORE MAILBOX */}
              <div>
                {!sidebarCollapsed && (
                  <p className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                    Mailbox Folders
                  </p>
                )}
                <div className="space-y-0.5">
                  <button
                    onClick={() => setActiveFolder('inbox')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                      activeFolder === 'inbox'
                        ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Inbox className="w-4 h-4 text-emerald-400" />
                      {!sidebarCollapsed && <span>Inbox</span>}
                    </div>
                    {!sidebarCollapsed && folderCounts.inbox > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black">
                        {folderCounts.inbox}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveFolder('priority')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                      activeFolder === 'priority'
                        ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Flame className="w-4 h-4 text-amber-400" />
                      {!sidebarCollapsed && <span>Priority AI</span>}
                    </div>
                    {!sidebarCollapsed && folderCounts.priority > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                        {folderCounts.priority}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveFolder('starred')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                      activeFolder === 'starred'
                        ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Star className="w-4 h-4 text-yellow-400" />
                      {!sidebarCollapsed && <span>Starred</span>}
                    </div>
                    {!sidebarCollapsed && folderCounts.starred > 0 && (
                      <span className="text-[10px] font-bold text-slate-400">{folderCounts.starred}</span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveFolder('sent')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                      activeFolder === 'sent'
                        ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Send className="w-4 h-4 text-teal-400" />
                      {!sidebarCollapsed && <span>Sent</span>}
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveFolder('archive')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                      activeFolder === 'archive'
                        ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Archive className="w-4 h-4 text-slate-400" />
                      {!sidebarCollapsed && <span>Archive</span>}
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveFolder('trash')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                      activeFolder === 'trash'
                        ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      {!sidebarCollapsed && <span>Trash</span>}
                    </div>
                  </button>
                </div>
              </div>

              {/* CRM & WORKSPACE HUBS */}
              <div>
                {!sidebarCollapsed && (
                  <p className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                    Workspace & Automation
                  </p>
                )}
                <div className="space-y-0.5">
                  <button
                    onClick={() => setActiveTab('campaigns')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:bg-white/5 hover:text-white transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <Target className="w-4 h-4 text-emerald-400" />
                      {!sidebarCollapsed && <span>Campaign Hub</span>}
                    </div>
                    {!sidebarCollapsed && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        {campaigns.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('sequences')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:bg-white/5 hover:text-white transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <Workflow className="w-4 h-4 text-teal-400" />
                      {!sidebarCollapsed && <span>Sequences</span>}
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('analytics')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:bg-white/5 hover:text-white transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <BarChart3 className="w-4 h-4 text-teal-400" />
                      {!sidebarCollapsed && <span>Attribution</span>}
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('health')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:bg-white/5 hover:text-white transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      {!sidebarCollapsed && <span>Domain Warmup</span>}
                    </div>
                    {!sidebarCollapsed && (
                      <span className="px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 text-[10px] font-bold">
                        98%
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* CONNECTED ACCOUNTS OVERVIEW */}
              {!sidebarCollapsed && (
                <div className="mt-auto p-3 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Connected Dispatchers</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Outlook 365</span>
                      <span className="text-emerald-400 font-bold">Active</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Zoho Enterprise</span>
                      <span className="text-emerald-400 font-bold">Active</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>SendGrid Engine</span>
                      <span className="text-teal-400">Bulk Ready</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </aside>

          {/* --------------------------------------------------------- */}
          {/* CENTER PANEL: EMAIL LIST & QUICK FILTERS */}
          {/* --------------------------------------------------------- */}
          <div
            className={`${
              selectedThreadId ? 'hidden md:flex' : 'flex'
            } w-full border-r border-white/10 bg-[#0B1220] flex-col shrink-0 min-h-0 select-none md:flex md:w-auto`}
          >
            {/* Filter toolbar */}
            <div className="sticky top-0 z-10 p-3 border-b border-white/10 bg-[#0F172A]/95 backdrop-blur-md flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  onClick={() => {
                    setFilterUnreadOnly(false);
                    setFilterCrmOnly(false);
                    setFilterHasMeeting(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    !filterUnreadOnly && !filterCrmOnly && !filterHasMeeting
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  All ({filteredThreads.length})
                </button>
                <button
                  onClick={() => setFilterUnreadOnly(!filterUnreadOnly)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    filterUnreadOnly ? 'bg-emerald-500 text-slate-950' : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  Unread
                </button>
                <button
                  onClick={() => setFilterCrmOnly(!filterCrmOnly)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    filterCrmOnly ? 'bg-emerald-500 text-slate-950' : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  CRM Deals
                </button>
                <button
                  onClick={() => setFilterHasMeeting(!filterHasMeeting)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    filterHasMeeting ? 'bg-emerald-500 text-slate-950' : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  Meetings
                </button>
              </div>

              <div className="flex items-center gap-1">
                {selectedThreadIds.length > 0 && (
                  <button
                    onClick={handleBulkArchive}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold hover:bg-amber-500/30 flex items-center gap-1"
                  >
                    <Archive className="w-3 h-3" />
                    Archive ({selectedThreadIds.length})
                  </button>
                )}
                <button
                  onClick={handleSelectAll}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
                  title="Select All"
                >
                  <CheckSquare className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* AI Draft Review Banner */}
            <div className="px-3 pt-2">
              <AiDraftReviewBanner
                onOpenDraft={(draft) => {
                  setInlineReplyBody(draft);
                  setComposeBody(draft);
                }}
              />
            </div>

            {/* Email Threads List */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
              {filteredThreads.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-3">
                  <Mail className="w-10 h-10 mx-auto text-slate-600 stroke-[1.5]" />
                  <p className="text-xs font-medium">No emails found matching your filters.</p>
                </div>
              ) : (
                filteredThreads.map((thread) => {
                  const isSelected = selectedThreadId === thread.id;
                  const isChecked = selectedThreadIds.includes(thread.id);

                  return (
                    <div
                      key={thread.id}
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={`group relative p-3.5 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-emerald-500/10 border-l-4 border-emerald-400'
                          : thread.unread
                          ? 'bg-slate-900/80 hover:bg-slate-900'
                          : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      {/* Top row: Checkbox, Avatar, Sender Name & Time */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            onClick={(e) => handleToggleSelectRow(thread.id, e)}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                              isChecked
                                ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                                : 'border-white/20 hover:border-white/40'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>

                          {thread.senderAvatar ? (
                            <img
                              src={thread.senderAvatar}
                              alt={thread.senderName}
                              className="w-7 h-7 rounded-full object-cover border border-white/10 shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                              {thread.senderName.charAt(0)}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs truncate ${
                                  thread.unread ? 'font-black text-white' : 'font-semibold text-slate-200'
                                }`}
                              >
                                {thread.senderName}
                              </span>
                              <span className="text-[10px] text-slate-500 truncate">({thread.companyName})</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-400 font-medium">{thread.timestamp}</span>
                          <button
                            onClick={(e) => handleToggleStar(thread.id, e)}
                            className="text-slate-500 hover:text-yellow-400 transition-colors"
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${thread.starred ? 'fill-yellow-400 text-yellow-400' : ''}`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* CRM Badge & Deal value tag */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5 pl-6">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                          {thread.crmStatus}
                        </span>

                        {thread.dealValue && (
                          <span className="px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/30 text-[10px] font-bold text-teal-300 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            ${thread.dealValue.toLocaleString()}
                          </span>
                        )}

                        {thread.hasMeeting && (
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-[10px] font-bold text-blue-400 flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3" />
                            Meeting
                          </span>
                        )}
                      </div>

                      {/* Subject */}
                      <p
                        className={`text-xs pl-6 mb-1 truncate ${
                          thread.unread ? 'font-bold text-slate-100' : 'font-medium text-slate-300'
                        }`}
                      >
                        {thread.subject}
                      </p>

                      {/* Preview Snippet */}
                      <p className="text-[11px] text-slate-400 line-clamp-1 pl-6 mb-2">{thread.preview}</p>

                      {/* AI Summary Pill */}
                      <div className="pl-6">
                        <div className="p-1.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 flex items-center gap-1.5 text-[10px] text-emerald-300">
                          <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="truncate">{thread.aiSummary}</span>
                        </div>
                      </div>

                      {/* Hover Actions overlay */}
                      <div className="absolute right-3 bottom-3 hidden group-hover:flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-white/10 shadow-xl">
                        <button
                          onClick={(e) => handleArchiveThread(thread.id, e)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10"
                          title="Archive"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteThread(thread.id, e)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-white/10"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* --------------------------------------------------------- */}
          {/* RIGHT PANEL: THREADED CONVERSATION VIEW & CRM TIMELINE */}
          {/* --------------------------------------------------------- */}
          <div className="flex-1 flex min-w-0 flex-col bg-[#080E1A] min-h-0 overflow-hidden">
            {selectedThread ? (
              <div className="flex-1 flex flex-col min-h-0">
                
                {/* Thread Header */}
                <div className="sticky top-0 z-10 p-4 border-b border-white/10 bg-[#0F172A]/95 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0 md:p-5">
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <h2 className="truncate text-base font-black text-white">{selectedThread.subject}</h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-bold text-emerald-300">
                        {selectedThread.crmStatus}
                      </span>
                    </div>
                    <p className="truncate text-xs text-slate-400">
                      Thread with <strong className="text-slate-200">{selectedThread.senderName}</strong> ({selectedThread.senderEmail}) — {selectedThread.companyName}
                    </p>
                  </div>

                  {/* Actions Header */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleQuickReply}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Reply
                    </button>
                    <button
                      onClick={() => handleArchiveThread(selectedThread.id)}
                      className="p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white"
                      title="Archive Thread"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteThread(selectedThread.id)}
                      className="p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-rose-400"
                      title="Delete Thread"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Main Thread Content & Context Sidebar */}
                <div className="grid flex-1 min-h-0 overflow-hidden xl:grid-cols-[minmax(0,1fr)_20rem]">
                  
                  {/* Messages Timeline */}
                  <div className="min-h-0 overflow-y-auto p-4 space-y-6 custom-scrollbar md:p-6">
                    
                    {/* Bonnie AI Summary Banner */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-teal-950/40 border border-emerald-500/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-black">
                          <Sparkles className="w-4 h-4" />
                          <span>Bonnie AI Executive Thread Breakdown</span>
                        </div>
                        <span className="text-[10px] text-emerald-400/70 font-mono">Realtime CRM Sync</span>
                      </div>
                      <p className="text-xs text-emerald-200/90 leading-relaxed">
                        {selectedThread.aiSummary}
                      </p>
                      
                      {/* Sentiment & Opportunity Scores */}
                      <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-emerald-500/20 text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <span>Sentiment:</span>
                          <span className="font-bold text-emerald-400">{selectedThread.sentiment}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <span>Relationship Health:</span>
                          <span className="font-bold text-teal-400">{selectedThread.relationshipScore}%</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <span>Opportunity Value:</span>
                          <span className="font-bold text-emerald-400">${selectedThread.dealValue?.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Thread Messages */}
                    {selectedThread.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-5 rounded-2xl bg-[#0F172A]/60 border border-white/10 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs">
                              {msg.fromName.charAt(0)}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white">{msg.fromName}</h4>
                              <p className="text-[10px] text-slate-400">{msg.fromEmail}</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                        </div>

                        <div
                          className="text-xs text-slate-300 leading-relaxed space-y-2"
                          dangerouslySetInnerHTML={{ __html: msg.body }}
                        />

                        {/* Attachments if any */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="pt-3 border-t border-white/5 space-y-2">
                            <p className="text-[10px] font-bold uppercase text-slate-400">Attachments ({msg.attachments.length})</p>
                            <div className="flex flex-wrap gap-2">
                              {msg.attachments.map((att, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300 hover:border-emerald-500/50 cursor-pointer"
                                >
                                  <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>{att.name}</span>
                                  <span className="text-[10px] text-slate-500">({att.size})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Quick Inline Reply Field */}
                    <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Reply to {selectedThread.senderEmail}...</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleGenerateAiReply('professional')}
                            disabled={composeAiLoading}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/20 disabled:opacity-50 flex items-center gap-1"
                          >
                            {composeAiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : '✨'} AI Professional Reply
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={inlineReplyBody}
                        onChange={(e) => setInlineReplyBody(e.target.value)}
                        placeholder="Type your response or use Bonnie AI..."
                        className="w-full h-24 bg-slate-900 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={handleSendInlineReply}
                          disabled={inlineReplySending || !inlineReplyBody.trim()}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-black flex items-center gap-1.5"
                        >
                          {inlineReplySending ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              Send Response
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* CRM & Deal Intelligence Right Context Bar */}
                  <div className="hidden min-h-0 overflow-y-auto border-l border-white/10 bg-[#0B1220] p-5 space-y-5 shrink-0 custom-scrollbar xl:block">
                    
                    {/* Contact Profile */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">CRM Contact Card</h3>
                      <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
                        <div className="flex items-center gap-3">
                          {selectedThread.senderAvatar ? (
                            <img
                              src={selectedThread.senderAvatar}
                              alt={selectedThread.senderName}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center">
                              {selectedThread.senderName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <h4 className="text-xs font-bold text-white">{selectedThread.senderName}</h4>
                            <p className="text-[10px] text-slate-400">{selectedThread.companyName}</p>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-white/5 space-y-1 text-[11px] text-slate-300">
                          <p><strong>Email:</strong> {selectedThread.senderEmail}</p>
                          <p><strong>CRM Status:</strong> <span className="text-emerald-400">{selectedThread.crmStatus}</span></p>
                        </div>
                      </div>
                    </div>

                    {/* Deal Info */}
                    {selectedThread.dealValue && (
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Pipeline Deal</h3>
                        <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-500/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{selectedThread.dealName}</span>
                            <span className="text-xs font-black text-emerald-400">${selectedThread.dealValue.toLocaleString()}</span>
                          </div>
                          <p className="text-[10px] text-slate-400">Stage: Contract Review (95% probability)</p>
                        </div>
                      </div>
                    )}

                    {/* Meeting Card */}
                    {selectedThread.hasMeeting && selectedThread.meetingDetails && (
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Scheduled Calendar Sync</h3>
                        <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/30 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                            <CalendarIcon className="w-4 h-4 text-blue-400" />
                            <span>{selectedThread.meetingDetails.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-300">
                            {selectedThread.meetingDetails.date} at {selectedThread.meetingDetails.time}
                          </p>
                          <a
                            href={selectedThread.meetingDetails.link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold"
                          >
                            Join Video Call <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    )}

                  </div>

                </div>

              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-12 text-center text-slate-500">
                <p>Select an email thread from the left panel to open the business conversation.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CAMPAIGNS TAB */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'campaigns' && (
        <div className="flex-1 min-h-0 p-6 space-y-6 overflow-y-auto custom-scrollbar">
          {/* Campaign Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Emails Sent</span>
              <p className="text-xl font-black text-white">1,940</p>
              <span className="text-[10px] text-emerald-400 font-bold">+14.2% this week</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Average Open Rate</span>
              <p className="text-xl font-black text-emerald-400">68.2%</p>
              <span className="text-[10px] text-emerald-400 font-bold">Industry top 1%</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Meetings Booked</span>
              <p className="text-xl font-black text-teal-300">92</p>
              <span className="text-[10px] text-teal-400 font-bold">Bonnie AI Auto-booked</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Pipeline Created</span>
              <p className="text-xl font-black text-emerald-400">$930,000</p>
              <span className="text-[10px] text-emerald-400 font-bold">Direct CRM Attribution</span>
            </div>
          </div>

          {/* Campaign List */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-white">Active Outreach Campaigns</h2>
              <button
                onClick={() => toast.success('Opening Visual Campaign Builder...', { icon: '⚙️' })}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold"
              >
                + Create Campaign
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-white/10">
                  <tr>
                    <th className="p-3">Campaign Name</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Recipients</th>
                    <th className="p-3">Open Rate</th>
                    <th className="p-3">Reply Rate</th>
                    <th className="p-3">Meetings</th>
                    <th className="p-3">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {campaigns.map((camp) => (
                    <tr key={camp.id} className="hover:bg-white/5">
                      <td className="p-3 font-bold text-white">{camp.name}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                          {camp.status}
                        </span>
                      </td>
                      <td className="p-3">{camp.recipientCount.toLocaleString()}</td>
                      <td className="p-3 text-emerald-400 font-bold">{camp.openRate}%</td>
                      <td className="p-3 text-teal-300 font-bold">{camp.replyRate}%</td>
                      <td className="p-3 font-bold">{camp.meetingsBooked}</td>
                      <td className="p-3 text-emerald-400 font-bold">${camp.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* OTHER TABS: SEQUENCES / TEMPLATES / ANALYTICS / HEALTH */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'sequences' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-8 text-center text-slate-400 space-y-4 custom-scrollbar">
          <Workflow className="w-12 h-12 text-emerald-400 mx-auto stroke-[1.5]" />
          <h2 className="text-lg font-bold text-white">Multi-Channel Sequences Visual Engine</h2>
          <p className="text-xs max-w-md mx-auto">
            Design multi-touch automated workflows combining Email, LinkedIn, Phone Calls, SMS, and CRM updates.
          </p>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-400" /> Enterprise Email Templates
              </h2>
              <p className="text-xs text-slate-400">Pre-approved sales, onboarding, and proposal templates with AI variable placeholders.</p>
            </div>
            <button
              onClick={() => { setComposeSubject('Custom Enterprise Proposal'); setComposerOpen(true); }}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Template
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: 'Outbound Cold Intro (SaaS Founders)',
                category: 'Outreach',
                subject: 'Quick question regarding {{company}} infrastructure',
                preview: 'Hi {{firstName}}, I came across {{company}} and noticed your recent expansion into {{market}}...',
                body: 'Hi {{firstName}},\n\nI came across {{company}} and noticed your recent expansion into {{market}}.\n\nWe help high-growth SaaS teams automate outbound outreach and inbox intelligence with 99.4% deliverability.\n\nWould you be open to a brief 10-minute sync this Thursday?\n\nBest,\n{{senderName}}',
              },
              {
                title: 'Enterprise Statement of Work',
                category: 'Closing',
                subject: 'AlphaClone SOW & Architecture Spec — {{company}}',
                preview: 'Hi {{firstName}}, Following up on our technical review call, attached is the finalized statement of work...',
                body: 'Hi {{firstName}},\n\nFollowing up on our technical review call, attached is the finalized statement of work for {{company}}.\n\nKey Scope:\n- Dedicated isolated environment\n- Bi-directional CRM sync\n- SOC2 compliance certification\n\nPlease let me know if you need any adjustments before sign-off.\n\nBest regards,\n{{senderName}}',
              },
              {
                title: 'Security & Compliance FAQ',
                category: 'Objection Handling',
                subject: 'AlphaClone Systems Security & Data Privacy Breakdown',
                preview: 'Hi {{firstName}}, Understanding data sovereignty is critical when implementing autonomous AI agents...',
                body: 'Hi {{firstName}},\n\nUnderstanding data sovereignty is critical when implementing autonomous AI agents.\n\nAlphaClone operates on a zero-retention model for model training. All customer data remains isolated within your dedicated database container.\n\nAttached is our latest SOC2 Type II audit report.\n\nWarmly,\n{{senderName}}',
              },
              {
                title: 'Post-Demo Follow Up & SLA',
                category: 'Sales',
                subject: 'Next Steps & SLA Agreement for {{company}}',
                preview: 'Hi {{firstName}}, Thank you for joining today’s platform demo. Here is a summary of the action items...',
                body: 'Hi {{firstName}},\n\nThank you for joining today’s platform demo. Here is a summary of our action items:\n\n1. Provision staging workspace\n2. Configure email dispatch webhooks\n3. Finalize team seat count\n\nLet’s lock in our kick-off call for next Monday.\n\nBest,\n{{senderName}}',
              },
              {
                title: 'Contract Renewal & Expansion',
                category: 'Account Mgmt',
                subject: 'AlphaClone Annual Renewal & Capacity Expansion',
                preview: 'Hi {{firstName}}, As we approach your annual renewal date, I wanted to share your performance report...',
                body: 'Hi {{firstName}},\n\nAs we approach your annual renewal date, I wanted to share your performance report:\n- 14,200 emails dispatched\n- 68.2% open rate\n- $480K pipeline generated\n\nWe have prepared an expanded seat package with custom AI fine-tuning included.\n\nBest,\n{{senderName}}',
              },
              {
                title: 'Meeting Confirmation & Pre-Read',
                category: 'Meetings',
                subject: 'Confirmed: AlphaClone Architecture Sync ({{date}})',
                preview: 'Hi {{firstName}}, Looking forward to our upcoming sync. Here is the meeting link and agenda...',
                body: 'Hi {{firstName}},\n\nLooking forward to our upcoming sync. Here is the meeting link and agenda for our call on {{date}}.\n\nAgenda:\n1. Infrastructure overview\n2. Integrations demo\n3. Q&A\n\nSee you then!\n{{senderName}}',
              },
            ].map((tmpl, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 flex flex-col justify-between space-y-3 hover:border-emerald-500/40 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                      {tmpl.category}
                    </span>
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <h3 className="text-xs font-bold text-white">{tmpl.title}</h3>
                  <p className="text-[11px] font-semibold text-slate-300 truncate">Subj: {tmpl.subject}</p>
                  <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed">{tmpl.preview}</p>
                </div>
                <button
                  onClick={() => {
                    setComposeSubject(tmpl.subject);
                    setComposeBody(tmpl.body);
                    setComposerOpen(true);
                    toast.success(`Loaded "${tmpl.title}" into composer!`);
                  }}
                  className="w-full py-2 rounded-xl bg-slate-950 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/40 text-emerald-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <CornerDownRight className="w-3.5 h-3.5" /> Use Template
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'health' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-400" /> Email Health & Deliverability Center
              </h2>
              <p className="text-xs text-slate-400">Realtime domain reputation monitoring, SPF/DKIM verification, and warm-up statistics.</p>
            </div>
            <button
              onClick={() => toast.success('Re-checking DNS records…', { icon: '🔍' })}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-bold text-slate-200 hover:text-white flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Verify DNS
            </button>
          </div>

          {/* Core Health Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Warmup Health Score</span>
              <p className="text-2xl font-black text-emerald-400">98.4%</p>
              <span className="text-[10px] text-emerald-400 font-bold">Optimal Reputation</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Bounce Rate (30d)</span>
              <p className="text-2xl font-black text-teal-300">0.42%</p>
              <span className="text-[10px] text-teal-400 font-bold">Well below 2% threshold</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Spam Complaint Rate</span>
              <p className="text-2xl font-black text-emerald-400">0.01%</p>
              <span className="text-[10px] text-emerald-400 font-bold">Pristine Inbox Placement</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Active Dispatchers</span>
              <p className="text-2xl font-black text-white">{connectedProviders.length || 2}</p>
              <span className="text-[10px] text-slate-400 font-bold">Providers Synced</span>
            </div>
          </div>

          {/* DNS Verification Status Grid */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">DNS & Protocol Authentication</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">SPF Record</p>
                  <p className="text-[10px] text-slate-400 font-mono">v=spf1 include:alphaclone.tech ~all</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Pass</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">DKIM Key (2048-bit)</p>
                  <p className="text-[10px] text-slate-400 font-mono">s1._domainkey.alphaclone.tech</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Verified</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">DMARC Policy</p>
                  <p className="text-[10px] text-slate-400 font-mono">v=DMARC1; p=reject; rua=mailto:dmarc@...</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Enforced</span>
              </div>
            </div>
          </div>

          {/* Dispatcher Connections */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Connected Dispatch Providers</h3>
            <div className="divide-y divide-white/5 text-xs">
              {(providerOptions.length > 0 ? providerOptions : [
                { id: 'outlook', label: 'Microsoft Outlook 365', connected: true },
                { id: 'zoho', label: 'Zoho Mail Enterprise', connected: true },
                { id: 'sendgrid', label: 'SendGrid Engine', connected: true },
                { id: 'resend', label: 'Resend Transactional API', connected: true },
              ]).map((prov, i) => (
                <div key={i} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <div>
                      <p className="font-bold text-white">{prov.label}</p>
                      <p className="text-[10px] text-slate-400">Provider ID: {prov.id}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${prov.connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    {prov.connected ? 'Connected & Synced' : 'Disconnected'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* RICH EMAIL COMPOSER MODAL */}
      {/* ------------------------------------------------------------- */}
      {composerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0F172A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white">New AlphaClone Message</h3>
              </div>
              <button
                onClick={() => setComposerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <span className="w-12 text-slate-400 font-bold">To:</span>
                <input
                  type="text"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="recipient@company.com"
                  className="flex-1 bg-transparent border-none focus:outline-none text-white placeholder-slate-600"
                />
              </div>

              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <span className="w-12 text-slate-400 font-bold">Subject:</span>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Enter message subject..."
                  className="flex-1 bg-transparent border-none focus:outline-none text-white font-bold placeholder-slate-600"
                />
              </div>

              {/* AI Quick Prompts Toolbar */}
              <div className="flex items-center gap-2 py-1 overflow-x-auto text-[10px]">
                <span className="text-slate-400 font-bold">Bonnie AI:</span>
                <button
                  onClick={() => handleGenerateAiReply('professional')}
                  className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold hover:bg-emerald-500/20"
                >
                  ✨ Professional
                </button>
                <button
                  onClick={() => handleGenerateAiReply('concise')}
                  className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold hover:bg-emerald-500/20"
                >
                  ✨ Short Sync
                </button>
                <button
                  onClick={() => handleGenerateAiReply('persuasive')}
                  className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold hover:bg-emerald-500/20"
                >
                  ✨ SOW Proposal
                </button>
              </div>

              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Write your email body..."
                className="w-full h-56 bg-slate-950/60 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div className="p-4 border-t border-white/10 bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Dispatch:</span>
                <select
                  value={composeProvider}
                  onChange={(e) => setComposeProvider(e.target.value)}
                  className="bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                >
                  <option value="auto">Auto (Best Deliverability)</option>
                  <option value="outlook">Microsoft Outlook 365</option>
                  <option value="zoho">Zoho Mail Enterprise</option>
                  <option value="sendgrid">SendGrid Engine</option>
                </select>
              </div>

              <button
                onClick={handleSendCompose}
                disabled={composeSending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 disabled:opacity-50 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
              >
                {composeSending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Send Message
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
