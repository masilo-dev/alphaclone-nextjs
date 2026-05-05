'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Gauge, Sparkles } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { UsageDashboard } from '@/components/UsageDashboard';

export default function PlanActivationPanel() {
    const router = useRouter();
    const { currentTenant } = useTenant();

    const trialInfo = (() => {
        if (!currentTenant?.trial_ends_at || currentTenant.subscription_status !== 'trial') {
            return null;
        }

        const trialEnd = new Date(currentTenant.trial_ends_at);
        const now = new Date();
        const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return {
            daysLeft,
            expired: daysLeft <= 0,
        };
    })();

    if (!currentTenant) {
        return null;
    }

    const planName = (currentTenant.subscription_plan || 'starter').toUpperCase();
    const statusName = currentTenant.subscription_status || 'active';

    return (
        <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/80 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">
                        <Sparkles className="h-3.5 w-3.5" />
                        Plan Visibility
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Your plan, status, and usage are now visible here</h3>
                        <p className="mt-1 max-w-3xl text-sm text-slate-400">
                            All plans include the same product surface. The difference is quota scale, team size, storage, and support level.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => router.push('/dashboard/business/settings')}
                        className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-teal-400"
                    >
                        <CreditCard className="h-4 w-4" />
                        Manage Billing
                    </button>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Current Plan</div>
                    <div className="text-lg font-bold text-white">{planName}</div>
                    <div className="mt-1 text-sm text-slate-400">Quotas and support scale with your plan.</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Subscription Status</div>
                    <div className="text-lg font-bold capitalize text-white">{statusName}</div>
                    <div className="mt-1 text-sm text-slate-400">
                        {trialInfo
                            ? trialInfo.expired
                                ? 'Your trial has expired and billing needs attention.'
                                : `${trialInfo.daysLeft} day${trialInfo.daysLeft === 1 ? '' : 's'} left in trial.`
                            : 'Your workspace is currently usable under this subscription state.'}
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        <Gauge className="h-3.5 w-3.5" />
                        What Counts
                    </div>
                    <div className="text-sm text-slate-300">
                        AI usage, projects, storage, users, contracts, and API volume are quota-aware.
                    </div>
                </div>
            </div>

            <UsageDashboard tenantId={currentTenant.id} />
        </section>
    );
}
