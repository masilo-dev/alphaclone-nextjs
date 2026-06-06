import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';
import type { FormField } from '@/types/tenantForms';

export const dynamic = 'force-dynamic';

function resolveBrandColor(tenant: {
  brand_color_primary?: string | null;
  settings?: Record<string, unknown> | null;
}): string {
  const settings = (tenant.settings || {}) as Record<string, unknown>;
  const branding = (settings.branding || {}) as Record<string, unknown>;
  return (
    tenant.brand_color_primary ||
    (branding.brand_color_primary as string | undefined) ||
    (branding.primaryColor as string | undefined) ||
    '#14b8a6'
  );
}

function resolveLogoUrl(tenant: {
  logo_url?: string | null;
  settings?: Record<string, unknown> | null;
}): string | null {
  const settings = (tenant.settings || {}) as Record<string, unknown>;
  const branding = (settings.branding || {}) as Record<string, unknown>;
  return (
    tenant.logo_url ||
    (branding.logo_url as string | undefined) ||
    (branding.logo as string | undefined) ||
    null
  );
}

/** Public read-only endpoint for branded form pages (no auth required). */
export async function GET(req: NextRequest) {
  try {
    const tenantSlug = req.nextUrl.searchParams.get('tenantSlug')?.trim();
    const formSlug = req.nextUrl.searchParams.get('formSlug')?.trim() || 'contact';

    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: 'tenantSlug is required' }, { status: 400 });
    }

    const admin = createAdminSupabaseClientOrThrow();

    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .select('id, name, slug, logo_url, brand_color_primary, settings')
      .eq('slug', tenantSlug)
      .maybeSingle();

    if (tenantError) throw tenantError;
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
    }

    let formQuery = admin
      .from('tenant_forms')
      .select('slug, title, description, fields, settings, is_active')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true);

    formQuery =
      formSlug === 'contact'
        ? formQuery.or('slug.eq.contact,is_default.eq.true')
        : formQuery.eq('slug', formSlug);

    const { data: form, error: formError } = await formQuery
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (formError) throw formError;
    if (!form) {
      return NextResponse.json({ success: false, error: 'Form not found or inactive' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      tenant: {
        name: tenant.name,
        slug: tenant.slug,
        logoUrl: resolveLogoUrl(tenant),
        brandColor: resolveBrandColor(tenant),
      },
      form: {
        slug: form.slug,
        title: form.title,
        description: form.description,
        fields: (form.fields || []) as FormField[],
        settings: (form.settings || {}) as Record<string, unknown>,
      },
    });
  } catch (err: unknown) {
    console.error('[forms/public]', err);
    const message = err instanceof Error ? err.message : 'Failed to load form';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
