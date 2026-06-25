'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Sparkles, Send, Mail, Loader2, Check, AlertCircle,
  Zap, Edit3, Eye, Clock,
  Briefcase, Smile, Gift, Languages,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTenant } from '../../contexts/TenantContext';
import { qualifyLead, QualificationResult, PITCH_ANGLES } from '../../lib/leadQualification';
import { supabase } from '../../lib/supabase';
import { CAMPAIGN_LANGUAGE_OPTIONS, type CampaignLanguageMode } from '@/lib/languageUtils';

// ── Types ─────────────────────────────────────────────────────────────────────
interface OutreachLead {
  business_name: string;
  email?:     string;
  phone?:     string;
  website?:   string;
  rating?:    number;
  address?:   string;
  category?:  string;
  source?:    string;
  scraperLeadId?: string;
  qualification: QualificationResult;
}

interface GeneratedEmail {
  business_name: string;
  subject:       string;
  body:          string;
  pitchAngle:    string;
  recipientEmail: string | null;
  recipientSource: 'lead' | 'inferred' | 'none';
  language?: string;
  languageLabel?: string;
}

type SendStatus = 'idle' | 'generating' | 'preview' | 'sending' | 'done';
type OutreachProvider = 'microsoft' | 'brevo' | 'resend' | 'sendgrid' | 'zoho';
const OUTREACH_PROVIDER_OPTIONS: { id: OutreachProvider; label: string }[] = [
  { id: 'microsoft', label: 'Microsoft 365' },
  { id: 'brevo', label: 'Brevo' },
  { id: 'resend', label: 'Resend' },
  { id: 'sendgrid', label: 'SendGrid' },
  { id: 'zoho', label: 'Zoho Mail' },
];

const TONES: { id: string; label: string; Icon: typeof Briefcase }[] = [
  { id: 'professional', label: 'Professional', Icon: Briefcase },
  { id: 'friendly', label: 'Friendly', Icon: Smile },
  { id: 'direct', label: 'Direct', Icon: Zap },
  { id: 'value_add', label: 'Value-Add', Icon: Gift },
];

// ── Props ─────────────────────────────────────────────────────────────────────
interface OutreachPanelProps {
  leads:    OutreachLead[];
  industry: string;
  onClose:  () => void;
  onSendComplete?: (results: Array<{ businessName: string; status: 'sent' | 'queued' | 'failed'; scraperLeadId?: string }>) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
export function OutreachPanel({ leads, industry, onClose, onSendComplete }: OutreachPanelProps) {
  const { currentTenant } = useTenant();
  const [tone,          setTone         ] = useState('professional');
  const [customContext, setCustomContext ] = useState('');
  const [senderName,    setSenderName   ] = useState('');
  const [fromAddress,   setFromAddress  ] = useState('');
  const [senderOptions, setSenderOptions] = useState<string[]>([]);
  const [status,        setStatus       ] = useState<SendStatus>('idle');
  const [emails,        setEmails       ] = useState<GeneratedEmail[]>([]);
  const [editingIdx,    setEditingIdx   ] = useState<number | null>(null);
  const [sendResults,   setSendResults  ] = useState<Array<{ name: string; status: 'sent' | 'queued' | 'failed'; error?: string }>>([]);
  const [queueOnly,     setQueueOnly    ] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<OutreachProvider[]>(['microsoft']);
  const [balanceByDailyLimit, setBalanceByDailyLimit] = useState(false);
  const [languageMode, setLanguageMode] = useState<CampaignLanguageMode>('auto');

  const inferLeadRecipient = (lead: OutreachLead): string | null => {
    const directEmail = String(lead?.email || '').trim();
    if (directEmail.includes('@')) {
      return directEmail.toLowerCase();
    }

    const website = String(lead?.website || '').trim();
    if (!website) return null;

    try {
      const url = new URL(website.startsWith('http://') || website.startsWith('https://') ? website : `https://${website}`);
      const host = url.hostname.replace(/^www\./i, '').toLowerCase();
      if (!host || !host.includes('.') || host.includes('localhost')) return null;
      return `info@${host}`;
    } catch {
      return null;
    }
  };

  const leadsWithRecipient = leads.filter((l) => Boolean(inferLeadRecipient(l)));
  const leadsWithoutRecipient = leads.filter((l) => !inferLeadRecipient(l));

  // Fetch user display name and Zoho sender addresses on mount
  useEffect(() => {
    if (currentTenant?.id) {
      fetch(`/api/email/sender-profile?tenantId=${encodeURIComponent(currentTenant.id)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.profile?.fromName) setSenderName(data.profile.fromName);
          if (data?.profile?.fromEmail && !fromAddress) setFromAddress(data.profile.fromEmail);
        })
        .catch(() => {});
    }

    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.user_metadata?.full_name) setSenderName(data.user.user_metadata.full_name);
      else if (data?.user?.email) setSenderName(data.user.email.split('@')[0]);
    };
    fetchUser();

    // Fetch Zoho sender addresses so we can pass fromAddress explicitly
    fetch('/api/zoho/mail?action=sender-addresses')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data?.addresses) && data.addresses.length > 0) {
          setSenderOptions(data.addresses);
          setFromAddress(data.addresses[0]); // default to primary
        }
      })
      .catch(() => {}); // non-fatal
  }, []);

  // ── Generate emails ────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!leads.length) {
      toast.error('No leads selected for outreach generation');
      return;
    }
    if (languageMode === 'ask') {
      toast.error('Choose a language before generating, or switch language to Auto.');
      return;
    }
    setStatus('generating');

    try {
      const res = await fetch('/api/outreach/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: leads.map(l => ({
            business_name: l.business_name || 'Unknown Business',
            email:    inferLeadRecipient(l) || '',
            phone:    l.phone || '',
            website:  l.website || '',
            rating:   l.rating || 0,
            address:  l.address || '',
            country:  l.address || '',
            category: l.category || '',
            pitchAngle: inferLeadRecipient(l) ? (l.qualification?.pitchAngle || 'professional') : 'no-email-follow-up',
            insights:   Array.isArray(l.qualification?.insights) ? l.qualification.insights : [],
            score:      l.qualification?.score || 0,
          })),
          industry,
          tone,
          customContext,
          senderName: senderName || 'the team',
          languageMode,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Generation failed');
      setEmails(data.emails);
      setStatus('preview');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate emails');
      setStatus('idle');
    }
  };

  // ── Send all ───────────────────────────────────────────────────────────────
  const handleSendAll = async () => {
    if (!currentTenant) { toast.error('No active workspace'); return; }
    if (senderName && fromAddress) {
      await fetch('/api/email/sender-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          fromName: senderName,
          fromEmail: fromAddress,
        }),
      }).catch(() => null);
    }
    setStatus('sending');
    
    const sendPromises = emails.map(async (email) => {
      const recipient = String(email.recipientEmail || '').trim();
      if (!recipient || !recipient.includes('@')) {
        return {
          name: email.business_name || 'Unknown Business',
          status: 'failed' as const,
          error: 'No recipient email available. Add or import an email for this lead.',
        };
      }

      try {
        const res = await fetch('/api/outreach/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId:    currentTenant.id,
            leadEmail:   recipient,
            leadName:    email.business_name || 'Unknown Business',
            subject:     email.subject,
            body:        email.body,
            pitchAngle:  email.pitchAngle || 'professional',
            industry,
            score:       0,
            fromAddress: fromAddress || undefined,
            queue:       queueOnly,
            deliveryProviders: selectedProviders,
            balanceByDailyLimit,
            language: email.language,
            languageMode,
          }),
        });
        const data = await res.json();
        return {
          name:   email.business_name || 'Unknown Business',
          status: (data.status === 'sent' ? 'sent' : data.status === 'queued' ? 'queued' : 'failed') as 'sent' | 'queued' | 'failed',
          error:  data.error,
        };
      } catch (err: any) {
        return { name: email.business_name || 'Unknown Business', status: 'failed' as const, error: err.message };
      }
    });

    const results = await Promise.all(sendPromises);
    setSendResults(results);
    setStatus('done');
    const sentCount   = results.filter(r => r.status === 'sent').length;
    const queuedCount = results.filter(r => r.status === 'queued').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    toast.success(`✅ ${sentCount} sent · ${queuedCount} queued · ${failedCount} failed`);

    if (onSendComplete) {
      onSendComplete(
        results.map((r, i) => ({
          businessName: r.name,
          status: r.status,
          scraperLeadId: leads[i]?.scraperLeadId,
        }))
      );
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex items-stretch sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-5xl max-h-[100dvh] sm:max-h-[90vh] min-h-0 sm:min-h-0 bg-slate-950 border border-slate-800 rounded-none sm:rounded-2xl lg:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 flex-shrink-0 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-teal-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-white truncate">Outreach Automation</h2>
              <p className="text-xs sm:text-xs text-slate-500 uppercase tracking-widest truncate">
                {industry} · {leadsWithRecipient.length} emailable · {leadsWithoutRecipient.length} phone-only
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 sm:p-2.5 text-slate-500 hover:text-white hover:bg-slate-900 rounded-xl transition-all shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row">

          {/* ── Left: Config pane ──────────────────────────────────────────── */}
          <div className="w-full lg:w-80 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800 lg:overflow-y-auto p-4 sm:p-5 space-y-5 sm:space-y-6 bg-slate-950/60 lg:max-h-full">

            {/* Lead summary */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Selected Leads</p>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {leads.map((l, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${l.qualification?.bgColor ?? ''} ${l.qualification?.borderColor ?? ''}`}>
                    <span className="font-semibold text-white truncate flex-1">{l.business_name}</span>
                    <span className={`text-xs font-black uppercase ${l.qualification?.color ?? ''}`}>
                      {l.qualification?.label}
                    </span>
                    {!l.qualification?.canAutoSend && (
                      <span title="No email — will be skipped for auto-send">
                        <AlertCircle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {leadsWithoutRecipient.length > 0 && (
                <p className="text-xs text-amber-400/80 mt-1">
                  {leadsWithoutRecipient.length} lead{leadsWithoutRecipient.length > 1 ? 's have' : ' has'} no reachable email. AI will generate phone scripts for these leads.
                </p>
              )}
            </div>

            {/* Tone */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tone of Voice</p>
              <div className="grid grid-cols-2 gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${tone === t.id ? 'bg-teal-500/10 border-teal-500/40 text-teal-300' : 'border-slate-800 text-slate-400 hover:border-slate-700'}`}
                  >
                    <t.Icon className="w-4 h-4 text-teal-400/90" aria-hidden />
                    <p className="text-xs font-bold uppercase tracking-wider">{t.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom context */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Custom Instructions</p>
              <textarea
                value={customContext}
                onChange={e => setCustomContext(e.target.value)}
                placeholder="e.g. Mention our 30-day free trial offer. Ask for a 10-min video call."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white min-h-[80px] resize-none focus:outline-none focus:border-teal-500 transition-all"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Email Language</p>
              <div className="relative">
                <Languages className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <select
                  value={languageMode}
                  onChange={(e) => setLanguageMode(e.target.value as CampaignLanguageMode)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  {CAMPAIGN_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>{option.label}</option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-500">
                Auto uses country, address, and company context. Ask mode makes MCP/UI request confirmation before sending.
              </p>
            </div>

            {/* From address selector */}
            {senderOptions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Send From</p>
                <select
                  value={fromAddress}
                  onChange={e => setFromAddress(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  {senderOptions.map(addr => (
                    <option key={addr} value={addr}>{addr}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Queue vs Send toggle */}
            <div className="flex items-center gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800">
              <button
                onClick={() => setQueueOnly(!queueOnly)}
                className={`w-10 h-5 rounded-full transition-all relative ${queueOnly ? 'bg-amber-500' : 'bg-teal-500'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${queueOnly ? 'left-0.5' : 'left-[22px]'}`} />
              </button>
              <div>
                <p className="text-xs font-bold text-white">{queueOnly ? 'Queue only' : 'Send immediately'}</p>
                <p className="text-xs text-slate-500">{queueOnly ? 'Review in CRM before sending' : 'Send now using selected providers'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Outreach Providers</p>
              <div className="grid grid-cols-2 gap-2">
                {OUTREACH_PROVIDER_OPTIONS.map((provider) => {
                  const checked = selectedProviders.includes(provider.id);
                  return (
                    <label key={provider.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedProviders((prev) => {
                            if (e.target.checked) return [...prev, provider.id];
                            const next = prev.filter((p) => p !== provider.id);
                            return next.length > 0 ? next : [provider.id];
                          });
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500"
                      />
                      <span className="truncate">{provider.label}</span>
                    </label>
                  );
                })}
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={balanceByDailyLimit}
                  onChange={(e) => setBalanceByDailyLimit(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500"
                />
                Balance by provider daily limits
              </label>
            </div>

            {/* Generate button */}
            {status !== 'done' && (
              <button
                onClick={handleGenerate}
                disabled={status === 'generating' || !leads.length}
                className="w-full py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-sm rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {status === 'generating' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generate Emails</>
                )}
              </button>
            )}
          </div>

          {/* ── Right: Preview / Results pane ─────────────────────────────── */}
          <div className="flex-1 min-w-0 min-h-[12rem] lg:overflow-y-auto p-4 sm:p-5 space-y-4 lg:max-h-full">

            {status === 'idle' && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 text-slate-600 py-16">
                <Sparkles className="w-12 h-12 opacity-20" />
                <p className="text-sm px-2 max-w-md">
                  Configure your tone and click <strong className="text-slate-400">Generate Emails</strong> to produce personalized outreach for {leads.length} lead{leads.length !== 1 ? 's' : ''}.
                </p>
                {/* Pitch angle legend */}
                {leads.length > 0 && (
                  <div className="mt-4 w-full max-w-sm space-y-2 text-left">
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">Detected pitch angles</p>
                    {[...new Set(leads.map(l => l.qualification.pitchAngle))].map(pa => (
                      <div key={pa} className="flex items-start gap-2 p-2 bg-slate-900/50 rounded-lg border border-slate-800 text-xs">
                        <Zap className="w-3 h-3 text-teal-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-bold text-teal-300">{PITCH_ANGLES[pa]?.label || pa}</span>
                          <p className="text-slate-500 text-xs mt-0.5">{PITCH_ANGLES[pa]?.hook}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {status === 'generating' && (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400 py-16">
                <Loader2 className="w-10 h-10 animate-spin text-teal-400" />
                <p className="text-sm">AI is writing {leads.length} personalized outreach drafts…</p>
                <p className="text-xs text-slate-600">Industry: {industry} · Tone: {tone}</p>
              </div>
            )}

            {status === 'preview' && emails.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-bold text-white min-w-0">{emails.length} emails ready to send</p>
                  <button
                    type="button"
                    onClick={handleSendAll}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold rounded-xl transition-all w-full sm:w-auto shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    {queueOnly ? 'Queue All' : 'Send All'}
                  </button>
                </div>

                {emails.map((email, idx) => {
                  const isEditing = editingIdx === idx;
                  const pa = PITCH_ANGLES[email.pitchAngle];
                  return (
                    <div key={idx} className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
                      {/* Email header */}
                      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{email.business_name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            To: {email.recipientEmail || 'No recipient email'}{email.languageLabel ? ` · ${email.languageLabel}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${
                            email.recipientSource === 'lead'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : email.recipientSource === 'inferred'
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                                : 'bg-slate-700/40 border-slate-700 text-slate-400'
                          }`}>
                            {email.recipientSource === 'lead' ? 'Verified recipient' : email.recipientSource === 'inferred' ? 'Inferred recipient' : 'No recipient'}
                          </span>
                          {pa && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 font-bold">
                              {pa.label}
                            </span>
                          )}
                          <button onClick={() => setEditingIdx(isEditing ? null : idx)}
                            className="p-1.5 text-slate-500 hover:text-white transition-all">
                            {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                      {/* Subject */}
                      <div className="px-4 pt-3 pb-1">
                        {isEditing && (
                          <input
                            value={email.recipientEmail || ''}
                            onChange={e => setEmails(prev => prev.map((em, i) => i === idx ? {
                              ...em,
                              recipientEmail: e.target.value.trim() || null,
                              recipientSource: 'inferred',
                            } : em))}
                            placeholder="recipient@company.com"
                            className="w-full mb-2 text-xs bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none"
                          />
                        )}
                        {isEditing ? (
                          <input
                            value={email.subject}
                            onChange={e => setEmails(prev => prev.map((em, i) => i === idx ? { ...em, subject: e.target.value } : em))}
                            className="w-full text-xs font-bold bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-teal-300 focus:outline-none"
                          />
                        ) : (
                          <p className="text-xs font-bold text-teal-300 break-words">{email.subject}</p>
                        )}
                      </div>
                      {/* Body */}
                      <div className="px-4 pb-4 pt-2">
                        {isEditing ? (
                          <textarea
                            value={email.body}
                            onChange={e => setEmails(prev => prev.map((em, i) => i === idx ? { ...em, body: e.target.value } : em))}
                            className="w-full text-xs bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 resize-none min-h-[100px] focus:outline-none focus:border-teal-500"
                          />
                        ) : (
                          <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{email.body}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {status === 'sending' && (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400 py-16">
                <Loader2 className="w-10 h-10 animate-spin text-teal-400" />
                <p className="text-sm">{queueOnly ? 'Queuing' : 'Sending'} your outreach campaign…</p>
              </div>
            )}

            {status === 'done' && sendResults.length > 0 && (
              <div className="space-y-4">
                {/* Summary strip */}
                <div className="grid grid-cols-1 xs:grid-cols-3 gap-3">
                  {[
                    { label: 'Sent',   count: sendResults.filter(r => r.status === 'sent').length,   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                    { label: 'Queued', count: sendResults.filter(r => r.status === 'queued').length, color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20'   },
                    { label: 'Failed', count: sendResults.filter(r => r.status === 'failed').length, color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/20'     },
                  ].map(s => (
                    <div key={s.label} className={`p-3 rounded-xl border text-center ${s.bg}`}>
                      <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
                      <p className="text-xs text-slate-500 uppercase">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Per-lead results */}
                <div className="space-y-2">
                  {sendResults.map((r, i) => (
                    <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-xs ${
                      r.status === 'sent'   ? 'bg-emerald-500/5 border-emerald-500/20' :
                      r.status === 'queued' ? 'bg-amber-500/5 border-amber-500/20' :
                                              'bg-rose-500/5 border-rose-500/20'
                    }`}>
                      {r.status === 'sent'   && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                      {r.status === 'queued' && <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                      {r.status === 'failed' && <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
                      <span className="font-semibold text-white flex-1 truncate">{r.name}</span>
                      <span className={`font-bold uppercase text-xs ${
                        r.status === 'sent' ? 'text-emerald-400' : r.status === 'queued' ? 'text-amber-400' : 'text-rose-400'
                      }`}>{r.status}</span>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-slate-600 text-center pt-2">
                  Open tracking active · View logs in CRM → Outreach tab
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default OutreachPanel;
