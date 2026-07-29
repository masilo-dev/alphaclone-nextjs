import { NextRequest, NextResponse } from 'next/server';
import { start } from "workflow/api";
import { processScheduledAiTasks } from "@/workflows/cron-workflows";
<<<<<<< HEAD
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
=======
>>>>>>> origin/main

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
<<<<<<< HEAD
  const denied = denyIfCronUnauthorized(request);
  if (denied) return denied;
=======
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // For testing purposes, we might allow bypassing this if in development
  if (process.env.NODE_ENV !== 'development') {
    if (!cronSecret || authHeader !== `Bearer \${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
>>>>>>> origin/main

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
