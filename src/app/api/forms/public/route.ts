import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClientOrThrow } from '@/lib/apiAuth';
import { rateLimitMiddleware, rateLimitConfigs } from '@/lib/rateLimit';
import type { FormField } from '@/types/tenantForms';

export const dynamic = 'force-dynamic';

/**
 * Public endpoint for branded form pages — no auth required.
 * Used by /form/[slug]/[formSlug] via BrandedFormClient.
 */
export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimitMiddleware(req, rateLimitConfigs.public.contact);
    if (limited) return limited;

    const tenantSlug = req.nextUrl.searchParams.get('tenantSlug')?.trim();
    const formSlug = req.nextUrl.searchParams.get('formSlug')?.trim() || 'contact';

    if (!tenantSlug) {
      return NextResponse.json({ error: 'tenantSlug is required' }, { status: 400 });
    }

    const admin = createAdminSupabaseClientOrThrow();

    const { data: tenant } = await admin
      .from('tenants')
      .select('id, name, slug, logo_url, settings')
      .eq('slug', tenantSlug)
      .maybeSingle();

    if (!tenant) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    let formQuery = admin
      .from('tenant_forms')
      .select('slug, title, description, fields, settings, is_active')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true);

    formQuery = formSlug === 'contact'
      ? formQuery.or('slug.eq.contact,is_default.eq.true')
      : formQuery.eq('slug', formSlug);

    const { data: form } = await formQuery
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!form) {
      return NextResponse.json({ error: 'Form not found or inactive' }, { status: 404 });
    }

    const settings = (tenant.settings || {}) as Record<string, unknown>;
    const brandColor = String(settings.brand_color || '#14b8a6');

    return NextResponse.json({
      success: true,
      tenant: {
        name: tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.logo_url ?? null,
        brandColor,
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
