import { tenantService } from './tenancy/TenantService';

export interface WorkflowStep {
    id?: string;
    workflow_id?: string;
    action_type: string;
    action_order: number;
    action_config: any;
    delay_minutes?: number;
    is_active?: boolean;
    tenant_id?: string;
    // UI temporary fields
    name?: string;
    type?: 'trigger' | 'condition' | 'action' | 'delay';
    config?: any;
    nextStepId?: string;
    description?: string;
}

export interface WorkflowExecution {
    id: string;
    workflow_id: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    executed_at: string;
    context?: any;
    error_message?: string;
    tenant_id: string;
}

export interface WorkflowStepLog {
    id: string;
    execution_id: string;
    step_id: string;
    status: 'success' | 'failure';
    input?: any;
    output?: any;
    error?: string;
    executed_at: string;
}

export interface Workflow {
    id: string;
    name: string;
    description?: string;
    trigger_type: string;
    trigger_conditions?: any;
    is_active: boolean;
    created_by: string;
    tenant_id: string;
    metadata?: any;
    created_at?: string;
    updated_at?: string;
    version?: number;
    is_template?: boolean;
    steps?: WorkflowStep[];
}

export const workflowService = {
    /**
     * Create a new workflow
     */
    async createWorkflow(workflow: Partial<Workflow>): Promise<{ workflow: Workflow | null; error: string | null }> {
        try {
            const tid = tenantService.getCurrentTenantId();
            if (!tid) throw new Error('No active tenant found');

            const response = await fetch(`/api/tenant/${tid}/automation-workflows`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...workflow,
                    steps: (workflow.steps || []).map((step, index) => ({
                        action_type: step.action_type || step.type || 'webhook',
                        action_order: index,
                        action_config: step.action_config || step.config || {},
                        delay_minutes: step.delay_minutes || 0,
                        is_active: step.is_active ?? true,
                    })),
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.workflow) throw new Error(payload.error || 'Failed to create workflow');
            return { workflow: payload.workflow as Workflow, error: null };
        } catch (error) {
            console.error('Workflow creation error:', error);
            return {
                workflow: null,
                error: error instanceof Error ? error.message : 'Failed to create workflow',
            };
        }
    },

    /**
     * Update an existing workflow
     */
    async updateWorkflow(id: string, workflow: Partial<Workflow>): Promise<{ success: boolean; error: string | null }> {
        try {
            const tid = tenantService.getCurrentTenantId();
            if (!tid) throw new Error('No active tenant found');

            const current = await this.getWorkflowById(id);
            if (!current.workflow) throw new Error(current.error || 'Workflow not found');
            const merged = { ...current.workflow, ...workflow };
            const response = await fetch(`/api/tenant/${tid}/automation-workflows`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workflowId: id,
                    name: merged.name,
                    description: merged.description || null,
                    trigger_type: merged.trigger_type,
                    trigger_conditions: merged.trigger_conditions || {},
                    is_active: merged.is_active,
                    metadata: merged.metadata || {},
                    steps: (merged.steps || []).map((step, index) => ({
                        action_type: step.action_type || step.type || 'webhook',
                        action_order: index,
                        action_config: step.action_config || step.config || {},
                        delay_minutes: step.delay_minutes || 0,
                        is_active: step.is_active ?? true,
                    })),
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Failed to update workflow');
            return { success: true, error: null };
        } catch (error) {
            console.error('Workflow update error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update workflow',
            };
        }
    },

    /**
     * Get all workflows
     */
    async getWorkflows(userId: string): Promise<{ workflows: Workflow[]; error: string | null }> {
        try {
            const tid = tenantService.getCurrentTenantId();
            if (!tid) throw new Error('No active tenant found');

            const response = await fetch(`/api/tenant/${tid}/automation-workflows`);
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Failed to fetch workflows');
            return { workflows: (payload.workflows || []).filter((item: Workflow) => !userId || item.created_by === userId), error: null };
        } catch (error) {
            return {
                workflows: [],
                error: error instanceof Error ? error.message : 'Failed to fetch workflows',
            };
        }
    },

    /**
     * Get a single workflow by ID
     */
    async getWorkflowById(id: string): Promise<{ workflow: Workflow | null; error: string | null }> {
        try {
            const tid = tenantService.getCurrentTenantId();
            if (!tid) throw new Error('No active tenant found');

            const response = await fetch(`/api/tenant/${tid}/automation-workflows?workflowId=${encodeURIComponent(id)}`);
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.workflow) throw new Error(payload.error || 'Workflow not found');
            return { workflow: payload.workflow as Workflow, error: null };
        } catch (error) {
            console.error('Fetch workflow error:', error);
            return {
                workflow: null,
                error: error instanceof Error ? error.message : 'Failed to fetch workflow',
            };
        }
    },

    /**
     * Execute a workflow
     */
    async executeWorkflow(workflowId: string, context: Record<string, any>): Promise<{ success: boolean; error: string | null }> {
        let executionId: string | undefined;
        const tid = tenantService.getCurrentTenantId();
        try {
            if (!tid) throw new Error('No active tenant found');
            const workflowResult = await this.getWorkflowById(workflowId);
            if (!workflowResult.workflow || !workflowResult.workflow.is_active) throw new Error(workflowResult.error || 'Workflow not found or disabled');
            const steps = workflowResult.workflow.steps || [];
            if (!steps.length) throw new Error('Workflow has no steps');
            context.tenantId = tid;
            const startResponse = await fetch(`/api/tenant/${tid}/automation-workflows`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'start_execution', workflowId, context }) });
            const startPayload = await startResponse.json().catch(() => ({}));
            if (!startResponse.ok || !startPayload.execution) throw new Error(startPayload.error || 'Workflow execution could not be started');
            executionId = startPayload.execution.id;
            for (const step of steps) {
                const stepResult = await this.executeStep(step, context);
                if (!stepResult.success) throw new Error(stepResult.error || 'Step execution failed');
            }
            const finishResponse = await fetch(`/api/tenant/${tid}/automation-workflows`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'finish_execution', executionId, status: 'completed', context }) });
            const finishPayload = await finishResponse.json().catch(() => ({}));
            if (!finishResponse.ok) throw new Error(finishPayload.error || 'Workflow completion could not be recorded');
            return { success: true, error: null };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Workflow execution failed';
            if (tid && executionId) {
                await fetch(`/api/tenant/${tid}/automation-workflows`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'finish_execution', executionId, status: 'failed', context, errorMessage: message }) }).catch(() => undefined);
            }
            return {
                success: false,
                error: message,
            };
        }
    },

    /**
     * Execute a single workflow step
     */
    async executeStep(step: WorkflowStep, context: Record<string, any>): Promise<{ success: boolean; error: string | null }> {
        try {
            const type = step.action_type;
            if (type === 'wait') {
                return await this.executeDelay(step, context);
            }
            if (type === 'condition') {
                return await this.executeCondition(step, context);
            }
            
            return await this.executeAction(step, context);
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Step execution failed',
            };
        }
    },

    /**
     * Execute an action step
     */
    async executeAction(step: WorkflowStep, context: Record<string, any>): Promise<{ success: boolean; error: string | null }> {
        const actionType = step.action_type;
        const config = step.action_config || {};

        switch (actionType) {
            case 'send_message': {
                const { messageService } = await import('./messageService');
                const result = await messageService.sendMessage(
                    context.userId || config.senderId,
                    config.senderName || 'Workflow automation',
                    'system',
                    config.message || context.message || 'Workflow notification',
                    config.recipientId || context.recipientId,
                    [],
                    config.priority || 'normal',
                );
                if (result.error || !result.message) return { success: false, error: result.error || 'Workflow message could not be sent' };
                return { success: true, error: null };
            }

            case 'update_project': {
                const { projectService } = await import('./projectService');
                const { error } = await projectService.updateProject(config.projectId || context.projectId, {
                    status: config.status,
                });
                if (error) return { success: false, error };
                return { success: true, error: null };
            }

            case 'create_invoice': {
                const { businessInvoiceService } = await import('./businessInvoiceService');
                const tenantId = context.tenantId || tenantService.getCurrentTenantId();
                if (!tenantId) {
                    return { success: false, error: 'No active organization for invoice creation' };
                }
                const { error } = await businessInvoiceService.createInvoice(tenantId, {
                    projectId: config.projectId,
                    total: Number(config.amount) || 0,
                    notes: config.description || 'Workflow-generated invoice',
                    status: 'draft',
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                });
                if (error) {
                    return { success: false, error };
                }
                return { success: true, error: null };
            }

            case 'send_email':
                return await this.executeSendEmail(step, context);

            // ── ZOHO CRM ──────────────────────────────────────
            case 'zoho_create_lead': {
                const tenantId = context.tenantId || tenantService.getCurrentTenantId();
                if (!tenantId) return { success: false, error: 'Workflow has no workspace context' };
                const response = await fetch('/api/leads/management', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tenantId,
                        action: 'save_lead',
                        config: {
                            source: config.source || 'workflow_automation',
                            leadData: {
                                id: config.externalId || `workflow_${crypto.randomUUID()}`,
                                name: config.company || context.company || config.lastName || context.leadName || 'Workflow lead',
                                email: config.email || context.email || null,
                                phone: config.phone || context.phone || null,
                                type: config.industry || context.industry || null,
                                metadata: { description: config.description || 'Created by workflow automation' },
                                foundAt: new Date().toISOString(),
                            },
                        },
                    }),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || payload.success === false) return { success: false, error: payload.error || 'Lead could not be created' };
                context.leadId = payload.data?.id;
                return { success: true, error: null };
            }

            case 'zoho_update_deal': {
                const tenantId = context.tenantId || tenantService.getCurrentTenantId();
                const dealId = config.dealId || context.dealId;
                if (!tenantId) return { success: false, error: 'Workflow has no workspace context' };
                if (!dealId) return { success: false, error: 'Workflow deal update has no deal ID' };
                const response = await fetch(`/api/tenant/${tenantId}/deals`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: dealId,
                        stage: config.stage || context.dealStage,
                        value: config.amount ?? context.dealAmount,
                        expectedCloseDate: config.closingDate || context.closingDate,
                        stageReason: 'Updated by workflow automation',
                    }),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) return { success: false, error: payload.error || 'Deal could not be updated' };
                return { success: true, error: null };
            }

            case 'zoho_create_contact': {
                const { contactService } = await import('./contactService');
                const { contact, error } = await contactService.createContact({
                    firstName: config.firstName || context.firstName || config.company || context.company || 'Workflow contact',
                    lastName: config.lastName || context.lastName || '',
                    email: config.email || context.email,
                    phone: config.phone || context.phone,
                    notes: config.company || context.company ? `Company: ${config.company || context.company}` : undefined,
                    leadSource: 'workflow_automation',
                });
                if (error || !contact) return { success: false, error: error || 'Contact could not be created' };
                context.contactId = contact.id;
                return { success: true, error: null };
            }

            // ── ZOHO MAIL ─────────────────────────────────────
            case 'zoho_send_mail':
                return await this.executeZohoMail(step, context);

            // ── AI ACTIONS ────────────────────────────────────
            case 'ai_analyze_lead': {
                try {
                    const { generateText } = await import('./unifiedAIService');
                    const result = await generateText(
                        `Score this lead from 0 to 100 using only the supplied facts. Return JSON {"score":number,"quality":"high"|"medium"|"low","reason":"short explanation"}. Do not invent facts.\n${JSON.stringify(context)}`,
                        500,
                        'deepseek-chat',
                        context.tenantId,
                    );
                    if (result.error || !result.text) throw new Error(result.error || 'AI returned no lead analysis');
                    const match = String(result.text || '').match(/\{[\s\S]*\}/);
                    if (!match) throw new Error('AI returned no structured lead score');
                    const analysis = JSON.parse(match[0]);
                    const score = Number(analysis.score);
                    if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error('AI returned an invalid lead score');
                    context.leadScore = score;
                    context.leadQuality = ['high', 'medium', 'low'].includes(analysis.quality) ? analysis.quality : score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low';
                    context.leadScoreReason = String(analysis.reason || '');
                    return { success: true, error: null };
                } catch (error) {
                    return { success: false, error: error instanceof Error ? error.message : 'Lead analysis failed' };
                }
            }

            case 'ai_draft_email': {
                try {
                    const { generateText } = await import('./unifiedAIService');
                    const result = await generateText(`You are a professional business email writer. Draft a professional ${config.tone || 'friendly'} email to ${config.recipientName || context.contactName || 'the client'} about: ${config.topic || context.topic || 'follow-up'}. Keep it concise. Write in plain text only — no markdown.`, 2048, 'deepseek-chat', context.tenantId);
                    if (result.error || !result.text) throw new Error(result.error || 'AI returned no email draft');
                    context.emailDraft = result.text;
                    context.emailSubject = config.subject || `Follow-up: ${config.topic || ''}`;
                    return { success: true, error: null };
                } catch (error) {
                    return { success: false, error: error instanceof Error ? error.message : 'Email drafting failed' };
                }
            }

            case 'ai_generate_contract': {
                try {
                    const { generateText } = await import('./unifiedAIService');
                    const result = await generateText(`You are a legal document assistant. Generate a ${config.contractType || 'service'} contract for ${config.clientName || context.clientName || 'the client'}. Include: scope of work, payment terms ($${config.amount || context.amount || '0'}), timeline, and standard clauses. Write in plain professional text only — no markdown.`, 4096, 'deepseek-chat', context.tenantId);
                    if (result.error || !result.text) throw new Error(result.error || 'AI returned no contract draft');
                    context.contractContent = result.text;
                    return { success: true, error: null };
                } catch (error) {
                    return { success: false, error: error instanceof Error ? error.message : 'Contract generation failed' };
                }
            }

            // ── CONTRACTS ─────────────────────────────────────
            case 'create_contract': {
                const { contractService } = await import('./contractService');
                const { contract, error: cErr } = await contractService.createContract({
                    title: config.title || context.contractTitle || 'Auto-generated Contract',
                    content: config.content || context.contractContent || '',
                    project_id: config.projectId || context.projectId,
                    client_id: config.clientId || context.clientId,
                    status: 'draft',
                    payment_amount: config.amount || context.amount,
                    payment_due_date: config.dueDate || new Date(Date.now() + 30 * 86400000).toISOString(),
                });
                if (cErr) return { success: false, error: String(cErr) };
                context.contractId = contract?.id;
                return { success: true, error: null };
            }

            // ── INVOICES ──────────────────────────────────────
            case 'generate_invoice': {
                const tenantId = context.tenantId || tenantService.getCurrentTenantId();
                if (!tenantId) return { success: false, error: 'Workflow has no workspace context' };
                const { businessInvoiceService } = await import('./businessInvoiceService');
                const amount = Number(config.amount ?? context.amount ?? 0);
                const { invoice, error } = await businessInvoiceService.createInvoice(tenantId, {
                    clientId: config.clientId || context.clientId,
                    projectId: config.projectId || context.projectId,
                    dueDate: config.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                    status: 'draft',
                    subtotal: amount,
                    taxRate: Number(config.taxRate || 0),
                    tax: amount * (Number(config.taxRate || 0) / 100),
                    discountAmount: Number(config.discount || 0),
                    total: amount,
                    lineItems: config.lineItems || context.lineItems || [{ description: config.description || 'Service', quantity: 1, rate: amount, amount }],
                    notes: config.notes || '',
                    isPublic: false,
                });
                if (error || !invoice) return { success: false, error: error || 'Invoice could not be created' };
                context.invoiceNumber = invoice.invoiceNumber;
                return { success: true, error: null };
            }

            // ── QUOTATIONS ────────────────────────────────────
            case 'generate_quote': {
                const tenantId = context.tenantId || tenantService.getCurrentTenantId();
                if (!tenantId) return { success: false, error: 'Workflow has no workspace context' };
                const response = await fetch(`/api/tenant/${tenantId}/quotes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: config.name || context.quoteName || 'Workflow-generated quote',
                        email: config.email || context.email,
                        currency: config.currency || 'USD',
                        amount: Number(config.amount ?? context.amount ?? 0),
                    }),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || !payload.quote) return { success: false, error: payload.error || 'Quote could not be created' };
                context.quoteId = payload.quote.id;
                context.quoteNumber = payload.quote.quote_number;
                return { success: true, error: null };
            }

            // ── EMAIL CAMPAIGNS ───────────────────────────────
            case 'launch_campaign': {
                const { emailCampaignService } = await import('./emailCampaignService');
                const { campaign, error } = await emailCampaignService.createCampaign(context.userId, {
                    name: config.campaignName || context.campaignName || 'Workflow campaign',
                    subject: config.subject || context.emailSubject || 'Important update',
                    templateId: config.templateId || context.templateId,
                    fromName: config.fromName || 'AlphaClone',
                    fromEmail: config.fromEmail || context.fromEmail || 'notifications@alphaclonesystems.com',
                    scheduledAt: config.scheduleAt,
                    segmentFilter: config.segmentFilter || context.segmentFilter || {},
                    metadata: { createdByWorkflow: true },
                });
                if (error || !campaign) return { success: false, error: error || 'Campaign could not be created' };
                context.campaignId = campaign.id;
                return { success: true, error: null };
            }

            // ── TASKS ─────────────────────────────────────────
            case 'create_task': {
                const { taskService } = await import('./taskService');
                const { error: tErr } = await taskService.createTask(context.userId, {
                    title: config.title || context.taskTitle || 'Auto-created Task',
                    description: config.description || context.taskDescription || '',
                    assignedTo: config.assignedTo || context.userId,
                    priority: config.priority || 'medium',
                    status: 'todo',
                    dueDate: config.dueDate || new Date(Date.now() + 7 * 86400000).toISOString(),
                    relatedToProject: config.projectId || context.projectId,
                    relatedToDeal: config.dealId || context.dealId,
                    relatedToLead: config.leadId || context.leadId,
                    tags: config.tags || [],
                });
                if (tErr) return { success: false, error: tErr };
                return { success: true, error: null };
            }

            // ── NOTIFICATIONS ─────────────────────────────────
            case 'send_notification': {
                const tenantId = context.tenantId || tenantService.getCurrentTenantId();
                if (!tenantId) return { success: false, error: 'Workflow has no workspace context' };
                const response = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                    userId: config.recipientId || context.userId,
                    tenantId,
                    title: config.title || 'Workflow Notification',
                    message: config.message || context.notificationMessage || 'A workflow completed.',
                    type: ['message', 'project', 'payment', 'system', 'alert', 'task'].includes(config.notificationType) ? config.notificationType : 'system',
                }) });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) return { success: false, error: payload.error || 'Workflow notification failed' };
                return { success: true, error: null };
            }

            // ── SCHEDULE MEETING ──────────────────────────────
            case 'schedule_meeting': {
                try {
                    const tenantId = context.tenantId || tenantService.getCurrentTenantId();
                    if (!tenantId) return { success: false, error: 'Workflow has no workspace context' };
                    const participants = (config.participants || []).filter((value: unknown) => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value));
                    const response = await fetch('/api/meetings/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            tenantId,
                            title: config.title || 'Automated Meeting',
                            durationMinutes: config.duration || 30,
                            participants,
                            scheduledAt: config.scheduledAt || context.scheduledAt,
                        }),
                    });
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) return { success: false, error: payload.error || 'Workflow meeting could not be scheduled' };
                    context.meetingId = payload.meetingId;
                    context.meetingUrl = payload.meetingUrl;
                    return { success: true, error: null };
                } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Workflow meeting failed' }; }
            }

            // ── UPDATE PROJECT STATUS ─────────────────────────
            case 'update_project_status': {
                if (config.projectId || context.projectId) {
                    const { projectService } = await import('./projectService');
                    const { error } = await projectService.updateProject(config.projectId || context.projectId, { status: config.status || context.newStatus || 'in_progress' });
                    if (error) return { success: false, error };
                }
                return { success: true, error: null };
            }

            default:
                return { success: false, error: `Unknown action type: ${actionType}` };
        }
    },

    /**
     * Send email via Gmail API
     */
    async executeSendEmail(step: WorkflowStep, context: Record<string, any>): Promise<{ success: boolean; error: string | null }> {
        const config = step.action_config || {};
        try {
            const res = await fetch(`/api/gmail/messages/send?userId=${context.userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: config.to || context.email,
                    subject: config.subject || context.emailSubject || 'Notification',
                    messageBody: config.body || context.emailDraft || context.emailBody || '',
                }),
            });
            if (!res.ok) return { success: false, error: 'Email send failed' };
            return { success: true, error: null };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Email send failed' };
        }
    },

    /**
     * Send email via Zoho Mail
     */
    async executeZohoMail(step: WorkflowStep, context: Record<string, any>): Promise<{ success: boolean; error: string | null }> {
        const config = step.action_config || {};
        try {
            const res = await fetch('/api/zoho/mail?action=send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toAddress: config.to || context.email,
                    subject: config.subject || context.emailSubject || 'Notification',
                    content: config.body || context.emailDraft || '',
                    ccAddress: config.cc,
                    bccAddress: config.bcc,
                }),
            });
            if (!res.ok) return { success: false, error: 'Zoho Mail send failed' };
            return { success: true, error: null };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Zoho Mail send failed' };
        }
    },

    /**
     * Execute a condition step
     */
    async executeCondition(step: WorkflowStep, context: Record<string, any>): Promise<{ success: boolean; error: string | null }> {
        const config = step.action_config || {};
        if (!config.condition) {
            return { success: true, error: null };
        }

        const fieldValue = context[config.condition.field];
        let conditionMet = false;

        switch (config.condition.operator) {
            case 'equals':
                conditionMet = fieldValue === config.condition.value;
                break;
            case 'contains':
                conditionMet = String(fieldValue).includes(String(config.condition.value));
                break;
            case 'greater_than':
                conditionMet = Number(fieldValue) > Number(config.condition.value);
                break;
            case 'less_than':
                conditionMet = Number(fieldValue) < Number(config.condition.value);
                break;
        }

        return { success: conditionMet, error: conditionMet ? null : 'Condition not met' };
    },

    /**
     * Get all executions for a specific workflow
     */
    async getWorkflowExecutions(workflowId: string): Promise<{ executions: WorkflowExecution[]; error: string | null }> {
        try {
            const tid = tenantService.getCurrentTenantId();
            if (!tid) throw new Error('No active tenant found');

            const response = await fetch(`/api/tenant/${tid}/automation-workflows?view=executions&workflowId=${encodeURIComponent(workflowId)}`);
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Failed to fetch executions');
            return { executions: payload.executions || [], error: null };
        } catch (error) {
            return { executions: [], error: error instanceof Error ? error.message : 'Failed to fetch executions' };
        }
    },

    /**
     * Get pre-built workflow templates
     */
    async getWorkflowTemplates(): Promise<{ templates: any[]; error: string | null }> {
        try {
            const tid = tenantService.getCurrentTenantId();
            if (!tid) throw new Error('No active tenant found');
            const response = await fetch(`/api/tenant/${tid}/automation-workflows?view=templates`);
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Failed to fetch templates');
            return { templates: payload.templates || [], error: null };
        } catch (error) {
            return { templates: [], error: error instanceof Error ? error.message : 'Failed to fetch templates' };
        }
    },

    /**
     * Execute a delay step
     */
    async executeDelay(step: WorkflowStep, _context: Record<string, any>): Promise<{ success: boolean; error: string | null }> {
        const delaySeconds = step.action_config?.delaySeconds || 5;
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
        return { success: true, error: null };
    },
};
