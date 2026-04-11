import { NextResponse } from 'next/server';
import { ENV } from '@/config/env';
import { createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';
import { redis } from '@/lib/cache/redis';

/**
 * Health check endpoint for monitoring
 * Returns system health status
 */

export async function GET() {
    const startTime = Date.now();
    const checks: Record<string, any> = {};
    const supabaseConfigured = !!ENV.VITE_SUPABASE_URL && !!ENV.SUPABASE_SERVICE_ROLE_KEY;
    const stripeConfigured = !!ENV.STRIPE_SECRET_KEY;
    const dailyConfigured = !!ENV.DAILY_API_KEY;
    const resendConfigured = !!ENV.RESEND_API_KEY;
    const pushConfigured = !!ENV.VITE_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;

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
            error: dbError?.message,
        };
    } catch (error) {
        checks.database = {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
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
        } catch (error) {
            checks.redis = {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error',
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
    } catch (error) {
        checks.auth = {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
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
        uptime: process.uptime(),
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            unit: 'MB',
        },
        nodeVersion: process.version,
        platform: process.platform,
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
