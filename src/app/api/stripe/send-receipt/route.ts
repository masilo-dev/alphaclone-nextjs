import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await requireAuthenticatedUser();
    return NextResponse.json(
      { error: 'Receipt sending is not yet implemented', code: 'NOT_IMPLEMENTED' },
      { status: 501 }
    );
  } catch (error) {
    return routeErrorResponse(error, 'Unauthorized', req);
  }
}
