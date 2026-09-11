'use client';

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
      <div className="ac-workspace-panel rounded-lg p-8 flex items-center justify-center text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading recurring profiles...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white uppercase tracking-wide flex items-center gap-2">
            <Repeat className="w-5 h-5 text-teal-400" /> Recurring Invoices
          </h2>
          <p className="text-xs text-slate-500 mt-1">Auto-generate invoices on a schedule — native billing, no Zoho required.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="px-3 py-2 rounded-xl border border-white/10 text-slate-400 hover:text-white text-xs font-bold uppercase"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Profile
          </button>
        </div>
      </div>

      {showForm && (
        <Card className="p-5 bg-slate-900/60 border-white/10">
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Client</label>
              <select
                className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                value={form.clientId}
                onChange={(e) => handleClientPick(e.target.value)}
              >
                <option value="">Manual entry</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Client name</label>
              <input
                required
                className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                value={form.clientName}
                onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
              <input
                type="email"
                className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                value={form.clientEmail}
                onChange={(e) => setForm((f) => ({ ...f, clientEmail: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Amount (USD)</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Frequency</label>
              <select
                className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
                value={form.frequency}
                onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as RecurringFrequency }))}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Start date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white"
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
              <label htmlFor="autoSend" className="text-sm text-slate-300">Auto-send invoice email when generated</label>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-teal-600 text-white text-xs font-black uppercase disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Create profile'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 rounded-xl border border-white/10 text-slate-400 text-xs font-bold uppercase"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {profiles.length === 0 ? (
        <Card className="p-10 text-center border-dashed border-white/10 bg-slate-900/30">
          <Repeat className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No recurring profiles yet. Create one for retainers or subscriptions.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => (
            <Card key={p.id} className="p-4 bg-slate-900/40 border-white/5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-white">{p.clientName}</p>
                  <p className="text-xs text-slate-500 mt-1 flex flex-wrap gap-3">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {p.frequency}</span>
                    <span>${Number(p.amount).toFixed(2)}</span>
                    {p.lastGenerated && (
                      <span>Last: {new Date(p.lastGenerated).toLocaleDateString()}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${p.active ? 'bg-teal-500/15 text-teal-400' : 'bg-slate-500/15 text-slate-400'}`}>
                    {p.active ? 'Active' : 'Paused'}
                  </span>
                  <button type="button" onClick={() => toggleActive(p)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400" title={p.active ? 'Pause' : 'Resume'}>
                    {p.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={() => runNow(p.id)} className="p-2 rounded-lg hover:bg-white/5 text-teal-400" title="Generate now">
                    <Play className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => remove(p.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => toggleExpand(p.id)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400">
                    {expandedId === p.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {expandedId === p.id && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-[10px] font-black uppercase text-slate-500 mb-2 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Generated invoices
                  </p>
                  {(generated[p.id] || []).length === 0 ? (
                    <p className="text-xs text-slate-500">None yet</p>
                  ) : (
                    <ul className="space-y-1">
                      {(generated[p.id] as Array<{ id: string; invoice_number: string; status: string; total: number }>).map((inv) => (
                        <li key={inv.id} className="text-xs text-slate-300 flex justify-between">
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
