/**
 * Project/task schema compatibility — normalize IDs and status values for chaser scans.
 */

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const CLOSED_TASK_STATUSES = new Set([
  'completed',
  'complete',
  'done',
  'cancelled',
  'canceled',
  'archived',
]);

const CLOSED_PROJECT_STATUSES = new Set([
  'completed',
  'complete',
  'done',
  'cancelled',
  'canceled',
  'archived',
  'closed',
]);

export function normalizeTaskStatus(status: unknown): string {
  return String(status || 'pending').trim().toLowerCase();
}

export function normalizeProjectStatus(status: unknown): string {
  return String(status || 'active').trim().toLowerCase();
}

export function isOpenTask(status: unknown): boolean {
  return !CLOSED_TASK_STATUSES.has(normalizeTaskStatus(status));
}

export function isOpenProject(status: unknown): boolean {
  return !CLOSED_PROJECT_STATUSES.has(normalizeProjectStatus(status));
}

export async function resolveProjectIdCompat(
  supabase: SupabaseClient,
  tenantId: string,
  projectRef?: string | null,
): Promise<string | null> {
  if (!projectRef) return null;

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', projectRef)
    .maybeSingle();
  if (project?.id) return project.id;

  const { data: businessProject } = await supabase
    .from('business_projects')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', projectRef)
    .maybeSingle();
  return businessProject?.id || projectRef;
}

export async function listStaleProjects(
  tenantId: string,
  staleDays = 3,
  limit = 25,
): Promise<Array<Record<string, unknown>>> {
  const admin = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - staleDays * 86400000).toISOString();
  const rows: Array<Record<string, unknown>> = [];

  const { data: projects } = await admin
    .from('projects')
    .select('id, name, status, updated_at, owner_id')
    .eq('tenant_id', tenantId)
    .lt('updated_at', cutoff)
    .limit(limit);

  for (const p of projects || []) {
    if (!isOpenProject(p.status)) continue;
    rows.push({ ...p, source_table: 'projects' });
  }

  const { data: bizProjects } = await admin
    .from('business_projects')
    .select('id, name, status, updated_at')
    .eq('tenant_id', tenantId)
    .lt('updated_at', cutoff)
    .limit(limit);

  for (const p of bizProjects || []) {
    if (!isOpenProject(p.status)) continue;
    if (rows.some((r) => r.id === p.id)) continue;
    rows.push({ ...p, source_table: 'business_projects' });
  }

  return rows;
}
