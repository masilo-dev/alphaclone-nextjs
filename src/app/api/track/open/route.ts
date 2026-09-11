import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── Tracking pixel: 1×1 transparent GIF ──────────────────────────────────────
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/track/open?id={trackingId}
 * Embedded as <img src="..."> in every outreach email.
 * Records the open timestamp and returns the pixel — zero JS required.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trackingId = searchParams.get('id');

  if (trackingId) {
    try {
      const admin = adminSupabase();
      await admin
        .from('lead_outreach_log')
        .update({ status: 'opened', opened_at: new Date().toISOString() })
        .eq('tracking_id', trackingId)
        .in('status', ['sent', 'queued']); // don't downgrade 'replied'
    } catch (err) {
      console.warn('[Track] Could not update open status:', err);
    }
  }

  return new Response(PIXEL, {
    status: 200,
    headers: {
      'Content-Type':  'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma':        'no-cache',
      'Expires':       '0',
    },
  });
}
