import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { ensureFooter } from '@/lib/email/emailComposition';
import { buildCanonicalProjectPortalUrl } from '@/lib/projects/portalLinks';
import { escapeHtml } from '@/lib/email/escapeHtml';

const NOREPLY_FOOTER =
  '\n\n—\nThis is an automated project update from AlphaClone Systems. Please do not reply to this email; use your project portal link to message the team.';

type ProjectNotifyRow = {
  id: string;
  tenant_id: string;
  name: string;
  progress: number | null;
  current_stage: string | null;
  client_id: string | null;
  portal_token: string | null;
  is_public: boolean | null;
  owner_name: string | null;
  owner_id: string | null;
};

function buildPortalUrl(origin: string, portalToken: string | null): string | null {
  if (!portalToken) return null;
  return buildCanonicalProjectPortalUrl(portalToken);
}

async function resolveClientRecipient(
  admin: SupabaseClient,
  tenantId: string,
  clientId: string | null
): Promise<{ email: string | null; name: string | null }> {
  if (!clientId) return { email: null, name: null };

  const { data: client } = await admin
    .from('business_clients')
    .select('email, name, company')
    .eq('tenant_id', tenantId)
    .eq('id', clientId)
    .limit(1)
    .maybeSingle();

  if (client?.email) {
    return {
      email: String(client.email).trim().toLowerCase(),
      name: client.name || client.company || null,
    };
  }

  const { data: contact } = await admin
    .from('contacts')
    .select('email, full_name, first_name, last_name')
    .eq('tenant_id', tenantId)
    .eq('id', clientId)
    .limit(1)
    .maybeSingle();

  return {
    email: contact?.email ? String(contact.email).trim().toLowerCase() : null,
    name: contact?.full_name || [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || null,
  };
}

async function wasClientEmailSentRecently(
  admin: SupabaseClient,
  projectId: string,
  kind: string,
  dedupeKey?: string
): Promise<boolean> {
  const since = new Date();
  since.setHours(since.getHours() - 24);

  const { data } = await admin
    .from('client_portal_events')
    .select('id, metadata')
    .eq('project_id', projectId)
    .eq('event_type', 'custom')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  return (data || []).some((row) => {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    if (meta.kind !== kind) return false;
    if (dedupeKey != null && String(meta.dedupe_key || '') !== dedupeKey) return false;
    return true;
  });
}

async function loadProjectForClientNotify(
  admin: SupabaseClient,
  projectId: string,
  tenantId: string
): Promise<{ row: ProjectNotifyRow | null; skipped?: string }> {
  const { data: project, error } = await admin
    .from('projects')
    .select('id, tenant_id, name, progress, current_stage, client_id, portal_token, is_public, owner_name, owner_id')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !project) {
    return { row: null, skipped: 'project_not_found' };
  }

  const row = project as ProjectNotifyRow;
  // Client email is independent of whether a public portal is enabled.
  if (!row.is_public) row.portal_token = null;

  return { row };
}

async function sendClientProjectNoReplyEmail(params: {
  tenantId: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  templateName: string;
  idempotencyKey?: string;
}): Promise<{ success: boolean; error?: string }> {
  const sendResult = await sendEmailServer({
    tenantId: params.tenantId,
    to: params.to,
    subject: params.subject,
    html: ensureFooter(params.html),
    text: params.text,
    fromName: 'AlphaClone Project Updates',
    category: 'transactional',
    templateName: params.templateName,
    idempotencyKey: params.idempotencyKey,
  });
  return { success: sendResult.success, error: sendResult.error };
}

export async function notifyProjectClientDetails(params: {
  admin: SupabaseClient;
  projectId: string;
  tenantId: string;
  kind: 'created' | 'details_updated';
  changes?: string[];
  origin: string;
}): Promise<{ sent: boolean; skipped?: string; email?: string }> { return {sent:false,skipped:'lifecycle_notifications_use_durable_outbox'}; }

export async function notifyProjectClientProgressUpdate(params: {
  admin: SupabaseClient;
  projectId: string;
  tenantId: string;
  previousProgress?: number | null;
  newProgress: number;
  origin: string;
  trigger?: 'progress_change' | 'milestone' | 'manual';
}): Promise<{ sent: boolean; skipped?: string; email?: string }> { return {sent:false,skipped:'lifecycle_notifications_use_durable_outbox'}; }

export async function notifyProjectClientStageUpdate(params: {
  admin: SupabaseClient;
  projectId: string;
  tenantId: string;
  previousStage: string;
  newStage: string;
  origin: string;
}): Promise<{ sent: boolean; skipped?: string; email?: string }> { return {sent:false,skipped:'lifecycle_notifications_use_durable_outbox'}; }

export async function notifyProjectClientNote(params: {
  admin: SupabaseClient;
  projectId: string;
  tenantId: string;
  noteContent: string;
  authorName?: string;
  origin: string;
}): Promise<{ sent: boolean; skipped?: string; email?: string }> {
  const { admin, projectId, tenantId, noteContent, authorName, origin } = params;
  const content = String(noteContent || '').trim();
  if (!content) return { sent: false, skipped: 'empty_note' };

  const loaded = await loadProjectForClientNotify(admin, projectId, tenantId);
  if (!loaded.row) return { sent: false, skipped: loaded.skipped };

  const row = loaded.row;
  const { email, name } = await resolveClientRecipient(admin, tenantId, row.client_id);
  if (!email || !email.includes('@')) {
    return { sent: false, skipped: 'no_client_email' };
  }

  const portalUrl = buildPortalUrl(origin, row.portal_token);
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const fromLine = authorName ? `<p>Update from <strong>${authorName}</strong>:</p>` : '';
  const htmlBody = `<p>${greeting}</p>
<p>There is a new update on your project <strong>${row.name}</strong>.</p>
${fromLine}
<blockquote style="border-left:3px solid var(--brand-blue-500);padding-left:12px;color:var(--ws-border);">${content.replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</blockquote>
${portalUrl ? `<p><a href="${portalUrl}">View project portal &amp; reply</a></p>` : ''}
<p style="color:var(--ws-text-muted);font-size:12px;">This message was sent automatically. Use the portal link to message the team — do not reply to this email.</p>`;

  const sendResult = await sendClientProjectNoReplyEmail({
    tenantId,
    to: email,
    subject: `Project update: ${row.name}`,
    html: htmlBody,
    text: [
      greeting,
      '',
      `New update on "${row.name}":`,
      content,
      portalUrl ? `View portal: ${portalUrl}` : '',
      NOREPLY_FOOTER,
    ]
      .filter(Boolean)
      .join('\n'),
    templateName: 'projectNoteUpdate',
  });

  if (!sendResult.success) {
    return { sent: false, skipped: sendResult.error || 'send_failed' };
  }

  await admin.from('client_portal_events').insert({
    tenant_id: tenantId,
    project_id: projectId,
    client_id: row.client_id,
    event_type: 'custom',
    metadata: {
      kind: 'note_email_sent',
      recipient: email,
      author: authorName || null,
    },
  });

  return { sent: true, email };
}

export async function notifyProjectTeamClientPortalMessage(params: {
  admin: SupabaseClient;
  projectId: string;
  tenantId: string;
  projectName: string;
  authorName: string;
  content: string;
  origin: string;
}): Promise<{ sent: boolean; skipped?: string }> {
  const { admin, projectId, tenantId, projectName, authorName, content, origin } = params;

  const { data: project } = await admin
    .from('projects')
    .select('owner_id')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!project?.owner_id) {
    return { sent: false, skipped: 'no_owner' };
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('email, name')
    .eq('id', project.owner_id)
    .maybeSingle();

  if (!profile?.email) {
    return { sent: false, skipped: 'no_owner_email' };
  }

  const dashboardUrl = `${origin.replace(/\/$/, '')}/dashboard/business/projects`;
  const htmlBody = `<p>Hi ${profile.name || 'there'},</p>
<p><strong>${authorName}</strong> left a message on the client portal for <strong>${projectName}</strong>:</p>
<blockquote style="border-left:3px solid var(--brand-blue-500);padding-left:12px;color:var(--ws-border);">${content.replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</blockquote>
<p><a href="${dashboardUrl}">Open projects dashboard</a></p>
<p style="color:var(--ws-text-muted);font-size:12px;">Automated notification — please do not reply.</p>`;

  const sendResult = await sendClientProjectNoReplyEmail({
    tenantId,
    to: profile.email,
    subject: `Client portal message: ${projectName}`,
    html: htmlBody,
    text: [
      `Hi ${profile.name || 'there'},`,
      '',
      `${authorName} left a message on the client portal for "${projectName}":`,
      content,
      `Open projects: ${dashboardUrl}`,
      NOREPLY_FOOTER,
    ].join('\n'),
    templateName: 'projectPortalClientMessage',
  });

  if (!sendResult.success) {
    return { sent: false, skipped: sendResult.error || 'send_failed' };
  }

  return { sent: true };
}

/**
 * Emails the project owner and the client when a project is marked finished.
 * Client mail still goes out if the portal is off, as long as we have an email.
 */
export async function notifyProjectFinished(params: {
  admin: SupabaseClient;
  projectId: string;
  tenantId: string;
  origin: string;
  ownerId?: string | null;
}): Promise<{ client: { sent: boolean; skipped?: string }; owner: { sent: boolean; skipped?: string } }> { return {client:{sent:false,skipped:'lifecycle_notifications_use_durable_outbox'},owner:{sent:false,skipped:'owner_digest_policy'}}; }

/** A milestone date/name/status update merits an email even if project % is unchanged. */
export async function notifyProjectClientMilestoneUpdate(params: {
  admin: SupabaseClient; tenantId: string; projectId: string;
  milestone: { id: string; name: string; status: string; due_date?: string | null; updated_at?: string };
  action: 'created' | 'updated' | 'deleted'; progress?: number;
}): Promise<{ sent: boolean; skipped?: string; email?: string; status?: string }> { return {sent:false,skipped:'lifecycle_notifications_use_durable_outbox'}; }
