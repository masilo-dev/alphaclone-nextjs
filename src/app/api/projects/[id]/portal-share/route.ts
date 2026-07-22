import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { hashPortalPassword } from '@/lib/projects/portalPassword';
import crypto from 'crypto';

const portalShareSchema = z.object({
  tenantId: z.string().uuid(),
  password: z.string().min(4).max(128).optional().nullable(),
  clearPassword: z.boolean().optional(),
  expiresInDays: z.number().int().min(1).max(365).optional().nullable(),
  neverExpires: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const body = await req.json();
    const parsed = portalShareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 422 });
    }

    const { tenantId, password, clearPassword, expiresInDays, neverExpires } = parsed.data;
    const { admin } = await requireTenantAccess(tenantId);
    const { data: project, error: fetchError } = await admin
      .from('projects')
      .select('id, portal_token')
      .eq('id', projectId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const token = project.portal_token || crypto.randomUUID().replace(/-/g, '');

    let portalExpiresAt: string | null = null;
    if (neverExpires) {
      portalExpiresAt = null;
    } else if (expiresInDays) {
      const expires = new Date();
      expires.setDate(expires.getDate() + expiresInDays);
      portalExpiresAt = expires.toISOString();
    }

    let portalPasswordHash: string | null | undefined;
    if (clearPassword) {
      portalPasswordHash = null;
    } else if (password) {
      portalPasswordHash = hashPortalPassword(password);
    }

    const updatePayload: Record<string, unknown> = {
      is_public: true,
      portal_enabled: true,
      updated_at: new Date().toISOString(),
    };

    if (!project.portal_token) {
      updatePayload.portal_token = token;
    }

    if (portalExpiresAt !== undefined || neverExpires || expiresInDays) {
      updatePayload.portal_expires_at = portalExpiresAt;
    }
    if (portalPasswordHash !== undefined) {
      updatePayload.portal_password_hash = portalPasswordHash;
    }

    const { error: updateError } = await admin
      .from('projects')
      .update(updatePayload)
      .eq('id', projectId)
      .eq('tenant_id', tenantId);

    if (updateError) throw updateError;

    const origin = req.nextUrl.origin.replace(/\/$/, '');
    const url = `${origin}/p/${token}`;

    return NextResponse.json({
      success: true,
      url,
      token,
      expiresAt: portalExpiresAt,
      passwordProtected: clearPassword ? false : Boolean(password) || undefined,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to configure portal share', req);
  }
}
