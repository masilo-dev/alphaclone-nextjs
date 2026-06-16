'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { tenantService } from '@/services/tenancy/TenantService';

interface ModulePayload {
  module: {
    module: string;
    score: number;
    confidence: number;
    recommendations: string[];
    risks: string[];
  };
  topActions: string[];
  systemicRisks: string[];
}

export function ModuleIntelligenceCard({
  moduleKey,
  title
}: {
  moduleKey: string;
  title: string;
}) {
  const [data, setData] = useState<ModulePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) {
          if (active) setData(null);
          return;
        }
        const response = await fetch(
          `/api/intelligence/system?tenantId=${encodeURIComponent(tenantId)}&module=${encodeURIComponent(moduleKey)}`,
          { credentials: 'include' }
        );
        if (!response.ok) {
          console.warn('Intelligence API not available');
          if (active) setData(null);
          return;
        }
        const payload = await response.json().catch(() => ({}));
        if (active) setData(payload.data as ModulePayload);
      } catch {
        if (active) setData(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [moduleKey]);

  const scoreTone = useMemo(() => {
    const score = data?.module?.score || 0;
    if (score >= 75) return 'text-teal-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  }, [data?.module?.score]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3 text-xs text-slate-400 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading module intelligence...
      </div>
    );
  }

  if (!data?.module) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs uppercase tracking-wider text-slate-400">{title}</h4>
        <div className={`text-sm font-bold ${scoreTone}`}>{Math.round(data.module.score)}</div>
      </div>
      {data.topActions?.[0] && <p className="text-xs text-slate-200 line-clamp-2">{data.topActions[0]}</p>}
      {data.systemicRisks?.[0] && (
        <p className="text-[11px] text-amber-300 flex items-start gap-1.5 line-clamp-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {data.systemicRisks[0]}
        </p>
      )}
    </div>
  );
}
