import { NextResponse } from 'next/server';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic';

function configurationReady(): boolean {
  return Boolean(
    ENV.VITE_SUPABASE_URL &&
      ENV.VITE_SUPABASE_ANON_KEY &&
      ENV.SUPABASE_SERVICE_ROLE_KEY &&
      ENV.NEXT_PUBLIC_APP_URL &&
      (process.env.CRON_SECRET || process.env.INTERNAL_API_KEY) &&
      process.env.ENCRYPTION_SECRET?.length === 32
  );
}

export async function GET() {
  const startedAt = Date.now();
  const configured = configurationReady();
  let dbStatus = 'unchecked';

  if (configured) {
    try {
      const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase
        .from('tenants')
        .select('id', { head: true, count: 'exact' })
        .abortSignal(AbortSignal.timeout(8_000));
      dbStatus = error ? 'degraded' : 'ready';
    } catch {
      dbStatus = 'degraded';
    }
  }

  // Always return 200 — Railway only needs the server to be alive.
  // Configuration/DB issues are surfaced in the response body for observability.
  return NextResponse.json(
    {
      status: 'ok',
      configuration: configured ? 'ready' : 'degraded',
      database: dbStatus,
      responseTime: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
