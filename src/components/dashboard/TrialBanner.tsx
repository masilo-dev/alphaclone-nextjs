'use client';

import React from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { CreditCard, AlertCircle, Clock, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TRIAL_LIMITS } from '@/services/tenancy/types';

export const TrialBanner: React.FC = () => {
    const { currentTenant, isLoading } = useTenant();
    const router = useRouter();

    if (isLoading || !currentTenant) return null;

    const status = currentTenant.subscription_status;
    const trialEndsAt = currentTenant.trial_ends_at ? new Date(currentTenant.trial_ends_at) : null;

    if (status !== 'trial' || !trialEndsAt) return null;

    const now = new Date();
    const diffTime = trialEndsAt.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isExpired = diffTime <= 0;
    const isEndingSoon = daysLeft <= 3;

    const getBannerStyles = () => {
        if (isExpired) return 'bg-red-600/10 border-red-500/30 text-red-100';
        if (isEndingSoon) return 'bg-red-600/10 border-red-500/20 text-red-100';
        if (daysLeft <= 7) return 'bg-amber-600/10 border-amber-500/20 text-amber-100';
        return 'bg-teal-600/10 border-teal-500/20 text-teal-100';
    };

    const getIconStyles = () => {
        if (isExpired || isEndingSoon) return 'text-red-400';
        if (daysLeft <= 7) return 'text-amber-400';
        return 'text-teal-400';
    };

    const getButtonStyles = () => {
        if (isExpired || isEndingSoon) return 'bg-red-500 hover:bg-red-600';
        if (daysLeft <= 7) return 'bg-amber-500 hover:bg-amber-600';
        return 'bg-teal-600 hover:bg-teal-700';
    };

    const formattedEndDate = trialEndsAt.toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    const message = isExpired
        ? 'Your 14-day free trial has ended — choose a plan to keep full access'
        : isEndingSoon
            ? `Trial ending ${daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`} (${formattedEndDate}) — add billing when ready`
            : daysLeft <= 7
                ? `${daysLeft} days left in your free trial (ends ${formattedEndDate}) — no card required yet`
                : `${TRIAL_LIMITS.TRIAL_DAYS}-day Premium trial active · ${daysLeft} days left · full access · no daily limits`;

    return (
        <div className={`border-b px-4 py-2.5 flex items-center justify-between backdrop-blur-md sticky top-0 z-[40] transition-colors duration-500 ${getBannerStyles()}`}>
            <div className="flex items-center gap-3 text-sm font-medium min-w-0">
                {isExpired ? (
                    <AlertCircle className={`w-4 h-4 shrink-0 ${getIconStyles()}`} />
                ) : daysLeft <= 7 ? (
                    <Clock className={`w-4 h-4 shrink-0 ${getIconStyles()}`} />
                ) : (
                    <Sparkles className={`w-4 h-4 shrink-0 ${getIconStyles()}`} />
                )}
                <span className="truncate">{message}</span>
            </div>
            <button
                className={`shrink-0 text-white text-xs px-4 py-1.5 rounded-lg transition-all font-bold shadow-lg active:scale-95 flex items-center gap-1.5 ${getButtonStyles()}`}
                onClick={() => router.push('/billing/upgrade')}
            >
                <CreditCard className="w-3.5 h-3.5" />
                {isExpired ? 'Choose plan' : 'View pricing'}
            </button>
        </div>
    );
};
