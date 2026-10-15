'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTenant } from '../contexts/TenantContext';
import { AlertCircle, CreditCard, Clock, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from './ui/UIComponents';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

import { getTrialEntitlement } from '@/lib/billing/trialEntitlement';

interface SubscriptionGuardProps {
    children: React.ReactNode;
}

export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ children }) => {
    const { currentTenant, isLoading } = useTenant();
    const { user } = useAuth();
    const router = useRouter();
    const entitlement = getTrialEntitlement(currentTenant);
    const status = currentTenant?.subscription_status;

    // Inactive states that should block the dashboard
    const isInactive = status === 'suspended' || status === 'cancelled' || entitlement.isExpired;

    // Soft warning logic (for edge cases client-side)
    React.useEffect(() => {
        if (!isLoading && currentTenant && isInactive) {
            toast.error(entitlement.isExpired ? entitlement.description : 'Your subscription is inactive.', {
                id: 'subscription-warning',
                duration: 5000,
            });
        }
    }, [isInactive, entitlement.isExpired, entitlement.description, isLoading, currentTenant]);

    return <>{children}</>;
};
