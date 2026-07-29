import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
import { autonomousRunnerService } from '@/services/autonomousRunnerService';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = denyIfCronUnauthorized(request);
  if (denied) return denied;

  try {
    const result = await autonomousRunnerService.runOnce();
    if (result.success) {
      return NextResponse.json({
        success: true,
        runsEvaluated: result.runs?.length || 0,
        timestamp: new Date().toISOString(),
      });
    }
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
=======
import { start } from "workflow/api";
import { autonomousRunner } from "@/workflows/cron-workflows";

export async function GET(request: NextRequest) {
  // Check auth
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { runId } = await start(autonomousRunner);
    return NextResponse.json({ success: true, runId });
>>>>>>> origin/main
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Trigger failed' }, { status: 500 });
  }
}
