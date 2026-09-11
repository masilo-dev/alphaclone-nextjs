import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { integratedIntelligenceService } from '@/services/intelligence/integratedIntelligenceService';

function drilldownByModule(snapshot: any, moduleKey: string) {
  const moduleRow = (snapshot.modules || []).find((m: any) => m.module === moduleKey);
  if (!moduleRow) return null;
  return {
    tenantId: snapshot.tenantId,
    generatedAt: snapshot.generatedAt,
    module: moduleRow,
    topActions: (moduleRow.recommendations || []).slice(0, 8),
    systemicRisks: (moduleRow.risks || []).slice(0, 8),
    overallScore: snapshot.overallScore,
    overallConfidence: snapshot.overallConfidence
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');
    const persist = searchParams.get('persist') === 'true';
    const moduleKey = searchParams.get('module');

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();
    const snapshot = await integratedIntelligenceService.generateSnapshot(supabase, tenantId, { persist });
    const data = moduleKey ? drilldownByModule(snapshot, moduleKey) : snapshot;

    if (moduleKey && !data) {
      return NextResponse.json({ error: `Unknown module: ${moduleKey}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to generate integrated intelligence snapshot');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      tenantId?: string;
      persist?: boolean;
      module?: string;
    };
    const tenantId = body.tenantId;
    const moduleKey = body.module;

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const supabase = createSupabaseAdminClient();
    const snapshot = await integratedIntelligenceService.generateSnapshot(supabase, tenantId, {
      persist: body.persist !== false
    });
    const data = moduleKey ? drilldownByModule(snapshot, moduleKey) : snapshot;

    if (moduleKey && !data) {
      return NextResponse.json({ error: `Unknown module: ${moduleKey}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to persist integrated intelligence snapshot');
  }
}
