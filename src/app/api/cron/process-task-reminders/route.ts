import { NextRequest, NextResponse } from 'next/server';
import { start } from "workflow/api";
import { processTaskReminders } from "@/workflows/cron-workflows";
<<<<<<< HEAD
import { denyIfCronUnauthorized } from '@/lib/cronAuth';

export const dynamic = 'force-dynamic';

async function runTaskReminders() {
    const { runId } = await start(processTaskReminders);
    return NextResponse.json({ success: true, runId });
}

export async function GET(req: NextRequest) {
    const denied = denyIfCronUnauthorized(req);
    if (denied) return denied;

    try {
        return await runTaskReminders();
    } catch (error) {
        console.error('[cron/process-task-reminders] failed to start workflow:', error);
        return NextResponse.json({ error: 'Failed to trigger workflow', code: 'CRON_FAILED' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const denied = denyIfCronUnauthorized(req);
    if (denied) return denied;

    try {
        return await runTaskReminders();
=======

function authorized(req: NextRequest): boolean {
    const headerSecret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '');
    const secret = process.env.CRON_SECRET;
    return Boolean(secret && headerSecret && headerSecret === secret);
}

export async function POST(req: NextRequest) {
    if (!authorized(req)) {
        return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    try {
        const { runId } = await start(processTaskReminders);
        return NextResponse.json({ success: true, runId });
>>>>>>> origin/main
    } catch (error) {
        console.error('[cron/process-task-reminders] failed to start workflow:', error);
        return NextResponse.json({ error: 'Failed to trigger workflow', code: 'CRON_FAILED' }, { status: 500 });
    }
}
