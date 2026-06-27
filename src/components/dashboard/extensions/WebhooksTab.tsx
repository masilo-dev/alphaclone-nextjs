'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Webhook as WebhookIcon, Trash2 } from 'lucide-react';
import { ModulePageLayout } from '@/components/ui/ModulePageLayout';
import { registerWebhook, type Webhook as WebhookRecord } from '@/services/webhookDeliveryService';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';

const EVENT_OPTIONS = ['deal.stage_changed', 'invoice.created', 'lead.created', 'contact.created'];

export default function WebhooksTab() {
  const { currentTenant } = useTenant();
  const [hooks, setHooks] = useState<WebhookRecord[]>([]);
  const [url, setUrl] = useState('');
  const [event, setEvent] = useState(EVENT_OPTIONS[0]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      setHooks([]);
    } else {
      setHooks(
        (data || []).map((w: any) => ({
          id: w.id,
          tenantId: w.tenant_id,
          url: w.url,
          events: w.events || [],
          secret: w.secret,
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
    const { error } = await registerWebhook(url.trim(), [event]);
    if (error) toast.error(error);
    else {
      toast.success('Webhook registered');
      setUrl('');
      void load();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('webhooks').delete().eq('id', id);
    void load();
  };

  return (
    <ModulePageLayout
      header={
        <div className="px-1 pb-2">
          <h1 className="text-lg font-semibold text-white">Extensions & Webhooks</h1>
          <p className="text-sm text-slate-400">Outbound event hooks for integrations</p>
        </div>
      }
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
