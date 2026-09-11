import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { executeSingleBonnieTool } from '@/lib/bonnie/executeSingleBonnieTool';
import { assertBonnieDirectToolAllowed } from '@/lib/security/bonnieToolAllowlist';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, tool, args, policySource } = body;

    if (!tenantId || !tool) {
      return NextResponse.json({ error: 'Missing tenantId or tool' }, { status: 400 });
    }

    const { user } = await requireTenantAccess(tenantId);
    assertBonnieDirectToolAllowed(String(tool));
    const result = await executeSingleBonnieTool({
      tenantId,
      userId: user.id,
      tool: String(tool),
      args: args || {},
      policySource: policySource || 'bonnie',
    });

    return NextResponse.json({ success: result.success, result });
  } catch (error) {
    return routeErrorResponse(error, 'Bonnie tool execution failed');
  }
}
