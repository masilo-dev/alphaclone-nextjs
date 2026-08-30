import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { assertContactSalesStageTransition } from '@/lib/stageProgression';
import { validateDailyResourceQuota, recordDailyResourceQuota } from '@/lib/server/dailyResourceQuota';

const baseFields = z.object({
  name: z.string().trim().min(1).max(300),
  email: z.union([z.string().trim().email().max(320), z.literal(''), z.null()]).optional(),
  phone: z.string().trim().max(100).nullable().optional(),
  industry: z.string().trim().max(200).nullable().optional(),
  location: z.string().trim().max(500).nullable().optional(),
  salesStage: z.enum(['lead', 'prospect', 'customer', 'lost']),
  value: z.coerce.number().min(0).max(1_000_000_000),
  description: z.string().max(20_000).nullable().optional(),
  customFields: z.record(z.string(), z.unknown()),
  website: z.union([z.string().url().max(2000), z.literal(''), z.null()]).optional(),
});
const fields = baseFields.extend({ salesStage: baseFields.shape.salesStage.default('lead'), value: baseFields.shape.value.default(0), customFields: baseFields.shape.customFields.default({}) });
const updateSchema = baseFields.partial().extend({ clientId: z.string().uuid(), isActive: z.boolean().optional() });
const bulkCreateSchema = z.object({ clients: z.array(fields).min(1).max(500) });
const deleteSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

function row(value: z.infer<typeof fields>) {
  return { name: value.name, email: value.email || null, phone: value.phone || null, industry: value.industry || null, location: value.location || null, sales_stage: value.salesStage, value: value.value, description: value.description || null, custom_fields: value.customFields, website: value.website || null };
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const body = await req.json().catch(() => ({}));
    const bulk = bulkCreateSchema.safeParse(body);
    let values: z.infer<typeof fields>[];
    if (bulk.success) {
      values = bulk.data.clients;
    } else {
      const single = fields.safeParse(body);
      if (!single.success) return NextResponse.json({ error: 'Invalid client details' }, { status: 400 });
      values = [single.data];
    }
    const admin = createSupabaseAdminClient();
    const emails = [...new Set(values.map((item) => item.email?.toLowerCase()).filter(Boolean) as string[])];
    const existingEmails = new Set<string>();
    if (emails.length) {
      const { data, error } = await admin.from('business_clients').select('email').eq('tenant_id', tenantId).eq('is_active', true).in('email', emails);
      if (error) throw error;
      for (const item of data || []) if (item.email) existingEmails.add(item.email.toLowerCase());
    }
    const seen = new Set(existingEmails);
    const accepted = values.filter((item) => {
      const email = item.email?.toLowerCase();
      if (!email) return true;
      if (seen.has(email)) return false;
      seen.add(email); return true;
    });
    if (!accepted.length) return NextResponse.json({ error: 'Every supplied email already belongs to an active client in this workspace', code: 'DUPLICATE_EMAIL' }, { status: 409 });
    const leadCount = accepted.filter((item) => item.salesStage === 'lead').length;
    if (leadCount) await validateDailyResourceQuota(tenantId, user.id, 'leads', leadCount);
    const { data, error } = await admin.from('business_clients').insert(accepted.map((item) => ({ tenant_id: tenantId, ...row(item), is_active: true }))).select('*');
    if (error) throw error;
    const createdLeadCount = (data || []).filter((item: { sales_stage?: string }) => item.sales_stage === 'lead').length;
    if (createdLeadCount) {
      await recordDailyResourceQuota(tenantId, user.id, 'leads', createdLeadCount);
    }
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: bulk.success ? 'clients_imported' : 'client_created', payload: { clientIds: (data || []).map((item: any) => item.id), clientId: data?.[0]?.id, clientName: data?.[0]?.name || data?.[0]?.company_name, count: data?.length || 0, actorUserId: user.id, skippedDuplicates: values.length - accepted.length } });

    const { bridgeAutomationEventToTenantNotification } = await import('@/lib/audit/businessEventBridge');
    void bridgeAutomationEventToTenantNotification(
      tenantId,
      bulk.success ? 'clients_imported' : 'client_created',
      {
        clientIds: (data || []).map((item: { id: string }) => item.id),
        clientId: data?.[0]?.id,
        clientName: data?.[0]?.name || data?.[0]?.company_name,
        count: data?.length || 0,
        actorUserId: user.id,
      },
    );

    return NextResponse.json({ clients: data || [], client: bulk.success ? undefined : data?.[0], count: data?.length || 0, skipped: values.length - accepted.length }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Client records could not be created', req); }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid client update', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const { clientId, isActive, ...value } = parsed.data;
    const admin = createSupabaseAdminClient();
    const { data: existing, error: lookupError } = await admin.from('business_clients').select('*').eq('tenant_id', tenantId).eq('id', clientId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    if (value.salesStage && value.salesStage !== existing.sales_stage) {
      const transition = assertContactSalesStageTransition(existing.sales_stage, value.salesStage);
      if (!transition.ok) return NextResponse.json({ error: transition.message }, { status: 409 });
    }
    if (value.email) {
      const { data: duplicate } = await admin.from('business_clients').select('id').eq('tenant_id', tenantId).eq('is_active', true).eq('email', value.email).neq('id', clientId).maybeSingle();
      if (duplicate) return NextResponse.json({ error: 'Another active client already uses this email', code: 'DUPLICATE_EMAIL' }, { status: 409 });
    }
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const map: Record<string, string> = { salesStage: 'sales_stage', customFields: 'custom_fields' };
    for (const [key, item] of Object.entries(value)) if (item !== undefined) updates[map[key] || key] = item === '' ? null : item;
    if (isActive !== undefined) updates.is_active = isActive;
    const { data, error } = await admin.from('business_clients').update(updates).eq('tenant_id', tenantId).eq('id', clientId).select('*').single();
    if (error) throw error;
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: isActive === true ? 'client_restored' : 'client_updated', payload: { clientId, actorUserId: user.id, changedFields: Object.keys(updates) } });
    return NextResponse.json({ client: data });
  } catch (error) { return routeErrorResponse(error, 'Client could not be updated', req); }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid client selection' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('business_clients').update({ is_active: false, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).in('id', parsed.data.ids).eq('is_active', true).select('id');
    if (error) throw error;
    const ids = (data || []).map((item: any) => item.id);
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'clients_archived', payload: { clientIds: ids, actorUserId: user.id } });
    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) { return routeErrorResponse(error, 'Clients could not be archived', req); }
}
