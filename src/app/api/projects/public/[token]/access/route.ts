import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  evaluatePortalAccess,
  resolvePortalProject,
  toPublicProjectView,
} from '@/lib/projects/portalAccess';
import { routeErrorResponse } from '@/lib/apiAuth';

type RouteContext = { params: Promise<{ token: string }> };

function passwordFromRequest(req: NextRequest, body?: { password?: string }): string | undefined {
  const header = req.headers.get('x-portal-password')?.trim();
  const query = req.nextUrl.searchParams.get('password')?.trim();
  const fromBody = body?.password?.trim();
  return fromBody || header || query || undefined;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const admin = createSupabaseAdminClient();
    const { project, error } = await resolvePortalProject(admin, token);

    if (error || !project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const password = passwordFromRequest(req);
    const access = evaluatePortalAccess(project, password);
    const requiresPassword = Boolean(project.portal_password_hash);
    const expired = access.ok === false && access.reason === 'expired';

    if (!access.ok) {
      return NextResponse.json({
        success: false,
        expired,
        requiresPassword,
        projectName: project.name,
        error:
          access.reason === 'expired'
            ? 'This client link has expired'
            : access.reason === 'password_invalid'
              ? 'Incorrect password'
              : access.reason === 'password_required'
                ? 'Password required'
                : 'Project not found',
      }, { status: access.reason === 'password_required' ? 401 : access.reason === 'password_invalid' ? 403 : 410 });
    }

    const { data: milestones } = await admin
      .from('milestones')
      .select('id, name, status, due_date, description')
      .eq('project_id', project.id)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      success: true,
      expired: false,
      requiresPassword: false,
      project: toPublicProjectView(project),
      projectId: project.id,
      milestones: milestones || [],
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load project portal', req);
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const body = await req.json().catch(() => ({}));
    const admin = createSupabaseAdminClient();
    const { project, error } = await resolvePortalProject(admin, token);

    if (error || !project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const password = passwordFromRequest(req, body);
    const access = evaluatePortalAccess(project, password);

    if (!access.ok) {
      return NextResponse.json({
        success: false,
        expired: access.reason === 'expired',
        requiresPassword: access.reason === 'password_required' || access.reason === 'password_invalid',
        error:
          access.reason === 'expired'
            ? 'This client link has expired'
            : access.reason === 'password_invalid'
              ? 'Incorrect password'
              : 'Password required',
      }, { status: access.reason === 'password_invalid' ? 403 : access.reason === 'expired' ? 410 : 401 });
    }

    return NextResponse.json({ success: true, project: toPublicProjectView(project), projectId: project.id });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to verify portal access', req);
  }
}
