'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  RefreshCw,
  Search,
  ExternalLink,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ModulePageLayout } from '../../ui/ModulePageLayout';
import { EnterpriseDataTable, type EnterpriseColumn } from '../../ui/EnterpriseDataTable';
import { StatusBadge } from '../../ui/StatusBadge';
import { ModuleStatCards } from '../common/ModuleStatCards';

interface BillingSummaryRow {
  tenant_id: string;
  tenant_name: string;
  subscription_plan: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  total_mcp_calls_today: number;
  total_leads_today: number;
  total_outreach_today: number;
}

const PLAN_MRR: Record<string, number> = {
  free: 0,
  starter: 15,
  pro: 15,
  enterprise: 149,
  trial: 0,
};

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'neutral' | 'info'> = {
  active: 'success',
  trial: 'info',
  past_due: 'warning',
  suspended: 'warning',
  cancelled: 'error',
  free: 'neutral',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  active: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 inline mr-1" />,
  trial: <Clock className="h-3.5 w-3.5 text-blue-400 inline mr-1" />,
  past_due: <AlertCircle className="h-3.5 w-3.5 text-amber-400 inline mr-1" />,
  suspended: <AlertCircle className="h-3.5 w-3.5 text-amber-400 inline mr-1" />,
  cancelled: <XCircle className="h-3.5 w-3.5 text-red-400 inline mr-1" />,
  free: <Clock className="h-3.5 w-3.5 text-slate-400 inline mr-1" />,
};

const SuperAdminSubscriptionsTab: React.FC = () => {
  const [rows, setRows] = useState<BillingSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/tenant-billing-summary', {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load billing summary');
      }
      setRows((payload.rows as BillingSummaryRow[]) || []);
    } catch (err: unknown) {
      console.error('[SuperAdminSubscriptionsTab]', err);
      toast.error(err instanceof Error ? err.message : 'Failed to load billing summary');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.subscription_plan?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.subscription_status?.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [rows, searchTerm]
  );

  const totalMrr = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const status = r.subscription_status || 'free';
        if (status !== 'active' && status !== 'trial' && status !== 'trialing') return sum;
        const plan = (r.subscription_plan || 'free').toLowerCase();
        return sum + (PLAN_MRR[plan] ?? 0);
      }, 0),
    [rows]
  );

  const activeSubs = rows.filter(
    (r) =>
      r.subscription_status === 'active' ||
      r.subscription_status === 'trial' ||
      r.subscription_status === 'trialing'
  ).length;
  const pastDue = rows.filter((r) => r.subscription_status === 'past_due').length;
  const freeCount = rows.filter(
    (r) => !r.subscription_status || r.subscription_status === 'free'
  ).length;

  const stats = [
    {
      label: 'MRR',
      value: `$${totalMrr.toLocaleString()}`,
      sub: 'active + trial',
      Icon: TrendingUp,
      accent: 'teal' as const,
    },
    {
      label: 'Active subscriptions',
      value: activeSubs,
      Icon: CheckCircle2,
      accent: 'emerald' as const,
    },
    {
      label: 'Past due',
      value: pastDue,
      Icon: AlertCircle,
      accent: 'amber' as const,
    },
    {
      label: 'Free plan',
      value: freeCount,
      Icon: CreditCard,
      accent: 'blue' as const,
    },
  ];

  const columns = useMemo<EnterpriseColumn<BillingSummaryRow>[]>(
    () => [
      {
        id: 'tenant',
        header: 'Tenant',
        mobilePrimary: true,
        sortable: true,
        sortValue: (r) => r.tenant_name,
        accessor: (r) => (
          <div className="min-w-0">
            <span className="text-[13px] font-bold text-white block truncate">{r.tenant_name}</span>
            <span className="text-[10px] text-slate-500 font-mono">{r.tenant_id.substring(0, 12)}…</span>
          </div>
        ),
      },
      {
        id: 'plan',
        header: 'Plan',
        sortable: true,
        sortValue: (r) => r.subscription_plan || '',
        accessor: (r) => (
          <span className="capitalize font-semibold text-slate-200 text-xs">
            {r.subscription_plan || 'free'}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        sortable: true,
        sortValue: (r) => r.subscription_status || '',
        accessor: (r) => {
          const status = r.subscription_status || 'free';
          return (
            <StatusBadge variant={STATUS_VARIANT[status] || 'neutral'}>
              {STATUS_ICON[status]}
              {status}
            </StatusBadge>
          );
        },
      },
      {
        id: 'mrr',
        header: 'MRR',
        sortable: true,
        sortValue: (r) => PLAN_MRR[r.subscription_plan || ''] || 0,
        accessor: (r) => {
          const amount = PLAN_MRR[r.subscription_plan || ''] || 0;
          const isActive = r.subscription_status === 'active' || r.subscription_status === 'trial';
          return (
            <span className={`font-mono text-xs font-bold ${isActive && amount > 0 ? 'text-teal-300' : 'text-slate-500'}`}>
              {isActive && amount > 0 ? `$${amount}` : '—'}
            </span>
          );
        },
      },
      {
        id: 'mcp_today',
        header: 'MCP Today',
        sortable: true,
        sortValue: (r) => r.total_mcp_calls_today,
        accessor: (r) => (
          <span className="font-mono text-xs text-slate-300">{r.total_mcp_calls_today ?? 0}</span>
        ),
      },
      {
        id: 'leads_today',
        header: 'Leads Today',
        sortable: true,
        sortValue: (r) => r.total_leads_today,
        accessor: (r) => (
          <span className="font-mono text-xs text-slate-300">{r.total_leads_today ?? 0}</span>
        ),
      },
      {
        id: 'period_end',
        header: 'Period Ends',
        accessor: (r) =>
          r.current_period_end ? (
            <span className="text-xs text-slate-400">
              {new Date(r.current_period_end).toLocaleDateString()}
              {r.cancel_at_period_end && (
                <span className="ml-1.5 text-amber-400 text-[10px] font-bold">(cancels)</span>
              )}
            </span>
          ) : (
            <span className="text-xs text-slate-600">—</span>
          ),
      },
      {
        id: 'stripe',
        header: 'Stripe',
        accessor: (r) =>
          r.stripe_customer_id ? (
            <a
              href={`https://dashboard.stripe.com/customers/${r.stripe_customer_id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 font-mono"
            >
              {r.stripe_customer_id.substring(0, 14)}…
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : (
            <span className="text-xs text-slate-600">no customer</span>
          ),
      },
    ],
    []
  );

  return (
    <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module p-3 sm:p-4 md:p-6">
      <ModulePageLayout
        header={
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-teal-400" />
                Subscriptions &amp; Billing
              </h2>
              <p className="text-slate-400 text-sm">
                Real-time subscription state, Stripe IDs, and daily usage per tenant
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50 self-start"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        }
        toolbar={
          <div className="relative px-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search tenant, plan, or status…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-white/5 rounded-xl text-sm text-white focus:outline-none focus:border-teal-500/50"
            />
          </div>
        }
        stats={
          !loading ? (
            <div className="px-1">
              <ModuleStatCards stats={stats} />
            </div>
          ) : null
        }
      >
        <div className="px-1 pb-20">
          {loading ? (
            <div className="divide-y divide-white/5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 bg-slate-900/40 animate-pulse" />
              ))}
            </div>
          ) : (
            <EnterpriseDataTable
              columns={columns}
              data={filtered}
              getRowId={(r) => r.tenant_id}
              emptyMessage={searchTerm ? 'No tenants match your search.' : 'No billing data found.'}
            />
          )}
        </div>
      </ModulePageLayout>
    </div>
  );
};

export default SuperAdminSubscriptionsTab;
