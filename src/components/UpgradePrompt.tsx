'use client';

import { useState, useEffect } from 'react';
import { X, Zap, Check, TrendingUp } from 'lucide-react';
import { subscriptionService, TIER_PRICING } from '../services/subscriptionService';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';

export interface UpgradePromptProps {
    currentTier: string;
    suggestedTier: string;
    triggerFeature: string;
    promptType?: 'modal' | 'banner' | 'tooltip' | 'in_context';
    onClose?: () => void;
    onUpgrade?: () => void;
}

const TIER_FEATURES = {
    starter: [
        '10 users',
        '25 projects',
        '5GB storage',
        'Email support',
        'Basic analytics',
    ],
    pro: [
        '50 users',
        '100 projects',
        '25GB storage',
        'Priority support',
        'Advanced analytics',
        'AI features',
        'White-label',
    ],
    enterprise: [
        'Unlimited users',
        'Unlimited projects',
        'Unlimited storage',
        '24/7 phone support',
        'Custom integrations',
        'Dedicated account manager',
        'SLA guarantee',
    ],
};

const FEATURE_MESSAGES = {
    users: 'You\'ve reached your user limit',
    projects: 'You\'ve hit your project limit',
    storage: 'Storage limit reached',
    ai_requests: 'AI request quota exhausted',
    contracts: 'Contract limit reached',
    video_minutes: 'Video minutes depleted',
};

export function UpgradePrompt({
    currentTier,
    suggestedTier,
    triggerFeature,
    promptType = 'modal',
    onClose,
    onUpgrade,
}: UpgradePromptProps) {
    const { user } = useAuth();
    const { currentTenant: tenant } = useTenant();
    const [promptId, setPromptId] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(true);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

    useEffect(() => {
        // Track that prompt was shown
        if (user && tenant) {
            trackPromptShown();
        }
    }, []);

    async function trackPromptShown() {
        const result = await subscriptionService.trackUpgradePrompt(
            tenant!.id,
            user!.id,
            {
                promptType: promptType === 'tooltip' ? 'tooltip' : promptType === 'banner' ? 'banner' : 'modal',
                triggerFeature,
                currentTier,
                suggestedTier,
                promptLocation: window.location.pathname,
            }
        );

        if (result.success && result.promptId) {
            setPromptId(result.promptId);
        }
    }

    async function handleUpgradeClick() {
        if (promptId) {
            await subscriptionService.recordPromptClick(promptId);
        }

        if (onUpgrade) {
            onUpgrade();
        } else {
            // Redirect to upgrade page
            window.location.href = `/settings/billing?upgrade=${suggestedTier}&cycle=${billingCycle}`;
        }
    }

    function handleClose() {
        setIsVisible(false);
        if (onClose) {
            onClose();
        }
    }

    if (!isVisible) return null;

    const pricing = subscriptionService.getPricing(suggestedTier, billingCycle);
    const savings = subscriptionService.calculateAnnualSavings(suggestedTier);
    const features = TIER_FEATURES[suggestedTier as keyof typeof TIER_FEATURES] || [];
    const message = FEATURE_MESSAGES[triggerFeature as keyof typeof FEATURE_MESSAGES] || 'Upgrade to unlock more';

    // Banner style
    if (promptType === 'banner') {
        return (
            <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    <div className="flex items-center justify-between flex-wrap">
                        <div className="flex items-center flex-1">
                            <Zap className="h-5 w-5 mr-2" />
                            <p className="font-medium">
                                {message} • <span className="font-bold">Upgrade to {suggestedTier}</span> and get 20% off annual plans!
                            </p>
                        </div>
                        <div className="flex items-center space-x-3 mt-2 sm:mt-0">
                            <button
                                onClick={handleUpgradeClick}
                                className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                            >
                                Upgrade Now
                            </button>
                            <button
                                onClick={handleClose}
                                className="text-white hover:text-gray-200 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Tooltip style
    if (promptType === 'tooltip') {
        return (
            <div className="absolute z-50 w-72 bg-white rounded-lg shadow-xl border border-gray-200 p-4">
                <button
                    onClick={handleClose}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                >
                    <X className="h-4 w-4" />
                </button>
                <div className="mb-3">
                    <div className="flex items-center text-yellow-600 mb-2">
                        <TrendingUp className="h-5 w-5 mr-2" />
                        <span className="font-semibold">{message}</span>
                    </div>
                    <p className="text-sm text-gray-600">
                        Upgrade to <strong>{suggestedTier}</strong> for more capacity and features.
                    </p>
                </div>
                <button
                    onClick={handleUpgradeClick}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                    See Plans
                </button>
            </div>
        );
    }

    // Modal style (default)
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-xl">
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                    <div className="flex items-center mb-2">
                        <Zap className="h-8 w-8 mr-3" />
                        <h2 className="text-2xl font-bold">Unlock More Power</h2>
                    </div>
                    <p className="text-blue-100">{message}. Upgrade to keep growing!</p>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Billing Cycle Toggle */}
                    <div className="flex items-center justify-center mb-6 bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setBillingCycle('monthly')}
                            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                                billingCycle === 'monthly'
                                    ? 'bg-white text-blue-600 shadow'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setBillingCycle('annual')}
                            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                                billingCycle === 'annual'
                                    ? 'bg-white text-blue-600 shadow'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            Annual
                            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                Save {savings.savingsPercent}%
                            </span>
                        </button>
                    </div>

                    {/* Pricing */}
                    <div className="text-center mb-6">
                        <div className="text-5xl font-bold text-gray-900 mb-2">
                            {subscriptionService.formatPrice(
                                billingCycle === 'monthly' ? pricing.finalPriceCents : pricing.finalPriceCents / 12
                            )}
                            <span className="text-xl text-gray-500 font-normal">/mo</span>
                        </div>
                        {billingCycle === 'annual' && (
                            <div className="text-sm text-gray-600">
                                Billed annually • Save {subscriptionService.formatPrice(savings.savingsCents)}
                            </div>
                        )}
                    </div>

                    {/* Features */}
                    <div className="mb-6">
                        <h3 className="font-semibold text-gray-900 mb-3">What's included:</h3>
                        <ul className="space-y-2">
                            {features.map((feature, index) => (
                                <li key={index} className="flex items-start">
                                    <Check className="h-5 w-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                                    <span className="text-gray-700">{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* CTA */}
                    <button
                        onClick={handleUpgradeClick}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105"
                    >
                        Upgrade to {suggestedTier.charAt(0).toUpperCase() + suggestedTier.slice(1)}
                    </button>

                    <p className="text-center text-sm text-gray-500 mt-4">
                        No commitment. Cancel anytime.
                    </p>
                </div>
            </div>
        </div>
    );
}
