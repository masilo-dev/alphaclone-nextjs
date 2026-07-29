import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePlatformSuperAdmin, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { dataMigrationService } from '@/services/migration/DataMigrationService';
import { rateLimitConfigs, rateLimitMiddleware } from '@/lib/rateLimit';
import { securityLogService } from '@/services/securityLogService';
import { timingSafeEqual } from 'node:crypto';

const bodySchema = z.object({
  tenantId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.CRM_MIGRATE_ALLOW_SECRET_IN_PROD !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const requestIp =
      (req.headers.get('x-forwarded-for') || '')
        .split(',')[0]
        ?.trim() ||
      req.headers.get('x-real-ip')?.trim() ||
      'unknown';

    const limited = await rateLimitMiddleware(
      req,
      rateLimitConfigs.api.heavy,
      `${requestIp}:crm-migrate`
    );
    if (limited) return limited;

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 422 });
    }

    try {
      await requirePlatformSuperAdmin();
    } catch {
      const secret =
        req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
        req.headers.get('x-crm-migrate-secret')?.trim() ||
        req.nextUrl.searchParams.get('secret') ||
        '';
      const expected = process.env.CRM_MIGRATE_SECRET || '';
      if (
        !expected ||
        !secret ||
        expected.length !== secret.length ||
        !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))
      ) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const tenantAccess = await requireTenantAccess(parsed.data.tenantId, req);
    void securityLogService.logEvent({
      tenantId: tenantAccess.membership.tenant_id,
      userId: tenantAccess.user.id,
      eventType: 'ADMIN_CRM_MIGRATION_INVOKED',
      ipAddress: requestIp,
      userAgent: req.headers.get('user-agent') || undefined,
      severity: 'critical',
      useAdminClient: true,
      eventDetails: { tenantId: parsed.data.tenantId },
    });

    const result = await dataMigrationService.runFullMigration();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return routeErrorResponse(error, 'CRM migration failed', req);
  }
}
