import { NextResponse } from 'next/server';
import { createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';
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
  const checks = {
    configuration: configurationReady() ? 'ready' : 'unavailable',
    database: 'unavailable',
  };

  if (checks.configuration === 'ready') {
    try {
      const supabase = createAdminSupabaseClientOrThrow();
      const { error } = await supabase
        .from('tenants')
        .select('id', { head: true, count: 'exact' })
        .abortSignal(AbortSignal.timeout(8_000));
      checks.database = error ? 'unavailable' : 'ready';
    } catch {
      checks.database = 'unavailable';
    }
  }

  const ready = Object.values(checks).every((status) => status === 'ready');
  return NextResponse.json(
    {
      status: ready ? 'ready' : 'unavailable',
      checks,
      responseTime: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
