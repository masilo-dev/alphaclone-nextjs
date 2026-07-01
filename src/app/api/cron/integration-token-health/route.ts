import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { runSlackTokenHealthCheck } from '@/services/slack/slackIntegrationService';
import { runMicrosoftTokenHealthCheck } from '@/services/microsoft/microsoftConnectionService';
import { runGoogleCalendarTokenHealthCheck } from '@/services/google/googleCalendarIntegrationService';
import { runFacebookTokenHealthCheck } from '@/services/facebook/facebookIntegrationService';
import { runLinkedInTokenHealthCheck } from '@/services/linkedin/linkedinIntegrationService';

export const dynamic = 'force-dynamic';

/**
 * Daily token health for integrations without dedicated crons.
 */
export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    const [slack, microsoft, googleCalendar, facebook, linkedin] = await Promise.all([
      runSlackTokenHealthCheck(50).catch((e) => ({ error: String(e) })),
      runMicrosoftTokenHealthCheck(50).catch((e) => ({ error: String(e) })),
      runGoogleCalendarTokenHealthCheck(50).catch((e) => ({ error: String(e) })),
      runFacebookTokenHealthCheck(50).catch((e) => ({ error: String(e) })),
      runLinkedInTokenHealthCheck(50).catch((e) => ({ error: String(e) })),
    ]);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      slack,
      microsoft,
      googleCalendar,
      facebook,
      linkedin,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
