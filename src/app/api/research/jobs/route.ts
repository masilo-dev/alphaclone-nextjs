import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { researchService } from '@/lib/research/researchService';

const createJobSchema = z.object({
  tenantId: z.string().uuid(),
  query: z.string().trim().min(1, 'Query is required'),
  industry: z.string().trim().optional(),
  location: z.string().trim().optional(),
  targetCount: z.number().int().min(1).max(500).default(50),
  sources: z.array(z.string()).default(['public_websites', 'directories', 'osm']),
  qualificationRules: z.object({
    requireEmail: z.boolean().optional(),
    requirePhone: z.boolean().optional(),
    requireWebsite: z.boolean().optional(),
    targetIndustry: z.string().optional(),
    targetLocation: z.string().optional(),
    businessSize: z.enum(['small', 'medium', 'large', 'any']).optional(),
    ownerOperatedPreference: z.boolean().optional(),
    socialPresenceRequired: z.boolean().optional(),
    customInstructions: z.string().optional(),
    minScore: z.number().min(0).max(100).optional(),
  }).optional().default({}),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid parameters' }, { status: 400 });
    }

    const auth = await requireTenantAccess(parsed.data.tenantId, request);
    const job = await researchService.startResearchJob(
      parsed.data.tenantId,
      auth.user?.id || null,
      {
        query: parsed.data.query,
        industry: parsed.data.industry,
        location: parsed.data.location,
        targetCount: parsed.data.targetCount,
        sources: parsed.data.sources,
        qualificationRules: parsed.data.qualificationRules,
      }
    );

    return NextResponse.json({ success: true, job }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Research job could not be started', request);
  }
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId') || '';
    if (!z.string().uuid().safeParse(tenantId).success) {
      return NextResponse.json({ error: 'Valid tenantId is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId, request);
    const limit = Number(request.nextUrl.searchParams.get('limit') || 25);
    const jobs = await researchService.listResearchJobs(tenantId, { limit });

    return NextResponse.json({ success: true, jobs });
  } catch (error) {
    return routeErrorResponse(error, 'Research jobs could not be loaded', request);
  }
}
