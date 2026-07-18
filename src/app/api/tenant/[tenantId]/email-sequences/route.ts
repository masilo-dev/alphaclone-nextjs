import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const schema = z.object({ name: z.string().trim().min(1).max(200), steps: z.array(z.object({ delayDays: z.coerce.number().int().min(0).max(3650), subject: z.string().trim().min(1).max(500), body: z.string().max(50000) })).min(1).max(100) });

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const sequenceId = req.nextUrl.searchParams.get('sequenceId');
    const admin = createSupabaseAdminClient();
    if (sequenceId) {
      if (!z.string().uuid().safeParse(sequenceId).success) return NextResponse.json({ error: 'Valid sequenceId required' }, { status: 400 });
      const { data: sequence, error } = await admin.from('email_sequences').select('id, name, created_at').eq('tenant_id', tenantId).eq('id', sequenceId).maybeSingle();
      if (error) throw error;
      if (!sequence) return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
      const { data: steps, error: stepError } = await admin.from('email_sequence_steps').select('*').eq('sequence_id', sequenceId).order('delay_days');
      if (stepError) throw stepError;
      return NextResponse.json({ sequence: { ...sequence, steps: steps || [] } });
    }
    const { data, error } = await admin.from('email_sequences').select('id, name, created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ sequences: data || [] });
  } catch (error) { return routeErrorResponse(error, 'Email sequences could not be loaded', req); }
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Sequence name and at least one complete step are required', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data: sequence, error } = await admin.from('email_sequences').insert({ tenant_id: tenantId, name: parsed.data.name }).select('*').single();
    if (error) throw error;
    const { error: stepError } = await admin.from('email_sequence_steps').insert(parsed.data.steps.map((step) => ({ sequence_id: sequence.id, delay_days: step.delayDays, subject: step.subject, body: step.body })));
    if (stepError) { await admin.from('email_sequences').delete().eq('tenant_id', tenantId).eq('id', sequence.id); throw stepError; }
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'email_sequence_created', payload: { sequenceId: sequence.id, actorUserId: user.id, stepCount: parsed.data.steps.length } });
    return NextResponse.json({ sequence }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Email sequence could not be created', req); }
}
