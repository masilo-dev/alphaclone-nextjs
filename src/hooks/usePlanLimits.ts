import { useTenant } from '@/contexts/TenantContext';
import { getPlanLimits, canAccessFeature, isWithinLimit, PlanLimits } from '@/lib/planLimits';
import { SubscriptionPlan } from '@/services/tenancy/types';

export function usePlanLimits() {
    const { currentTenant } = useTenant();
    
    const plan: SubscriptionPlan = currentTenant?.subscription_plan || 'starter';
    const limits = getPlanLimits(plan);
    
    return {
        plan,
        limits,
        canAccessFeature: (feature: keyof PlanLimits) => canAccessFeature(plan, feature),
        isWithinLimit: (resource: 'users' | 'storage' | 'projects', currentCount: number) => 
            isWithinLimit(plan, resource, currentCount),
    };
}
