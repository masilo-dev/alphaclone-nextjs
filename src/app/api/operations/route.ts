import { NextRequest, NextResponse } from 'next/server';
import { getApiAuthUser } from '@/lib/apiAuth';
import { OperationsService } from '@/services/operationsService';

export async function GET(req: NextRequest) {
  try {
    const authResult = await getApiAuthUser(req);
    if (!authResult || !authResult.user || !authResult.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId } = authResult;
    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'hud';

    if (view === 'hud') {
      const data = await OperationsService.getTodayHUD(tenantId);
      return NextResponse.json(data);
    }

    if (view === 'health') {
      const data = await OperationsService.getBusinessHealth(tenantId);
      return NextResponse.json(data);
    }

    if (view === 'work_records') {
      const status = searchParams.get('status') || undefined;
      const data = await OperationsService.getUniversalWorkRecords(tenantId, status);
      return NextResponse.json({ workRecords: data });
    }

    if (view === 'decisions') {
      const data = await OperationsService.getDecisionRecords(tenantId);
      return NextResponse.json({ decisions: data });
    }

    if (view === 'alamos') {
      const data = await OperationsService.getAlamosEvaluations(tenantId);
      return NextResponse.json({ evaluations: data });
    }

    if (view === 'failures') {
      const data = await OperationsService.getFailureRecords(tenantId);
      return NextResponse.json({ failures: data });
    }

    if (view === 'slas') {
      const data = await OperationsService.getCommunicationSLAs(tenantId);
      return NextResponse.json({ slas: data });
    }

    if (view === 'blockers') {
      const data = await OperationsService.getBlockers(tenantId);
      return NextResponse.json({ blockers: data });
    }

    if (view === 'ask_bonnie') {
      const query = searchParams.get('q') || 'What needs my attention today?';
      const result = await OperationsService.askBonnieOperations(tenantId, query);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown view parameter' }, { status: 400 });
  } catch (err: any) {
    console.error('[API /api/operations GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getApiAuthUser(req);
    if (!authResult || !authResult.user || !authResult.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId } = authResult;
    const body = await req.json();
    const action = body.action;

    if (action === 'create_work_record') {
      const data = await OperationsService.createWorkRecord({ ...body.payload, tenant_id: tenantId });
      return NextResponse.json({ success: true, data });
    }

    if (action === 'update_work_record_status') {
      const data = await OperationsService.updateWorkRecordStatus(tenantId, body.id, body.status, body.finalResult);
      return NextResponse.json({ success: true, data });
    }

    if (action === 'create_decision') {
      const data = await OperationsService.createDecisionRecord({ ...body.payload, tenant_id: tenantId });
      return NextResponse.json({ success: true, data });
    }

    if (action === 'evaluate_alamos') {
      const data = await OperationsService.evaluateALAMOS({ ...body.payload, tenant_id: tenantId });
      return NextResponse.json({ success: true, data });
    }

    if (action === 'create_failure') {
      const data = await OperationsService.createFailureRecord({ ...body.payload, tenant_id: tenantId });
      return NextResponse.json({ success: true, data });
    }

    if (action === 'create_sla') {
      const data = await OperationsService.createCommunicationSLA({ ...body.payload, tenant_id: tenantId });
      return NextResponse.json({ success: true, data });
    }

    if (action === 'update_sla_status') {
      const data = await OperationsService.updateSLAStatus(tenantId, body.id, body.status);
      return NextResponse.json({ success: true, data });
    }

    if (action === 'create_blocker') {
      const data = await OperationsService.createBlocker({ ...body.payload, tenant_id: tenantId });
      return NextResponse.json({ success: true, data });
    }

    if (action === 'resolve_blocker') {
      const data = await OperationsService.resolveBlocker(tenantId, body.id, body.resolutionNotes || '');
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ error: 'Invalid or missing action parameter' }, { status: 400 });
  } catch (err: any) {
    console.error('[API /api/operations POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
