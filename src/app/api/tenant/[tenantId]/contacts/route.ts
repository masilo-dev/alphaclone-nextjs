import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const nullableUuid = z.union([z.string().uuid(), z.null(), z.literal('')]).optional();
const nullableText = (max: number) => z.union([z.string().trim().max(max), z.null()]).optional();
const contactFields = z.object({
  companyId: nullableUuid,
  firstName: z.string().trim().max(200).optional(),
  lastName: z.string().trim().max(200).optional(),
  title: nullableText(200),
  department: nullableText(200),
  email: z.union([z.string().trim().email().max(320), z.literal(''), z.null()]).optional(),
  phone: nullableText(100),
  mobile: nullableText(100),
  addressLine1: nullableText(500),
  addressLine2: nullableText(500),
  city: nullableText(200),
  state: nullableText(200),
  postalCode: nullableText(50),
  country: nullableText(200),
  linkedinUrl: nullableText(2000),
  facebookUrl: nullableText(2000),
  twitterUrl: nullableText(2000),
  bio: nullableText(10000),
  notes: nullableText(10000),
  status: z.enum(['active', 'inactive', 'unsubscribed', 'bounced']).optional(),
  leadSource: nullableText(200),
  ownerId: nullableUuid,
  emailOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
  preferredContactMethod: z.enum(['email', 'phone', 'sms', 'any']).optional(),
  tags: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});
const createSchema = contactFields.refine(
  (value) => Boolean(value.firstName?.trim() || value.lastName?.trim()) && Boolean(value.email || value.phone || value.mobile),
  { message: 'A name and an email or phone number are required' },
);
const updateSchema = contactFields.extend({ contactId: z.string().uuid() });
const deleteSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) });

function toRow(value: z.infer<typeof contactFields>) {
  const row: Record<string, unknown> = {};
  const mapping: Record<string, string> = {
    companyId: 'company_id', firstName: 'first_name', lastName: 'last_name', title: 'title', department: 'department',
    email: 'email', phone: 'phone', mobile: 'mobile', addressLine1: 'address_line1', addressLine2: 'address_line2',
    city: 'city', state: 'state', postalCode: 'postal_code', country: 'country', linkedinUrl: 'linkedin_url',
    facebookUrl: 'facebook_url', twitterUrl: 'twitter_url', bio: 'bio', notes: 'notes', status: 'status',
    leadSource: 'lead_source', ownerId: 'owner_id', emailOptIn: 'email_opt_in', smsOptIn: 'sms_opt_in',
    preferredContactMethod: 'preferred_contact_method', tags: 'tags', customFields: 'custom_fields',
  };
  for (const [key, column] of Object.entries(mapping)) {
    const raw = value[key as keyof typeof value];
    if (raw !== undefined) row[column] = raw === '' ? null : raw;
  }
  return row;
}

async function assertReferences(admin: ReturnType<typeof createSupabaseAdminClient>, tenantId: string, companyId?: string | null, ownerId?: string | null) {
  if (companyId) {
    const { data, error } = await admin.from('companies').select('id').eq('tenant_id', tenantId).eq('id', companyId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Contact company is not in this workspace');
  }
  if (ownerId) {
    const { data, error } = await admin.from('tenant_users').select('user_id').eq('tenant_id', tenantId).eq('user_id', ownerId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Contact owner is not a workspace member');
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid contact details', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const value = parsed.data;
    const admin = createSupabaseAdminClient();
    await assertReferences(admin, tenantId, value.companyId || null, value.ownerId || null);
    const { data, error } = await admin.from('contacts').insert({
      tenant_id: tenantId,
      ...toRow(value),
      first_name: value.firstName?.trim() || value.lastName?.trim() || 'Contact',
      last_name: value.lastName?.trim() || '',
      status: value.status || 'active',
      email_opt_in: value.emailOptIn ?? true,
      sms_opt_in: value.smsOptIn ?? false,
      preferred_contact_method: value.preferredContactMethod === 'any' ? 'email' : value.preferredContactMethod || 'email',
      tags: value.tags || [],
      custom_fields: value.customFields || {},
      created_by: user.id,
    }).select('*').single();
    if (error) throw error;
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'contact_created', payload: { contactId: data.id, actorUserId: user.id } });
    return NextResponse.json({ contact: data }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Contact could not be created', req); }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid contact update', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const { contactId, ...value } = parsed.data;
    const admin = createSupabaseAdminClient();
    await assertReferences(admin, tenantId, value.companyId || null, value.ownerId || null);
    const updates = { ...toRow(value), updated_by: user.id, updated_at: new Date().toISOString() };
    const { data, error } = await admin.from('contacts').update(updates).eq('tenant_id', tenantId).eq('id', contactId).is('deleted_at', null).select('*').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'contact_updated', payload: { contactId, actorUserId: user.id } });
    return NextResponse.json({ contact: data });
  } catch (error) { return routeErrorResponse(error, 'Contact could not be updated', req); }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid contact selection' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await admin.from('contacts').update({ deleted_at: now, updated_by: user.id, updated_at: now }).eq('tenant_id', tenantId).in('id', parsed.data.ids).is('deleted_at', null).select('id');
    if (error) throw error;
    const ids = (data || []).map((row) => row.id);
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'contacts_deleted', payload: { contactIds: ids, actorUserId: user.id } });
    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) { return routeErrorResponse(error, 'Contacts could not be deleted', req); }
}
