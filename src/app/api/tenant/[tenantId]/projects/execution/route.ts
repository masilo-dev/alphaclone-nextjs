import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { bonnieProjectExecutionEngine } from '@/lib/bonnie/bonnieProjectExecutionEngine';
import { projectReminderEngine } from '@/services/projects/projectReminderEngine';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || 'default-user';

    const brief = await projectReminderEngine.generateOwnerMorningBrief(tenantId, userId);
    return NextResponse.json({ success: true, brief });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch project execution brief' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    const body = await req.json();
    const { projectId, projectName } = body;

    const target = projectId || projectName;
    if (!target) {
      return NextResponse.json({ success: false, error: 'projectId or projectName required' }, { status: 400 });
    }

    const report = await bonnieProjectExecutionEngine.handleProjectCommand(tenantId, target);
    return NextResponse.json({ success: true, report });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to execute project command' }, { status: 500 });
  }
}
