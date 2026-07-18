import { NextRequest, NextResponse } from 'next/server';
import { ZohoService } from '../../../../../services/zoho/ZohoService';
import { requireTenantAccess } from '@/lib/apiAuth';

function tokenNeedsRefresh(expiryDate: string | undefined, force: boolean): boolean {
  if (force) return true;
  if (!expiryDate) return true;
  const expiresAt = new Date(expiryDate).getTime();
  if (Number.isNaN(expiresAt)) return true;
  return Date.now() + 5 * 60 * 1000 >= expiresAt;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const force = body?.force === true;

  try {
    const tenantId = String(body?.tenantId || '').trim();
    const { user } = await requireTenantAccess(tenantId, req);
    const zohoService = new ZohoService(user.id, tenantId);
    const config = await zohoService.getConfig();
    if (!config?.refreshToken) {
      return NextResponse.json(
        { success: false, error: 'Zoho is not connected.', reconnect: true },
        { status: 400 }
      );
    }

    if (!tokenNeedsRefresh(config.expiryDate, force)) {
      return NextResponse.json({ success: true, refreshed: false });
    }

    const token = await zohoService.refreshAccessToken();
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not refresh Zoho token. Reconnect Zoho if this keeps happening.',
          reconnect: true,
        },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true, refreshed: true });
  } catch (err: unknown) {
    console.error('[Zoho Refresh] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to refresh Zoho token',
        reconnect: true,
      },
      { status: 500 }
    );
  }
}
