import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import 'server-only';

import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import {
  hashClientPortalPassword,
  validateClientPortalPasswordStrength,
  rotateClientPortalSaltAndRevoke,
  writeClientPortalAuditRow,
} from '@/lib/auth/clientPortalAuth';
import { getOrCreateClientPortalUrl } from '@/services/finance/clientFinancePortalService';
import { appendWorkspaceActivity } from '@/services/finance/workspaceActivityService';

export const dynamic = 'force-dynamic';

const grantAccessSchema = z.object({
  clientId: z.string().uuid(),
  tenantId: z.string().uuid(),
  password: z.string().min(1).max(4096),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = grantAccessSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Valid clientId, tenantId, and password are required.' },
        { status: 400 }
      );
    }

    const { clientId, tenantId, password } = parsed.data;

    const { admin, user } = await requireTenantAccess(tenantId, req);
    await requireTenantRole(tenantId, ['owner', 'admin', 'billing_manager'], req);

    const strength = validateClientPortalPasswordStrength(password);
    if (!strength.ok) {
      return NextResponse.json({ error: strength.reason }, { status: 400 });
    }

    const { data: existing, error: lookupError } = await admin
      .from('business_clients')
      .select('id, tenant_id, name, client_portal_password_hash, client_portal_session_salt')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const passwordHash = hashClientPortalPassword(password);
    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await admin
      .from('business_clients')
      .update({
        client_portal_password_hash: passwordHash,
        client_portal_password_set_at: now,
        updated_at: now,
      })
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .select('id, client_portal_session_salt')
      .single();

    if (updateError) throw updateError;

    await rotateClientPortalSaltAndRevoke(admin, clientId, tenantId);

    await writeClientPortalAuditRow(admin, {
      tenant_id: tenantId,
      client_id: clientId,
      event_type: existing.client_portal_password_hash ? 'password_rotated' : 'password_set',
      metadata: {
        granted_by_user_id: user.id,
        grant_reason: 'owner_initiated',
      },
    });

    await writeClientPortalAuditRow(admin, {
      tenant_id: tenantId,
      client_id: clientId,
      event_type: 'grant_access',
      metadata: {
        granted_by_user_id: user.id,
      },
    });

    void appendWorkspaceActivity(admin, {
      tenant_id: tenantId,
      project_id: null,
      client_id: clientId,
      invoice_id: null,
      contract_id: null,
      actor_type: 'team_user',
      actor_id: user.id,
      actor_display_name: user.email || null,
      event_type: 'client_portal.access_granted',
      summary: existing.client_portal_password_hash
        ? `Reset portal password for ${existing.name || 'client'}`
        : `Granted portal access to ${existing.name || 'client'}`,
      metadata: {
        granted_by_user_id: user.id,
        password_rotated: Boolean(existing.client_portal_password_hash),
      },
    }).catch((e) => console.error('[client-finance/grant-access] workspace activity failed', e));

    const url = await getOrCreateClientPortalUrl(admin, tenantId, clientId);

    return NextResponse.json({
      success: true,
      clientId,
      portalUrl: url,
      passwordUpdated: true,
      saltRotated: true,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to grant client portal access', req);
  }
}
