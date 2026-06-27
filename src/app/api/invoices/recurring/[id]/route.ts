import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, createAdminSupabaseClientOrThrow, routeErrorResponse } from '@/lib/apiAuth';
import {
  deleteRecurringProfile,
  generateFromRecurringProfile,
  listRecurringProfiles,
  updateRecurringProfile,
} from '@/services/finance/recurringInvoiceService';

const patchSchema = z.object({
  tenantId: z.string().uuid(),
  clientId: z.string().uuid().optional().nullable(),
  clientName: z.string().min(1).optional(),
  clientEmail: z.string().email().optional().nullable(),
  amount: z.number().positive().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  lineItems: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number().min(0),
        rate: z.number().min(0),
      })
    )
    .optional(),
  taxRate: z.number().min(0).max(100).optional(),
  paymentTermsDays: z.number().int().min(1).max(365).optional(),
  autoSend: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    await requireTenantAccess(parsed.data.tenantId);
    const admin = createAdminSupabaseClientOrThrow();
    await updateRecurringProfile(admin, parsed.data.tenantId, id, parsed.data);

    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to update recurring invoice', req);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();
    await deleteRecurringProfile(admin, tenantId, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to delete recurring invoice', req);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const tenantId = String(body.tenantId || '').trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();
    const profiles = await listRecurringProfiles(admin, tenantId);
    const profile = profiles.find((p) => p.id === id);
    if (!profile) {
      return NextResponse.json({ error: 'Recurring profile not found' }, { status: 404 });
    }

    const result = await generateFromRecurringProfile(admin, profile);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to generate invoice', req);
  }
}
