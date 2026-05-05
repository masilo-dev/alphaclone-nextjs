import { NextRequest, NextResponse } from 'next/server';
import { start } from "workflow/api";
import { processRecurringInvoices } from "@/workflows/cron-workflows";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { runId } = await start(processRecurringInvoices);
    
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
