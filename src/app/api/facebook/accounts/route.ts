import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tenantId = req.nextUrl.searchParams.get('tenantId');
  if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
  const { data: membership } = await db.from('tenant_users').select('tenant_id').eq('tenant_id', tenantId).eq('user_id', user.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const [identities, legacy] = await Promise.all([
    db.from('social_identities').select('id, provider_identity_id, display_name, can_publish, can_upload_media, is_active, created_at').eq('tenant_id', tenantId).eq('provider', 'facebook').eq('is_active', true),
    db.from('facebook_integrations').select('id, page_id, page_name, is_active, connected_at').eq('tenant_id', tenantId).eq('is_active', true),
  ]);
  if (identities.error || legacy.error) return NextResponse.json({ error: 'Unable to load Facebook connection state' }, { status: 500 });
  const pages = new Map((legacy.data || []).map((page) => [page.page_id, page]));
  for (const identity of identities.data || []) pages.set(identity.provider_identity_id, {
    id: identity.id, page_id: identity.provider_identity_id, page_name: identity.display_name,
    is_active: identity.is_active, connected_at: identity.created_at,
    can_publish: identity.can_publish, can_upload_media: identity.can_upload_media,
  });
  return NextResponse.json({ pages: [...pages.values()] });
}
