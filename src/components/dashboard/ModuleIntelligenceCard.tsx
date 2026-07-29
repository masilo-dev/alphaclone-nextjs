'use client';

import React, { useEffect, useMemo, useState } from 'react';
<<<<<<< HEAD
import { AlertTriangle, Loader2, Play, RefreshCw, Zap } from 'lucide-react';
import { tenantService } from '@/services/tenancy/TenantService';
import { toast } from 'react-hot-toast';
=======
import { AlertTriangle, Loader2 } from 'lucide-react';
import { tenantService } from '@/services/tenancy/TenantService';
>>>>>>> origin/main

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

<<<<<<< HEAD
import { runModuleIntelligenceAction } from '@/services/intelligence/intelligenceFacade';

=======
>>>>>>> origin/main
export function ModuleIntelligenceCard({
  moduleKey,
  title
}: {
  moduleKey: string;
  title: string;
}) {
  const [data, setData] = useState<ModulePayload | null>(null);
  const [loading, setLoading] = useState(true);
<<<<<<< HEAD
  const [executing, setExecuting] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const tenantId = tenantService.getCurrentTenantId();
      if (!tenantId) {
        setData(null);
        setUnavailable(true);
        return;
      }
      const response = await fetch(
        `/api/intelligence/system?tenantId=${encodeURIComponent(tenantId)}&module=${encodeURIComponent(moduleKey)}`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        setData(null);
        setUnavailable(true);
        return;
      }
      const payload = await response.json().catch(() => ({}));
      setData(payload.data as ModulePayload);
      setUnavailable(false);
    } catch {
      setData(null);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [moduleKey]);

  useEffect(() => {
    let active = true;
    void (async () => { if (active) await load(); })();
    return () => { active = false; };
  }, [load]);

  const handleExecute = async (actionText: string) => {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) {
      toast.error('Select a workspace first.');
      return;
    }
    setExecuting(actionText);
    try {
      const result = await runModuleIntelligenceAction({
        tenantId,
        moduleKey,
        actionText,
      });
      if (result.success) {
        toast.success(result.summary || result.text || 'Action executed via Bonnie.');
        await load();
      } else if (result.approvalRequired) {
        toast('Action queued for approval in AI Agents tab', { icon: '⚠️' });
      } else {
        toast.error(result.error || 'Action failed');
      }
    } catch {
      toast.error('Execution failed.');
    } finally {
      setExecuting(null);
    }
  };
=======

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
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Failed');
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
>>>>>>> origin/main

  const scoreTone = useMemo(() => {
    const score = data?.module?.score || 0;
    if (score >= 75) return 'text-teal-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  }, [data?.module?.score]);

<<<<<<< HEAD
  if (loading && !data) {
=======
  if (loading) {
>>>>>>> origin/main
    return (
      <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3 text-xs text-slate-400 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading module intelligence...
      </div>
    );
  }

<<<<<<< HEAD
  // Explicit state instead of vanishing silently when intelligence isn't ready.
  if (!data?.module) {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs uppercase tracking-wider text-slate-400">{title}</h4>
          <button
            onClick={() => load()}
            className="text-[10px] text-teal-400 hover:text-teal-300 font-bold uppercase tracking-wider flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Scan
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          {unavailable
            ? 'Intelligence is still warming up for this workspace — add a few records, then run a scan.'
            : 'No insights yet.'}
        </p>
      </div>
    );
  }

  const topAction = data.topActions?.[0];

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs uppercase tracking-wider text-slate-400">{title}</h4>
        <div className="flex items-center gap-2">
          <div className={`text-sm font-bold ${scoreTone}`}>{Math.round(data.module.score)}</div>
          <button
            onClick={() => load()}
            title="Recalibrate scan"
            className="text-slate-500 hover:text-teal-400 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {topAction ? (
        <button
          onClick={() => handleExecute(topAction)}
          disabled={!!executing}
          className="w-full group flex items-center justify-between gap-2 p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500/20 transition-all text-left disabled:opacity-60"
        >
          <span className="flex items-start gap-2 min-w-0">
            {executing === topAction
              ? <Loader2 className="w-3.5 h-3.5 text-teal-400 animate-spin mt-0.5 shrink-0" />
              : <Zap className="w-3.5 h-3.5 text-teal-400 mt-0.5 shrink-0" />}
            <span className="text-xs text-teal-100 font-medium line-clamp-2">{topAction}</span>
          </span>
          <Play className="w-3 h-3 text-teal-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </button>
      ) : (
        <p className="text-[11px] text-slate-500">System optimized — no immediate action needed.</p>
      )}

=======
  if (!data?.module) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs uppercase tracking-wider text-slate-400">{title}</h4>
        <div className={`text-sm font-bold ${scoreTone}`}>{Math.round(data.module.score)}</div>
      </div>
      {data.topActions?.[0] && <p className="text-xs text-slate-200 line-clamp-2">{data.topActions[0]}</p>}
>>>>>>> origin/main
      {data.systemicRisks?.[0] && (
        <p className="text-[11px] text-amber-300 flex items-start gap-1.5 line-clamp-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {data.systemicRisks[0]}
        </p>
      )}
    </div>
  );
}
