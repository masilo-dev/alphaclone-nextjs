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
    const [isProcessing, setIsProcessing] = useState(false);

    if (isLoading) return <>{children}</>;


    if (!currentTenant) return <>{children}</>;

    const status = currentTenant.subscription_status;
    const trialEndsAt = currentTenant.trial_ends_at ? new Date(currentTenant.trial_ends_at) : null;
    const isTrialExpired = status === 'trial' && trialEndsAt && trialEndsAt < new Date();

    // Inactive states that should block the dashboard
    const isInactive = status === 'suspended' || status === 'cancelled' || isTrialExpired;

    if (isInactive) {
        return (
            <div className="fixed inset-0 z-[9999] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 text-center border border-slate-200 dark:border-slate-700">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        {isTrialExpired ? (
                            <Clock className="w-10 h-10 text-red-600 dark:text-red-400" />
                        ) : (
                            <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
                        )}
                    </div>

                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                        {isTrialExpired ? 'Trial Expired' : 'Subscription Inactive'}
                    </h2>

                    <p className="text-slate-600 dark:text-slate-400 mb-6">
                        {isTrialExpired
                            ? 'Your trial period has ended. Add a payment method to continue.'
                            : 'Your subscription is inactive. Update your payment details to restore access.'}
                    </p>


                    <div className="space-y-4">
                        <Button
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={async () => {
                                if (!currentTenant || !user) return;
                                setIsProcessing(true);
                                try {
                                    const response = await fetch('/api/stripe/create-checkout', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            plan: currentTenant.subscription_plan || 'starter',
                                            tenantId: currentTenant.id,
                                            userId: user.id,
                                        }),
                                    });
                                    const data = await response.json();
                                    if (data.url) {
                                        window.location.href = data.url;
                                    } else {
                                        throw new Error(data.error || 'No checkout URL returned');
                                    }
                                } catch (error) {
                                    console.error('Checkout error:', error);
                                    toast.error('Failed to start checkout. Please try again.');
                                    setIsProcessing(false);
                                }
                            }}
                            disabled={isProcessing}
                        >
                            <CreditCard className="w-5 h-5" />
                            {isProcessing ? 'Redirecting to checkout...' : 'Add Payment Method'}
                        </Button>


                        <button
                            className="text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 flex items-center justify-center gap-1 mx-auto"
                            onClick={() => window.location.reload()}
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh Status
                        </button>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
                        <p className="text-xs text-slate-400">
                            Need help? Contact our support team at support@alphacone.io
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
