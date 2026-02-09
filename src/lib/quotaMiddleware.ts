import { NextRequest, NextResponse } from 'next/server';
import { quotaEnforcementService, MetricName } from '../services/quotaEnforcementService';

/**
 * Quota Enforcement Middleware
 * Add to API routes to enforce subscription tier limits
 */

export interface QuotaConfig {
    metric: MetricName;
    action: string; // Descriptive name for logging
}

/**
 * Middleware to check quota before allowing API action
 */
export async function enforceQuota(
    request: NextRequest,
    tenantId: string,
    config: QuotaConfig
): Promise<NextResponse | null> {
    try {
        // Check if tenant can perform this action
        const { allowed, reason, currentUsage, limit } = await quotaEnforcementService.canPerformAction(
            tenantId,
            config.metric
        );

        if (!allowed) {
            // Return 429 Too Many Requests with quota information
            return NextResponse.json(
                {
                    error: 'Quota Exceeded',
                    message: reason || `You've reached your ${config.metric} limit.`,
                    quota: {
                        metric: config.metric,
                        current: currentUsage,
                        limit: limit,
                        exceeded: true,
                    },
                    upgrade_url: '/settings/billing',
                },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': limit?.toString() || '0',
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': getNextMonthTimestamp().toString(),
                        'Retry-After': getSecondsUntilNextMonth().toString(),
                    },
                }
            );
        }

        // Quota check passed
        return null; // Allow request to proceed
    } catch (error) {
        console.error('Quota middleware error:', error);
        // Fail open - allow request if quota check fails
        return null;
    }
}

/**
 * Helper: Get timestamp of next month
 */
function getNextMonthTimestamp(): number {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return Math.floor(nextMonth.getTime() / 1000);
}

/**
 * Helper: Get seconds until next month
 */
function getSecondsUntilNextMonth(): number {
    const now = Math.floor(Date.now() / 1000);
    const nextMonth = getNextMonthTimestamp();
    return nextMonth - now;
}

/**
 * Example usage in API route:
 *
 * export async function POST(request: Request) {
 *     const tenantId = await getTenantId();
 *
 *     // Check quota
 *     const quotaResponse = await enforceQuota(request, tenantId, {
 *         metric: 'projects',
 *         action: 'create_project'
 *     });
 *
 *     if (quotaResponse) {
 *         return quotaResponse; // Quota exceeded
 *     }
 *
 *     // Proceed with creating project...
 *     const project = await createProject(data);
 *
 *     // Track usage
 *     await quotaEnforcementService.trackProjectCreation(
 *         tenantId,
 *         userId,
 *         project.id
 *     );
 *
 *     return NextResponse.json(project);
 * }
 */

/**
 * Quota check decorator for service functions
 */
export function withQuotaCheck<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    metric: MetricName
): T {
    return (async (...args: any[]) => {
        const tenantId = args[0]; // Assume first arg is always tenantId

        const { allowed, reason } = await quotaEnforcementService.canPerformAction(tenantId, metric);

        if (!allowed) {
            throw new Error(reason || `Quota exceeded for ${metric}`);
        }

        return fn(...args);
    }) as T;
}
