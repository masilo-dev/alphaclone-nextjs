import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const settingsSchema = z.object({
  businessName: z.string().trim().min(1).max(200),
  tradingName: z.string().trim().max(200).optional().default(''),
  logoUrl: z.string().trim().max(2048).optional().default(''),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  address: z.string().trim().max(1000).optional().default(''),
  phone: z.string().trim().max(50).optional().default(''),
  email: z.union([z.string().trim().email(), z.literal('')]).default(''),
  taxRate: z.coerce.number().min(0).max(100),
  taxCountry: z.string().trim().min(2).max(3),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  invoicePrefix: z.string().trim().min(1).max(20),
  bankDetails: z.string().trim().max(5000).optional().default(''),
  mobilePaymentDetails: z.string().trim().max(5000).optional().default(''),
  serviceSectors: z.array(z.string().trim().min(1).max(100)).max(100),
  myServices: z.record(z.string().max(100), z.unknown()),
});

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { admin } = await requireTenantAccess(tenantId, req);
    const { data, error } = await admin.from('business_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ settings: data || null });
  } catch (error) {
    return routeErrorResponse(error, 'Business settings could not be loaded', req);
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
    const parsed = settingsSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid business settings', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const value = parsed.data;
    const admin = createSupabaseAdminClient();
    const { data: existing, error: existingError } = await admin.from('business_settings').select('settings').eq('tenant_id', tenantId).maybeSingle();
    if (existingError) throw existingError;
    const { data, error } = await admin.from('business_settings').upsert({
      tenant_id: tenantId,
      business_name: value.businessName,
      trading_name: value.tradingName || null,
      logo_url: value.logoUrl || null,
      brand_color: value.brandColor,
      address: value.address || null,
      phone: value.phone || null,
      email: value.email || null,
      tax_rate: value.taxRate,
      tax_country: value.taxCountry,
      currency: value.currency,
      invoice_prefix: value.invoicePrefix,
      bank_details: value.bankDetails || null,
      mobile_payment_details: value.mobilePaymentDetails || null,
      settings: { ...(existing?.settings && typeof existing.settings === 'object' ? existing.settings : {}), service_sectors: value.serviceSectors, my_services: value.myServices },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' }).select('*').single();
    if (error) throw error;
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'business_settings_updated', payload: { actorUserId: user.id } });
    return NextResponse.json({ settings: data });
  } catch (error) {
    return routeErrorResponse(error, 'Business settings could not be saved', req);
  }
}
