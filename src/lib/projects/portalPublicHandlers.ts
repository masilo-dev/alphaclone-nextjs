import 'server-only';

import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  evaluatePortalAccess,
  resolvePortalProject,
  toPublicProjectView,
  type PortalProjectRow,
} from '@/lib/projects/portalAccess';

export function readPortalPassword(req: NextRequest, bodyPassword?: string): string | undefined {
  const header = req.headers.get('x-portal-password')?.trim();
  if (header) return header;
  const fromBody = typeof bodyPassword === 'string' ? bodyPassword.trim() : '';
  return fromBody || undefined;
}

export async function loadPublicPortalContext(
  admin: SupabaseClient,
  token: string,
  password?: string
) {
  const { project, error } = await resolvePortalProject(admin, token);
  if (error || !project) {
    return { ok: false as const, status: 404, body: { error: 'Project not found' } };
  }

  const access = evaluatePortalAccess(project, password);
  if (!access.ok) {
    if (access.reason === 'expired') {
      return { ok: false as const, status: 410, body: { expired: true, error: 'Link expired' } };
    }
    if (access.reason === 'password_required') {
      return {
        ok: false as const,
        status: 401,
        body: { requiresPassword: true, projectName: project.name },
      };
    }
    if (access.reason === 'password_invalid') {
      return { ok: false as const, status: 401, body: { requiresPassword: true, error: 'Invalid password' } };
    }
    return { ok: false as const, status: 404, body: { error: 'Project not found' } };
  }

  return { ok: true as const, project };
}

export async function loadPublicPortalPayload(admin: SupabaseClient, project: PortalProjectRow) {
  const { data: milestones } = await admin
    .from('project_milestones')
    .select('id, name, status, due_date, description, order_index')
    .eq('project_id', project.id)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true });

  return {
    projectId: project.id,
    project: toPublicProjectView(project),
    milestones: milestones || [],
  };
}
