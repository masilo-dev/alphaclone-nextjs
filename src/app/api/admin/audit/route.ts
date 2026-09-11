import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requirePlatformSuperAdmin, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requirePlatformSuperAdmin();
    const admin = createSupabaseAdminClient();

    const searchParams = req.nextUrl.searchParams;
    const action = searchParams.get('action')?.trim();
    const actorUserId = searchParams.get('actorUserId')?.trim();
    const resourceId = searchParams.get('resourceId')?.trim();
    const search = searchParams.get('search')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const offset = (page - 1) * limit;

    let query = admin
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (action) {
      query = query.eq('action', action);
    }
    if (actorUserId) {
      query = query.eq('user_id', actorUserId);
    }
    if (resourceId) {
      query = query.eq('resource_id', resourceId);
    }
    if (search) {
      query = query.or(`action.ilike.%${search}%,resource_type.ilike.%${search}%,actor_type.ilike.%${search}%`);
    }

    const { data: logs, count, error } = await query;
    if (error) throw error;

    // Filter out any potential sensitive metadata keys
    const sanitizedLogs = (logs || []).map((log: Record<string, any>) => {
      const meta = log.metadata || {};
      const cleanMeta: Record<string, any> = {};
      for (const [k, v] of Object.entries(meta)) {
        if (!/token|secret|password|key|hash|cookie|credential/i.test(k)) {
          cleanMeta[k] = v;
        }
      }
      return {
        ...log,
        metadata: cleanMeta,
      };
    });

    return NextResponse.json({
      success: true,
      logs: sanitizedLogs,
      total: count || 0,
      page,
      limit,
    });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
