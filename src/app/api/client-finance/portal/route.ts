import { NextRequest, NextResponse } from 'next/server';
import { resolveSupabaseAdminClient } from '@/lib/supabase-admin';
import { getClientFinancePortalData } from '@/services/finance/clientFinancePortalService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')?.trim();
    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    const admin = await resolveSupabaseAdminClient();
    const data = await getClientFinancePortalData(admin, token, req.nextUrl.origin);

    if (!data) {
      return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, portal: data });
  } catch (error) {
    console.error('[client-finance/portal]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load portal' },
      { status: 500 }
    );
  }
}
