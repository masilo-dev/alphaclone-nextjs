'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  MessageSquare, Mail, MessageCircle, Phone, 
  Sparkles, Send, Trash2, CheckCircle2, AlertCircle, 
  Archive, Loader2, ArrowRight, CornerUpLeft, ShieldAlert,
  Inbox, Brain, RefreshCw, Check, Star, CheckSquare
} from 'lucide-react';
import { ModuleStatCards, type ModuleStat } from '../common/ModuleStatCards';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { extractEmailAddress } from '@/lib/email/composeNavigation';
import toast from 'react-hot-toast';
import EmailLeadInsightPanel from '../inbox/EmailLeadInsightPanel';
import EmailProviderSelector from '@/components/shared/EmailProviderSelector';
import {
  normalizeDeliveryProvider,
  resolveAutoProvider,
  type DeliveryEmailProvider,
} from '@/lib/email/emailProviderOptions';

function resolveOutreachProvider(source?: string | null): string | undefined {
  const normalized = String(source || '').toLowerCase();
  if (normalized === 'zoho') return 'zoho';
  if (normalized === 'microsoft' || normalized === 'outlook') return 'microsoft';
  return undefined;
}

interface UnifiedMessage {
  id: string;
  tenant_id: string;
  source: string;
  channel: string;
  direction: string;
  external_id: string | null;
  thread_id: string | null;
  subject: string | null;
  body: string | null;
  html_body: string | null;
  from_address: string | null;
  from_name: string | null;
  to_address: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  priority: 'low' | 'normal' | 'high' | 'urgent' | null;
  category: string | null;
  intent: string | null;
  needs_response: boolean;
  auto_replied: boolean;
  received_at: string | null;
  sent_at: string | null;
  read: boolean;
  archived: boolean;
  metadata: Record<string, any> | null;
}

export default function UnifiedInboxTab() {
  const { currentTenant: tenant } = useTenant();
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<UnifiedMessage | null>(null);
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [draftingReply, setDraftingReply] = useState(false);
  const [draftReplyText, setDraftReplyText] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [processingIntelligence, setProcessingIntelligence] = useState(false);
  const [customReplyPrompt, setCustomReplyPrompt] = useState('');
  const [deliveryProvider, setDeliveryProvider] = useState<DeliveryEmailProvider>('auto');
  const [workspaceDefault, setWorkspaceDefault] = useState<DeliveryEmailProvider>('auto');
  const [providerOptions, setProviderOptions] = useState<
    Array<{ id: DeliveryEmailProvider; label: string; connected: boolean; native?: boolean; campaigns?: boolean }>
  >([]);
  const [savingDraft, setSavingDraft] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('unified_messages')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('archived', false)
        .order('received_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
      
      // Select the first message by default if none is selected
      if (data && data.length > 0 && !selectedMessage) {
        setSelectedMessage(data[0]);
      }
    } catch (err: any) {
      toast.error('Failed to load messages: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, selectedMessage]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!tenant?.id) return;
    fetch(`/api/settings/email-provider?tenantId=${encodeURIComponent(tenant.id)}`, {
      credentials: 'include',
    })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        const connected = (data.connectedProviders || []) as typeof providerOptions;
        setProviderOptions(connected);
        const tenantDefault = normalizeDeliveryProvider(data.defaultProvider);
        setWorkspaceDefault(tenantDefault);
        setDeliveryProvider(tenantDefault);
      })
      .catch(() => {});
  }, [tenant?.id]);

  const resolveSendProvider = () => {
    const connectedIds = providerOptions.filter((p) => p.connected).map((p) => p.id);
    const fromPicker =
      deliveryProvider === 'auto'
        ? resolveAutoProvider(connectedIds, workspaceDefault)
        : deliveryProvider;
    if (fromPicker !== 'auto') return fromPicker;
    return resolveOutreachProvider(selectedMessage?.source);
  };

  const handleSaveDraftToMailbox = async () => {
    if (!tenant?.id || !draftReplyText.trim()) return;
    setSavingDraft(true);
    try {
      const recipient = selectedMessage ? extractEmailAddress(selectedMessage.from_address) : '';
      const provider = resolveSendProvider();
      const res = await fetch('/api/email/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          to: recipient,
          subject: replySubject,
          body: draftReplyText,
          deliveryProvider: provider === 'auto' ? 'zoho' : provider,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save draft');
      toast.success(data.note || 'AI draft saved to drafts');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSelectMessage = async (msg: UnifiedMessage) => {
    setSelectedMessage(msg);
    setDraftReplyText('');
    setCustomReplyPrompt('');
    setReplySubject(msg.subject ? `Re: ${msg.subject.replace(/^Re:\s*/i, '')}` : 'Re: Your message');
    
    if (!msg.read) {
      // Mark as read in local state first
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
      // Save to database
      void fetch(`/api/tenant/${encodeURIComponent(tenant?.id || '')}/inbox/messages`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read', messageId: msg.id }) }).then(async (response) => {
        if (!response.ok) { await loadMessages(); toast.error('Message read state could not be saved'); }
      });
    }
  };

  const handleArchiveMessage = async (msgId: string) => {
    try {
      const response = await fetch(`/api/tenant/${encodeURIComponent(tenant?.id || '')}/inbox/messages`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'archive', messageId: msgId }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Message could not be archived');
      
      toast.success('Conversation archived');
      setMessages(prev => prev.filter(m => m.id !== msgId));
      if (selectedMessage?.id === msgId) {
        setSelectedMessage(null);
      }
    } catch (err: any) {
      toast.error('Failed to archive: ' + err.message);
    }
  };

  const handleMarkNeedsResponse = async (msgId: string, val: boolean) => {
    try {
      const response = await fetch(`/api/tenant/${encodeURIComponent(tenant?.id || '')}/inbox/messages`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'needs_response', messageId: msgId, value: val }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Message could not be updated');
      
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, needs_response: val } : m));
      if (selectedMessage?.id === msgId) {
        setSelectedMessage(prev => prev ? { ...prev, needs_response: val } : null);
      }
      toast.success(val ? 'Marked as needs response' : 'Marked as resolved');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  };

  const handleGenerateAIDraft = async () => {
    if (!selectedMessage) return;
    setDraftingReply(true);
    try {
      const res = await fetch('/api/inbox/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: selectedMessage.id,
          context: customReplyPrompt || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Draft generation failed');
      setDraftReplyText(data.draft);
      toast.success('AI draft generated — review before sending');

      if (tenant?.id && selectedMessage?.channel === 'email') {
        const provider = resolveSendProvider();
        void fetch('/api/email/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: tenant.id,
            to: extractEmailAddress(selectedMessage.from_address),
            subject: replySubject,
            body: data.draft,
            deliveryProvider: provider === 'auto' ? 'zoho' : provider,
          }),
        }).then(async (draftRes) => {
          if (draftRes.ok) toast.success('Saved to your drafts folder for review');
        });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDraftingReply(false);
    }
  };

  const handleProcessIntelligence = async () => {
    if (!selectedMessage) return;
    setProcessingIntelligence(true);
    try {
      const res = await fetch('/api/inbox/process-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: selectedMessage.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Intelligence processing failed');
      
      toast.success('AI Intelligence updated!');
      // Update selected message and messages list
      setSelectedMessage(data.message);
      setMessages(prev => prev.map(m => m.id === selectedMessage.id ? data.message : m));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessingIntelligence(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedMessage || !draftReplyText.trim() || !tenant?.id) return;

    if (selectedMessage.channel !== 'email') {
      toast.error('Direct send is available for email messages. Chat and SMS channels need their native reply flow.');
      return;
    }

    const recipient = extractEmailAddress(selectedMessage.from_address);
    if (!recipient.includes('@')) {
      toast.error('No valid recipient email on this message.');
      return;
    }

    setSendingReply(true);
    const sendToast = toast.loading('Sending email...');
    try {
      const subject = replySubject.trim() || `Re: ${selectedMessage.subject || 'Your message'}`;
      const provider = resolveSendProvider();

      const response = await fetch('/api/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          leadEmail: recipient,
          leadName: selectedMessage.from_name || undefined,
          subject,
          body: draftReplyText,
          pitchAngle: 'inbox_reply',
          autoSend: true,
          consentGranted: true,
          confidenceScore: 100,
          ...(provider
            ? { preferredProvider: provider, deliveryProviders: [provider] }
            : {}),
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to send email');
      }

      const stateResponse = await fetch(`/api/tenant/${encodeURIComponent(tenant?.id || '')}/inbox/messages`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'replied', messageId: selectedMessage.id }) });
      const statePayload = await stateResponse.json().catch(() => ({}));
      if (!stateResponse.ok) throw new Error(statePayload.error || 'Reply state could not be saved');

      const sentVia = String(result.provider || provider || 'platform').toUpperCase();
      toast.success(`Email sent via ${sentVia}`, { id: sendToast });
      setDraftReplyText('');
      setCustomReplyPrompt('');
      loadMessages();
    } catch (err: any) {
      toast.error('Failed to send reply: ' + err.message, { id: sendToast });
    } finally {
      setSendingReply(false);
    }
  };

  const handleQuickEmailAction = async () => {
    if (!selectedMessage) return;
    if (selectedMessage.channel !== 'email') {
      toast.error('Quick send is available for email messages only.');
      return;
    }
    if (!draftReplyText.trim()) {
      await handleGenerateAIDraft();
    }
    document.getElementById('inbox-reply-compose')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getSourceIcon = (source: string) => {
    switch (source?.toLowerCase()) {
      case 'zoho': return <Mail className="w-4 h-4 text-emerald-400" />;
      case 'whatsapp': return <MessageCircle className="w-4 h-4 text-green-400" />;
      case 'facebook': return <MessageSquare className="w-4 h-4 text-blue-400" />;
      case 'instagram': return <MessageCircle className="w-4 h-4 text-pink-400" />;
      default: return <MessageSquare className="w-4 h-4 text-slate-400" />;
    }
  };

  const getPriorityStyle = (priority: string | null) => {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'high': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'normal': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getSentimentEmoji = (sentiment: string | null) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return '😊';
      case 'negative': return '😡';
      default: return '😐';
    }
  };

  const filteredMessages = messages.filter(m => {
    if (filterSource !== 'all' && m.source !== filterSource) return false;
    if (filterPriority !== 'all' && m.priority !== filterPriority) return false;
    return true;
  });

  const inboxStats = useMemo<ModuleStat[]>(() => {
    const pending = messages.filter(m => m.needs_response).length;
    const unread = messages.filter(m => !m.read).length;
    const urgent = messages.filter(m => m.priority === 'urgent' || m.priority === 'high').length;
    const channels = new Set(messages.map(m => m.source)).size;
    return [
      { label: 'Total Messages', value: messages.length, sub: 'Across all channels', Icon: Inbox, accent: 'teal' },
      { label: 'Needs Reply', value: pending, sub: 'Awaiting response', Icon: CornerUpLeft, accent: pending > 0 ? 'amber' : 'emerald' },
      { label: 'Unread', value: unread, sub: 'Not yet opened', Icon: Mail, accent: 'blue' },
      { label: 'High Priority', value: urgent, sub: `${channels} channel${channels !== 1 ? 's' : ''} active`, Icon: AlertCircle, accent: urgent > 0 ? 'rose' : 'purple' },
    ];
  }, [messages]);

  if (loading && messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        <p className="text-slate-400 text-sm">Aggregating solopreneur conversation feeds...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 ac-scroll-full ac-enterprise-module">
      {messages.length > 0 && (
        <ModuleStatCards stats={inboxStats} />
      )}
    <div className="flex min-h-[480px] border border-slate-800 rounded-3xl ac-scroll-full bg-slate-950/60 backdrop-blur-md" role="region" aria-label="All channels inbox">
      {/* 1. Left Message List Section */}
      <div className="w-1/3 border-r border-slate-800 flex flex-col bg-slate-900/20">
        {/* Filters Header */}
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Inbox className="w-5 h-5 text-teal-400" />
              Unified Inbox
            </h3>
            <span className="text-xs bg-teal-500/15 text-teal-400 px-2.5 py-0.5 rounded-full font-semibold">
              {messages.filter(m => m.needs_response).length} Pending
            </span>
          </div>

          <div className="flex gap-2">
            <select
              value={filterSource}
              onChange={e => setFilterSource(e.target.value)}
              className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-teal-500"
            >
              <option value="all">All Channels</option>
              <option value="zoho">Zoho Mail</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
            </select>

            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-teal-500"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Scrollable Message List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-900">
          {filteredMessages.length === 0 ? (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <Inbox className="w-8 h-8 mx-auto opacity-40 text-slate-400" />
              <p className="text-sm font-medium">Inbox is empty</p>
              <p className="text-xs opacity-60">All messages caught up!</p>
            </div>
          ) : (
            filteredMessages.map(msg => (
              <div
                key={msg.id}
                onClick={() => handleSelectMessage(msg)}
                className={`p-4 cursor-pointer transition-all flex flex-col gap-2 relative ${
                  selectedMessage?.id === msg.id 
                    ? 'bg-slate-800/40 border-l-4 border-teal-500' 
                    : 'hover:bg-slate-900/30'
                } ${!msg.read ? 'bg-slate-900/10' : ''}`}
              >
                {/* Meta details */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {getSourceIcon(msg.source)}
                    <span className={`font-semibold text-xs ${!msg.read ? 'text-white' : 'text-slate-300'}`}>
                      {msg.from_name || msg.from_address || 'Unknown'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {msg.received_at ? new Date(msg.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>

                {/* Subject & snippet */}
                <div className="space-y-1">
                  {msg.subject && (
                    <h4 className={`text-xs truncate ${!msg.read ? 'text-white font-bold' : 'text-slate-400'}`}>
                      {msg.subject}
                    </h4>
                  )}
                  <p className="text-xs text-slate-500 line-clamp-2">
                    {msg.body}
                  </p>
                </div>

                {/* Sentiment & Priority Tags */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex gap-1.5 items-center">
                    {msg.priority && (
                      <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded border ${getPriorityStyle(msg.priority)}`}>
                        {msg.priority}
                      </span>
                    )}
                    {msg.sentiment && (
                      <span className="text-xs" title={`Sentiment: ${msg.sentiment}`}>
                        {getSentimentEmoji(msg.sentiment)}
                      </span>
                    )}
                    {msg.category && (
                      <span className="text-[10px] text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded capitalize">
                        {msg.category}
                      </span>
                    )}
                  </div>
                  {msg.needs_response && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Needs Response" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. Right Detail & Intelligence Panel */}
      <div className="flex-1 flex flex-col bg-slate-900/10">
        {selectedMessage ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Thread Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/20">
              <div>
                <h3 className="text-sm font-bold text-white">
                  {selectedMessage.subject || `Conversation with ${selectedMessage.from_name || 'Client'}`}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                  From:{' '}
                  {selectedMessage.from_address ? (
                    <button
                      type="button"
                      onClick={handleQuickEmailAction}
                      className="font-mono text-teal-400 hover:text-teal-300 underline-offset-2 hover:underline"
                      title="Prepare reply and send in platform"
                    >
                      {selectedMessage.from_address}
                    </button>
                  ) : (
                    <span className="font-mono text-slate-300">Unknown</span>
                  )}
                  <span>| Channel: <span className="capitalize">{selectedMessage.source} ({selectedMessage.channel})</span></span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedMessage.channel === 'email' && selectedMessage.from_address && (
                  <button
                    type="button"
                    onClick={handleQuickEmailAction}
                    className="px-3 py-2 rounded-xl border border-teal-500/20 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send email
                  </button>
                )}
                <button
                  onClick={() => handleMarkNeedsResponse(selectedMessage.id, !selectedMessage.needs_response)}
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    selectedMessage.needs_response 
                      ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                  }`}
                  title={selectedMessage.needs_response ? 'Mark as Resolved' : 'Mark as Pending Response'}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  {selectedMessage.needs_response ? 'Pending Action' : 'Resolved'}
                </button>

                <button
                  onClick={() => handleArchiveMessage(selectedMessage.id)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition-all"
                  title="Archive conversation"
                >
                  <Archive className="w-4 h-4" />
                </button>
              </div>
            </div>

            {selectedMessage.channel === 'email' && selectedMessage.from_address && (
              <div className="px-4 pt-3">
                <EmailLeadInsightPanel
                  from={selectedMessage.from_address}
                  subject={selectedMessage.subject}
                  compact
                />
              </div>
            )}

            {/* Main Area: Message Display & AI Panel */}
            <div className="flex-1 flex overflow-hidden">
              {/* Message Thread Scroll Area */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-sm">
                    {selectedMessage.from_name?.[0] || selectedMessage.from_address?.[0] || 'C'}
                  </div>
                  <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-semibold text-sm text-white">
                        {selectedMessage.from_name || selectedMessage.from_address}
                      </span>
                      <span className="text-xs text-slate-500">
                        {selectedMessage.received_at ? new Date(selectedMessage.received_at).toLocaleString() : ''}
                      </span>
                    </div>
                    <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {selectedMessage.body}
                    </div>
                  </div>
                </div>

                {/* Reply drafting interface */}
                <div id="inbox-reply-compose" className="mt-8 pt-6 border-t border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CornerUpLeft className="w-3.5 h-3.5" />
                      Compose Response
                    </span>
                    <button
                      onClick={handleGenerateAIDraft}
                      disabled={draftingReply}
                      className="px-3 py-1.5 bg-teal-500/15 hover:bg-teal-500/25 disabled:opacity-50 text-teal-400 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-teal-500/20 transition-all"
                    >
                      {draftingReply ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Generate AI Draft
                    </button>
                  </div>

                  {selectedMessage.channel === 'email' && providerOptions.some((p) => p.connected) && (
                    <EmailProviderSelector
                      value={deliveryProvider}
                      onChange={setDeliveryProvider}
                      providers={providerOptions}
                      compact
                    />
                  )}

                  {selectedMessage.channel === 'email' && (
                    <input
                      type="text"
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                      placeholder="Email subject"
                      className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-teal-500"
                    />
                  )}

                  {/* Optional instruction input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add instructions for draft (e.g. 'say yes, book for Friday at 3pm')"
                      value={customReplyPrompt}
                      onChange={e => setCustomReplyPrompt(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <textarea
                    rows={6}
                    value={draftReplyText}
                    onChange={e => setDraftReplyText(e.target.value)}
                    placeholder="AI draft or manual message response..."
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-teal-500 resize-none"
                  />

                  <div className="flex justify-end gap-2">
                    {draftReplyText && (
                      <button
                        onClick={() => setDraftReplyText('')}
                        className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-400 rounded-xl text-xs font-semibold"
                      >
                        Clear Draft
                      </button>
                    )}
                    {selectedMessage.channel === 'email' && draftReplyText && (
                      <button
                        onClick={handleSaveDraftToMailbox}
                        disabled={savingDraft}
                        className="px-4 py-2 border border-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-semibold disabled:opacity-40"
                      >
                        {savingDraft ? 'Saving…' : 'Save to Drafts'}
                      </button>
                    )}
                    <button
                      onClick={handleSendReply}
                      disabled={!draftReplyText.trim() || sendingReply}
                      className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-teal-500/10"
                    >
                      {sendingReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      {sendingReply ? 'Sending...' : 'Send Response'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Sidebar AI Intelligence Panel */}
              <div className="w-80 border-l border-slate-800 bg-slate-900/30 p-4 space-y-6 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Brain className="w-4 h-4 text-violet-400 animate-pulse" />
                    AI Copilot Intelligence
                  </h4>
                  <button
                    onClick={handleProcessIntelligence}
                    disabled={processingIntelligence}
                    className="p-1 hover:bg-slate-850 rounded text-slate-500 hover:text-white transition-colors"
                    title="Run AI Triage analysis"
                  >
                    {processingIntelligence ? <Loader2 className="w-3 h-3 animate-spin text-teal-400" /> : <RefreshCw className="w-3 h-3" />}
                  </button>
                </div>

                {/* Intent Summary */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-500">Extracted Intent</span>
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-850 text-xs text-slate-300 leading-relaxed font-semibold">
                    {selectedMessage.intent || 'Classification pending. Click refresh above to analyze.'}
                  </div>
                </div>

                {/* AI Sentiment Analysis */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-500">Sentiment Rating</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getSentimentEmoji(selectedMessage.sentiment)}</span>
                    <span className="text-xs font-bold text-slate-300 capitalize">{selectedMessage.sentiment || 'neutral'}</span>
                  </div>
                </div>

                {/* Priority / Response urgencies */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-500">Priority Tier</span>
                  <div>
                    <span className={`inline-block text-[10px] font-black uppercase tracking-widest border px-3 py-1 rounded-full ${getPriorityStyle(selectedMessage.priority)}`}>
                      {selectedMessage.priority || 'normal'}
                    </span>
                  </div>
                </div>

                {/* Recommended Next Action */}
                {selectedMessage.metadata?.suggested_action && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase text-slate-500">AI Suggested Next Action</span>
                    <div className="p-3 bg-teal-500/5 text-teal-300 rounded-xl border border-teal-500/10 text-xs leading-relaxed flex gap-2">
                      <ArrowRight className="w-4 h-4 flex-shrink-0 text-teal-400 mt-0.5" />
                      <p>{selectedMessage.metadata.suggested_action}</p>
                    </div>
                  </div>
                )}

                {/* Summary block */}
                {selectedMessage.metadata?.summary && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase text-slate-500">Executive Summary</span>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {selectedMessage.metadata.summary}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <Inbox className="w-12 h-12 mb-4 text-slate-700 animate-pulse" />
            <p className="font-semibold text-lg text-white mb-1">Select a message</p>
            <p className="text-sm max-w-sm">Pick any conversation from the list to respond or view smart intelligence triage.</p>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
