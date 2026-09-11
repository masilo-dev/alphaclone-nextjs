'use client';

import React from 'react';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { PlanLimits, formatLimit } from '@/lib/planLimits';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/UIComponents';
import { useRouter } from 'next/navigation';

// All features are available on all plans.
// This component shows a quota warning when a user is near or over their plan limit.
interface QuotaGateProps {
    resource: keyof PlanLimits;
    currentUsage: number;
    label?: string;
    children: React.ReactNode;
}

export const QuotaGate: React.FC<QuotaGateProps> = ({ resource, currentUsage, label, children }) => {
    const { plan, limits } = usePlanLimits();
    const router = useRouter();

    const limit = limits[resource] as number;
    const isUnlimited = limit === -1;
    const isOver = !isUnlimited && currentUsage >= limit;
    const isNear = !isUnlimited && !isOver && currentUsage >= limit * 0.8;

    if (isOver) {
        return (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
                <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-white font-semibold mb-1">
                    {label || String(resource)} limit reached
                </p>
                <p className="text-slate-400 text-sm mb-4">
                    Your {plan} plan includes {formatLimit(limit)}. Upgrade to increase your limit.
                </p>
                <Button
                    onClick={() => router.push('/dashboard/settings?tab=billing')}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-sm px-4 py-2"
                >
                    Upgrade Plan
                </Button>
            </div>
        );
    }

    return (
        <>
            {isNear && (
                <div className="mb-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                        {currentUsage} / {formatLimit(limit)} {label || String(resource)} used.{' '}
                        <button
                            onClick={() => router.push('/dashboard/settings?tab=billing')}
                            className="underline hover:text-amber-300"
                        >
                            Upgrade for more.
                        </button>
                    </span>
                </div>
            )}
            {children}
        </>
    );
};

// Keep FeatureGate as an alias for backward compatibility — all features are available
export const FeatureGate: React.FC<{ feature: keyof PlanLimits; children: React.ReactNode; fallback?: React.ReactNode }> = ({ children }) => {
    return <>{children}</>;
};
