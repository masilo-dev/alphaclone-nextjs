'use client';

import React, { useState, useEffect } from 'react';
import {
    X, Eye, MousePointerClick, Mail, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { campaignService, Campaign, CampaignRecipient } from '@/services/campaignService';
import { StandardStatCard, StandardStatusBadge, resolveStatusVariant, type CardTheme } from '@/components/ui/design-system';

interface CampaignAnalyticsProps {
    campaign: Campaign;
    onClose: () => void;
}

const CampaignAnalytics: React.FC<CampaignAnalyticsProps> = ({ campaign, onClose }) => {
    const [analytics, setAnalytics] = useState<any>(null);
    const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const [aRes, rRes] = await Promise.all([
                campaignService.getAnalytics(campaign.id),
                campaignService.getRecipients(campaign.id),
            ]);
            if (aRes.analytics) setAnalytics(aRes.analytics);
            if (!rRes.error) setRecipients(rRes.recipients);
            setLoading(false);
        };
        load();
    }, [campaign.id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
            </div>
        );
    }

    const statusCounts = {
        sent: recipients.filter(r => r.status !== 'pending').length,
        delivered: recipients.filter(r => ['delivered', 'opened', 'clicked'].includes(r.status)).length,
        opened: recipients.filter(r => ['opened', 'clicked'].includes(r.status)).length,
        clicked: recipients.filter(r => r.status === 'clicked').length,
        bounced: recipients.filter(r => r.status === 'bounced').length,
        failed: recipients.filter(r => r.status === 'failed').length,
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">{campaign.name}</h2>
                    <p className="text-sm text-slate-400">Subject: {campaign.subject}</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-slate-400">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total Sent', value: analytics?.sent || 0, theme: 'blue' as CardTheme, icon: Mail },
                    { label: 'Delivered', value: analytics?.delivered || 0, theme: 'emerald' as CardTheme, icon: CheckCircle2 },
                    { label: 'Opened', value: analytics?.opened || 0, theme: 'purple' as CardTheme, icon: Eye },
                    { label: 'Clicked', value: analytics?.clicked || 0, theme: 'amber' as CardTheme, icon: MousePointerClick },
                ].map(s => (
                    <StandardStatCard
                        key={s.label}
                        label={s.label}
                        value={s.value.toLocaleString()}
                        themeColor={s.theme}
                        icon={s.icon}
                        interactive={false}
                    />
                ))}
            </div>

            {/* Rates */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Open Rate', value: `${analytics?.openRate || 0}%`, theme: 'purple' as CardTheme },
                    { label: 'Click Rate', value: `${analytics?.clickRate || 0}%`, theme: 'amber' as CardTheme },
                    { label: 'Delivery Rate', value: `${analytics?.deliveryRate || 0}%`, theme: 'emerald' as CardTheme },
                ].map(s => (
                    <StandardStatCard
                        key={s.label}
                        label={s.label}
                        value={s.value}
                        themeColor={s.theme}
                        interactive={false}
                    />
                ))}
            </div>

            {/* Issues */}
            {(statusCounts.bounced > 0 || statusCounts.failed > 0) && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span className="text-sm font-bold text-red-400">Delivery Issues</span>
                    </div>
                    <div className="flex gap-4 text-sm">
                        {statusCounts.bounced > 0 && (
                            <span className="text-red-300">{statusCounts.bounced} bounced</span>
                        )}
                        {statusCounts.failed > 0 && (
                            <span className="text-red-300">{statusCounts.failed} failed</span>
                        )}
                    </div>
                </div>
            )}

            {/* Recipient List */}
            <div>
                <h3 className="text-sm font-bold text-white mb-3">Recipients ({recipients.length})</h3>
                <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden">
                    <div className="divide-y divide-white/5 max-h-60 overflow-y-auto">
                        {recipients.map(r => (
                            <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                <div>
                                    <span className="text-white">{r.email}</span>
                                    {r.name && <span className="text-slate-500 ml-2">({r.name})</span>}
                                </div>
                                <StandardStatusBadge variant={resolveStatusVariant(r.status)}>{r.status}</StandardStatusBadge>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CampaignAnalytics;
