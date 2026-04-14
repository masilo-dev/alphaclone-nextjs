import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: job, error } = await supabase
      .from('lead_search_jobs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) return clientErrorResponse(error, { request: req, scope: 'scraper/jobs/[id].GET' });
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    return NextResponse.json({ success: true, job });
  } catch (err: unknown) {
    return clientErrorResponse(err, { request: req, scope: 'scraper/jobs/[id].GET' });
  }
}
