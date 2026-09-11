import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { assertDealStageTransition } from '@/lib/stageProgression';

const stageSchema = z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']);
const nullableUuid = z.union([z.string().uuid(), z.null()]).optional();
const nullableDate = z.union([z.string().date(), z.null(), z.literal('')]).optional();
const createSchema = z.object({
  name: z.string().trim().min(1).max(250),
  value: z.coerce.number().min(0).max(1_000_000_000_000).default(0),
  stage: stageSchema.default('lead'),
  probability: z.coerce.number().min(0).max(100).optional(),
  expectedCloseDate: nullableDate,
  contactId: nullableUuid,
  projectId: nullableUuid,
  contactName: z.string().trim().max(250).optional(),
  contactEmail: z.union([z.string().trim().email(), z.literal('')]).optional(),
  description: z.string().trim().max(10000).optional(),
  notes: z.string().trim().max(10000).optional(),
  currency: z.string().trim().length(3).optional(),
  ownerId: nullableUuid,
  source: z.enum(['referral', 'website', 'cold_outreach', 'social_media', 'event', 'partner', 'organic', 'other']).optional(),
  sourceDetails: z.string().trim().max(4000).optional(),
  nextStep: z.string().trim().max(4000).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  competitorInfo: z.string().trim().max(4000).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  lostReason: z.string().trim().max(4000).optional(),
  wonDetails: z.string().trim().max(4000).optional(),
});
const updateSchema = createSchema.partial().extend({
  id: z.string().uuid(),
  stageReason: z.string().trim().max(2000).optional(),
});
const deleteSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) });

async function assertReference(admin: ReturnType<typeof createSupabaseAdminClient>, table: 'contacts' | 'projects', id: string | null | undefined, tenantId: string) {
  if (!id) return;
  const { data, error } = await admin.from(table).select('id').eq('id', id).eq('tenant_id', tenantId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`${table === 'contacts' ? 'Contact' : 'Project'} is not in this workspace`);
}

async function assertOwner(admin: ReturnType<typeof createSupabaseAdminClient>, ownerId: string | null | undefined, tenantId: string) {
  if (!ownerId) return;
  const { data, error } = await admin.from('tenant_users').select('user_id').eq('tenant_id', tenantId).eq('user_id', ownerId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Deal owner is not a workspace member');
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid deal details', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const value = parsed.data;
    const admin = createSupabaseAdminClient();
    await Promise.all([assertReference(admin, 'contacts', value.contactId, tenantId), assertReference(admin, 'projects', value.projectId, tenantId), assertOwner(admin, value.ownerId, tenantId)]);
    const { data, error } = await admin.from('deals').insert({
      tenant_id: tenantId,
      owner_id: value.ownerId || user.id,
      name: value.name,
      value: value.value,
      currency: value.currency?.toUpperCase() || 'USD',
      stage: value.stage,
      probability: value.probability ?? 0,
      expected_close_date: value.expectedCloseDate || null,
      contact_id: value.contactId || null,
      project_id: value.projectId || null,
      contact_name: value.contactName || null,
      contact_email: value.contactEmail || null,
      description: value.description || null,
      notes: value.notes || null,
      source: value.source || null,
      source_details: value.sourceDetails || null,
      next_step: value.nextStep || null,
      tags: value.tags || [],
      metadata: value.metadata || {},
    }).select('*').single();
    if (error) throw error;
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'deal_created', payload: { dealId: data.id, actorUserId: user.id } });
    return NextResponse.json({ deal: data }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Deal could not be created', req);
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid deal update', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const value = parsed.data;
    const admin = createSupabaseAdminClient();
    const { data: existing, error: existingError } = await admin.from('deals').select('*').eq('id', value.id).eq('tenant_id', tenantId).maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    await Promise.all([assertReference(admin, 'contacts', value.contactId, tenantId), assertReference(admin, 'projects', value.projectId, tenantId), assertOwner(admin, value.ownerId, tenantId)]);
    if (value.stage && value.stage !== existing.stage) {
      const transition = assertDealStageTransition(existing.stage, value.stage);
      if (!transition.ok) return NextResponse.json({ error: transition.message }, { status: 409 });
    }
    const stageChanged = Boolean(value.stage && value.stage !== existing.stage);
    const changedAt = new Date().toISOString();
    const history = Array.isArray(existing.metadata?.stage_history) ? existing.metadata.stage_history : [];
    const updates: Record<string, unknown> = { updated_at: changedAt };
    if (value.name !== undefined) updates.name = value.name;
    if (value.value !== undefined) updates.value = value.value;
    if (value.currency !== undefined) updates.currency = value.currency.toUpperCase();
    if (value.stage !== undefined) updates.stage = value.stage;
    if (value.probability !== undefined) updates.probability = value.probability;
    if (value.expectedCloseDate !== undefined) updates.expected_close_date = value.expectedCloseDate || null;
    if (value.contactId !== undefined) updates.contact_id = value.contactId;
    if (value.projectId !== undefined) updates.project_id = value.projectId;
    if (value.contactName !== undefined) updates.contact_name = value.contactName || null;
    if (value.contactEmail !== undefined) updates.contact_email = value.contactEmail || null;
    if (value.description !== undefined) updates.description = value.description || null;
    if (value.notes !== undefined) updates.notes = value.notes || null;
    if (value.ownerId !== undefined) updates.owner_id = value.ownerId || user.id;
    if (value.source !== undefined) updates.source = value.source;
    if (value.sourceDetails !== undefined) updates.source_details = value.sourceDetails || null;
    if (value.nextStep !== undefined) updates.next_step = value.nextStep || null;
    if (value.tags !== undefined) updates.tags = value.tags;
    if (value.metadata !== undefined && !stageChanged) updates.metadata = value.metadata;
    if (value.competitorInfo !== undefined) updates.competitor_info = value.competitorInfo || null;
    if (value.customFields !== undefined) updates.custom_fields = value.customFields;
    if (value.lostReason !== undefined) updates.lost_reason = value.lostReason || null;
    if (value.wonDetails !== undefined) updates.won_details = value.wonDetails || null;
    if (stageChanged) {
      updates.metadata = { ...(existing.metadata || {}), previous_stage: existing.stage, last_stage_change_at: changedAt, stage_change_reason: value.stageReason || null, stage_history: [...history.slice(-19), { from: existing.stage, to: value.stage, reason: value.stageReason || undefined, changed_at: changedAt }] };
      if (value.stage === 'closed_won') updates.actual_close_date = changedAt.slice(0, 10);
    }
    const { data, error } = await admin.from('deals').update(updates).eq('id', value.id).eq('tenant_id', tenantId).select('*').single();
    if (error) throw error;
    if (stageChanged) await admin.from('deal_stage_history').insert({ deal_id: value.id, tenant_id: tenantId, from_stage: existing.stage, to_stage: value.stage, changed_by: user.id });
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: stageChanged ? 'deal_stage_changed' : 'deal_updated', payload: { dealId: value.id, actorUserId: user.id, oldStage: existing.stage, newStage: value.stage || existing.stage } });
    return NextResponse.json({ deal: data });
  } catch (error) {
    return routeErrorResponse(error, 'Deal could not be updated', req);
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid deal selection' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data: existing, error: lookupError } = await admin.from('deals').select('id').eq('tenant_id', tenantId).in('id', parsed.data.ids);
    if (lookupError) throw lookupError;
    const foundIds = (existing || []).map((row: any) => row.id);
    if (foundIds.length) {
      const { error } = await admin.from('deals').delete().eq('tenant_id', tenantId).in('id', foundIds);
      if (error) throw error;
    }
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'deals_deleted', payload: { dealIds: foundIds, actorUserId: user.id } });
    return NextResponse.json({ success: true, count: foundIds.length });
  } catch (error) {
    return routeErrorResponse(error, 'Deals could not be deleted', req);
  }
}
