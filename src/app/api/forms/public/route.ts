import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantSlug = req.nextUrl.searchParams.get('tenantSlug');
    const formSlug = req.nextUrl.searchParams.get('formSlug') || 'contact';
    if (!tenantSlug) {
      return NextResponse.json({ error: 'tenantSlug is required' }, { status: 400 });
    }

    const admin = createAdminSupabaseClientOrThrow();
    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .select('id, name, slug, logo_url, brand_color_primary, settings')
      .eq('slug', tenantSlug)
      .maybeSingle();
    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    let query = admin
      .from('tenant_forms')
      .select('id, slug, title, description, fields, settings, is_active, is_default')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true);

    if (formSlug === 'default') {
      query = query.eq('is_default', true);
    } else {
      query = query.eq('slug', formSlug);
    }

    const { data: form, error: formError } = await query.maybeSingle();
    if (formError) throw formError;
    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    const branding = (tenant.settings as any)?.branding || {};
    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.logo_url || branding.logo || null,
        brandColor: tenant.brand_color_primary || branding.primaryColor || '#14b8a6',
      },
      form,
    });
  } catch (err: any) {
    console.error('[forms/public]', err);
    return NextResponse.json({ error: err.message || 'Failed to load form' }, { status: 500 });
  }
}
