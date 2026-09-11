'use client';

import { useEffect, useState } from 'react';
import { quotaEnforcementService, UsageSummary, QuotaAlert } from '../services/quotaEnforcementService';

interface UsageDashboardProps {
    tenantId: string;
    showAlerts?: boolean;
}

export function UsageDashboard({ tenantId, showAlerts = true }: UsageDashboardProps) {
    const [usage, setUsage] = useState<UsageSummary[]>([]);
    const [alerts, setAlerts] = useState<QuotaAlert[]>([]);
    const [loading, setLoading] = useState(true);

    async function loadUsageData() {
        setLoading(true);
        const [usageData, alertsData] = await Promise.all([
            quotaEnforcementService.getUsageSummary(tenantId),
            showAlerts ? quotaEnforcementService.getQuotaAlerts(tenantId) : Promise.resolve([]),
        ]);

        setUsage(usageData);
        setAlerts(alertsData);
        setLoading(false);
    }

    useEffect(() => {
        void loadUsageData();
    }, [tenantId, showAlerts]);

    function getStatusColor(status: string): string {
        switch (status) {
            case 'ok':
                return 'bg-emerald-500';
            case 'approaching':
                return 'bg-amber-400';
            case 'exceeded':
                return 'bg-red-500';
            default:
                return 'bg-slate-500';
        }
    }

    function getStatusText(status: string): string {
        switch (status) {
            case 'ok':
                return 'Healthy';
            case 'approaching':
                return 'Approaching Limit';
            case 'exceeded':
                return 'Limit Exceeded';
            default:
                return 'Unknown';
        }
    }

    function formatMetricName(name: string): string {
        return name
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {showAlerts && alerts.length > 0 && (
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
                    <h3 className="mb-2 text-lg font-semibold text-amber-100">Quota Alerts</h3>
                    <div className="space-y-2">
                        {alerts.map((alert) => (
                            <div key={alert.id} className="flex items-center justify-between text-sm">
                                <span className="text-amber-50">
                                    {formatMetricName(alert.metric_name)}: {alert.current_value} / {alert.limit_value}
                                </span>
                                <span
                                    className={`rounded px-2 py-1 text-xs font-medium ${
                                        alert.alert_type === 'exceeded'
                                            ? 'bg-red-500/20 text-red-100'
                                            : 'bg-amber-500/20 text-amber-100'
                                    }`}
                                >
                                    {alert.alert_type}
                                </span>
                            </div>
                        ))}
                    </div>
                    <a
                        href="/dashboard/business/settings"
                        className="mt-3 inline-block text-sm font-medium text-teal-300 hover:text-teal-200"
                    >
                        Review billing and quotas -&gt;
                    </a>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {usage.map((metric) => (
                    <div key={metric.metric_name} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                        <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-sm font-medium text-slate-200">{formatMetricName(metric.metric_name)}</h4>
                            <span
                                className={`h-2 w-2 rounded-full ${getStatusColor(metric.status)}`}
                                title={getStatusText(metric.status)}
                            ></span>
                        </div>

                        <div className="relative mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                                className={`absolute left-0 top-0 h-full transition-all ${getStatusColor(metric.status)}`}
                                style={{ width: `${Math.min(metric.percentage_used, 100)}%` }}
                            ></div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">
                                {metric.current_value.toLocaleString()} /{' '}
                                {metric.limit_value === 999999 ? 'Unlimited' : metric.limit_value.toLocaleString()}
                            </span>
                            <span
                                className={`font-medium ${
                                    metric.status === 'exceeded'
                                        ? 'text-red-400'
                                        : metric.status === 'approaching'
                                            ? 'text-amber-300'
                                            : 'text-emerald-400'
                                }`}
                            >
                                {metric.percentage_used.toFixed(1)}%
                            </span>
                        </div>

                        <div className="mt-2 text-xs text-slate-500">{getStatusText(metric.status)}</div>
                    </div>
                ))}
            </div>

            {usage.some((metric) => metric.status === 'exceeded') && (
                <div className="rounded-2xl border border-teal-500/25 bg-teal-500/10 p-4 text-center">
                    <p className="mb-2 text-teal-100">
                        You&apos;ve reached the limit for some features. Review your plan or upgrade to keep everything moving.
                    </p>
                    <a
                        href="/dashboard/business/settings"
                        className="inline-block rounded-lg bg-teal-500 px-4 py-2 font-medium text-slate-950 transition-colors hover:bg-teal-400"
                    >
                        View Plans & Upgrade
                    </a>
                </div>
            )}
        </div>
    );
}
