import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const admin = createSupabaseAdminClient();

    const { data: project } = await admin
      .from('projects')
      .select('id, name, is_public, tenant_id')
      .eq('id', projectId)
      .maybeSingle();

    if (!project?.is_public) {
      return NextResponse.json({ error: 'Project not found or not public' }, { status: 404 });
    }

    const { data: comments, error } = await admin
      .from('project_comments')
      .select('id, author_name, author_email, content, is_client, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, comments: comments || [], projectName: project.name });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load comments' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await req.json();
    const authorName = String(body.authorName || body.author_name || '').trim();
    const authorEmail = String(body.authorEmail || body.author_email || '').trim();
    const content = String(body.content || '').trim();
    const isClient = body.isClient !== false;

    if (!authorName || !content) {
      return NextResponse.json({ error: 'authorName and content are required' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: project } = await admin
      .from('projects')
      .select('id, is_public, tenant_id')
      .eq('id', projectId)
      .maybeSingle();

    if (!project?.is_public) {
      return NextResponse.json({ error: 'Project not found or not public' }, { status: 404 });
    }

    const { data: comment, error } = await admin
      .from('project_comments')
      .insert({
        tenant_id: project.tenant_id,
        project_id: projectId,
        author_name: authorName,
        author_email: authorEmail || null,
        content,
        is_client: isClient,
      })
      .select('id, author_name, author_email, content, is_client, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, comment });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to post comment' },
      { status: 500 }
    );
  }
}
