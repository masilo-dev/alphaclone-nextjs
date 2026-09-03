import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

/**
 * Detailed dependency/integration health for internal monitoring.
 * Must NOT be used as Railway liveness/readiness — third-party outages here
 * must not mark the platform dead.
 *
 * Protect with CRON_SECRET or INTERNAL_API_KEY in production.
 */
export async function GET(request: NextRequest) {
  const authDenied = denyIfCronUnauthorized(request);
  if (authDenied) return authDenied;

  const startedAt = Date.now();
  const timeoutMs = 8_000;

  const checks: Record<string, { status: string; ms?: number; detail?: string }> = {};

  async function timedCheck(
    name: string,
    fn: () => Promise<{ status: string; detail?: string }>
  ): Promise<void> {
    const t0 = Date.now();
    try {
      const result = await Promise.race([
        fn(),
        new Promise<{ status: string; detail?: string }>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs)
        ),
      ]);
      checks[name] = { status: result.status, ms: Date.now() - t0, detail: result.detail };
    } catch (err) {
      checks[name] = {
        status: 'degraded',
        ms: Date.now() - t0,
        detail: err instanceof Error ? err.message : 'unavailable',
      };
    }
  }

  const { getRedisConnectionState, getRedisAsync } = await import('@/lib/redis/client');
  const redisState = getRedisConnectionState();

  await timedCheck('redis', async () => {
    if (!redisState.configured) return { status: 'skipped', detail: 'not configured' };
    const client = await getRedisAsync();
    if (!client) return { status: 'degraded', detail: 'not connected' };
    await client.ping();
    return { status: 'healthy', detail: redisState.backend };
  });

  await timedCheck('database', async () => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from('tenants')
      .select('id', { head: true, count: 'exact' })
      .abortSignal(AbortSignal.timeout(5_000));
    return error
      ? { status: 'degraded', detail: error.message }
      : { status: 'healthy' };
  });

  await timedCheck('bonnie_durable', async () => {
    const { isDurableRuntimeEnabled } = await import('@/lib/bonnie/runtime/types');
    return isDurableRuntimeEnabled()
      ? { status: 'healthy', detail: 'postgres_agent_tasks' }
      : { status: 'degraded', detail: 'BONNIE_DURABLE_RUNTIME=false' };
  });

  const optionalIntegrations = [
    { key: 'openai', env: 'OPENAI_API_KEY' },
    { key: 'anthropic', env: 'ANTHROPIC_API_KEY' },
    { key: 'linkedin', env: 'LINKEDIN_CLIENT_ID' },
    { key: 'facebook', env: 'FACEBOOK_APP_ID' },
    { key: 'stripe', env: 'STRIPE_SECRET_KEY' },
    { key: 'browserbase', env: 'BROWSERBASE_API_KEY' },
    { key: 'resend', env: 'RESEND_API_KEY' },
    { key: 'slack', env: 'SLACK_BOT_TOKEN' },
  ];

  for (const { key, env } of optionalIntegrations) {
    checks[key] = {
      status: process.env[env]?.trim() ? 'configured' : 'not_configured',
    };
  }

  const { getMemorySnapshot } = await import('@/lib/runtime/memoryTelemetry');
  const memory = getMemorySnapshot();

  const anyDegraded = Object.values(checks).some(
    (c) => c.status === 'degraded' || c.status === 'unhealthy'
  );

  return NextResponse.json(
    {
      status: anyDegraded ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startedAt,
      redis: redisState,
      memory,
      checks,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
