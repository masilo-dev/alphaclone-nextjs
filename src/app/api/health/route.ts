import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { redis } from '@/lib/cache/redis';

/**
 * Health check endpoint for monitoring
 * Returns system health status
 */

export async function GET() {
    const startTime = Date.now();
    const checks: Record<string, any> = {};

    // 1. Check database connection
    try {
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

    // 3. Check auth service (Supabase Auth)
    try {
        const authStart = Date.now();
        const { error: authError } = await supabase.auth.getSession();
        checks.auth = {
            status: authError ? 'unhealthy' : 'healthy',
            responseTime: Date.now() - authStart,
            error: authError?.message,
        };
    } catch (error) {
        checks.auth = {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }

    // 4. System info
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

    // Determine overall health
    const allHealthy = Object.values(checks).every(
        check => !check.status || check.status === 'healthy'
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
