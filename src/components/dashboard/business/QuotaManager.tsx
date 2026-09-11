'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, FileText, Users, DollarSign, RefreshCw, Settings, BarChart3, X } from 'lucide-react';
import { quotaService, QuotaUsage, QuotaLimits } from '../../../services/quotaService';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenant } from '../../../contexts/TenantContext';
import { Button } from '../../ui/UIComponents';
import toast from 'react-hot-toast';

interface QuotaManagerProps {
    className?: string;
}

const QuotaManager: React.FC<QuotaManagerProps> = ({ className }) => {
    const { user } = useAuth();
    const { currentTenant } = useTenant();
    const [quotaUsage, setQuotaUsage] = useState<QuotaUsage | null>(null);
    const [quotaLimits, setQuotaLimits] = useState<QuotaLimits>({
        leadsPerDay: 40,
        contractsPerDay: 4,
        invoicesPerDay: 30,
        receiptsPerDay: 30
    });
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [editingLimits, setEditingLimits] = useState<QuotaLimits>(quotaLimits);

    useEffect(() => {
        loadQuotaData();
    }, [user?.id]);

    const loadQuotaData = async () => {
        if (!user?.id) return;

        try {
            setLoading(true);
            const [usage, limits] = await Promise.all([
                quotaService.getQuotaUsage(user.id),
                // Load tenant limits if available
                currentTenant?.quota_limits ? Promise.resolve(currentTenant.quota_limits) : Promise.resolve(quotaLimits)
            ]);

            setQuotaUsage(usage);
            setQuotaLimits(limits);
            setEditingLimits(limits);
        } catch (error) {
            console.error('Error loading quota data:', error);
            toast.error('Failed to load quota information');
        } finally {
            setLoading(false);
        }
    };

    const handleResetQuota = async () => {
        if (!user?.id) return;

        try {
            const { success, error } = await quotaService.resetQuotaUsage(user.id);
            if (success) {
                toast.success('Quota usage reset successfully');
                loadQuotaData();
            } else {
                toast.error(error || 'Failed to reset quota');
            }
        } catch (error) {
            console.error('Error resetting quota:', error);
            toast.error('Failed to reset quota usage');
        }
    };

    const handleSaveLimits = async () => {
        if (!user?.id || !currentTenant?.id) return;

        try {
            const { success, error } = await quotaService.updateQuotaLimits(editingLimits);
            if (success) {
                toast.success('Quota limits updated successfully');
                setQuotaLimits(editingLimits);
                setShowSettings(false);
            } else {
                toast.error(error || 'Failed to update quota limits');
            }
        } catch (error) {
            console.error('Error updating quota limits:', error);
            toast.error('Failed to update quota limits');
        }
    };

    const getProgressColor = (usage: number, limit: number) => {
        const percentage = (usage / limit) * 100;
        if (percentage >= 90) return 'bg-red-500';
        if (percentage >= 70) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getProgressPercentage = (usage: number, limit: number) => {
        return Math.min(100, (usage / limit) * 100);
    };

    const formatNumber = (num: number) => {
        return num.toLocaleString();
    };

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
                        Track your daily usage across different resources
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={loadQuotaData}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Settings"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Quota Usage Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Leads Quota */}
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-400" />
                            <span className="text-white font-medium">Leads</span>
                        </div>
                        <span className="text-slate-400 text-sm">
                            {formatNumber(quotaUsage?.leads || 0)} / {formatNumber(quotaLimits.leadsPerDay)}
                        </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                            className={`h-2 rounded-full transition-all ${getProgressColor(quotaUsage?.leads || 0, quotaLimits.leadsPerDay)}`}
                            style={{ width: `${getProgressPercentage(quotaUsage?.leads || 0, quotaLimits.leadsPerDay)}%` }}
                        ></div>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                        {formatNumber(Math.max(0, quotaLimits.leadsPerDay - (quotaUsage?.leads || 0)))} remaining
                    </div>
                </div>

                {/* Contracts Quota */}
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-green-400" />
                            <span className="text-white font-medium">Contracts</span>
                        </div>
                        <span className="text-slate-400 text-sm">
                            {formatNumber(quotaUsage?.contracts || 0)} / {formatNumber(quotaLimits.contractsPerDay)}
                        </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                            className={`h-2 rounded-full transition-all ${getProgressColor(quotaUsage?.contracts || 0, quotaLimits.contractsPerDay)}`}
                            style={{ width: `${getProgressPercentage(quotaUsage?.contracts || 0, quotaLimits.contractsPerDay)}%` }}
                        ></div>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                        {formatNumber(Math.max(0, quotaLimits.contractsPerDay - (quotaUsage?.contracts || 0)))} remaining
                    </div>
                </div>

                {/* Invoices Quota */}
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-yellow-400" />
                            <span className="text-white font-medium">Invoices</span>
                        </div>
                        <span className="text-slate-400 text-sm">
                            {formatNumber(quotaUsage?.invoices || 0)} / {formatNumber(quotaLimits.invoicesPerDay)}
                        </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                            className={`h-2 rounded-full transition-all ${getProgressColor(quotaUsage?.invoices || 0, quotaLimits.invoicesPerDay)}`}
                            style={{ width: `${getProgressPercentage(quotaUsage?.invoices || 0, quotaLimits.invoicesPerDay)}%` }}
                        ></div>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                        {formatNumber(Math.max(0, quotaLimits.invoicesPerDay - (quotaUsage?.invoices || 0)))} remaining
                    </div>
                </div>

                {/* Receipts Quota */}
                <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-purple-400" />
                            <span className="text-white font-medium">Receipts</span>
                        </div>
                        <span className="text-slate-400 text-sm">
                            {formatNumber(quotaUsage?.receipts || 0)} / {formatNumber(quotaLimits.receiptsPerDay)}
                        </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                            className={`h-2 rounded-full transition-all ${getProgressColor(quotaUsage?.receipts || 0, quotaLimits.receiptsPerDay)}`}
                            style={{ width: `${getProgressPercentage(quotaUsage?.receipts || 0, quotaLimits.receiptsPerDay)}%` }}
                        ></div>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                        {formatNumber(Math.max(0, quotaLimits.receiptsPerDay - (quotaUsage?.receipts || 0)))} remaining
                    </div>
                </div>
            </div>

            {/* Warning Messages */}
            <div className="space-y-2 mb-4">
                {quotaUsage && (
                    <>
                        {(quotaUsage.leads >= quotaLimits.leadsPerDay * 0.9) && (
                            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <AlertTriangle className="w-4 h-4 text-red-400" />
                                <span className="text-red-400 text-sm">You're approaching your daily leads limit!</span>
                            </div>
                        )}
                        {(quotaUsage.contracts >= quotaLimits.contractsPerDay * 0.9) && (
                            <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                                <span className="text-yellow-400 text-sm">You're approaching your daily contracts limit!</span>
                            </div>
                        )}
                        {(quotaUsage.invoices >= quotaLimits.invoicesPerDay * 0.9) && (
                            <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                                <span className="text-yellow-400 text-sm">You're approaching your daily invoices limit!</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
                <button
                    onClick={handleResetQuota}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    Reset Today's Usage
                </button>

                <div className="text-slate-400 text-sm flex items-center">
                    Limits reset daily at midnight UTC
                </div>
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">Quota Limits Settings</h3>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Daily Leads Limit
                                </label>
                                <input
                                    type="number"
                                    value={editingLimits.leadsPerDay}
                                    onChange={(e) => setEditingLimits(prev => ({ ...prev, leadsPerDay: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    min="1"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Daily Contracts Limit
                                </label>
                                <input
                                    type="number"
                                    value={editingLimits.contractsPerDay}
                                    onChange={(e) => setEditingLimits(prev => ({ ...prev, contractsPerDay: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    min="1"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Daily Invoices Limit
                                </label>
                                <input
                                    type="number"
                                    value={editingLimits.invoicesPerDay}
                                    onChange={(e) => setEditingLimits(prev => ({ ...prev, invoicesPerDay: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    min="1"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Daily Receipts Limit
                                </label>
                                <input
                                    type="number"
                                    value={editingLimits.receiptsPerDay}
                                    onChange={(e) => setEditingLimits(prev => ({ ...prev, receiptsPerDay: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    min="1"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowSettings(false)}
                                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveLimits}
                                className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuotaManager;