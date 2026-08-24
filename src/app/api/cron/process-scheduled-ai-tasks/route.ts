import { NextRequest, NextResponse } from 'next/server';
import { start } from "workflow/api";
import { processScheduledAiTasks } from "@/workflows/cron-workflows";
import { denyIfCronUnauthorized } from '@/lib/cronAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = denyIfCronUnauthorized(request);
  if (denied) return denied;

  try {
    const { runId } = await start(processScheduledAiTasks);
    
    return NextResponse.json({
      success: true,
      runId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Workflow trigger failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to start workflow' }, { status: 500 });
  }
}
