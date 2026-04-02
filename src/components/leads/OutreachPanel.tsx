'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Sparkles, Send, Mail, Loader2, Check, AlertCircle,
  Zap, Edit3, Eye, ChevronDown, Clock, BarChart2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTenant } from '../../contexts/TenantContext';
import { qualifyLead, QualificationResult, PITCH_ANGLES } from '../../lib/leadQualification';
import { supabase } from '../../lib/supabase';

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
  qualification: QualificationResult;
}

interface GeneratedEmail {
  business_name: string;
  subject:       string;
  body:          string;
  pitchAngle:    string;
}

type SendStatus = 'idle' | 'generating' | 'preview' | 'sending' | 'done';

const TONES = [
  { id: 'professional', label: 'Professional', icon: '💼' },
  { id: 'friendly',     label: 'Friendly',     icon: '👋' },
  { id: 'direct',       label: 'Direct',        icon: '⚡' },
  { id: 'value_add',    label: 'Value-Add',     icon: '🎁' },
];

// ── Props ─────────────────────────────────────────────────────────────────────
interface OutreachPanelProps {
  leads:    OutreachLead[];
  industry: string;
  onClose:  () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
export function OutreachPanel({ leads, industry, onClose }: OutreachPanelProps) {
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

  // Leads that can receive auto-outreach (have email)
  const emailable = leads.filter(l => l.qualification.canAutoSend);
  const noEmail   = leads.filter(l => !l.qualification.canAutoSend);

  // Fetch user display name and Zoho sender addresses on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: { email?: string; user_metadata?: Record<string, string> } | null } }) => {
      if (data?.user?.user_metadata?.full_name) setSenderName(data.user.user_metadata.full_name);
      else if (data?.user?.email) setSenderName(data.user.email.split('@')[0]);
    });

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
    if (!emailable.length) {
      toast.error('No leads with email addresses to generate outreach for');
      return;
    }
    setStatus('generating');

    try {
      const res = await fetch('/api/outreach/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: emailable.map(l => ({
            business_name: l.business_name,
            email:    l.email,
            phone:    l.phone,
            website:  l.website,
            rating:   l.rating,
            address:  l.address,
            category: l.category,
            pitchAngle: l.qualification.pitchAngle,
            insights:   l.qualification.insights,
            score:      l.qualification.score,
          })),
          industry,
          tone,
          customContext,
          senderName: senderName || 'the team',
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
    setStatus('sending');
    const results: typeof sendResults = [];

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      const lead  = emailable[i];
      if (!lead?.email) continue;

      try {
        const res = await fetch('/api/outreach/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId:    currentTenant.id,
            leadEmail:   lead.email,
            leadName:    lead.business_name,
            subject:     email.subject,
            body:        email.body,
            pitchAngle:  lead.qualification.pitchAngle,
            industry,
            score:       lead.qualification.score,
            fromAddress: fromAddress || undefined,
            queue:       queueOnly,
          }),
        });
        const data = await res.json();
        results.push({
          name:   email.business_name,
          status: data.status === 'sent' ? 'sent' : data.status === 'queued' ? 'queued' : 'failed',
          error:  data.error,
        });
      } catch (err: any) {
        results.push({ name: email.business_name, status: 'failed', error: err.message });
      }
    }

    setSendResults(results);
    setStatus('done');
    const sentCount   = results.filter(r => r.status === 'sent').length;
    const queuedCount = results.filter(r => r.status === 'queued').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    toast.success(`✅ ${sentCount} sent · ${queuedCount} queued · ${failedCount} failed`);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-5xl max-h-[90vh] bg-slate-950 border border-slate-800 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Outreach Automation</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                {industry} · {emailable.length} emailable · {noEmail.length} phone-only
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 text-slate-500 hover:text-white hover:bg-slate-900 rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">

          {/* ── Left: Config pane ──────────────────────────────────────────── */}
          <div className="w-80 flex-shrink-0 border-r border-slate-800 overflow-y-auto p-5 space-y-6 bg-slate-950/60">

            {/* Lead summary */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Selected Leads</p>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {leads.map((l, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${l.qualification.bgColor} ${l.qualification.borderColor}`}>
                    <span className="font-semibold text-white truncate flex-1">{l.business_name}</span>
                    <span className={`text-[9px] font-black uppercase ${l.qualification.color}`}>
                      {l.qualification.label}
                    </span>
                    {!l.qualification.canAutoSend && (
                      <span title="No email — will be skipped for auto-send">
                        <AlertCircle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {noEmail.length > 0 && (
                <p className="text-[10px] text-amber-400/80 mt-1">
                  ⚠ {noEmail.length} lead{noEmail.length > 1 ? 's have' : ' has'} no email — phone follow-up recommended
                </p>
              )}
            </div>

            {/* Tone */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tone of Voice</p>
              <div className="grid grid-cols-2 gap-2">
                {TONES.map(t => (
                  <button key={t.id} onClick={() => setTone(t.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${tone === t.id ? 'bg-teal-500/10 border-teal-500/40 text-teal-300' : 'border-slate-800 text-slate-400 hover:border-slate-700'}`}>
                    <span className="text-lg leading-none">{t.icon}</span>
                    <p className="text-[10px] font-bold uppercase tracking-wider mt-1">{t.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom context */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Custom Instructions</p>
              <textarea
                value={customContext}
                onChange={e => setCustomContext(e.target.value)}
                placeholder="e.g. Mention our 30-day free trial offer. Ask for a 10-min video call."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white min-h-[80px] resize-none focus:outline-none focus:border-teal-500 transition-all"
              />
            </div>

            {/* From address selector */}
            {senderOptions.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Send From</p>
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
                <p className="text-xs font-bold text-white">{queueOnly ? '📋 Queue Only' : '🚀 Send Immediately'}</p>
                <p className="text-[10px] text-slate-500">{queueOnly ? 'Review in CRM before sending' : 'Send via Zoho Mail now'}</p>
              </div>
            </div>

            {/* Generate button */}
            {status !== 'done' && (
              <button
                onClick={handleGenerate}
                disabled={status === 'generating' || !emailable.length}
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
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {status === 'idle' && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 text-slate-600 py-16">
                <Sparkles className="w-12 h-12 opacity-20" />
                <p className="text-sm">Configure your tone and click <strong className="text-slate-400">Generate Emails</strong> to produce<br />personalized outreach for {emailable.length} lead{emailable.length !== 1 ? 's' : ''}.</p>
                {/* Pitch angle legend */}
                {leads.length > 0 && (
                  <div className="mt-4 w-full max-w-sm space-y-2 text-left">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Detected pitch angles</p>
                    {[...new Set(leads.map(l => l.qualification.pitchAngle))].map(pa => (
                      <div key={pa} className="flex items-start gap-2 p-2 bg-slate-900/50 rounded-lg border border-slate-800 text-xs">
                        <Zap className="w-3 h-3 text-teal-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-bold text-teal-300">{PITCH_ANGLES[pa]?.label || pa}</span>
                          <p className="text-slate-500 text-[10px] mt-0.5">{PITCH_ANGLES[pa]?.hook}</p>
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
                <p className="text-sm">AI is writing {emailable.length} personalized emails…</p>
                <p className="text-[10px] text-slate-600">Industry: {industry} · Tone: {tone}</p>
              </div>
            )}

            {status === 'preview' && emails.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-white">{emails.length} emails ready to send</p>
                  <button
                    onClick={handleSendAll}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold rounded-xl transition-all"
                  >
                    <Send className="w-4 h-4" />
                    {queueOnly ? 'Queue All' : 'Send All'}
                  </button>
                </div>

                {emails.map((email, idx) => {
                  const lead = emailable[idx];
                  const isEditing = editingIdx === idx;
                  const pa = PITCH_ANGLES[email.pitchAngle];
                  return (
                    <div key={idx} className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
                      {/* Email header */}
                      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{email.business_name}</p>
                          <p className="text-[10px] text-slate-500 truncate">To: {lead?.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {pa && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 font-bold">
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
                        {isEditing ? (
                          <input
                            value={email.subject}
                            onChange={e => setEmails(prev => prev.map((em, i) => i === idx ? { ...em, subject: e.target.value } : em))}
                            className="w-full text-xs font-bold bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-teal-300 focus:outline-none"
                          />
                        ) : (
                          <p className="text-xs font-bold text-teal-300">📧 {email.subject}</p>
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
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Sent',   count: sendResults.filter(r => r.status === 'sent').length,   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                    { label: 'Queued', count: sendResults.filter(r => r.status === 'queued').length, color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20'   },
                    { label: 'Failed', count: sendResults.filter(r => r.status === 'failed').length, color: 'text-rose-400',   bg: 'bg-rose-500/10 border-rose-500/20'     },
                  ].map(s => (
                    <div key={s.label} className={`p-3 rounded-xl border text-center ${s.bg}`}>
                      <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
                      <p className="text-[10px] text-slate-500 uppercase">{s.label}</p>
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
                      <span className={`font-bold uppercase text-[9px] ${
                        r.status === 'sent' ? 'text-emerald-400' : r.status === 'queued' ? 'text-amber-400' : 'text-rose-400'
                      }`}>{r.status}</span>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-slate-600 text-center pt-2">
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
