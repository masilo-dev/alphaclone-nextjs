import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { buildIlikeOrFilter } from '@/lib/db/postgrestFilters';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().optional(),
  search: z.string().trim().max(200).optional(),
  stage: z.string().trim().max(100).optional(),
  status: z.string().trim().max(100).optional(),
});

type LeadCursor = { createdAt: string; id: string };

function decodeCursor(value?: string): LeadCursor | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64').toString('utf8')) as LeadCursor;
    if (!decoded?.createdAt || !decoded?.id) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid lead query', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { limit, search, stage, status } = parsed.data;
    const cursor = decodeCursor(parsed.data.cursor);
    const admin = createSupabaseAdminClient();

    let query = admin
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .is('client_id', null)
      .neq('stage', 'converted');

    if (stage) query = query.eq('stage', stage);
    if (status) query = query.eq('status', status);
    if (search) {
      const filter = buildIlikeOrFilter(['business_name', 'email', 'phone', 'industry', 'location'], search);
      if (filter) query = query.or(filter);
    }

    if (cursor) {
      // Descending keyset: records older than the cursor timestamp, plus records at
      // the same timestamp whose UUID sorts below the cursor UUID.
      query = query.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
      );
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    if (error) throw error;
    const rows = data || [];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    return NextResponse.json({
      leads: page,
      pageInfo: {
        hasMore,
        total: count || 0,
        nextCursor: hasMore && last ? { createdAt: last.created_at, id: last.id } : null,
      },
    });
  } catch (error) {
    return routeErrorResponse(error, 'Leads could not be loaded', req);
  }
}
