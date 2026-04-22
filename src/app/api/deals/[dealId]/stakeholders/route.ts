import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireAuthenticatedUser, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { quantumDealIntelligenceService } from '@/services/intelligence/quantumDealIntelligenceService';

export const dynamic = 'force-dynamic';

const addSchema = z.object({
  contactId: z.string().uuid(),
  role: z.enum(['decision_maker', 'influencer', 'champion', 'blocker', 'evaluator', 'legal', 'finance', 'user']),
  influenceWeight: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, context: { params: Promise<{ dealId: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { dealId } = await context.params;
    const body = await req.json();
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const admin = createAdminSupabaseClientOrThrow();
    const { data: deal, error: dealError } = await admin
      .from('deals')
      .select('tenant_id')
      .eq('id', dealId)
      .single();
    if (dealError || !deal?.tenant_id) {
      return NextResponse.json({ success: false, error: 'Deal not found' }, { status: 404 });
    }

    await requireTenantAccess(deal.tenant_id);

    const { error } = await admin.from('deal_stakeholders').upsert(
      {
        tenant_id: deal.tenant_id,
        deal_id: dealId,
        contact_id: parsed.data.contactId,
        role: parsed.data.role,
        influence_weight: parsed.data.influenceWeight ?? 0.5,
        notes: parsed.data.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,deal_id,contact_id,role' }
    );
    if (error) throw error;

    await quantumDealIntelligenceService.recomputeDeal(admin as any, deal.tenant_id, dealId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return routeErrorResponse(err, 'Failed to add stakeholder.', req);
  }
}

const deleteSchema = z.object({
  contactId: z.string().uuid(),
  role: z.enum(['decision_maker', 'influencer', 'champion', 'blocker', 'evaluator', 'legal', 'finance', 'user']).optional(),
});

export async function DELETE(req: NextRequest, context: { params: Promise<{ dealId: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { dealId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const admin = createAdminSupabaseClientOrThrow();
    const { data: deal, error: dealError } = await admin
      .from('deals')
      .select('tenant_id')
      .eq('id', dealId)
      .single();
    if (dealError || !deal?.tenant_id) {
      return NextResponse.json({ success: false, error: 'Deal not found' }, { status: 404 });
    }
    await requireTenantAccess(deal.tenant_id);

    let q = admin
      .from('deal_stakeholders')
      .delete()
      .eq('tenant_id', deal.tenant_id)
      .eq('deal_id', dealId)
      .eq('contact_id', parsed.data.contactId);
    if (parsed.data.role) q = q.eq('role', parsed.data.role);
    const { error } = await q;
    if (error) throw error;

    await quantumDealIntelligenceService.recomputeDeal(admin as any, deal.tenant_id, dealId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return routeErrorResponse(err, 'Failed to remove stakeholder.', req);
  }
}

