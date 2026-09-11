'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from '@/lib/events/businessEventTaxonomy';
import {
  defaultTenantNotificationPolicy,
  type CategoryChannelPolicy,
  type TenantNotificationPolicy,
} from '@/lib/notifications/tenantNotificationPolicy';

const CHANNELS: Array<{ key: keyof CategoryChannelPolicy; label: string }> = [
  { key: 'in_app', label: 'In-app' },
  { key: 'email_owner', label: 'Owner email' },
  { key: 'email_assignee', label: 'Assignee email' },
  { key: 'email_client', label: 'Client email' },
  { key: 'daily_digest', label: 'Digest' },
  { key: 'urgent_only', label: 'Urgent only' },
];

export default function NotificationCategoryPolicyPanel({ tenantId }: { tenantId: string }) {
  const [policy, setPolicy] = useState<TenantNotificationPolicy>(defaultTenantNotificationPolicy());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tenant/${tenantId}/notification-preferences`);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || 'Preferences could not be loaded');
        if (!cancelled && payload.tenant_policy) setPolicy(payload.tenant_policy);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Preferences could not be loaded');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const saveCategory = async (category: NotificationCategory, patch: Partial<CategoryChannelPolicy>) => {
    const next = { ...policy, [category]: { ...policy[category], ...patch } };
    setPolicy(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/tenant/${tenantId}/notification-preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: { [category]: next[category] } }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Could not save notification policy');
      if (payload.tenant_policy) setPolicy(payload.tenant_policy);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save notification policy');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-xs text-slate-500 p-4">Loading notification policy…</p>;
  }

  return (
    <div className="divide-y divide-white/5">
      {NOTIFICATION_CATEGORIES.map((category) => {
        const row = policy[category];
        return (
          <div key={category} className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-[13px] font-bold text-white capitalize">{category.replace('_', ' ')}</h4>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveCategory(category, { disabled: !row.disabled })}
                className={`text-[10px] uppercase tracking-widest font-bold ${row.disabled ? 'text-rose-300' : 'text-slate-500'}`}
              >
                {row.disabled ? 'Disabled' : 'Enabled'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((channel) => (
                <button
                  key={channel.key}
                  type="button"
                  disabled={saving || row.disabled}
                  onClick={() => void saveCategory(category, { [channel.key]: !row[channel.key] })}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                    row[channel.key] ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {channel.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
