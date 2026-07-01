import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { runLinkedInTokenHealthCheck } from '@/services/linkedin/linkedinIntegrationService';

export const dynamic = 'force-dynamic';

/**
 * Deactivates expired/revoked LinkedIn integrations and reports tokens expiring within 7 days.
 */
export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    const result = await runLinkedInTokenHealthCheck(100);
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
