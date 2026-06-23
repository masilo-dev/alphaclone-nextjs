import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resolvePublicProject(tokenOrId: string) {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('id, name, is_public')
    .or(`portal_token.eq.${tokenOrId},id.eq.${tokenOrId}`)
    .eq('is_public', true)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const project = await resolvePublicProject(token);
  if (!project) {
    return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('project_comments')
    .select('id, author_name, author_email, content, is_client, created_at')
    .eq('project_id', project.id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, comments: data || [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const project = await resolvePublicProject(token);
  if (!project) {
    return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const authorName = String(body.authorName || '').trim();
  const content = String(body.content || '').trim();
  const authorEmail = body.authorEmail ? String(body.authorEmail).trim() : null;
  const isClient = body.isClient !== false;

  if (!authorName || !content) {
    return NextResponse.json({ success: false, error: 'Name and message are required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('project_comments')
    .insert({
      project_id: project.id,
      author_name: authorName,
      author_email: authorEmail,
      content,
      is_client: isClient,
    })
    .select('id, author_name, author_email, content, is_client, created_at')
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, comment: data });
}
