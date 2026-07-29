import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requirePlatformSuperAdmin, routeErrorResponse } from '@/lib/apiAuth';
import { rateLimitConfigs, rateLimitMiddleware } from '@/lib/rateLimit';
import { securityLogService } from '@/services/securityLogService';
import { timingSafeEqual } from 'node:crypto';

export const dynamic = 'force-dynamic';

function getRequestIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const firstForwarded = forwarded?.split(',')[0]?.trim();
  return firstForwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && !process.env.DEV_MIGRATE_SECRET) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const limited = await rateLimitMiddleware(
      req,
      rateLimitConfigs.api.heavy,
      `${getRequestIp(req)}:dev-migrate`
    );
    if (limited) return limited;
    await requirePlatformSuperAdmin();
  } catch {
    const { searchParams } = new URL(req.url);
    const secret =
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
      req.headers.get('x-dev-migrate-secret')?.trim() ||
      searchParams.get('secret') ||
      '';
    const expected = process.env.DEV_MIGRATE_SECRET;
    const allowSecretInProd = process.env.DEV_MIGRATE_ALLOW_SECRET_IN_PROD === 'true';
    if (process.env.NODE_ENV === 'production' && !allowSecretInProd) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (
      !expected ||
      !secret ||
      expected.length !== secret.length ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const supabase = createSupabaseAdminClient();
    const ip = getRequestIp(req);
    const userAgent = req.headers.get('user-agent') || undefined;
    void securityLogService.logEvent({
      eventType: 'ADMIN_DEV_MIGRATE_INVOKED',
      ipAddress: ip,
      userAgent,
      severity: 'critical',
      useAdminClient: true,
      eventDetails: {
        path: req.nextUrl.pathname,
      },
    });

    const { data: columnCheck, error: columnCheckError } = await supabase.rpc('exec_sql', {
      sql_query:
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'lead_outreach_log' AND column_name = 'provider';",
    });

    if (columnCheckError) {
      console.log('exec_sql RPC check failed (which is normal if it is not exposed yet):', columnCheckError.message);
    }

    const columnExists = Array.isArray(columnCheck) && columnCheck.length > 0;

    if (columnExists) {
      return NextResponse.json({
        success: true,
        message: "Column 'provider' already exists in 'lead_outreach_log'. No migration needed.",
        checkResult: columnCheck,
      });
    }

    const migrationSql =
      "ALTER TABLE lead_outreach_log ADD COLUMN IF NOT EXISTS provider TEXT; NOTIFY pgrst, 'reload schema';";

    const { error: execError } = await supabase.rpc('exec_sql', { sql_query: migrationSql });

    if (execError) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error(
          `Migration SQL run failed: ${execError.message}. Also missing service role credentials in process.env.`
        );
      }

      const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ sql_query: migrationSql }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to apply migration via RPC fallback: ${response.status} ${text}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Successfully applied migration: added 'provider' column to 'lead_outreach_log'.",
    });
  } catch (err: unknown) {
    return routeErrorResponse(err, 'Migration failed', req);
  }
}
