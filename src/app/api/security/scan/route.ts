import { NextRequest, NextResponse } from 'next/server';
import { resolveMx } from 'node:dns/promises';
import { z } from 'zod';
import { assertSafeExternalHttpUrl } from '@/lib/security/externalUrl';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const inputSchema = z.object({ tenantId: z.string().uuid(), url: z.string().trim().min(3).max(2048) });

async function fetchHeaders(initial: URL): Promise<{ response: Response; finalUrl: URL }> {
  let current = initial;
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(current, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(12_000) });
    if (response.status < 300 || response.status >= 400) return { response, finalUrl: current };
    const location = response.headers.get('location');
    if (!location) return { response, finalUrl: current };
    current = await assertSafeExternalHttpUrl(new URL(location, current).toString());
  }
  throw new Error('The website redirected too many times');
}

function grade(score: number) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export async function POST(req: NextRequest) {
  try {
    const input = inputSchema.parse(await req.json());
    const { user } = await requireTenantAccess(input.tenantId);
    const normalized = /^https?:\/\//i.test(input.url) ? input.url : `https://${input.url}`;
    const safeUrl = await assertSafeExternalHttpUrl(normalized);
    const { response, finalUrl } = await fetchHeaders(safeUrl);
    const requiredHeaders = ['content-security-policy', 'strict-transport-security', 'x-content-type-options', 'x-frame-options'];
    const missingHeaders = requiredHeaders.filter(name => !response.headers.get(name));
    let mxReady = false;
    try { mxReady = (await resolveMx(finalUrl.hostname)).length > 0; } catch { mxReady = false; }
    const issues: string[] = [];
    let score = 100;
    if (finalUrl.protocol !== 'https:') { score -= 35; issues.push('Website does not enforce HTTPS'); }
    score -= missingHeaders.length * 10;
    issues.push(...missingHeaders.map(name => `Missing ${name} response header`));
    if (!mxReady) { score -= 5; issues.push('No MX mail record was found for the domain'); }
    if (!response.ok) { score -= 20; issues.push(`Website returned HTTP ${response.status}`); }
    score = Math.max(0, score);

    const result = {
      url: finalUrl.toString(),
      timestamp: new Date().toISOString(),
      score,
      grade: grade(score),
      checks: {
        ssl: { status: finalUrl.protocol === 'https:' ? 'pass' : 'fail', details: finalUrl.protocol === 'https:' ? 'HTTPS connection succeeded' : 'HTTPS is not enabled' },
        headers: { status: missingHeaders.length === 0 ? 'pass' : 'warning', details: missingHeaders.length ? `Missing: ${missingHeaders.join(', ')}` : 'Core browser security headers are present' },
        malware: { status: 'warning', details: 'Malware reputation was not assessed because no reputation provider is configured' },
        mail: { status: mxReady ? 'pass' : 'warning', details: mxReady ? 'Mail exchange records are configured' : 'No mail exchange record was found' },
      },
      issues,
    };
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from('security_scans').insert({
      tenant_id: input.tenantId, url: result.url, score, grade: result.grade, details: result,
    });
    if (error) throw error;
    await admin.from('business_automation_events').insert({
      tenant_id: input.tenantId, event_type: 'security_scan_completed', payload: { actorUserId: user.id, url: result.url, score },
    });
    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error, 'Website security scan could not be completed', req);
  }
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = z.string().uuid().parse(req.nextUrl.searchParams.get('tenantId'));
    const { admin } = await requireTenantAccess(tenantId);
    const { data, error } = await admin.from('security_scans').select('*')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ scans: data || [] });
  } catch (error) {
    return routeErrorResponse(error, 'Security scan history could not be loaded', req);
  }
}
