import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const adminRoles = ['owner', 'admin', 'tenant_admin', 'super_admin'];
const stepSchema = z.object({ step_name: z.string().trim().min(1).max(120), step_description: z.string().trim().max(1000).nullable().optional(), step_order: z.number().int().min(1).max(100), step_type: z.enum(['form', 'contract', 'payment', 'upload']), is_required: z.boolean() });
const postSchema = z.object({ steps: z.array(stepSchema).min(1).max(20) });
const patchSchema = z.object({ submissionId: z.string().uuid(), status: z.enum(['approved', 'pending', 'rejected']) });
const deleteSchema = z.object({ stepId: z.string().uuid() });

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { admin } = await requireTenantAccess(tenantId, req);
    const [{ data: steps, error: stepsError }, { data: contacts, error: contactsError }] = await Promise.all([
      admin.from('onboarding_steps').select('*').eq('tenant_id', tenantId).order('step_order', { ascending: true }),
      admin.from('contacts').select('id').eq('tenant_id', tenantId),
    ]);
    if (stepsError) throw stepsError;
    if (contactsError) throw contactsError;
    const contactIds = (contacts || []).map((contact: any) => contact.id);
    let submissions: unknown[] = [];
    if (contactIds.length) {
      const result = await admin.from('onboarding_submissions').select('*, contacts(first_name, last_name, email), onboarding_steps(*)').in('contact_id', contactIds).order('created_at', { ascending: false });
      if (result.error) throw result.error;
      submissions = result.data || [];
    }
    return NextResponse.json({ steps: steps || [], submissions });
  } catch (error) {
    return routeErrorResponse(error, 'Onboarding data could not be loaded', req);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, adminRoles, req);
    const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid onboarding steps', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('onboarding_steps').insert(parsed.data.steps.map((step: any) => ({ ...step, tenant_id: tenantId, step_description: step.step_description || null }))).select('*');
    if (error) throw error;
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'onboarding_steps_created', payload: { stepIds: (data || []).map((step: any) => step.id), actorUserId: user.id } });
    return NextResponse.json({ steps: data || [] }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Onboarding steps could not be created', req);
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, adminRoles, req);
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid submission review' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data: submission, error: lookupError } = await admin.from('onboarding_submissions').select('id, contact_id, onboarding_steps!inner(tenant_id)').eq('id', parsed.data.submissionId).eq('onboarding_steps.tenant_id', tenantId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    const { data, error } = await admin.from('onboarding_submissions').update({ status: parsed.data.status, completed_at: parsed.data.status === 'approved' ? new Date().toISOString() : null }).eq('id', submission.id).select('*').single();
    if (error) throw error;
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'onboarding_submission_reviewed', payload: { submissionId: data.id, status: parsed.data.status, actorUserId: user.id } });
    return NextResponse.json({ submission: data });
  } catch (error) {
    return routeErrorResponse(error, 'Onboarding submission could not be reviewed', req);
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, adminRoles, req);
    const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid onboarding step' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('onboarding_steps').delete().eq('id', parsed.data.stepId).eq('tenant_id', tenantId).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Onboarding step not found' }, { status: 404 });
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'onboarding_step_deleted', payload: { stepId: data.id, actorUserId: user.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Onboarding step could not be deleted', req);
  }
}
