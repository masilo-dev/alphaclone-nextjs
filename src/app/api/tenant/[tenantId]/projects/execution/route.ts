import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { bonnieProjectExecutionEngine } from '@/lib/bonnie/bonnieProjectExecutionEngine';
import { projectReminderEngine } from '@/services/projects/projectReminderEngine';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    const { user } = await requireTenantAccess(tenantId, req);
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || user.id;

    const brief = await projectReminderEngine.generateOwnerMorningBrief(tenantId, userId);
    return NextResponse.json({ success: true, brief });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to fetch project execution brief', req);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    await requireTenantAccess(tenantId, req);
    const body = await req.json();
    const { projectId, projectName } = body;

    const target = projectId || projectName;
    if (!target) {
      return NextResponse.json({ success: false, error: 'projectId or projectName required' }, { status: 400 });
    }

    const report = await bonnieProjectExecutionEngine.handleProjectCommand(tenantId, target);
    return NextResponse.json({ success: true, report });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to execute project command', req);
  }
}
