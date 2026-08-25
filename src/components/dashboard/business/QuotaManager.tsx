'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, TrendingUp, FileText, Users, DollarSign, RefreshCw, BarChart3 } from 'lucide-react';
import { quotaService, type DetailedUsageSummary } from '../../../services/quotaService';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenant } from '../../../contexts/TenantContext';
import toast from 'react-hot-toast';

interface QuotaManagerProps {
    className?: string;
}

type QuotaCardKey = 'leads' | 'contracts' | 'invoices' | 'receipts';

const CARD_META: Record<QuotaCardKey, { label: string; icon: typeof Users; color: string }> = {
    leads: { label: 'Leads', icon: Users, color: 'text-blue-400' },
    contracts: { label: 'Contracts', icon: FileText, color: 'text-green-400' },
    invoices: { label: 'Invoices', icon: DollarSign, color: 'text-yellow-400' },
    receipts: { label: 'Receipts', icon: TrendingUp, color: 'text-purple-400' },
};

const QuotaManager: React.FC<QuotaManagerProps> = ({ className }) => {
    const { user } = useAuth();
    const { currentTenant } = useTenant();
    const [summary, setSummary] = useState<DetailedUsageSummary | null>(null);
    const [loading, setLoading] = useState(true);

    const loadQuotaData = useCallback(async () => {
        if (!user?.id || !currentTenant?.id) return;

        try {
            setLoading(true);
            const usage = await quotaService.getTenantUsageSummary(currentTenant.id, user.id);
            setSummary(usage);
        } catch (error) {
            console.error('Error loading quota data:', error);
            toast.error('Failed to load quota information');
        } finally {
            setLoading(false);
        }
    }, [user?.id, currentTenant?.id]);

    useEffect(() => {
        void loadQuotaData();
    }, [loadQuotaData]);

    const getProgressColor = (usage: number, limit: number) => {
        if (limit < 0) return 'bg-green-500';
        const percentage = limit > 0 ? (usage / limit) * 100 : 0;
        if (percentage >= 90) return 'bg-red-500';
        if (percentage >= 70) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getProgressPercentage = (usage: number, limit: number) => {
        if (limit < 0) return usage > 0 ? 8 : 0;
        return Math.min(100, limit > 0 ? (usage / limit) * 100 : 0);
    };

    const formatNumber = (num: number) => num.toLocaleString();

    const formatLimit = (limit: number) => (limit < 0 ? 'Unlimited' : formatNumber(limit));

    if (loading) {
        return (
            <div className={`bg-slate-900/50 border border-slate-800 rounded-xl p-6 ${className}`}>
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-slate-700 rounded"></div>
                    <div className="h-4 bg-slate-700 rounded"></div>
                    <div className="space-y-2">
                        <div className="h-8 bg-slate-700 rounded"></div>
                        <div className="h-8 bg-slate-700 rounded"></div>
                        <div className="h-8 bg-slate-700 rounded"></div>
                        <div className="h-8 bg-slate-700 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-slate-900/50 border border-slate-800 rounded-xl p-6 ${className}`}>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-teal-400" />
                        Daily Usage Limits
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">
                        {summary
                            ? `${summary.plan.toUpperCase()} plan · resets daily at midnight UTC`
                            : 'Track your daily usage across different resources'}
                    </p>
                </div>
                <button
                    onClick={() => void loadQuotaData()}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    title="Refresh"
                    type="button"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {(Object.keys(CARD_META) as QuotaCardKey[]).map((key) => {
                    const metric = summary?.metrics[key];
                    const usage = metric?.current ?? 0;
                    const limit = metric?.limit ?? 0;
                    const remaining = metric?.remaining ?? 0;
                    const meta = CARD_META[key];
                    const Icon = meta.icon;

                    return (
                        <div key={key} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Icon className={`w-4 h-4 ${meta.color}`} />
                                    <span className="text-white font-medium">{meta.label}</span>
                                </div>
                                <span className="text-slate-400 text-sm">
                                    {formatNumber(usage)} / {formatLimit(limit)}
                                </span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full transition-all ${getProgressColor(usage, limit)}`}
                                    style={{ width: `${getProgressPercentage(usage, limit)}%` }}
                                />
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                                {limit < 0 ? 'No daily cap on this resource' : `${formatNumber(Math.max(0, remaining))} remaining`}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="space-y-2">
                {(Object.keys(CARD_META) as QuotaCardKey[]).map((key) => {
                    const metric = summary?.metrics[key];
                    if (!metric || metric.limit < 0) return null;
                    if (metric.current < metric.limit * 0.9) return null;
                    return (
                        <div
                            key={`warn-${key}`}
                            className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
                        >
                            <AlertTriangle className="w-4 h-4 text-yellow-400" />
                            <span className="text-yellow-400 text-sm">
                                You are approaching your daily {CARD_META[key].label.toLowerCase()} limit.
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default QuotaManager;
