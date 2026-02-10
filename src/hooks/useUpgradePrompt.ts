import { useState, useEffect } from 'react';
import { quotaEnforcementService } from '../services/quotaEnforcementService';
import { subscriptionService } from '../services/subscriptionService';
import { useTenant } from '../contexts/TenantContext';

/**
 * Hook to automatically show upgrade prompts when quotas are exceeded
 */
export function useUpgradePrompt(metric: string) {
    const { currentTenant: tenant } = useTenant();
    const [showPrompt, setShowPrompt] = useState(false);
    const [currentTier, setCurrentTier] = useState('free');
    const [suggestedTier, setSuggestedTier] = useState('starter');
    const [usagePercent, setUsagePercent] = useState(0);

    useEffect(() => {
        if (!tenant) return;

        checkQuota();
    }, [tenant, metric]);

    async function checkQuota() {
        if (!tenant) return;

        // Check if tenant can perform action
        const { allowed, currentUsage, limit } = await quotaEnforcementService.canPerformAction(
            tenant.id,
            metric as any
        );

        if (!allowed && currentUsage !== undefined && limit !== undefined) {
            // Quota exceeded - show upgrade prompt
            const percent = (currentUsage / limit) * 100;
            setUsagePercent(percent);

            // Get current tier from tenant
            const tier = tenant.subscription_plan || 'free';
            setCurrentTier(tier);

            // Get recommended tier
            const recommended = subscriptionService.getRecommendedTier(tier, percent);
            if (recommended) {
                setSuggestedTier(recommended);
                setShowPrompt(true);
            }
        }
    }

    function hidePrompt() {
        setShowPrompt(false);
    }

    return {
        showPrompt,
        currentTier,
        suggestedTier,
        usagePercent,
        hidePrompt,
    };
}

/**
 * Hook to check if feature is available for current tier
 */
export function useFeatureAvailable(feature: string) {
    const { currentTenant: tenant } = useTenant();
    const [isAvailable, setIsAvailable] = useState(true);
    const [requiresTier, setRequiresTier] = useState<string | null>(null);

    useEffect(() => {
        checkFeatureAvailability();
    }, [tenant, feature]);

    function checkFeatureAvailability() {
        if (!tenant) {
            setIsAvailable(false);
            return;
        }

        const currentTier = tenant.subscription_plan || 'free';

        // Define feature availability by tier
        const featureRequirements: Record<string, string> = {
            'white_label': 'enterprise',
            'custom_domain': 'enterprise',
            'sso': 'enterprise',
            'api_access': 'pro',
            'advanced_analytics': 'pro',
            'priority_support': 'pro',
            'ai_features': 'starter',
            'video_calls': 'starter',
        };

        const requiredTier = featureRequirements[feature];

        if (!requiredTier) {
            setIsAvailable(true);
            return;
        }

        const tierOrder = ['free', 'starter', 'pro', 'enterprise'];
        const currentIndex = tierOrder.indexOf(currentTier);
        const requiredIndex = tierOrder.indexOf(requiredTier);

        setIsAvailable(currentIndex >= requiredIndex);
        setRequiresTier(requiredTier);
    }

    return {
        isAvailable,
        requiresTier,
    };
}

/**
 * Hook to track usage and show warning when approaching limit
 */
export function useQuotaWarning(metric: string, warningThreshold: number = 80) {
    const { currentTenant: tenant } = useTenant();
    const [showWarning, setShowWarning] = useState(false);
    const [usagePercent, setUsagePercent] = useState(0);
    const [currentUsage, setCurrentUsage] = useState(0);
    const [limit, setLimit] = useState(0);

    useEffect(() => {
        if (!tenant) return;

        loadUsage();
    }, [tenant, metric]);

    async function loadUsage() {
        if (!tenant) return;

        const usage = await quotaEnforcementService.getUsageSummary(tenant.id);
        const metricUsage = usage.find(u => u.metric_name === metric);

        if (metricUsage) {
            setUsagePercent(metricUsage.percentage_used);
            setCurrentUsage(metricUsage.current_value);
            setLimit(metricUsage.limit_value);
            setShowWarning(metricUsage.percentage_used >= warningThreshold);
        }
    }

    return {
        showWarning,
        usagePercent,
        currentUsage,
        limit,
    };
}
