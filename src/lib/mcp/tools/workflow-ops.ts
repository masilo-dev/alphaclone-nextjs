/**
 * Direct connector tools for workflow actions that previously routed through
 * the manifest bridge / MCPServer (15s timeout on enqueue + email send).
 */

import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { okResult, throwConnectorError } from '@/lib/mcp/connector/response';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { queueContractLifecycle } from '@/lib/contracts/durableContractRouter';
import { sendEmailServer } from '@/lib/email/sendEmailServer';

defineConnectorTool({
  module: 'workflow-ops',
  name: 'start_contract_lifecycle',
  description:
    'Enqueue the durable contract lifecycle (signature → project → tasks → invoicing). Returns immediately with run_id — poll get_outcome_status for progress.',
  permission: 'contracts:write',
  rateLimitClass: 'write',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    contract_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      contract_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'contract_id'],
  },
  handler: async (args, ctx) => {
    const queued = await queueContractLifecycle({
      contractId: args.contract_id,
      tenantId: args.tenant_id,
      userId: ctx.userId,
    });
    return okResult('start_contract_lifecycle', {
      success: true,
      run_id: queued.run_id,
      task_id: queued.task_id,
      durable: queued.durable,
      poll_tool: queued.poll_tool,
      message: 'Contract lifecycle enqueued. Poll get_outcome_status with run_id for completion.',
    });
  },
});

defineConnectorTool({
  module: 'workflow-ops',
  name: 'send_project_email',
  description:
    'Send a project summary email with status, due date, tasks, and milestones. Uses the tenant email provider directly.',
  permission: 'email:send',
  rateLimitClass: 'write',
  auditAction: 'send_project_email',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    project_id: z.string().uuid(),
    to: z.string().email().optional(),
    recipient_email: z.string().email().optional(),
    subject: z.string().optional(),
    message: z.string().optional(),
    from_name: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      project_id: { type: 'string', format: 'uuid' },
      to: { type: 'string', format: 'email' },
      recipient_email: { type: 'string', format: 'email' },
      subject: { type: 'string' },
      message: { type: 'string' },
      from_name: { type: 'string' },
    },
    required: ['tenant_id', 'project_id'],
  },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const projectId = args.project_id;
    const to = args.to || args.recipient_email;

    const { data: bizProject } = await supabase
      .from('business_projects')
      .select('*')
      .eq('tenant_id', args.tenant_id)
      .eq('id', projectId)
      .maybeSingle();

    const { data: legacyProject } = bizProject
      ? { data: null }
      : await supabase
          .from('projects')
          .select('*')
          .eq('tenant_id', args.tenant_id)
          .eq('id', projectId)
          .maybeSingle();

    const project = bizProject || legacyProject;
    if (!project) throwConnectorError('RESOURCE_NOT_FOUND', 'Project not found');

    let recipient = to;
    if (!recipient && project.client_id) {
      const { data: client } = await supabase
        .from('business_clients')
        .select('email')
        .eq('id', project.client_id)
        .maybeSingle();
      recipient = client?.email || undefined;
    }
    if (!recipient) throwConnectorError('VALIDATION_ERROR', 'Recipient email is required (to or linked client email)');

    const [{ data: tasks }, { data: milestones }] = await Promise.all([
      supabase
        .from('tasks')
        .select('title, status, priority, due_date')
        .eq('tenant_id', args.tenant_id)
        .eq('related_to_project', projectId)
        .order('due_date', { ascending: true })
        .limit(25),
      supabase
        .from('project_milestones')
        .select('title, status, due_date')
        .eq('project_id', projectId)
        .order('due_date', { ascending: true })
        .limit(25),
    ]);

    const taskRows = (tasks || [])
      .map(
        (task) =>
          `<li>${task.title} — ${task.status || 'todo'}${task.due_date ? `, due ${task.due_date}` : ''}</li>`,
      )
      .join('');
    const milestoneRows = (milestones || [])
      .map(
        (item) =>
          `<li>${item.title} — ${item.status || 'pending'}${item.due_date ? `, due ${item.due_date}` : ''}</li>`,
      )
      .join('');

    const html = `
      <h2>${project.name}</h2>
      ${args.message ? `<p>${String(args.message).replace(/\n/g, '<br/>')}</p>` : ''}
      <p><strong>Status:</strong> ${project.status || 'active'}</p>
      <p><strong>Due:</strong> ${project.due_date || 'No due date'}</p>
      ${project.description ? `<p>${String(project.description).replace(/\n/g, '<br/>')}</p>` : ''}
      <h3>Tasks</h3><ul>${taskRows || '<li>No tasks listed</li>'}</ul>
      <h3>Milestones</h3><ul>${milestoneRows || '<li>No milestones listed</li>'}</ul>
    `;

    const sendResult = await sendEmailServer({
      tenantId: args.tenant_id,
      userId: ctx.userId,
      to: recipient,
      subject: args.subject || `Project update: ${project.name}`,
      html,
      fromName: args.from_name || 'AlphaClone Projects',
      templateName: 'mcpProjectEmail',
      relatedRecord: { type: 'project', id: projectId },
    });

    if (!sendResult.success) {
      throwConnectorError('DELIVERY_FAILED', sendResult.error || 'Project email failed');
    }

    try {
      await supabase.from('project_email_dispatches').insert({
        tenant_id: args.tenant_id,
        project_id: projectId,
        client_id: project.client_id || null,
        stage: 'mcp_summary',
        autonomy_level: 'level_2',
        approval_status: 'auto_sent',
        recipient_email: recipient,
        subject: args.subject || `Project update: ${project.name}`,
        body_text: args.message || `Project summary for ${project.name}`,
        sent_at: new Date().toISOString(),
      });
    } catch {
      // Non-critical audit row
    }

    return okResult('send_project_email', {
      sent: true,
      project_id: projectId,
      to: recipient,
      provider: sendResult.provider,
      email_id: sendResult.emailId,
    });
  },
});
