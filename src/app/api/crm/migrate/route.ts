import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePlatformSuperAdmin, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { reconcileTenantCrm } from '@/lib/crm/crmBridgeServer';
import { dataMigrationService } from '@/services/migration/DataMigrationService';
import { rateLimitConfigs, rateLimitMiddleware } from '@/lib/rateLimit';
import { securityLogService } from '@/services/securityLogService';
import { timingSafeEqual } from 'node:crypto';

const bodySchema = z.object({
  tenantId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
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
    const { tenantId } = parsed.data;
    const { admin, user, membership } = await requireTenantRole(
      tenantId,
      ['owner', 'admin', 'tenant_admin', 'super_admin'],
      req
    );

    const needsDestructiveMigrate =
      process.env.NODE_ENV !== 'production' ||
      process.env.CRM_MIGRATE_ALLOW_SECRET_IN_PROD === 'true';

    let isDestructiveMigration = false;
    if (needsDestructiveMigrate) {
      try {
        await requirePlatformSuperAdmin();
        isDestructiveMigration = true;
      } catch {
        const secret =
          req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ||
          req.headers.get('x-crm-migrate-secret')?.trim() ||
          req.nextUrl.searchParams.get('secret') ||
          '';
        const expected = process.env.CRM_MIGRATE_SECRET || '';
        if (
          expected &&
          secret &&
          expected.length === secret.length &&
          timingSafeEqual(Buffer.from(secret), Buffer.from(expected))
        ) {
          isDestructiveMigration = true;
        }
      }
    }

    void securityLogService.logEvent({
      tenantId,
      userId: user.id,
      eventType: isDestructiveMigration
        ? 'ADMIN_CRM_MIGRATION_INVOKED'
        : 'CRM_ACCOUNT_RECONCILE_INVOKED',
      ipAddress: requestIp,
      userAgent: req.headers.get('user-agent') || undefined,
      severity: isDestructiveMigration ? 'critical' : 'info',
      useAdminClient: true,
      eventDetails: { tenantId, destructive: isDestructiveMigration },
    }).catch(() => void 0);

    if (isDestructiveMigration) {
      const result = await dataMigrationService.runFullMigration();
      return NextResponse.json({ success: true, destructive: true, result });
    }

    const summary = await reconcileTenantCrm(admin, tenantId);
    return NextResponse.json({
      success: true,
      destructive: false,
      note: 'CRM bridge reconcile mode: linked leads, contacts, clients, deals to unified accounts & opportunities.',
      ...summary,
    });
  } catch (error) {
    return routeErrorResponse(error, 'CRM migration failed', req);
  }
}
