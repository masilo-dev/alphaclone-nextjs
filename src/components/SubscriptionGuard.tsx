'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTenant } from '../contexts/TenantContext';
import { AlertCircle, CreditCard, Clock, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from './ui/UIComponents';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

interface SubscriptionGuardProps {
    children: React.ReactNode;
}

export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ children }) => {
    const { currentTenant, isLoading } = useTenant();
    const { user } = useAuth();
    const router = useRouter();
    const status = currentTenant?.subscription_status;
    const trialEndsAt = currentTenant?.trial_ends_at ? new Date(currentTenant.trial_ends_at) : null;
    const isTrialExpired = status === 'trial' && trialEndsAt && trialEndsAt < new Date();

    // Inactive states that should block the dashboard
    const isInactive = status === 'suspended' || status === 'cancelled' || isTrialExpired;

    // Soft warning logic (for edge cases client-side)
    React.useEffect(() => {
        if (!isLoading && currentTenant && isInactive) {
            toast.error(isTrialExpired ? 'Your trial has expired. Please upgrade.' : 'Your subscription is inactive.', {
                id: 'subscription-warning',
                duration: 5000,
            });
        }
    }, [isInactive, isTrialExpired, isLoading, currentTenant]);

    return <>{children}</>;
};
