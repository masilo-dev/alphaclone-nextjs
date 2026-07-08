import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { evaluatePortalAccess, resolvePortalProject } from '@/lib/projects/portalAccess';
import { routeErrorResponse } from '@/lib/apiAuth';

function passwordFromRequest(req: NextRequest, body?: { password?: string }): string | undefined {
  const header = req.headers.get('x-portal-password')?.trim();
  const query = req.nextUrl.searchParams.get('password')?.trim();
  const fromBody = body?.password?.trim();
  return fromBody || header || query || undefined;
}

async function assertPortalAccess(req: NextRequest, token: string, body?: { password?: string }) {
  const admin = createSupabaseAdminClient();
  const { project, error } = await resolvePortalProject(admin, token);
  if (error || !project) {
    return { admin, project: null, error: 'Project not found', status: 404 as const };
  }

  const access = evaluatePortalAccess(project, passwordFromRequest(req, body));
  if (!access.ok) {
    const status = access.reason === 'expired' ? 410 : access.reason === 'password_invalid' ? 403 : 401;
    const message =
      access.reason === 'expired'
        ? 'This client link has expired'
        : access.reason === 'password_invalid'
          ? 'Incorrect password'
          : 'Password required';
    return { admin, project: null, error: message, status };
  }

  return { admin, project, error: null, status: 200 as const };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const gate = await assertPortalAccess(req, token);
    if (!gate.project) {
      return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
    }

    const { data, error } = await gate.admin
      .from('project_comments')
      .select('id, author_name, author_email, content, is_client, created_at')
      .eq('project_id', gate.project.id)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, comments: data || [], projectName: gate.project.name });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load comments', req);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
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

    const gate = await assertPortalAccess(req, token, body);
    if (!gate.project) {
      return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
    }

    const { data, error } = await gate.admin
      .from('project_comments')
      .insert({
        tenant_id: gate.project.tenant_id,
        project_id: gate.project.id,
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
    return routeErrorResponse(error, 'Failed to post comment', req);
  }
}
