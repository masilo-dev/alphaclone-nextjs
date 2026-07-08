'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BrainCircuit, CheckCircle2, Loader2 } from 'lucide-react';
import { tenantService } from '@/services/tenancy/TenantService';

type ModuleName =
  | 'crm'
  | 'invoicingRevenue'
  | 'emailInbox'
  | 'taskManagement'
  | 'socialMedia'
  | 'aiProposals'
  | 'analyticsDashboard'
  | 'teamCollaboration'
  | 'automationWorkflows'
  | 'customerSuccess';

interface ModuleAssessment {
  module: ModuleName;
  score: number;
  confidence: number;
  recommendations: string[];
  risks: string[];
}

interface SnapshotResponse {
  tenantId: string;
  generatedAt: string;
  overallScore: number;
  overallConfidence: number;
  modules: ModuleAssessment[];
  topActions: string[];
  systemicRisks: string[];
}

interface TrendPoint {
  timestamp: string;
  score: number;
  confidence: number;
}

const MODULE_LABELS: Record<ModuleName, string> = {
  crm: 'CRM',
  invoicingRevenue: 'Invoicing',
  emailInbox: 'Email',
  taskManagement: 'Tasks',
  socialMedia: 'Social',
  aiProposals: 'Proposals',
  analyticsDashboard: 'Analytics',
  teamCollaboration: 'Team',
  automationWorkflows: 'Automation',
  customerSuccess: 'Customer Success'
};

export function IntegratedIntelligencePanel() {
  const [snapshot, setSnapshot] = useState<SnapshotResponse | null>(null);
  const [trendPoints, setTrendPoints] = useState<TrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No tenant context available');
        const response = await fetch(
          `/api/intelligence/system?tenantId=${encodeURIComponent(tenantId)}&persist=true`,
          { method: 'GET', credentials: 'include' }
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Failed to load intelligence');
        if (active) {
          setSnapshot(payload.data as SnapshotResponse);
        }
        const trendResponse = await fetch(
          `/api/intelligence/trends?tenantId=${encodeURIComponent(tenantId)}&limit=12`,
          { method: 'GET', credentials: 'include' }
        );
        const trendPayload = await trendResponse.json().catch(() => ({}));
        if (active && trendResponse.ok) {
          setTrendPoints((trendPayload?.data?.points || []) as TrendPoint[]);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load intelligence');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const topModules = useMemo(() => {
    if (!snapshot?.modules?.length) return [];
    return [...snapshot.modules].sort((a, b) => b.score - a.score).slice(0, 4);
  }, [snapshot]);

  if (isLoading) {
    return (
      <div className="ac-workspace-panel rounded-lg p-4">
        <div className="flex items-center gap-2 text-slate-300 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Building integrated intelligence snapshot...
        </div>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="ac-workspace-panel rounded-lg border-red-500/20 p-4 text-sm text-red-300">
        Failed to load system intelligence snapshot.
      </div>
    );
  }

  return (
    <div className="ac-workspace-panel rounded-lg border-teal-500/20 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-teal-400" />
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Integrated Intelligence</h3>
            <p className="text-sm font-semibold text-white mt-0.5">System health and recommended action areas</p>
          </div>
        </div>
        <div className="text-xs text-slate-400 text-right">
          Score {snapshot.overallScore.toFixed(1)} | Confidence {(snapshot.overallConfidence * 100).toFixed(0)}%
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {topModules.map((moduleAssessment) => (
          <div key={moduleAssessment.module} className="rounded-lg border border-white/10 bg-slate-950/45 p-2.5">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">
              {MODULE_LABELS[moduleAssessment.module]}
            </div>
            <div className="text-lg font-bold text-white">{moduleAssessment.score.toFixed(0)}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
          <div className="text-[11px] font-black uppercase tracking-widest text-teal-300 mb-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Priority Actions
          </div>
          <ul className="space-y-1.5 text-sm text-slate-200">
            {snapshot.topActions.slice(0, 4).map((item) => (
              <li key={item} className="line-clamp-2">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
          <div className="text-[11px] font-black uppercase tracking-widest text-amber-300 mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Systemic Risks
          </div>
          <ul className="space-y-1.5 text-sm text-slate-200">
            {snapshot.systemicRisks.slice(0, 4).map((item) => (
              <li key={item} className="line-clamp-2">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {trendPoints.length > 1 && (
        <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
          <div className="text-[11px] text-slate-400 mb-2 uppercase tracking-widest font-black">Trend</div>
          <div className="flex items-end gap-1 h-16">
            {trendPoints.map((point, index) => (
              <div
                key={`${point.timestamp}-${index}`}
                className="flex-1 bg-teal-500/30 hover:bg-teal-400/60 rounded-sm"
                style={{ height: `${Math.max(8, Math.min(100, point.score))}%` }}
                title={`${new Date(point.timestamp).toLocaleDateString()} - ${point.score.toFixed(1)}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

