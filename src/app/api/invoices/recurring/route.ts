import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, createAdminSupabaseClientOrThrow, routeErrorResponse } from '@/lib/apiAuth';
import {
  createRecurringProfile,
  listGeneratedInvoices,
  listRecurringProfiles,
} from '@/services/finance/recurringInvoiceService';

const createSchema = z.object({
  tenantId: z.string().uuid(),
  clientId: z.string().uuid().optional().nullable(),
  clientName: z.string().min(1),
  clientEmail: z.string().email().optional().nullable(),
  amount: z.number().positive(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  startDate: z.string(),
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

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim();
    const profileId = req.nextUrl.searchParams.get('profileId')?.trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    if (profileId) {
      const generated = await listGeneratedInvoices(admin, tenantId, profileId);
      return NextResponse.json({ success: true, generated });
    }

    const profiles = await listRecurringProfiles(admin, tenantId);
    return NextResponse.json({ success: true, profiles });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load recurring invoices', req);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const input = parsed.data;
    await requireTenantAccess(input.tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    const profile = await createRecurringProfile(admin, input.tenantId, {
      clientId: input.clientId,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      amount: input.amount,
      frequency: input.frequency,
      startDate: input.startDate,
      endDate: input.endDate,
      description: input.description,
      lineItems: input.lineItems || [],
      taxRate: input.taxRate ?? 0,
      paymentTermsDays: input.paymentTermsDays ?? 14,
      autoSend: input.autoSend ?? true,
      active: input.active ?? true,
    });

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to create recurring invoice', req);
  }
}
