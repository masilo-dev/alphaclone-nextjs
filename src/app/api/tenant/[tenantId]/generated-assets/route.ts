import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const createSchema = z.object({
  assetType: z.enum(['content']),
  prompt: z.string().trim().min(1).max(20_000),
  content: z.string().min(1).max(500_000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit') || 20), 1), 100);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('generated_assets').select('*').eq('tenant_id', tenantId).eq('user_id', user.id).order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const { data: usageRows, error: usageError } = await admin.from('generated_assets').select('asset_type').eq('tenant_id', tenantId).eq('user_id', user.id).gte('created_at', today.toISOString());
    if (usageError) throw usageError;
    const usage = { logo: 0, image: 0, content: 0 };
    for (const row of usageRows || []) if (row.asset_type in usage) usage[row.asset_type as keyof typeof usage] += 1;
    return NextResponse.json({ assets: data || [], usage });
  } catch (error) { return routeErrorResponse(error, 'Generated asset history could not be loaded', req); }
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid generated asset' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('generated_assets').insert({ tenant_id: tenantId, user_id: user.id, asset_type: parsed.data.assetType, prompt: parsed.data.prompt, metadata: { ...(parsed.data.metadata || {}), content: parsed.data.content } }).select('*').single();
    if (error) throw error;
    return NextResponse.json({ asset: data }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Generated asset could not be saved', req); }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const assetId = req.nextUrl.searchParams.get('assetId') || '';
    if (!z.string().uuid().safeParse(assetId).success) return NextResponse.json({ error: 'Valid assetId is required' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data: asset, error: lookupError } = await admin.from('generated_assets').select('id,bucket_id,storage_path').eq('id', assetId).eq('tenant_id', tenantId).eq('user_id', user.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!asset) return NextResponse.json({ error: 'Generated asset not found' }, { status: 404 });
    if (asset.storage_path) {
      const { error: storageError } = await admin.storage.from(asset.bucket_id || 'social-assets').remove([asset.storage_path]);
      if (storageError) throw storageError;
    }
    const { error } = await admin.from('generated_assets').delete().eq('id', assetId).eq('tenant_id', tenantId).eq('user_id', user.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Generated asset could not be deleted', req); }
}
