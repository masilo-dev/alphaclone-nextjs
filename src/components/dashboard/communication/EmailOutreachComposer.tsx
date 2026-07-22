'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, Plus, Send, Trash2, Users, Loader2, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { BulkTeamMessageModal } from '@/components/dashboard/crm/BulkTeamMessageModal';
import { normalizeRecipientEmails } from '@/lib/email/bulkTeamMessage';
import { cn } from '@/lib/utils';

type TenantContact = {
  id: string;
  name: string;
  email: string;
  source: 'lead' | 'contact' | 'client';
  stage?: string;
};

type OutreachStep = {
  id: string;
  label: string;
  subject: string;
  body: string;
};

/**
 * Simple multi-step email outreach builder for Communication Hub.
 * Pick any tenant contacts, define 1–N outreaches, send one at a time.
 */
export function EmailOutreachComposer() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<TenantContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [steps, setSteps] = useState<OutreachStep[]>([
    { id: '1', label: 'Outreach 1', subject: '', body: '' },
  ]);
  const [activeStepId, setActiveStepId] = useState('1');
  const [composeOpen, setComposeOpen] = useState(false);

  const loadContacts = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const [leadsRes, contactsRes, clientsRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id, name, email, emails, status')
          .eq('tenant_id', currentTenant.id)
          .order('updated_at', { ascending: false })
          .limit(300),
        supabase
          .from('contacts')
          .select('id, first_name, last_name, email, emails')
          .eq('tenant_id', currentTenant.id)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(300),
        supabase
          .from('business_clients')
          .select('id, name, email, emails, sales_stage')
          .eq('tenant_id', currentTenant.id)
          .order('updated_at', { ascending: false })
          .limit(300),
      ]);

      const mapped: TenantContact[] = [];
      const seen = new Set<string>();

      const push = (item: TenantContact) => {
        const email = item.email.trim().toLowerCase();
        if (!email.includes('@') || seen.has(email)) return;
        seen.add(email);
        mapped.push({ ...item, email });
      };

      for (const row of leadsRes.data || []) {
        const email = String(row.email || (Array.isArray(row.emails) ? row.emails[0] : '') || '').trim();
        push({
          id: row.id,
          name: row.name || 'Lead',
          email,
          source: 'lead',
          stage: row.status || undefined,
        });
      }
      for (const row of contactsRes.data || []) {
        const email = String(row.email || (Array.isArray(row.emails) ? row.emails[0] : '') || '').trim();
        push({
          id: row.id,
          name: [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Contact',
          email,
          source: 'contact',
        });
      }
      for (const row of clientsRes.data || []) {
        const email = String(row.email || (Array.isArray(row.emails) ? row.emails[0] : '') || '').trim();
        push({
          id: row.id,
          name: row.name || 'Client',
          email,
          source: 'client',
          stage: row.sales_stage || undefined,
        });
      }

      setContacts(mapped);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.includes(q) ||
        (c.stage || '').toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const activeStep = steps.find((s) => s.id === activeStepId) || steps[0];
  const recipients = normalizeRecipientEmails([...selectedEmails]);

  const toggleEmail = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const addStep = () => {
    const n = steps.length + 1;
    const id = String(Date.now());
    setSteps((prev) => [...prev, { id, label: `Outreach ${n}`, subject: '', body: '' }]);
    setActiveStepId(id);
  };

  const removeStep = (id: string) => {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((s) => s.id !== id));
    if (activeStepId === id) setActiveStepId(steps[0].id === id ? steps[1].id : steps[0].id);
  };

  const updateActiveStep = (patch: Partial<OutreachStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === activeStepId ? { ...s, ...patch } : s)));
  };

  const openCompose = () => {
    if (recipients.length === 0) {
      toast.error('Select at least one contact with an email.');
      return;
    }
    if (!activeStep.subject.trim()) {
      toast.error('Add a subject for this outreach.');
      return;
    }
    setComposeOpen(true);
  };

  if (!user?.id) return null;

  return (
    <div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3 p-3 md:p-5">
      <div className="rounded-2xl border border-white/5 bg-slate-900/50 flex flex-col min-h-0 overflow-hidden">
        <div className="px-3 py-2.5 border-b border-white/5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-4 h-4 text-teal-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">Tenant contacts</p>
              <p className="text-[11px] text-slate-500">{selectedEmails.size} selected</p>
            </div>
          </div>
        </div>
        <div className="p-2 border-b border-white/5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-teal-500/40"
          />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5">
          {loading ? (
            <p className="text-xs text-slate-500 p-3 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-slate-500 p-3">No contacts with email found.</p>
          ) : (
            filtered.map((c) => {
              const selected = selectedEmails.has(c.email);
              return (
                <button
                  key={`${c.source}-${c.id}`}
                  type="button"
                  onClick={() => toggleEmail(c.email)}
                  className={cn(
                    'w-full text-left rounded-xl px-2.5 py-2 flex items-start gap-2 transition-colors',
                    selected ? 'bg-teal-500/10 border border-teal-500/30' : 'hover:bg-white/5 border border-transparent'
                  )}
                >
                  {selected ? (
                    <CheckSquare className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm text-white truncate">{c.name}</span>
                    <span className="block text-[11px] text-slate-500 truncate">{c.email}</span>
                    <span className="block text-[10px] text-slate-600 uppercase tracking-wider mt-0.5">
                      {c.source}
                      {c.stage ? ` · ${c.stage}` : ''}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-slate-900/50 flex flex-col min-h-0 overflow-hidden">
        <div className="px-3 py-2.5 border-b border-white/5 flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-teal-400" />
            <p className="text-sm font-semibold text-white">Email outreaches</p>
          </div>
          <button
            type="button"
            onClick={addStep}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white"
          >
            <Plus className="w-3.5 h-3.5" /> Add outreach
          </button>
        </div>

        <div className="px-3 py-2 flex gap-1.5 overflow-x-auto border-b border-white/5">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setActiveStepId(step.id)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[12px] font-medium',
                  activeStepId === step.id
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                    : 'text-slate-400 hover:bg-white/5 border border-transparent'
                )}
              >
                {step.label}
              </button>
              {steps.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeStep(step.id)}
                  className="p-1 text-slate-600 hover:text-rose-400"
                  aria-label={`Remove ${step.label}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
              Subject
            </label>
            <input
              value={activeStep.subject}
              onChange={(e) => updateActiveStep({ subject: e.target.value })}
              placeholder="Outreach subject"
              className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500/40"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
              Message
            </label>
            <textarea
              value={activeStep.body}
              onChange={(e) => updateActiveStep({ body: e.target.value })}
              placeholder="Write this outreach… (no auto greeting)"
              className="w-full h-[180px] max-h-[220px] rounded-xl bg-slate-950 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500/40 resize-none overflow-y-auto"
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Sending to {recipients.length} contact{recipients.length === 1 ? '' : 's'} · {activeStep.label}
          </p>
        </div>

        <div className="px-3 py-3 border-t border-white/5 flex justify-end">
          <button
            type="button"
            onClick={openCompose}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 px-4 py-2.5 text-xs font-bold text-white"
          >
            <Send className="w-3.5 h-3.5" />
            Send {activeStep.label}
          </button>
        </div>
      </div>

      {composeOpen && user?.id ? (
        <BulkTeamMessageModal
          isOpen={composeOpen}
          onClose={() => setComposeOpen(false)}
          userId={user.id}
          recipients={recipients}
          subject={activeStep.subject}
          body={activeStep.body}
        />
      ) : null}
    </div>
  );
}
