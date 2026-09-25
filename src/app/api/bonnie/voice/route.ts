import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { requireTenantAccess } from '@/lib/apiAuth';
import { runBonnieVoiceAgent } from '@/lib/bonnie/bonnieVoiceAgent';
import { resolveBonnieModuleFromPath } from '@/lib/bonnie/bonnieToolCatalog';

export async function POST(req: NextRequest) {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const tenantId = String(body.tenantId || '').trim();
    const transcript = String(body.transcript || body.text || '').trim();
    const pathname = body.pathname ? String(body.pathname) : undefined;
    const history = Array.isArray(body.history) ? body.history : [];

    if (!tenantId || !transcript) {
      return NextResponse.json({ error: 'tenantId and transcript required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);

    const result = await runBonnieVoiceAgent({
      tenantId,
      userId: user.id,
      transcript,
      pathname,
      moduleContext: resolveBonnieModuleFromPath(pathname || ''),
      history: history
        .filter((m: any) => m?.role && m?.content)
        .slice(-8)
        .map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content),
        })),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Voice agent failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
