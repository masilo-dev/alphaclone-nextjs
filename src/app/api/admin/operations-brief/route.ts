import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { isPlatformSuperAdmin } from '@/lib/quotas/resolveTenantForAiRequest';

export const runtime = 'nodejs';

type ErrorRow = {
  id?: string;
  message: string;
  severity?: string | null;
  url?: string | null;
  created_at?: string;
};

function buildOperationsBrief(logs: ErrorRow[]): string {
  if (logs.length === 0) {
    return 'No error telemetry was returned for the latest window. This does not prove the system is fault-free; it may mean logging is empty or not yet wired for some modules.';
  }
  const counts = new Map<string, number>();
  for (const row of logs) {
    const key = (row.message || 'Unknown').split('\n')[0].slice(0, 160);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const lines = top.map(([msg, n]) => `${n} occurrences: ${msg}`);
  return `Operations snapshot (latest ${logs.length} records)\n\nTop repeating signals:\n${lines.join('\n')}\n\nUse the recent table for URLs and timestamps. Escalate patterns that affect billing, auth, or data loss.`;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isPlatformSuperAdmin(supabase, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: logs, error } = await admin
    .from('error_logs')
    .select('id, message, severity, url, created_at, user_agent')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }

  const brief = buildOperationsBrief((logs as ErrorRow[]) || []);
  return NextResponse.json({
    brief,
    recent: (logs || []).slice(0, 30),
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await isPlatformSuperAdmin(supabase, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const title = String(body.title || '').trim();
    const area = String(body.area || '').trim();
    const impact = String(body.impact || '').trim();
    const steps = String(body.stepsToReproduce || '').trim();
    const expected = String(body.expectedBehavior || '').trim();

    if (!title || !area) {
      return NextResponse.json({ error: 'title and area are required' }, { status: 400 });
    }

    const message = [
      `[Incident] ${title}`,
      `Area: ${area}`,
      impact ? `Impact: ${impact}` : null,
      steps ? `Steps: ${steps}` : null,
      expected ? `Expected: ${expected}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from('error_logs').insert({
      message,
      severity: 'warning',
      user_id: user.id,
      url: area.slice(0, 500),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
