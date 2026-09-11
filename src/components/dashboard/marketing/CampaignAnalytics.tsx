'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    X, Eye, MousePointerClick, Mail, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { campaignService, Campaign, CampaignRecipient } from '@/services/campaignService';
import { StandardStatusBadge, resolveStatusVariant } from '@/components/ui/design-system';
import { PlatformKpiGrid } from '@/components/dashboard/metrics';
import { platformKpiFromNumbers } from '@/lib/metrics/metricPresentation';

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

    const countKpis = useMemo(
        () => [
            platformKpiFromNumbers({ label: 'Total Sent', current: analytics?.sent || 0 }),
            platformKpiFromNumbers({ label: 'Delivered', current: analytics?.delivered || 0 }),
            platformKpiFromNumbers({ label: 'Opened', current: analytics?.opened || 0 }),
            platformKpiFromNumbers({ label: 'Clicked', current: analytics?.clicked || 0 }),
        ],
        [analytics],
    );

    const rateKpis = useMemo(
        () => [
            platformKpiFromNumbers({
                label: 'Open Rate',
                current: Number(analytics?.openRate || 0),
                isPercentage: true,
            }),
            platformKpiFromNumbers({
                label: 'Click Rate',
                current: Number(analytics?.clickRate || 0),
                isPercentage: true,
            }),
            platformKpiFromNumbers({
                label: 'Delivery Rate',
                current: Number(analytics?.deliveryRate || 0),
                isPercentage: true,
            }),
        ],
        [analytics],
    );

    const statusCounts = useMemo(
        () => ({
            sent: recipients.filter((r) => r.status !== 'pending').length,
            delivered: recipients.filter((r) => ['delivered', 'opened', 'clicked'].includes(r.status)).length,
            opened: recipients.filter((r) => ['opened', 'clicked'].includes(r.status)).length,
            clicked: recipients.filter((r) => r.status === 'clicked').length,
            bounced: recipients.filter((r) => r.status === 'bounced').length,
            failed: recipients.filter((r) => r.status === 'failed').length,
        }),
        [recipients],
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">{campaign.name}</h2>
                    <p className="text-sm text-slate-400">Subject: {campaign.subject}</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-slate-400">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <PlatformKpiGrid items={countKpis} skeletonCount={4} />

            <PlatformKpiGrid items={rateKpis} skeletonCount={3} />

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
