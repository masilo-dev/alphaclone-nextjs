import { NextRequest, NextResponse } from 'next/server';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { z } from 'zod';

const querySchema = z.object({
  tenantId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  grade: z.string().trim().max(20).optional(),
  status: z.string().trim().max(40).optional(),
  hasEmail: z.coerce.boolean().optional(),
  location: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export async function GET(req: NextRequest) {
  try {
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { tenantId, campaignId, minScore, grade, status, hasEmail, location, page, limit } = parsed.data;

    const { admin: supabase } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'member', 'super_admin'], req);

    let query = supabase
      .from('scraper_leads')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('score', { ascending: false });

    if (campaignId) query = query.eq('campaign_id', campaignId);
    if (minScore !== undefined) query = query.gte('score', minScore);
    if (grade) query = query.eq('grade', grade);
    if (status) query = query.eq('status', status);
    if (hasEmail) query = query.not('email', 'is', null).neq('email', '');
    if (location) {
      const pattern = `%${location.replace(/[%_]/g, '')}%`;
      query = query.or(
        `company.ilike.${pattern},industry.ilike.${pattern},source_label.ilike.${pattern},name.ilike.${pattern}`
      );
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    const total = count || 0;
    const pages = Math.max(1, Math.ceil(total / limit));
    return NextResponse.json({
      leads: data || [],
      pagination: { page, limit, total, pages },
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to list scraper leads');
  }
}
