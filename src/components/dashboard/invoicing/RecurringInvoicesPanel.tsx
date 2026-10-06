'use client';

import { Select as AlphaCloneSelect } from '@/components/ui/select';
import { Input as AlphaCloneInput } from '@/components/ui/input';


import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw, Plus, Trash2, Play, Pause, Calendar, Repeat, Loader2, ChevronDown, ChevronUp, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/UIComponents';
import type { RecurringFrequency } from '@/services/finance/recurringInvoiceService';

type Profile = {
  id: string;
  clientName: string;
  clientEmail?: string | null;
  amount: number;
  frequency: RecurringFrequency;
  startDate: string;
  endDate?: string | null;
  description?: string | null;
  autoSend: boolean;
  active: boolean;
  lastGenerated?: string | null;
};

type ClientOption = { id: string; name: string; email?: string };

const FREQUENCIES: RecurringFrequency[] = ['weekly', 'monthly', 'yearly'];

const emptyForm = {
  clientId: '',
  clientName: '',
  clientEmail: '',
  amount: '',
  frequency: 'monthly' as RecurringFrequency,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  description: '',
  autoSend: true,
};

export default function RecurringInvoicesPanel({
  tenantId,
  clients,
}: {
  tenantId: string;
  clients: ClientOption[];
}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Record<string, unknown[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/recurring?tenantId=${encodeURIComponent(tenantId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setProfiles(data.profiles || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load recurring profiles');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) load();
  }, [tenantId, load]);

  const loadGenerated = async (profileId: string) => {
    const res = await fetch(
      `/api/invoices/recurring?tenantId=${encodeURIComponent(tenantId)}&profileId=${encodeURIComponent(profileId)}`
    );
    const data = await res.json();
    if (res.ok) {
      setGenerated((prev) => ({ ...prev, [profileId]: data.generated || [] }));
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!generated[id]) loadGenerated(id);
    }
  };

  const handleClientPick = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    setForm((f) => ({
      ...f,
      clientId,
      clientName: client?.name || f.clientName,
      clientEmail: client?.email || f.clientEmail,
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName.trim() || !form.amount) {
      toast.error('Client name and amount are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/invoices/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          clientId: form.clientId || null,
          clientName: form.clientName.trim(),
          clientEmail: form.clientEmail.trim() || null,
          amount: parseFloat(form.amount),
          frequency: form.frequency,
          startDate: form.startDate,
          endDate: form.endDate || null,
          description: form.description.trim() || null,
          autoSend: form.autoSend,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create');
      toast.success('Recurring profile created');
      setShowForm(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (profile: Profile) => {
    try {
      const res = await fetch(`/api/invoices/recurring/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, active: !profile.active }),
      });
      if (!res.ok) throw new Error('Update failed');
      load();
    } catch {
      toast.error('Failed to update profile');
    }
  };

  const runNow = async (profileId: string) => {
    const toastId = toast.loading('Generating invoice...');
    try {
      const res = await fetch(`/api/invoices/recurring/${profileId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Invoice generated', { id: toastId });
      load();
      if (expandedId === profileId) loadGenerated(profileId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed', { id: toastId });
    }
  };

  const remove = async (profileId: string) => {
    if (!confirm('Delete this recurring profile?')) return;
    try {
      const res = await fetch(
        `/api/invoices/recurring/${profileId}?tenantId=${encodeURIComponent(tenantId)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Profile deleted');
      load();
    } catch {
      toast.error('Failed to delete');
    }
  };

  if (loading) {
    return (
      <div className="ac-workspace-panel rounded-lg p-8 flex items-center justify-center text-[var(--ws-text-muted)]">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading recurring profiles...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[var(--ws-text-primary)] uppercase tracking-wide flex items-center gap-2">
            <Repeat className="w-5 h-5 text-teal-400" /> Recurring Invoices
          </h2>
          <p className="type-card-description text-[var(--ws-text-muted)] mt-1">Auto-generate invoices on a schedule — native billing, no Zoho required.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="px-3 py-2 rounded-xl border border-[var(--ws-border)] text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] type-caption font-bold uppercase"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded-xl bg-teal-600 text-[var(--text-inverse)] type-caption font-black uppercase tracking-widest flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Profile
          </button>
        </div>
      </div>

      {showForm && (
        <Card className="p-5 bg-[var(--ws-panel)]/60 border-[var(--ws-border)]">
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="type-caption font-bold text-[var(--ws-text-muted)] uppercase">Client</label>
              <AlphaCloneSelect
                className="mt-1 w-full px-3 py-2"
                value={form.clientId}
                onChange={(e) => handleClientPick(e.target.value)}
              >
                <option value="">Manual entry</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </AlphaCloneSelect>
            </div>
            <div>
              <label className="type-caption font-bold text-[var(--ws-text-muted)] uppercase">Client name</label>
              <AlphaCloneInput
                required
                className="mt-1 w-full px-3 py-2"
                value={form.clientName}
                onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
              />
            </div>
            <div>
              <label className="type-caption font-bold text-[var(--ws-text-muted)] uppercase">Email</label>
              <AlphaCloneInput
                type="email"
                className="mt-1 w-full px-3 py-2"
                value={form.clientEmail}
                onChange={(e) => setForm((f) => ({ ...f, clientEmail: e.target.value }))}
              />
            </div>
            <div>
              <label className="type-caption font-bold text-[var(--ws-text-muted)] uppercase">Amount (USD)</label>
              <AlphaCloneInput
                required
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full px-3 py-2"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="type-caption font-bold text-[var(--ws-text-muted)] uppercase">Frequency</label>
              <AlphaCloneSelect
                className="mt-1 w-full px-3 py-2"
                value={form.frequency}
                onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as RecurringFrequency }))}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </AlphaCloneSelect>
            </div>
            <div>
              <label className="type-caption font-bold text-[var(--ws-text-muted)] uppercase">Start date</label>
              <AlphaCloneInput
                type="date"
                className="mt-1 w-full px-3 py-2"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="autoSend"
                checked={form.autoSend}
                onChange={(e) => setForm((f) => ({ ...f, autoSend: e.target.checked }))}
              />
              <label htmlFor="autoSend" className="type-label text-[var(--ws-text-secondary)]">Auto-send invoice email when generated</label>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-teal-600 text-[var(--text-inverse)] type-caption font-black uppercase disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Create profile'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-xl border border-[var(--ws-border)] text-[var(--ws-text-muted)] type-caption font-bold uppercase"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {profiles.length === 0 ? (
        <Card className="p-10 text-center border-dashed border-[var(--ws-border)] bg-[var(--ws-panel)]/30">
          <Repeat className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-[var(--ws-text-muted)] type-card-description">No recurring profiles yet. Create one for retainers or subscriptions.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => (
            <Card key={p.id} className="p-4 bg-[var(--ws-panel)]/40 border-[var(--ws-border)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-[var(--ws-text-primary)]">{p.clientName}</p>
                  <p className="type-card-description text-[var(--ws-text-muted)] mt-1 flex flex-wrap gap-3">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {p.frequency}</span>
                    <span>${Number(p.amount).toFixed(2)}</span>
                    {p.lastGenerated && (
                      <span>Last: {new Date(p.lastGenerated).toLocaleDateString()}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`type-caption font-black uppercase px-2 py-1 rounded-lg ${p.active ? 'bg-teal-500/15 text-teal-400' : 'bg-slate-500/15 text-[var(--ws-text-muted)]'}`}>
                    {p.active ? 'Active' : 'Paused'}
                  </span>
                  <button type="button" onClick={() => toggleActive(p)} className="p-2 rounded-lg hover:bg-[var(--ws-hover)] text-[var(--ws-text-muted)]" title={p.active ? 'Pause' : 'Resume'}>
                    {p.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={() => runNow(p.id)} className="p-2 rounded-lg hover:bg-[var(--ws-hover)] text-teal-400" title="Generate now">
                    <Play className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => remove(p.id)} className="p-2 rounded-lg hover:bg-[var(--error-500)]/10 text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => toggleExpand(p.id)} className="p-2 rounded-lg hover:bg-[var(--ws-hover)] text-[var(--ws-text-muted)]">
                    {expandedId === p.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {expandedId === p.id && (
                <div className="mt-4 pt-4 border-t border-[var(--ws-border)]">
                  <p className="type-caption font-black uppercase text-[var(--ws-text-muted)] mb-2 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Generated invoices
                  </p>
                  {(generated[p.id] || []).length === 0 ? (
                    <p className="type-card-description text-[var(--ws-text-muted)]">None yet</p>
                  ) : (
                    <ul className="space-y-1">
                      {(generated[p.id] as Array<{ id: string; invoice_number: string; status: string; total: number }>).map((inv) => (
                        <li key={inv.id} className="type-caption text-[var(--ws-text-secondary)] flex justify-between">
                          <span>{inv.invoice_number}</span>
                          <span>{inv.status} · ${Number(inv.total).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
