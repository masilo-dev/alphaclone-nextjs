'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, CheckCircle2, Circle, RefreshCcw, Loader2 } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';
import type { AccountingPeriod } from '@/lib/accounting/accountingPeriodServer';
import { useWorkspacePreferences } from '@/hooks/useWorkspacePreferences';

const CHECKLIST = [
  { id: 'review', label: 'Review all journal entries for the period' },
  { id: 'reconcile', label: 'Complete bank reconciliations' },
  { id: 'ap', label: 'Verify accounts payable aging' },
  { id: 'ar', label: 'Review outstanding invoices' },
  { id: 'lock', label: 'Lock period to prevent backdated edits' },
] as const;

function legacyStorageKey(tenantId: string) {
  return `period-close-${tenantId}`;
}

export default function PeriodClosePage() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const {
    periodClose,
    loading: prefsLoading,
    savePeriodCloseChecklist,
    patchImmediate,
    reload: reloadPrefs,
  } = useWorkspacePreferences();

  const [period, setPeriod] = useState<AccountingPeriod | null>(null);
  const [loadingPeriod, setLoadingPeriod] = useState(true);
  const [closing, setClosing] = useState(false);

  const checked = useMemo(() => {
    if (!period) return {};
    return periodClose[period.id]?.checked ?? {};
  }, [period, periodClose]);

  const isTerminal = period?.status === 'closed' || period?.status === 'locked';
  const locked = period?.status === 'locked';

  const loadPeriods = useCallback(async () => {
    if (!tenantId) {
      setLoadingPeriod(false);
      return;
    }

    setLoadingPeriod(true);
    try {
      const fiscalYear = new Date().getFullYear();
      let response = await fetch(
        `/api/tenant/${encodeURIComponent(tenantId)}/accounting/periods?fiscalYear=${fiscalYear}`,
        { credentials: 'include' },
      );

      if (!response.ok) {
        throw new Error('Failed to load accounting periods');
      }

      let body = await response.json();
      let periods: AccountingPeriod[] = body.periods ?? [];
      let currentPeriod: AccountingPeriod | null = body.currentPeriod ?? null;

      if (periods.length === 0) {
        const initResponse = await fetch(
          `/api/tenant/${encodeURIComponent(tenantId)}/accounting/periods`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'initialize_fiscal_year', fiscalYear }),
          },
        );

        if (initResponse.status === 409) {
          const conflict = await initResponse.json();
          periods = conflict.periods ?? [];
        } else if (!initResponse.ok) {
          throw new Error('Failed to initialize fiscal year periods');
        } else {
          const initBody = await initResponse.json();
          periods = initBody.periods ?? [];
        }

        response = await fetch(
          `/api/tenant/${encodeURIComponent(tenantId)}/accounting/periods?fiscalYear=${fiscalYear}`,
          { credentials: 'include' },
        );
        if (response.ok) {
          body = await response.json();
          currentPeriod = body.currentPeriod ?? null;
          if (periods.length === 0) {
            periods = body.periods ?? [];
          }
        }
      }

      const active =
        currentPeriod ??
        periods.find((p) => p.status === 'open') ??
        periods[periods.length - 1] ??
        null;

      setPeriod(active);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load period');
    } finally {
      setLoadingPeriod(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  useEffect(() => {
    if (!tenantId || !period || prefsLoading) return;

    try {
      const raw = localStorage.getItem(legacyStorageKey(tenantId));
      if (!raw) return;

      const parsed = JSON.parse(raw) as { checked?: Record<string, boolean>; locked?: boolean };
      const serverChecked = periodClose[period.id]?.checked;
      const hasServerData = serverChecked && Object.keys(serverChecked).length > 0;

      if (!hasServerData && parsed.checked && Object.keys(parsed.checked).length > 0) {
        void patchImmediate({ periodClose: { periodId: period.id, checked: parsed.checked } }).then(() => {
          localStorage.removeItem(legacyStorageKey(tenantId));
        });
      } else {
        localStorage.removeItem(legacyStorageKey(tenantId));
      }
    } catch {
      localStorage.removeItem(legacyStorageKey(tenantId));
    }
  }, [tenantId, period, periodClose, prefsLoading, patchImmediate]);

  const toggle = (id: string) => {
    if (!period || isTerminal) return;
    const next = { ...checked, [id]: !checked[id] };
    savePeriodCloseChecklist(period.id, next);
  };

  const allDone = CHECKLIST.every((c) => checked[c.id]);

  const lockPeriod = async () => {
    if (!period || !tenantId) return;
    if (!allDone) {
      toast.error('Complete all checklist items first');
      return;
    }
    if (isTerminal) return;

    setClosing(true);
    try {
      const closeResponse = await fetch(
        `/api/tenant/${encodeURIComponent(tenantId)}/accounting/periods/${encodeURIComponent(period.id)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'close' }),
        },
      );
      if (!closeResponse.ok) {
        const body = await closeResponse.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to close period');
      }

      const lockResponse = await fetch(
        `/api/tenant/${encodeURIComponent(tenantId)}/accounting/periods/${encodeURIComponent(period.id)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'lock' }),
        },
      );
      if (!lockResponse.ok) {
        const body = await lockResponse.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to lock period');
      }

      const lockBody = await lockResponse.json();
      setPeriod(lockBody.period ?? period);
      toast.success('Period closed and locked');
      void reloadPrefs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not close period');
    } finally {
      setClosing(false);
    }
  };

  const resetChecklist = () => {
    if (!period || isTerminal) {
      toast.error('Unlock or start a new period before resetting this checklist.');
      return;
    }
    savePeriodCloseChecklist(period.id, {}, true);
    toast.success('Checklist reset');
  };

  const progress = Math.round((CHECKLIST.filter((c) => checked[c.id]).length / CHECKLIST.length) * 100);

  if (loadingPeriod || prefsLoading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!period) {
    return (
      <div className="p-4 text-sm text-slate-400">
        No accounting period available. Contact an admin to initialize fiscal periods.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 pb-24 max-w-lg mx-auto ac-scroll-full ac-enterprise-module">
      <div className="dashboard-panel-soft p-4">
        <h3 className="text-sm font-bold text-white mb-1">{period.periodName}</h3>
        <p className="text-xs text-slate-500 mb-2">
          {period.startDate} — {period.endDate} · Status:{' '}
          <span className="text-slate-300 capitalize">{period.status}</span>
        </p>
        <h3 className="text-sm font-bold text-white mb-2">Period close progress</h3>
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div className="bg-emerald-500 h-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-slate-300 mt-2">{progress}% complete</p>
        <p className="text-xs text-slate-500 mt-2">
          Use this checklist to confirm books, payables, cash, and receivables are reviewed before you lock the period.
        </p>
      </div>

      <div className="dashboard-panel-soft divide-y divide-white/5">
        {CHECKLIST.map((item) => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            disabled={isTerminal}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/5 disabled:opacity-60"
          >
            {checked[item.id] ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-slate-600 flex-shrink-0" />
            )}
            <span className="text-sm text-white">{item.label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => void lockPeriod()}
        disabled={locked || !allDone || closing || isTerminal}
        className="w-full h-11 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white font-bold flex items-center justify-center gap-2"
      >
        {closing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : locked ? (
          <>
            <Lock className="w-4 h-4" /> Period locked
          </>
        ) : period.status === 'closed' ? (
          <>
            <Lock className="w-4 h-4" /> Period closed
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" /> Close period
          </>
        )}
      </button>

      <button
        onClick={resetChecklist}
        disabled={isTerminal}
        className="w-full h-11 rounded-xl border border-white/10 bg-slate-900/60 hover:bg-slate-900 text-slate-200 disabled:opacity-40 font-bold flex items-center justify-center gap-2"
      >
        <RefreshCcw className="w-4 h-4" /> Reset checklist
      </button>
    </div>
  );
}
