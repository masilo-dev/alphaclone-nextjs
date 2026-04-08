import { NextRequest, NextResponse } from 'next/server';
import {
  RouteAuthError,
  createAdminSupabaseClientOrThrow,
  requireTenantAccess,
  routeErrorResponse,
} from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id') || searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId' },
        { status: 400 }
      );
    }

    await requireTenantAccess(tenantId);
    const supabase = createAdminSupabaseClientOrThrow();
    
    // Get recent scraping jobs for this tenant
    const { data: jobs, error } = await supabase
      .from('scraping_jobs')
      .select('id, url, status, leads_found, error_message, started_at, completed_at')
      .eq('tenant_id', tenantId)
      .order('started_at', { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch jobs' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      jobs: jobs || []
    });

  } catch (error) {
    if (error instanceof RouteAuthError) {
      return routeErrorResponse(error);
    }

    console.error('Playwright jobs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
