import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

async function resolvePublicProject(tokenOrId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('projects')
    .select('id, name, is_public, tenant_id')
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
  try {
    const { token } = await params;
    const project = await resolvePublicProject(token);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('project_comments')
      .select('id, author_name, author_email, content, is_client, created_at')
      .eq('project_id', project.id)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      comments: data || [],
      projectName: project.name,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load comments' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const project = await resolvePublicProject(token);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const authorName = String(body.authorName || body.author_name || '').trim();
    const content = String(body.content || '').trim();
    const authorEmail = body.authorEmail || body.author_email
      ? String(body.authorEmail || body.author_email).trim()
      : null;
    const isClient = body.isClient !== false;

    if (!authorName || !content) {
      return NextResponse.json({ success: false, error: 'Name and message are required' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('project_comments')
      .insert({
        tenant_id: project.tenant_id,
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
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to post comment' },
      { status: 500 }
    );
  }
}
