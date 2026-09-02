import { NextRequest, NextResponse } from 'next/server';

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

    // Keep Railway's frequent liveness probe cheap. Infrastructure clients are
    // loaded only for an explicitly requested deep diagnostic.
    const [
        { ENV },
        { redis, redisEnabled },
        { isVapidConfigured },
    ] = await Promise.all([
        import('@/config/env'),
        import('@/lib/cache/redis'),
        import('@/lib/push/vapidEnv'),
    ]);

    const checks: Record<string, any> = {};
    const { hasSupabaseServiceRole, createSupabaseAdminClient } = await import('@/lib/supabase-admin');
    const supabaseConfigured = !!ENV.VITE_SUPABASE_URL && hasSupabaseServiceRole();
    const stripeConfigured = !!ENV.STRIPE_SECRET_KEY;
    const dailyConfigured = !!ENV.DAILY_API_KEY;
    const resendConfigured = !!ENV.RESEND_API_KEY;
    const pushConfigured = isVapidConfigured();

    // 1. Check database connection (2.5s timeout so degraded infra never
    //    503s for 60+ seconds and clogs Railway health checks)
    try {
        const supabase = supabaseConfigured ? createSupabaseAdminClient() : null;
        const dbStart = Date.now();
        let dbError: string | null | undefined = null;
        if (supabase) {
            const timeoutMs = 2500;
            const timeout = new Promise<null>((_, rej) =>
                setTimeout(() => rej(new Error('timeout')), timeoutMs)
            );
            const query = supabase.from('tenants').select('id').limit(1).maybeSingle();
            const { error } = await Promise.race([query, timeout])
                .then((res: any) => res || { error: null })
                .catch((e: Error) => ({ error: e.message || 'unavailable' }));
            dbError = error ? (typeof error === 'string' ? error : error.message || 'unavailable') : null;
        } else {
            dbError = 'Supabase admin config missing (supabase URL + verified service_role JWT required)';
        }
        checks.database = {
            status: dbError ? 'degraded' : 'healthy',
            responseTime: Date.now() - dbStart,
            error: dbError || undefined,
        };
    } catch (e: any) {
        checks.database = {
            status: 'degraded',
            error: e?.message || 'unavailable',
        };
    }

    // 2. Check Redis connection
    if (redisEnabled && redis) {
        try {
            const redisStart = Date.now();
            const redisTimeout = new Promise<null>((_, rej) =>
                setTimeout(() => rej(new Error('timeout')), 1500)
            );
            await Promise.race([redis.ping(), redisTimeout]);
            checks.redis = {
                status: 'healthy',
                responseTime: Date.now() - redisStart,
            };
        } catch (e: any) {
            checks.redis = {
                status: 'degraded',
                error: e?.message || 'unavailable',
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
            status: supabaseConfigured && !!ENV.VITE_SUPABASE_ANON_KEY ? 'healthy' : 'degraded',
            responseTime: Date.now() - authStart,
            error: supabaseConfigured && !!ENV.VITE_SUPABASE_ANON_KEY
                ? undefined
                : 'Supabase auth configuration is incomplete',
        };
    } catch (e: any) {
        checks.auth = {
            status: 'degraded',
            error: e?.message || 'unavailable',
        };
    }

    // 4. Config summary
    checks.config = {
        status: supabaseConfigured ? 'healthy' : 'degraded',
        services: {
            supabase: supabaseConfigured ? 'configured' : 'missing',
            supabaseAuth: ENV.VITE_SUPABASE_ANON_KEY ? 'configured' : 'missing',
            stripe: stripeConfigured ? 'configured' : 'missing',
            daily: dailyConfigured ? 'configured' : 'missing',
            resend: resendConfigured ? 'configured' : 'missing',
            webPush: pushConfigured ? 'configured' : 'missing',
        },
    };

    // 5. Bonnie durable execution (Postgres queue — not Redis)
    const { isDurableRuntimeEnabled } = await import('@/lib/bonnie/runtime/types');
    checks.bonnie_durable_runtime = {
      status: isDurableRuntimeEnabled() ? 'healthy' : 'degraded',
      enabled: isDurableRuntimeEnabled(),
      orchestration: 'postgres_agent_tasks',
      note: 'Redis is cache/rate-limit only; durable tasks use Postgres Bonnie runtime.',
    };

    // 6. System runtime
    const { getMemorySnapshot, getMemoryBaseline, resolveHeapLimitMb } = await import(
      '@/lib/runtime/memoryTelemetry'
    );
    const memory = getMemorySnapshot();
    const memoryBaseline = getMemoryBaseline();
    checks.system = {
        status: memory.heapUsedPct >= 90 ? 'degraded' : 'operational',
        memory,
        memoryBaseline: memoryBaseline || undefined,
        heapLimitMb: resolveHeapLimitMb(),
    };

    // Overall status: use 'degraded' for partial issues but always return 200
    // so downstream monitors see the payload + render amber banner instead
    // of treating the route itself as dead.
    const anyUnhealthy = Object.values(checks).some(
        (check) =>
            check?.status &&
            check.status !== 'healthy' &&
            check.status !== 'skipped' &&
            check.status !== 'operational'
    );

    const overallStatus = anyUnhealthy ? 'degraded' : 'healthy';
    const totalResponseTime = Date.now() - startTime;

    return NextResponse.json(
        {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            responseTime: totalResponseTime,
            checks,
            version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        },
        { status: 200 }
    );
}
