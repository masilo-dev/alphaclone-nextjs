import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess } from '@/lib/apiAuth';
import { searchFacebookLeads } from '@/services/facebookLeadSearchService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = String(searchParams.get('tenantId') || '').trim();
    const query = String(searchParams.get('q') || searchParams.get('query') || '').trim();

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'tenantId is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const result = await searchFacebookLeads(tenantId, query);

    return NextResponse.json({
      success: true,
      query,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Search failed' }, { status: 500 });
  }
}
