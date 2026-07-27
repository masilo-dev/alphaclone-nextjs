import { NextRequest, NextResponse } from 'next/server';
import { parseLinkedInLeadResponse, syncLinkedInLeadToCrm } from '@/lib/linkedin/leadGenSync';
import { DEFAULT_TENANT_ID } from '@/lib/tenant/defaultTenant';

/**
 * GET handler for LinkedIn Webhook URL Verification Challenge
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const challenge = searchParams.get('challenge') || searchParams.get('hub.challenge');

  if (challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({
    status: 'active',
    service: 'AlphaClone LinkedIn Lead Gen Webhook',
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST handler for LinkedIn Lead Gen Form real-time notifications
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId') || DEFAULT_TENANT_ID;

    const payload = await req.json();

    // Check if payload contains lead notifications
    const leadEvents = Array.isArray(payload) ? payload : [payload];
    const results = [];

    for (const event of leadEvents) {
      if (!event || typeof event !== 'object') continue;

      const parsedLead = parseLinkedInLeadResponse(event);
      const syncResult = await syncLinkedInLeadToCrm(tenantId, parsedLead);
      results.push(syncResult);
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error('[LinkedInLeadWebhook] Processing error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process LinkedIn lead webhook' },
      { status: 500 }
    );
  }
}
