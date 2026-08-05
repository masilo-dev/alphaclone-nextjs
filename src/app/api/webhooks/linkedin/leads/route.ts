import { NextRequest, NextResponse } from 'next/server';
import { parseLinkedInLeadResponse, syncLinkedInLeadToCrm } from '@/lib/linkedin/leadGenSync';
import { DEFAULT_TENANT_ID } from '@/lib/tenant/defaultTenant';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getLinkedInAccessToken } from '@/services/linkedin/linkedinIntegrationService';
import { linkedInFetch } from '@/lib/linkedin/linkedinClient';

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
    const leadEvents = Array.isArray(payload) ? payload : [payload];
    const results = [];

    // Retrieve active integration token if needed for API resolution
    let cachedToken: string | null = null;

    for (const event of leadEvents) {
      if (!event || typeof event !== 'object') continue;

      let eventData = { ...event };
      const responseUrn = (event.leadFormResponseUrn || event.leadResponseUrn || event.responseUrn) as string | undefined;

      // If payload is only a notification URN without answers, attempt to fetch full details via REST API
      if (responseUrn && (!Array.isArray(event.answers) || event.answers.length === 0)) {
        try {
          if (!cachedToken) {
            const admin = createSupabaseAdminClient();
            const { data: activeRow } = await admin
              .from('linkedin_integrations')
              .select('*')
              .eq('tenant_id', tenantId)
              .eq('is_active', true)
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (activeRow) {
              cachedToken = await getLinkedInAccessToken(admin, activeRow);
            }
          }

          if (cachedToken) {
            const encodedUrn = encodeURIComponent(responseUrn);
            const res = await linkedInFetch(
              `https://api.linkedin.com/v2/adFormResponses/${encodedUrn}`,
              cachedToken,
              { method: 'GET' }
            );

            if (res.ok) {
              const fullDetails = await res.json();
              eventData = { ...eventData, ...fullDetails };
            }
          }
        } catch (fetchErr) {
          console.warn('[LinkedInLeadWebhook] Could not fetch lead response details:', fetchErr);
        }
      }

      const parsedLead = parseLinkedInLeadResponse(eventData);
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
