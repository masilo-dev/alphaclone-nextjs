'use client';

import React from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import PlanAndUsageView from '@/components/dashboard/PlanAndUsageView';

export default function BillingPage() {
  const { currentTenant, isLoading: tenantLoading } = useTenant();
  const { user, loading: authLoading } = useAuth();

  if (tenantLoading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentTenant || !user) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold text-slate-200">Session or Workspace missing</h1>
        <p className="mt-2 text-slate-400">Please sign in to view your billing and usage details.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Billing & Usage Management</h1>
          <p className="mt-2 text-slate-400">
            Monitor real-time daily quota usage, view plan capabilities, and manage subscription settings for workspace{' '}
            <span className="text-teal-400 font-semibold">{currentTenant.name}</span>.
          </p>
        </div>

        <PlanAndUsageView
          tenantId={currentTenant.id}
          userId={user.id}
          currentPlan={currentTenant.subscription_plan || 'free'}
          subscriptionStatus={currentTenant.subscription_status || 'free'}
          currentPeriodEnd={(currentTenant as any).current_period_end}
          cancelAtPeriodEnd={(currentTenant as any).cancel_at_period_end}
        />
      </div>
    </div>
  );
}
