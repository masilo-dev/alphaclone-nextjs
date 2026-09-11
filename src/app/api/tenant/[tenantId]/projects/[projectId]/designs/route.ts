import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { isExecutionFeatureEnabled } from '@/lib/projects/executionFeatureFlags';
import { createPenpotFile, createPenpotProject, penpotHealthCheck } from '@/lib/integrations/penpotClient';

function idOf(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  return String(obj.id || obj['project-id'] || obj['file-id'] || '').trim() || null;
}

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string; projectId: string }> }) {
  try {
    const { tenantId, projectId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();
    if (!(await isExecutionFeatureEnabled(admin, 'PENPOT_ENABLED', tenantId))) {
      return NextResponse.json({ enabled: false, designs: [], projectMapping: null });
    }
    const [{ data: mapping, error: mappingError }, { data: files, error: filesError }] = await Promise.all([
      admin.from('penpot_project_mappings').select('*').eq('tenant_id', tenantId).eq('project_id', projectId).maybeSingle(),
      admin.from('penpot_file_mappings').select('*').eq('tenant_id', tenantId).eq('project_id', projectId).order('updated_at', { ascending: false }),
    ]);
    if (mappingError) throw mappingError;
    if (filesError) throw filesError;
    return NextResponse.json({ enabled: true, projectMapping: mapping, designs: files || [] });
  } catch (error) {
    return routeErrorResponse(error, 'Project designs could not be loaded', req);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string; projectId: string }> }) {
  try {
    const { tenantId, projectId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();
    if (!(await isExecutionFeatureEnabled(admin, 'PENPOT_ENABLED', tenantId))) {
      return NextResponse.json({ error: 'Penpot integration is not enabled for this workspace' }, { status: 404 });
    }

    const health = await penpotHealthCheck();
    if (!health.ok) return NextResponse.json({ error: 'Design service is temporarily unavailable' }, { status: 503 });

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode || 'create_file');
    const { data: project, error: projectError } = await admin.from('projects').select('id,name').eq('tenant_id', tenantId).eq('id', projectId).is('deleted_at', null).maybeSingle();
    if (projectError) throw projectError;
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    if (mode === 'link_file') {
      const penpotProjectId = String(body.penpotProjectId || '').trim();
      const penpotFileId = String(body.penpotFileId || '').trim();
      if (!penpotProjectId || !penpotFileId) return NextResponse.json({ error: 'penpotProjectId and penpotFileId are required' }, { status: 400 });
      const { data, error } = await admin.from('penpot_file_mappings').upsert({
        tenant_id: tenantId, project_id: projectId, task_id: body.taskId || null, approval_id: body.approvalId || null,
        penpot_project_id: penpotProjectId, penpot_file_id: penpotFileId, name: body.name || null,
        preview_url: body.previewUrl || null, version: body.version || null, metadata: body.metadata || {}, created_by: user.id, updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,penpot_file_id' }).select('*').single();
      if (error) throw error;
      return NextResponse.json({ design: data });
    }

    let { data: mapping } = await admin.from('penpot_project_mappings').select('*').eq('tenant_id', tenantId).eq('project_id', projectId).maybeSingle();
    if (!mapping) {
      const teamId = String(body.teamId || process.env.PENPOT_TEAM_ID || '').trim();
      if (!teamId) return NextResponse.json({ error: 'Penpot team is not configured' }, { status: 409 });
      const key = `penpot-project:${tenantId}:${projectId}`;
      const { data: existingOp } = await admin.from('penpot_sync_operations').select('*').eq('tenant_id', tenantId).eq('idempotency_key', key).maybeSingle();
      if (existingOp?.status === 'completed' && existingOp.result?.penpotProjectId) {
        const { data: recovered } = await admin.from('penpot_project_mappings').select('*').eq('tenant_id', tenantId).eq('project_id', projectId).maybeSingle();
        mapping = recovered;
      } else {
        await admin.from('penpot_sync_operations').upsert({ tenant_id: tenantId, operation: 'create_project', idempotency_key: key, project_id: projectId, status: 'running', request: { teamId, name: project.name }, retry_count: Number(existingOp?.retry_count || 0), correlation_id: key }, { onConflict: 'tenant_id,idempotency_key' });
        try {
          const created = await createPenpotProject({ teamId, name: project.name });
          const penpotProjectId = idOf(created);
          if (!penpotProjectId) throw new Error('Penpot project response did not include an id');
          const { data: inserted, error: insertError } = await admin.from('penpot_project_mappings').insert({ tenant_id: tenantId, project_id: projectId, penpot_team_id: teamId, penpot_project_id: penpotProjectId, penpot_project_name: project.name, created_by: user.id }).select('*').single();
          if (insertError) throw insertError;
          mapping = inserted;
          await admin.from('penpot_sync_operations').update({ status: 'completed', result: { penpotProjectId }, completed_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('idempotency_key', key);
        } catch (error) {
          await admin.from('penpot_sync_operations').update({ status: 'failed', error: error instanceof Error ? error.message : 'Penpot project creation failed', retry_count: Number(existingOp?.retry_count || 0) + 1 }).eq('tenant_id', tenantId).eq('idempotency_key', key);
          throw error;
        }
      }
    }

    if (mode === 'ensure_project') return NextResponse.json({ projectMapping: mapping });

    const fileName = String(body.name || `${project.name} Design`).trim();
    const fileKey = String(body.idempotencyKey || `penpot-file:${tenantId}:${projectId}:${body.taskId || 'project'}:${fileName.toLowerCase()}`);
    const { data: existingFileOp } = await admin.from('penpot_sync_operations').select('*').eq('tenant_id', tenantId).eq('idempotency_key', fileKey).maybeSingle();
    if (existingFileOp?.status === 'completed' && existingFileOp.result?.penpotFileId) {
      const { data: existingFile } = await admin.from('penpot_file_mappings').select('*').eq('tenant_id', tenantId).eq('penpot_file_id', existingFileOp.result.penpotFileId).maybeSingle();
      return NextResponse.json({ duplicate: true, design: existingFile, projectMapping: mapping });
    }

    await admin.from('penpot_sync_operations').upsert({ tenant_id: tenantId, operation: 'create_file', idempotency_key: fileKey, project_id: projectId, task_id: body.taskId || null, status: 'running', request: { name: fileName, penpotProjectId: mapping.penpot_project_id }, retry_count: Number(existingFileOp?.retry_count || 0), correlation_id: fileKey }, { onConflict: 'tenant_id,idempotency_key' });
    try {
      const createdFile = await createPenpotFile({ projectId: mapping.penpot_project_id, name: fileName });
      const penpotFileId = idOf(createdFile);
      if (!penpotFileId) throw new Error('Penpot file response did not include an id');
      const base = String(process.env.PENPOT_BASE_URL || '').replace(/\/$/, '');
      const previewUrl = base ? `${base}/#/workspace/${penpotFileId}` : null;
      const { data: design, error: designError } = await admin.from('penpot_file_mappings').insert({ tenant_id: tenantId, project_id: projectId, task_id: body.taskId || null, approval_id: body.approvalId || null, penpot_project_id: mapping.penpot_project_id, penpot_file_id: penpotFileId, name: fileName, preview_url: previewUrl, created_by: user.id, metadata: { source: 'alphaclone' } }).select('*').single();
      if (designError) throw designError;
      await admin.from('penpot_sync_operations').update({ status: 'completed', result: { penpotFileId, previewUrl }, completed_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('idempotency_key', fileKey);
      await admin.from('project_activity').insert({ tenant_id: tenantId, project_id: projectId, task_id: body.taskId || null, actor_user_id: user.id, action: 'design_file_created', target_type: 'penpot_file', target_id: null, source: 'integration', correlation_id: fileKey, new_value: { penpotFileId, name: fileName, previewUrl } });
      return NextResponse.json({ duplicate: false, design, projectMapping: mapping }, { status: 201 });
    } catch (error) {
      await admin.from('penpot_sync_operations').update({ status: 'failed', error: error instanceof Error ? error.message : 'Penpot file creation failed', retry_count: Number(existingFileOp?.retry_count || 0) + 1 }).eq('tenant_id', tenantId).eq('idempotency_key', fileKey);
      throw error;
    }
  } catch (error) {
    return routeErrorResponse(error, 'Project design operation failed', req);
  }
}
