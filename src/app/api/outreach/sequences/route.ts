import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { enrollSequenceAudience } from '@/lib/outreach/sequenceEnrollment';

const sequenceSchema = z.object({
  tenantId: z.uuid(), name: z.string().trim().min(2).max(200), campaignId: z.uuid().optional(), audienceId: z.uuid().optional(),
  timezone: z.string().trim().min(1).max(100).default('UTC'), stopOnReply: z.boolean().default(true),
  requiresApproval: z.boolean().default(true),
  frequencyCap: z.object({ max_per_7_days: z.number().int().min(1).max(30) }).default({ max_per_7_days: 3 }),
  quietHours: z.object({ start: z.string().optional(), end: z.string().optional() }).default({}),
  steps: z.array(z.object({
    channel: z.enum(['email','linkedin','sms','whatsapp','call','task']), delayMinutes: z.number().int().nonnegative(),
    condition: z.record(z.string(), z.unknown()).default({}), template: z.record(z.string(), z.unknown()).default({}),
    variantGroup: z.string().trim().max(80).optional(),
  })).min(1).max(50),
});

const updateSchema = z.object({
  tenantId: z.uuid(), sequenceId: z.uuid(),
  status: z.enum(['draft','pending_approval','active','paused','completed','archived']),
  approve: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const tenantId = String(request.nextUrl.searchParams.get('tenantId') || '').trim();
    if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    const { admin } = await requireTenantAccess(tenantId, request);
    const { data, error } = await admin.from('outreach_sequences').select('*, audience:marketing_segments(id,name,estimated_size), steps:outreach_sequence_steps(*)')
      .eq('tenant_id', tenantId).order('updated_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ success: true, sequences: data || [] });
  } catch (error) {
    return routeErrorResponse(error, 'Outreach sequences could not be loaded', request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = sequenceSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid outreach sequence', details: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;
    const { user, admin } = await requireTenantAccess(input.tenantId, request);
    const { data: sequence, error: sequenceError } = await admin.from('outreach_sequences').insert({
      tenant_id: input.tenantId, campaign_id: input.campaignId || null, name: input.name, timezone: input.timezone,
      stop_on_reply: input.stopOnReply, requires_approval: input.requiresApproval, segment_id: input.audienceId || null,
      frequency_cap: input.frequencyCap, quiet_hours: input.quietHours, created_by: user.id,
    }).select('*').single();
    if (sequenceError) throw sequenceError;
    const rows = input.steps.map((step, index) => ({
      tenant_id: input.tenantId, sequence_id: sequence.id, step_order: index + 1,
      channel: step.channel, delay_minutes: step.delayMinutes, condition: step.condition,
      template: step.template, variant_group: step.variantGroup || null,
    }));
    const { data: steps, error: stepsError } = await admin.from('outreach_sequence_steps').insert(rows).select('*');
    if (stepsError) throw stepsError;
    return NextResponse.json({ success: true, sequence, steps: steps || [] }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Outreach sequence could not be created', request);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid sequence update', details: parsed.error.flatten() }, { status: 400 });
    const { tenantId, sequenceId, status, approve } = parsed.data;
    const { user, admin } = await requireTenantAccess(tenantId, request);
    const { data: current } = await admin.from('outreach_sequences').select('requires_approval, approved_at, segment_id')
      .eq('tenant_id', tenantId).eq('id', sequenceId).maybeSingle();
    if (!current) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    if (status === 'active' && !current.segment_id) {
      return NextResponse.json({ error: 'Select a saved audience before activating this sequence' }, { status: 409 });
    }
    if (status === 'active' && current.requires_approval && !current.approved_at && !approve) {
      return NextResponse.json({ error: 'This sequence requires approval before activation' }, { status: 409 });
    }
    const updates = approve
      ? { status, approved_by: user.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      : status === 'pending_approval'
      ? { status, updated_at: new Date().toISOString() }
      : status === 'active' && !current.requires_approval
        ? { status, approved_by: user.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        : { status, updated_at: new Date().toISOString() };
    const { data, error } = await admin.from('outreach_sequences').update(updates)
      .eq('tenant_id', tenantId).eq('id', sequenceId).select('*').single();
    if (error) throw error;
    const enrollment = status === 'active' && current.segment_id ? await enrollSequenceAudience(admin, tenantId, sequenceId, current.segment_id) : null;
    return NextResponse.json({ success: true, sequence: data, enrollment });
  } catch (error) {
    return routeErrorResponse(error, 'Outreach sequence could not be updated', request);
  }
}
