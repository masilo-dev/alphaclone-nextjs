import { NextRequest, NextResponse } from 'next/server';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { ImportJobService } from '@/services/importJobService';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin', 'member'], req);

    const job = await ImportJobService.getJobStatus(id, tenantId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, job });
  } catch (error: any) {
    return routeErrorResponse(error, 'Failed to fetch import job');
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenantId || body.tenant_id;
    const action = body.action; // 'cancel' | 'resume'

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);

    if (action === 'cancel') {
      const cancelled = await ImportJobService.cancelJob(id, tenantId);
      return NextResponse.json({ success: true, job: cancelled, message: 'Job cancelled' });
    }

    if (action === 'resume') {
      const resumed = await ImportJobService.resumeJob(id, tenantId);
      return NextResponse.json({ success: true, job: resumed, message: 'Job resumed' });
    }

    return NextResponse.json({ error: 'Invalid action. Supported actions: cancel, resume' }, { status: 400 });
  } catch (error: any) {
    return routeErrorResponse(error, 'Failed to update import job');
  }
}
