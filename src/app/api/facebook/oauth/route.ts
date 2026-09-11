import { NextRequest, NextResponse } from 'next/server';

/**
 * Legacy path referenced by older configs. Prefer /api/auth/facebook/connect?tenant_id=...
 */
export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenant_id');
  if (!tenantId?.trim()) {
    return NextResponse.json(
      { error: 'tenant_id is required. Use /api/auth/facebook/connect?tenant_id=<uuid>' },
      { status: 400 }
    );
  }
  const u = new URL(req.url);
  u.pathname = '/api/auth/facebook/connect';
  u.search = `tenant_id=${encodeURIComponent(tenantId.trim())}`;
  return NextResponse.redirect(u.toString());
}
