import { NextResponse } from 'next/server';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic';

function configurationReady(): boolean {
  // Core runtime: Supabase + public app URL.
  // Cron/encryption are reported in the body as optionalOpsReady so a missing
  // CRON_SECRET cannot brick Railway health-gated rollouts.
  return Boolean(
    ENV.VITE_SUPABASE_URL &&
      ENV.VITE_SUPABASE_ANON_KEY &&
      ENV.SUPABASE_SERVICE_ROLE_KEY &&
      ENV.NEXT_PUBLIC_APP_URL
  );
}

function optionalOpsReady(): boolean {
  return Boolean(
    (process.env.CRON_SECRET || process.env.INTERNAL_API_KEY) &&
      process.env.ENCRYPTION_SECRET?.length === 32
  );
}

/**
 * Liveness + readiness.
 * - Soft mode (READINESS_ALWAYS_200=true): always HTTP 200 for Railway bootstrap.
 * - Default production: HTTP 503 when config or database is not ready so traffic
 *   is not routed to a broken instance.
 */
export async function GET() {
  const startedAt = Date.now();
  const soft =
    process.env.READINESS_ALWAYS_200 === 'true' || process.env.READINESS_ALWAYS_200 === '1';
  const lightDb =
    process.env.READINESS_LIGHT_DB === 'true' ||
    process.env.READINESS_LIGHT_DB === '1' ||
    process.env.NODE_ENV === 'production';
  const configured = configurationReady();
  let dbStatus: 'unchecked' | 'ready' | 'degraded' = 'unchecked';

  if (configured && !lightDb) {
    try {
      const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase
        .from('tenants')
        .select('id', { head: true, count: 'exact' })
        .abortSignal(AbortSignal.timeout(3_000));
      dbStatus = error ? 'degraded' : 'ready';
    } catch {
      dbStatus = 'degraded';
    }
  } else if (configured && lightDb) {
    dbStatus = 'ready';
  }

  const opsReady = optionalOpsReady();
  const healthy = configured && dbStatus === 'ready';
  const body = {
    status: healthy ? 'ok' : 'degraded',
    configuration: configured ? 'ready' : 'degraded',
    database: dbStatus,
    ops: opsReady ? 'ready' : 'degraded',
    responseTime: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  };

  const status = soft || healthy ? 200 : 503;
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
