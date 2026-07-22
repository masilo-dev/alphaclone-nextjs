import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');
    const moduleKey = searchParams.get('module');
    const limit = Number(searchParams.get('limit') || 30);

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    const { admin: supabase } = await requireTenantAccess(tenantId);

    const { data, error } = await supabase
      .from('intelligence_snapshots')
      .select('created_at, overall_score, overall_confidence, module_scores')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
      .limit(Math.max(1, Math.min(limit, 180)));

    if (error) throw error;

    const points = (data || []).map((row: any) => {
      if (!moduleKey) {
        return {
          timestamp: row.created_at,
          score: Number(row.overall_score || 0),
          confidence: Number(row.overall_confidence || 0)
        };
      }
      const moduleRow = Array.isArray(row.module_scores)
        ? row.module_scores.find((moduleScore: any) => moduleScore.module === moduleKey)
        : null;
      return {
        timestamp: row.created_at,
        score: Number(moduleRow?.score || 0),
        confidence: Number(moduleRow?.confidence || 0)
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        tenantId,
        module: moduleKey || 'overall',
        points
      }
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to fetch intelligence trends');
  }
}
