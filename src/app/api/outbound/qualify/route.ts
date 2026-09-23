import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { qualifyLead, overrideQualification, getLatestQualification } from '@/lib/outbound/leadQualification';

const qualifySchema = z.object({
  tenantId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  icpId: z.string().uuid().optional(),
  campaignContext: z.string().max(500).optional(),
  profile: z.object({
    company_name: z.string().max(300).optional(),
    industry: z.string().max(200).optional(),
    location: z.string().max(300).optional(),
    company_size: z.number().int().nonnegative().optional(),
    revenue: z.number().nonnegative().optional(),
    website: z.string().max(500).optional(),
    domain: z.string().max(300).optional(),
    business_type: z.string().max(200).optional(),
    contact_name: z.string().max(300).optional(),
    job_title: z.string().max(300).optional(),
    email: z.string().email().optional(),
    social_links: z.record(z.string(), z.string()).optional(),
    technology_stack: z.array(z.string()).optional(),
    pain_points: z.array(z.string()).optional(),
    description: z.string().max(2000).optional(),
    notes: z.string().max(2000).optional(),
  }),
});

const overrideSchema = z.object({
  tenantId: z.string().uuid(),
  qualificationId: z.string().uuid(),
  newStatus: z.enum(['qualified', 'unqualified', 'review_required', 'disqualified']),
  reason: z.string().trim().min(1).max(500),
});

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId') || '';
    const leadId = request.nextUrl.searchParams.get('leadId') || undefined;
    const contactId = request.nextUrl.searchParams.get('contactId') || undefined;
    if (!z.string().uuid().safeParse(tenantId).success) {
      return NextResponse.json({ error: 'Valid tenantId required' }, { status: 400 });
    }
    await requireTenantAccess(tenantId, request);
    const qualification = await getLatestQualification(tenantId, { leadId, contactId });
    return NextResponse.json({ success: true, qualification });
  } catch (error) {
    return routeErrorResponse(error, 'Qualification could not be loaded', request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // Override mode
    if (body.qualificationId) {
      const parsed = overrideSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid override data', details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const { user } = await requireTenantAccess(parsed.data.tenantId, request);
      await overrideQualification(
        parsed.data.tenantId,
        parsed.data.qualificationId,
        user.id,
        parsed.data.newStatus,
        parsed.data.reason
      );
      return NextResponse.json({ success: true, overridden: true });
    }

    // Qualification mode
    const parsed = qualifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid qualification input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { user } = await requireTenantAccess(parsed.data.tenantId, request);
    const result = await qualifyLead(parsed.data, user.id);
    return NextResponse.json({ success: true, qualification: result }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Lead qualification failed', request);
  }
}
