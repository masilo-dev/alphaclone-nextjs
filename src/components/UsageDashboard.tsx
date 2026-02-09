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

    useEffect(() => {
        loadUsageData();
    }, [tenantId]);

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

    function getStatusColor(status: string): string {
        switch (status) {
            case 'ok':
                return 'bg-green-500';
            case 'approaching':
                return 'bg-yellow-500';
            case 'exceeded':
                return 'bg-red-500';
            default:
                return 'bg-gray-500';
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
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Alerts Section */}
            {showAlerts && alerts.length > 0 && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Quota Alerts</h3>
                    <div className="space-y-2">
                        {alerts.map(alert => (
                            <div key={alert.id} className="flex items-center justify-between text-sm">
                                <span className="text-yellow-700">
                                    {formatMetricName(alert.metric_name)}: {alert.current_value} /{' '}
                                    {alert.limit_value}
                                </span>
                                <span
                                    className={`px-2 py-1 rounded text-xs font-medium ${
                                        alert.alert_type === 'exceeded'
                                            ? 'bg-red-100 text-red-800'
                                            : 'bg-yellow-100 text-yellow-800'
                                    }`}
                                >
                                    {alert.alert_type}
                                </span>
                            </div>
                        ))}
                    </div>
                    <a
                        href="/settings/billing"
                        className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                        Upgrade Plan →
                    </a>
                </div>
            )}

            {/* Usage Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {usage.map(metric => (
                    <div key={metric.metric_name} className="rounded-lg border border-gray-200 bg-white p-4">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-gray-700">
                                {formatMetricName(metric.metric_name)}
                            </h4>
                            <span
                                className={`h-2 w-2 rounded-full ${getStatusColor(metric.status)}`}
                                title={getStatusText(metric.status)}
                            ></span>
                        </div>

                        {/* Progress Bar */}
                        <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                            <div
                                className={`absolute top-0 left-0 h-full transition-all ${getStatusColor(
                                    metric.status
                                )}`}
                                style={{ width: `${Math.min(metric.percentage_used, 100)}%` }}
                            ></div>
                        </div>

                        {/* Usage Numbers */}
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">
                                {metric.current_value.toLocaleString()} /{' '}
                                {metric.limit_value === 999999
                                    ? '∞'
                                    : metric.limit_value.toLocaleString()}
                            </span>
                            <span className={`font-medium ${
                                metric.status === 'exceeded' ? 'text-red-600' :
                                metric.status === 'approaching' ? 'text-yellow-600' :
                                'text-green-600'
                            }`}>
                                {metric.percentage_used.toFixed(1)}%
                            </span>
                        </div>

                        {/* Status Text */}
                        <div className="mt-2 text-xs text-gray-500">{getStatusText(metric.status)}</div>
                    </div>
                ))}
            </div>

            {/* Upgrade CTA if any metrics exceeded */}
            {usage.some(m => m.status === 'exceeded') && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-center">
                    <p className="text-blue-800 mb-2">
                        You've reached the limit for some features. Upgrade to continue using all features.
                    </p>
                    <a
                        href="/settings/billing"
                        className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                        View Plans & Upgrade
                    </a>
                </div>
            )}
        </div>
    );
}
