'use client';

import React from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { CreditCard, AlertCircle, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

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

    // Only show banner if <= 7 days left or expired
    if (daysLeft > 7 && !isExpired) return null;

    const getBannerStyles = () => {
        if (isExpired) return 'bg-red-600/10 border-red-500/30 text-red-100';
        if (daysLeft <= 2) return 'bg-red-600/10 border-red-500/20 text-red-100';
        if (daysLeft <= 5) return 'bg-amber-600/10 border-amber-500/20 text-amber-100';
        return 'bg-slate-800/50 border-slate-700/50 text-slate-200';
    };

    const getIconStyles = () => {
        if (isExpired || daysLeft <= 2) return 'text-red-400';
        if (daysLeft <= 5) return 'text-amber-400';
        return 'text-slate-400';
    };

    const getButtonStyles = () => {
        if (isExpired || daysLeft <= 2) return 'bg-red-500 hover:bg-red-600';
        if (daysLeft <= 5) return 'bg-amber-500 hover:bg-amber-600';
        return 'bg-teal-600 hover:bg-teal-700';
    };

    const message = isExpired 
        ? 'Trial Expired — Add payment method to restore full access'
        : daysLeft === 1 
            ? 'Trial ends tomorrow — add a payment method to keep access'
            : `Trial ends in ${daysLeft} days — no action needed yet`;

    return (
        <div className={`border-b px-4 py-2.5 flex items-center justify-between backdrop-blur-md sticky top-0 z-[40] transition-colors duration-500 ${getBannerStyles()}`}>
            <div className="flex items-center gap-3 text-sm font-medium">
                {isExpired ? (
                    <AlertCircle className={`w-4 h-4 ${getIconStyles()}`} />
                ) : (
                    <Clock className={`w-4 h-4 ${getIconStyles()}`} />
                )}
                <span>{message}</span>
            </div>
            <button
                className={`text-white text-xs px-4 py-1.5 rounded-lg transition-all font-bold shadow-lg active:scale-95 ${getButtonStyles()}`}
                onClick={() => router.push('/billing/upgrade')}
            >
                {isExpired ? 'Upgrade Now' : 'Manage Billing'}
            </button>
        </div>
    );
};
