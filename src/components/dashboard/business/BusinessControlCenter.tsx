'use client';

import { useEffect, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import Link from 'next/link';

type ControlData = {
  today: Record<string, number>;
  what_happened: Record<string, number>;
  bonnie_recommends: string[];
  platform_score: { score: number; grade: string; summary: string };
  needs_attention: Array<{ id: string; title: string; detail?: string; href: string; impact: string }>;
};

export function BusinessControlCenter() {
  const { currentTenant } = useTenant();
  const [data, setData] = useState<ControlData | null>(null);

  useEffect(() => {
    if (!currentTenant?.id) return;
    fetch(`/api/dashboard/business-control?tenantId=${currentTenant.id}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [currentTenant?.id]);

  if (!data) return null;

  return (
    <section className="rounded-2xl border border-cyan-900/30 bg-[#0f172a]/80 p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-cyan-400 font-semibold">Business Control</p>
          <h2 className="text-xl font-bold text-white mt-1">Today</h2>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-emerald-400">{data.platform_score.score}/100</p>
          <p className="text-xs text-slate-400">Platform context · {data.platform_score.grade}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
        {Object.entries(data.today).map(([key, val]) => (
          <div key={key} className="rounded-xl bg-slate-900/60 border border-slate-800 p-3">
            <p className="text-2xl font-bold text-white">{val}</p>
            <p className="text-xs text-slate-400 capitalize">{key.replace(/_/g, ' ')}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">What happened (24h)</h3>
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          {Object.entries(data.what_happened).map(([k, v]) => (
            <span key={k} className="px-2 py-1 rounded bg-slate-900 border border-slate-800">
              {v} {k.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      </div>

      {data.needs_attention.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-amber-400 mb-2">Needs attention</h3>
          <ul className="space-y-2">
            {data.needs_attention.slice(0, 5).map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="text-sm text-slate-200 hover:text-cyan-400 underline-offset-2 hover:underline">
                  {item.title}{item.detail ? ` — ${item.detail}` : ''}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl bg-cyan-950/20 border border-cyan-900/40 p-4">
        <h3 className="text-sm font-semibold text-cyan-300 mb-2">Bonnie recommends</h3>
        <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
          {data.bonnie_recommends.map((rec) => (
            <li key={rec}>{rec}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default BusinessControlCenter;
