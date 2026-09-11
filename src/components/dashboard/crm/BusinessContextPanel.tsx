'use client';

import { useEffect, useState } from 'react';
import type { EntityTimelineItem } from '@/lib/audit/entityTimelineService';

type BusinessContextPanelProps = {
  tenantId: string;
  entityType: 'lead' | 'client' | 'contact' | 'contract' | 'invoice' | 'project';
  entityId: string;
  className?: string;
};

type ContextPayload = {
  identity: Record<string, unknown>;
  outreach_status: string;
  timeline: EntityTimelineItem[];
  needs_attention: string[];
  next_action: string;
  relationships: Record<string, unknown>;
};

export function BusinessContextPanel({ tenantId, entityType, entityId, className = '' }: BusinessContextPanelProps) {
  const [data, setData] = useState<ContextPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tenantId || !entityId) return;
    setLoading(true);
    fetch(`/api/tenant/${tenantId}/entities/${entityType}/${entityId}/context`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => setError(err.message || 'Unable to load context'))
      .finally(() => setLoading(false));
  }, [tenantId, entityType, entityId]);

  if (loading) {
    return (
      <aside className={`rounded-xl border border-slate-800 bg-[#0f172a] p-4 text-slate-400 text-sm ${className}`}>
        Loading business context…
      </aside>
    );
  }

  if (error || !data) {
    return (
      <aside className={`rounded-xl border border-slate-800 bg-[#0f172a] p-4 text-red-400 text-sm ${className}`}>
        {error || 'Context unavailable'}
      </aside>
    );
  }

  const name = String(
    data.identity.business_name ||
    data.identity.contact_name ||
    data.identity.title ||
    data.identity.invoice_number ||
    data.identity.name ||
    'Record',
  );

  return (
    <aside className={`rounded-xl border border-cyan-900/30 bg-[#0f172a] text-slate-200 ${className}`}>
      <div className="border-b border-slate-800 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-cyan-400">Business Context</p>
        <h3 className="text-lg font-semibold text-white truncate">{name}</h3>
        {data.outreach_status !== 'N/A' ? (
          <p className="text-xs text-slate-400 mt-1">Outreach: {data.outreach_status}</p>
        ) : null}
      </div>

      {data.needs_attention.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-800 bg-amber-950/20">
          <p className="text-xs font-semibold text-amber-400 uppercase mb-1">Needs Attention</p>
          <ul className="text-sm space-y-1">
            {data.needs_attention.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-4 py-3 border-b border-slate-800">
        <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Recent Activity</p>
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {data.timeline.slice(0, 5).map((item) => (
            <li key={item.id} className="text-sm">
              <p className="text-white font-medium">{item.title}</p>
              <p className="text-xs text-slate-500">{item.source_label} · {new Date(item.timestamp).toLocaleString()}</p>
            </li>
          ))}
          {!data.timeline.length && <li className="text-xs text-slate-500">No activity yet</li>}
        </ul>
      </div>

      {Object.keys(data.relationships).length > 0 && (
        <div className="px-4 py-3 border-b border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Relationships</p>
          <ul className="text-xs space-y-1 text-slate-400">
            {Object.entries(data.relationships).map(([key, value]) => {
              const count = Array.isArray(value) ? value.length : value ? 1 : 0;
              if (!count) return null;
              return (
                <li key={key}>
                  {key}: {Array.isArray(value) ? count : String((value as Record<string, unknown>)?.name || 'linked')}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="px-4 py-3">
        <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Next Action</p>
        <p className="text-sm text-slate-300">{data.next_action}</p>
      </div>
    </aside>
  );
}

export default BusinessContextPanel;
