import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const tenantId = String(body.tenantId || '').trim();
    const niche = String(body.niche || '').trim();
    const location = String(body.location || '').trim();
    const sortBy = String(body.sortBy || 'default');
    const usePlaywright = Boolean(body.usePlaywright);

    if (!tenantId || !niche) {
      return NextResponse.json({ error: 'tenantId and niche are required' }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Not a tenant member' }, { status: 403 });

    const { data: job, error } = await supabase
      .from('lead_search_jobs')
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        niche,
        location,
        sort_by: sortBy,
        use_playwright: usePlaywright,
        status: 'pending',
        progress: 5,
        current_step: 'init',
      })
      .select('*')
      .single();

    if (error) return clientErrorResponse(error, { request: req, scope: 'scraper/jobs/create.POST' });
    return NextResponse.json({ success: true, job });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'scraper/jobs/create.POST' });
  }
}
