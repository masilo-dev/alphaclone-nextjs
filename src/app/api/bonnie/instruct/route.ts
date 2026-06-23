import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { runBonnieAgent } from '@/lib/bonnie/bonnieAgent';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = String(body.tenantId || '').trim();
    const instruction = String(body.instruction || '').trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const pathname = String(body.pathname || '').trim();
    const moduleContext = body.moduleContext ? String(body.moduleContext).trim() : undefined;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }
    if (!instruction) {
      return NextResponse.json({ error: 'instruction is required' }, { status: 400 });
    }

    const { user } = await requireTenantAccess(tenantId);
    const supabase = await createSupabaseServerClient();
    const { data: authUser } = await supabase.auth.getUser();
    const userId = authUser.user?.id || user.id;

    const result = await runBonnieAgent({
      tenantId,
      userId,
      instruction,
      pathname: pathname || undefined,
      moduleContext: moduleContext as any,
      history: history
        .filter((m: any) => m?.role && m?.content)
        .slice(-8)
        .map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content),
        })),
    });

    return NextResponse.json({
      success: result.success,
      response: result.response,
      provider: result.provider,
      model: result.model,
      toolsExecuted: result.toolResults.map((t) => ({
        tool: t.tool,
        success: t.success,
        summary: t.summary,
      })),
      logs: result.logs,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Bonnie agent failed');
  }
}
