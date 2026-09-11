import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { resolveOrCreateCRMIdentity } from '@/lib/crm/resolveOrCreateCRMIdentity';

const createLeadSchema = z.object({
  tenantId: z.string().uuid(),
  businessName: z.string().trim().min(1).max(500),
  contactName: z.string().trim().max(500).optional(),
  email: z.string().trim().email().max(320).optional().or(z.literal('')),
  phone: z.string().trim().max(100).optional(),
  industry: z.string().trim().max(200).optional(),
  location: z.string().trim().max(500).optional(),
  website: z.string().trim().max(2000).optional(),
  source: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(5000).optional(),
  stage: z.string().trim().max(80).optional(),
  value: z.coerce.number().min(0).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createLeadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { tenantId, businessName, contactName, email, phone, industry, location, website, source, notes, stage, value, metadata } =
      parsed.data;

    const { admin, user } = await requireTenantRole(
      tenantId,
      ['owner', 'admin', 'tenant_admin', 'super_admin', 'member'],
      req,
    );

    const result = await resolveOrCreateCRMIdentity(
      {
        business_name: businessName,
        contact_name: contactName,
        email: email || null,
        phone: phone || null,
        industry: industry || null,
        location: location || null,
        website: website || null,
        notes: notes || null,
        owner_id: user.id,
        metadata: {
          ...(metadata || {}),
          ...(value != null ? { value } : {}),
          ...(stage ? { requested_stage: stage } : {}),
        },
      },
      tenantId,
      source || 'manual',
      { userId: user.id, supabase: admin },
    );

    const { data: lead, error } = await admin
      .from('leads')
      .select('*')
      .eq('id', result.lead_id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !lead) {
      return NextResponse.json(
        { success: false, error: error?.message || 'Lead not found after create' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      lead,
      created: result.created,
      matched_existing: result.matched_existing,
      match_reason: result.match_reason,
      possible_duplicate: result.possible_duplicate,
      dashboard_event_emitted: result.dashboard_event_emitted,
      event_id: result.event_id,
    });
  } catch (err) {
    return routeErrorResponse(err, undefined, req);
  }
}
