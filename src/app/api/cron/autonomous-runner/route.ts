import { NextRequest, NextResponse } from 'next/server';
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
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Trigger failed' }, { status: 500 });
  }
}
