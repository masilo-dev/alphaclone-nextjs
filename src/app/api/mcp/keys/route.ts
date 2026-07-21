import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { generateMcpApiKey, hashMcpApiKey } from '@/lib/security/mcpKeyHash';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '';
    const { user } = await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from('mcp_api_keys')
      .select('id, updated_at, last_used_at')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .maybeSingle();
    return NextResponse.json({
      exists: !!data,
      updatedAt: data?.updated_at || null,
      lastUsedAt: data?.last_used_at || null,
    });
  } catch (error) {
    return routeErrorResponse(error, 'MCP key status could not be loaded', req);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '';
    const { user } = await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from('mcp_api_keys')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'MCP key could not be revoked', req);
  }
}

async function upsertMcpKey(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  tenantId: string,
  userId: string,
  token: string
) {
  const keyHash = hashMcpApiKey(token);
  const now = new Date().toISOString();

  const hashOnly = await admin.from('mcp_api_keys').upsert(
    {
      tenant_id: tenantId,
      user_id: userId,
      api_key: null,
      api_key_hash: keyHash,
      updated_at: now,
    },
    { onConflict: 'tenant_id,user_id' }
  );
  if (!hashOnly.error) return;

  const legacyHashed = await admin.from('mcp_api_keys').upsert(
    {
      tenant_id: tenantId,
      user_id: userId,
      api_key: keyHash,
      updated_at: now,
    },
    { onConflict: 'tenant_id,user_id' }
  );
  if (!legacyHashed.error) return;

  const legacyPlain = await admin.from('mcp_api_keys').upsert(
    {
      tenant_id: tenantId,
      user_id: userId,
      api_key: token,
      updated_at: now,
    },
    { onConflict: 'tenant_id,user_id' }
  );
  if (legacyPlain.error) throw legacyPlain.error;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = z.string().uuid().parse(body.tenantId);
    const { user } = await requireTenantAccess(tenantId, req);
    const token = generateMcpApiKey();
    const admin = createSupabaseAdminClient();
    await upsertMcpKey(admin, tenantId, user.id, token);
    return NextResponse.json({ success: true, token });
  } catch (error) {
    return routeErrorResponse(error, 'MCP key could not be rotated', req);
  }
}
