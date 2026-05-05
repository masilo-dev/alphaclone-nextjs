import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { start } from "workflow/api";
import { socialPublishing } from "@/workflows/cron-workflows";

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  try {
    const { runId } = await start(socialPublishing);
    
    return NextResponse.json({
      success: true,
      runId,
      timestamp: new Date().toISOString()
    });
  } catch (err: unknown) {
    console.error('[cron/social-publish] failed to trigger workflow:', err);
    return NextResponse.json({ success: false, error: 'Failed to trigger workflow' }, { status: 500 });
  }
}
