import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { DEFAULT_CONTACT_FIELDS } from '@/types/tenantForms';

export const dynamic = 'force-dynamic';

const fieldSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['text', 'email', 'phone', 'textarea', 'select', 'number']),
  label: z.string().min(1),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

const upsertSchema = z.object({
  tenantId: z.string().uuid(),
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  fields: z.array(fieldSchema).min(1).max(30),
  settings: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'contact';
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }
    await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();
    const { data, error } = await admin
      .from('tenant_forms')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ success: true, forms: data || [] });
  } catch (err) {
    return routeErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const payload = parsed.data;
    await requireTenantAccess(payload.tenantId);
    const admin = createAdminSupabaseClientOrThrow();
    const normalizedSlug = payload.slug || slugify(payload.title);

    if (payload.id) {
      const { data: slugConflict } = await admin
        .from('tenant_forms')
        .select('id, title')
        .eq('tenant_id', payload.tenantId)
        .eq('slug', normalizedSlug)
        .neq('id', payload.id)
        .maybeSingle();
      if (slugConflict) {
        return NextResponse.json(
          { error: `Form slug already exists for this workspace: ${String(slugConflict.title || slugConflict.id)}` },
          { status: 409 }
        );
      }

      const { data, error } = await admin
        .from('tenant_forms')
        .update({
          title: payload.title,
          description: payload.description || null,
          fields: payload.fields,
          settings: payload.settings || {},
          is_active: payload.is_active ?? true,
          is_default: payload.is_default ?? false,
          slug: normalizedSlug,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.id)
        .eq('tenant_id', payload.tenantId)
        .select()
        .single();
      if (error) throw error;
      if (payload.is_default) {
        await admin
          .from('tenant_forms')
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .eq('tenant_id', payload.tenantId)
          .neq('id', payload.id)
          .eq('is_default', true);
      }
      return NextResponse.json({ success: true, form: data });
    }

    const { data: slugConflict } = await admin
      .from('tenant_forms')
      .select('id, title')
      .eq('tenant_id', payload.tenantId)
      .eq('slug', normalizedSlug)
      .maybeSingle();
    if (slugConflict) {
      return NextResponse.json(
        { error: `Form slug already exists for this workspace: ${String(slugConflict.title || slugConflict.id)}` },
        { status: 409 }
      );
    }

    const { data, error } = await admin
      .from('tenant_forms')
      .insert({
        tenant_id: payload.tenantId,
        slug: normalizedSlug,
        title: payload.title,
        description: payload.description || null,
        fields: payload.fields,
        settings: payload.settings || { thankYouMessage: 'Thank you! We will be in touch soon.', createLead: true },
        is_active: payload.is_active ?? true,
        is_default: payload.is_default ?? false,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Form slug already exists for this workspace' }, { status: 409 });
      }
      throw error;
    }
    if (payload.is_default) {
      await admin
        .from('tenant_forms')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('tenant_id', payload.tenantId)
        .neq('id', data.id)
        .eq('is_default', true);
    }
    return NextResponse.json({ success: true, form: data });
  } catch (err) {
    return routeErrorResponse(err);
  }
}

/** Ensure every tenant has a default branded contact form */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = String(body?.tenantId || '');
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }
    await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    const { data: existing } = await admin
      .from('tenant_forms')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_default', true)
      .maybeSingle();

    if (existing?.id) {
      const { data: form } = await admin.from('tenant_forms').select('*').eq('id', existing.id).single();
      return NextResponse.json({ success: true, form, created: false });
    }

    const { data, error } = await admin
      .from('tenant_forms')
      .insert({
        tenant_id: tenantId,
        slug: 'contact',
        title: 'Contact Us',
        description: 'Send us a message — we reply fast.',
        fields: DEFAULT_CONTACT_FIELDS,
        settings: { thankYouMessage: 'Thank you! We will be in touch soon.', createLead: true },
        is_active: true,
        is_default: true,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, form: data, created: true });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
