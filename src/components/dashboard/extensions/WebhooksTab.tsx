'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Webhook as WebhookIcon, Trash2 } from 'lucide-react';
import { ModulePageLayout } from '@/components/ui/ModulePageLayout';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';
import { EnterprisePageHeader } from '@/components/dashboard/responsive/EnterpriseModuleChrome';

const EVENT_OPTIONS = ['deal.stage_changed', 'invoice.created', 'lead.created', 'contact.created'];
type WebhookRecord = { id: string; tenantId: string; url: string; events: string[]; isActive: boolean; createdAt: string; updatedAt: string };

export default function WebhooksTab() {
  const { currentTenant } = useTenant();
  const [hooks, setHooks] = useState<WebhookRecord[]>([]);
  const [url, setUrl] = useState('');
  const [event, setEvent] = useState(EVENT_OPTIONS[0]);
  const [loading, setLoading] = useState(true);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const response = await fetch(`/api/tenant/${encodeURIComponent(currentTenant.id)}/webhooks`, { credentials: 'include' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setHooks([]);
    } else {
      setHooks(
        (payload.webhooks || []).map((w: any) => ({
          id: w.id,
          tenantId: w.tenant_id,
          url: w.url,
          events: w.events || [],
          isActive: w.is_active,
          createdAt: w.created_at,
          updatedAt: w.updated_at,
        }))
      );
    }
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!url.trim()) return;
    if (!currentTenant?.id) return;
    const response = await fetch(`/api/tenant/${encodeURIComponent(currentTenant.id)}/webhooks`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.trim(), events: [event] }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) toast.error(payload.error || 'Webhook could not be registered');
    else {
      toast.success('Webhook registered');
      setNewSecret(payload.secret || null);
      setUrl('');
      void load();
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentTenant?.id) return;
    const response = await fetch(`/api/tenant/${encodeURIComponent(currentTenant.id)}/webhooks?id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
    if (!response.ok) return toast.error('Webhook could not be deleted');
    void load();
  };

  return (
    <ModulePageLayout
      header={<EnterprisePageHeader moduleKey="webhooks" />}
    >
      <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 mb-4 flex flex-wrap gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-app.com/webhooks/alphaclone"
          className="flex-1 min-w-[220px] bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
        />
        <select
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          className="bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
        >
          {EVENT_OPTIONS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <button
          onClick={() => void handleAdd()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Add webhook
        </button>
      </div>
      {newSecret && <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"><p className="text-xs font-semibold text-amber-300">Copy this signing secret now. It will not be shown again.</p><code className="mt-2 block break-all text-xs text-slate-300 select-all">{newSecret}</code><button onClick={() => setNewSecret(null)} className="mt-2 text-xs text-slate-500 hover:text-white">I saved it</button></div>}

      <div className="space-y-3 ac-scroll-full pb-24">
        {loading ? (
          <p className="text-sm text-slate-500 p-4">Loading webhooks…</p>
        ) : hooks.length === 0 ? (
          <p className="text-sm text-slate-500 p-4">No webhooks configured.</p>
        ) : (
          hooks.map((h) => (
            <div key={h.id} className="bg-slate-900 border border-white/5 rounded-xl p-4 flex items-start gap-3">
              <WebhookIcon className="w-5 h-5 text-teal-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white break-all">{h.url}</p>
                <p className="text-xs text-slate-500 mt-1">{(h.events || []).join(', ')}</p>
              </div>
              <button onClick={() => void handleDelete(h.id)} className="text-slate-500 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </ModulePageLayout>
  );
}
