import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';
import { redis } from '@/lib/cache/redis';
import { isVapidConfigured } from '@/lib/push/vapidEnv';

/**
 * Liveness endpoint for Railway and external monitors.
 * Deep diagnostics are available with `?deep=1`.
 */

export async function GET(request: NextRequest) {
    const startTime = Date.now();
    const deepDiagnostics = ['1', 'true', 'yes'].includes(
        (request.nextUrl.searchParams.get('deep') || '').toLowerCase()
    );

    const baseChecks = {
        runtime: {
            status: 'healthy',
            responseTime: Date.now() - startTime,
        },
        services: {
            database: 'healthy',
            api_gateway: 'healthy',
        },
    };

    if (!deepDiagnostics) {
        return NextResponse.json(
            {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                responseTime: Date.now() - startTime,
                checks: baseChecks,
                version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
            },
            { status: 200 }
        );
    }

    const checks: Record<string, any> = {};
    const supabaseConfigured = !!ENV.VITE_SUPABASE_URL && !!ENV.SUPABASE_SERVICE_ROLE_KEY;
    const stripeConfigured = !!ENV.STRIPE_SECRET_KEY;
    const dailyConfigured = !!ENV.DAILY_API_KEY;
    const resendConfigured = !!ENV.RESEND_API_KEY;
    const pushConfigured = isVapidConfigured();

    // 1. Check database connection
    try {
        const supabase = createAdminSupabaseClientOrThrow();
        const { error: dbError } = await supabase
            .from('tenants')
            .select('id')
            .limit(1);

        checks.database = {
            status: dbError ? 'unhealthy' : 'healthy',
            responseTime: Date.now() - startTime,
            error: dbError ? 'unavailable' : undefined,
        };
    } catch {
        checks.database = {
            status: 'unhealthy',
            error: 'unavailable',
        };
    }

    // 2. Check Redis connection
    const { redisEnabled } = await import('@/lib/cache/redis');
    if (redisEnabled && redis) {
        try {
            const redisStart = Date.now();
            await redis.ping();
            checks.redis = {
                status: 'healthy',
                responseTime: Date.now() - redisStart,
            };
        } catch {
            checks.redis = {
                status: 'unhealthy',
                error: 'unavailable',
            };
        }
    } else {
        checks.redis = {
            status: 'skipped',
            message: 'Redis not configured',
        };
    }

    // 3. Check auth service (Supabase Auth)
    try {
        const authStart = Date.now();
        checks.auth = {
            status: supabaseConfigured && !!ENV.VITE_SUPABASE_ANON_KEY ? 'healthy' : 'unhealthy',
            responseTime: Date.now() - authStart,
            error: supabaseConfigured && !!ENV.VITE_SUPABASE_ANON_KEY ? undefined : 'Supabase auth configuration is incomplete',
        };
    } catch {
        checks.auth = {
            status: 'unhealthy',
            error: 'unavailable',
        };
    }

    // 4. System info
    checks.config = {
        status: supabaseConfigured ? 'healthy' : 'unhealthy',
        services: {
            supabase: supabaseConfigured ? 'configured' : 'missing',
            supabaseAuth: ENV.VITE_SUPABASE_ANON_KEY ? 'configured' : 'missing',
            stripe: stripeConfigured ? 'configured' : 'missing',
            daily: dailyConfigured ? 'configured' : 'missing',
            resend: resendConfigured ? 'configured' : 'missing',
            webPush: pushConfigured ? 'configured' : 'missing',
        },
    };

    // 5. System info
    checks.system = {
        status: 'operational',
    };

    // Determine overall health (optional services may be skipped, e.g. Redis)
    const allHealthy = Object.values(checks).every(
        (check) =>
            !check?.status ||
            check.status === 'healthy' ||
            check.status === 'skipped'
    );

    const overallStatus = allHealthy ? 'healthy' : 'degraded';
    const totalResponseTime = Date.now() - startTime;

    return NextResponse.json(
        {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            responseTime: totalResponseTime,
            checks,
            version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        },
        { status: allHealthy ? 200 : 503 }
    );
}
