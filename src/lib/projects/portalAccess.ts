import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyPortalPassword } from '@/lib/projects/portalPassword';

export interface PortalProjectRow {
  id: string;
  tenant_id: string;
  name: string;
  category: string | null;
  status: string | null;
  current_stage: string | null;
  progress: number | null;
  due_date: string | null;
  owner_name: string | null;
  image: string | null;
  description: string | null;
  portal_token: string | null;
  portal_password_hash: string | null;
  portal_expires_at: string | null;
  is_public: boolean | null;
  portal_enabled?: boolean | null;
}

export type PortalAccessDenyReason = 'expired' | 'password_required' | 'password_invalid' | 'not_found';

export function isPortalExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

export async function resolvePortalProject(
  admin: SupabaseClient,
  tokenOrId: string
): Promise<{ project: PortalProjectRow | null; error: string | null }> {
  const { data, error } = await admin
    .from('projects')
    .select(
      'id, tenant_id, name, category, status, current_stage, progress, due_date, owner_name, image, description, portal_token, portal_password_hash, portal_expires_at, is_public, portal_enabled'
    )
    .eq('is_public', true)
    .eq('portal_enabled', true)
    .eq('portal_token', tokenOrId)
    .maybeSingle();

  if (error || !data) {
    return { project: null, error: error?.message || 'Project not found' };
  }

  return { project: data as PortalProjectRow, error: null };
}

export function evaluatePortalAccess(
  project: PortalProjectRow,
  password?: string
): { ok: true } | { ok: false; reason: PortalAccessDenyReason } {
  if (!project.is_public || !project.portal_enabled || !project.portal_token) {
    return { ok: false, reason: 'not_found' };
  }
  if (isPortalExpired(project.portal_expires_at)) {
    return { ok: false, reason: 'expired' };
  }
  if (project.portal_password_hash) {
    if (!password) return { ok: false, reason: 'password_required' };
    if (!verifyPortalPassword(password, project.portal_password_hash)) {
      return { ok: false, reason: 'password_invalid' };
    }
  }
  return { ok: true };
}

export function toPublicProjectView(project: PortalProjectRow) {
  const dueAt = project.due_date ? new Date(project.due_date).getTime() : null;
  const timeLeftMs = dueAt ? Math.max(0, dueAt - Date.now()) : null;
  return {
    name: project.name,
    category: project.category,
    status: project.status,
    currentStage: project.current_stage,
    progress: project.progress,
    dueDate: project.due_date,
    ownerName: project.owner_name,
    image: project.image,
    description: project.description,
    portalExpiresAt: project.portal_expires_at,
    timeLeftMs,
    daysLeft: timeLeftMs == null ? null : Math.ceil(timeLeftMs / 86_400_000),
  };
}
