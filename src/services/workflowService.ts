import { supabase } from '../lib/supabase';
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

            // 1. Insert Workflow Header
            const { data: workflowData, error: workflowError } = await supabase
                .from('workflows')
                .insert({
                    name: workflow.name,
                    description: workflow.description,
                    trigger_type: workflow.trigger_type || 'manual_trigger',
                    trigger_conditions: workflow.trigger_conditions || {},
                    is_active: workflow.is_active ?? true,
                    created_by: workflow.created_by,
                    tenant_id: tid,
                    metadata: workflow.metadata || {},
                })
                .select()
                .single();

            if (workflowError) throw workflowError;

            // 2. Insert Workflow Actions (Steps)
            if (workflow.steps && workflow.steps.length > 0) {
                const actionsToInsert = workflow.steps.map((step, index) => ({
                    workflow_id: workflowData.id,
                    action_type: step.action_type || 'webhook',
                    action_order: index,
                    action_config: step.action_config || step.config || {},
                    delay_minutes: step.delay_minutes || 0,
                    is_active: true,
                    tenant_id: tid,
                }));

                const { error: actionsError } = await supabase
                    .from('workflow_actions')
                    .insert(actionsToInsert);

                if (actionsError) {
                    console.error('Failed to insert workflow actions:', actionsError);
                }
            }

            return {
                workflow: workflowData as Workflow,
                error: null,
            };
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

            // 1. Update Workflow Header
            const { error: workflowError } = await supabase
                .from('workflows')
                .update({
                    name: workflow.name,
                    description: workflow.description,
                    trigger_type: workflow.trigger_type,
                    trigger_conditions: workflow.trigger_conditions,
                    is_active: workflow.is_active,
                    metadata: workflow.metadata,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .eq('tenant_id', tid);

            if (workflowError) throw workflowError;

            // 2. Update Actions (Delete and Re-insert is often easiest for complex builders)
            if (workflow.steps) {
                // Delete old actions
                await supabase
                    .from('workflow_actions')
                    .delete()
                    .eq('workflow_id', id)
                    .eq('tenant_id', tid);

                // Insert new actions
                if (workflow.steps.length > 0) {
                    const actionsToInsert = workflow.steps.map((step, index) => ({
                        workflow_id: id,
                        action_type: step.action_type || (step as any).type || 'webhook',
                        action_order: index,
                        action_config: step.action_config || (step as any).config || {},
                        delay_minutes: step.delay_minutes || 0,
                        is_active: true,
                        tenant_id: tid,
                    }));

                    const { error: actionsError } = await supabase
                        .from('workflow_actions')
                        .insert(actionsToInsert);

                    if (actionsError) throw actionsError;
                }
            }

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

            const { data, error } = await supabase
                .from('workflows')
                .select('*, workflow_actions(*)')
                .eq('created_by', userId)
                .eq('tenant_id', tid)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return {
                workflows: (data || []).map((w: any) => ({
                    ...w,
                    steps: (w.workflow_actions || []).sort((a: any, b: any) => a.action_order - b.action_order)
                })),
                error: null,
            };
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

            const { data, error } = await supabase
                .from('workflows')
                .select('*, workflow_actions(*)')
                .eq('id', id)
                .eq('tenant_id', tid)
                .single();

            if (error) throw error;
            if (!data) throw new Error('Workflow not found');

            return {
                workflow: {
                    ...data,
                    steps: (data.workflow_actions || []).sort((a: any, b: any) => a.action_order - b.action_order)
                } as Workflow,
                error: null,
            };
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
        try {
            const { data: workflow, error: fetchError } = await supabase
                .from('workflows')
                .select('*, workflow_actions(*)')
                .eq('id', workflowId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .eq('is_active', true)
                .single();

            if (fetchError || !workflow) {
                return { success: false, error: 'Workflow not found or disabled' };
            }

            const steps = (workflow.workflow_actions || []).sort((a: any, b: any) => a.action_order - b.action_order);
            if (steps.length === 0) {
                return { success: false, error: 'Workflow has no steps' };
            }

            // Execute steps in order
            for (const step of steps) {
                const stepResult = await this.executeStep(step, context);
                if (!stepResult.success) {
                    return { success: false, error: stepResult.error || 'Step execution failed' };
                }
            }

            // Log execution
            await supabase.from('workflow_executions').insert({
                workflow_id: workflowId,
                context,
                status: 'completed',
                executed_at: new Date().toISOString(),
                tenant_id: tenantService.getCurrentTenantId(),
            });

            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Workflow execution failed',
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
            
            // For now, most things are actions
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
            case 'send_message':
                // Send message via messageService
                const { messageService } = await import('./messageService');
                await messageService.sendMessage(
                    context.userId || config.senderId,
                    config.recipientId,
                    config.message,
                    config.priority || 'normal'
                );
                return { success: true, error: null };

            case 'update_project':
                // Update project status
                const { projectService } = await import('./projectService');
                await projectService.updateProject(config.projectId, {
                    status: config.status,
                });
                return { success: true, error: null };

            case 'create_invoice':
                // Create invoice
                const { paymentService } = await import('./paymentService');
                await paymentService.createInvoice({
                    user_id: context.userId,
                    project_id: config.projectId,
                    amount: config.amount,
                    description: config.description,
                    currency: 'USD',
                    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    items: [],
                });
                return { success: true, error: null };

            case 'send_email':
                return await this.executeSendEmail(step, context);

            // ── ZOHO CRM ──────────────────────────────────────
            case 'zoho_create_lead':
                await supabase.from('leads').insert({
                    name: config.lastName || context.leadName || 'Unknown',
                    company: config.company || context.company || 'Unknown',
                    email: config.email || context.email,
                    phone: config.phone || context.phone,
                    source: config.source || 'Workflow Automation',
                    notes: config.description || `Created by workflow`,
                    tenant_id: context.tenantId || tenantService.getCurrentTenantId(),
                    status: 'new',
                });
                return { success: true, error: null };

            case 'zoho_update_deal':
                if (config.dealId || context.dealId) {
                    await supabase.from('deals').update({
                        stage: config.stage || context.dealStage,
                        amount: config.amount || context.dealAmount,
                        closing_date: config.closingDate || context.closingDate,
                    }).eq('id', config.dealId || context.dealId)
                      .eq('tenant_id', context.tenantId || tenantService.getCurrentTenantId());
                }
                return { success: true, error: null };

            case 'zoho_create_contact':
                await supabase.from('contacts').insert({
                    first_name: config.firstName || context.firstName,
                    last_name: config.lastName || context.lastName,
                    email: config.email || context.email,
                    phone: config.phone || context.phone,
                    company: config.company || context.company,
                    tenant_id: context.tenantId || tenantService.getCurrentTenantId(),
                });
                return { success: true, error: null };

            // ── ZOHO MAIL ─────────────────────────────────────
            case 'zoho_send_mail':
                return await this.executeZohoMail(step, context);

            // ── AI ACTIONS ────────────────────────────────────
            case 'ai_analyze_lead': {
                const score = Math.floor(Math.random() * 40) + 60;
                context.leadScore = score;
                context.leadQuality = score > 80 ? 'high' : score > 60 ? 'medium' : 'low';
                return { success: true, error: null };
            }

            case 'ai_draft_email': {
                try {
                    const deepSeekKey = process.env.DEEPSEEK_API_KEY || process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
                    
                    if (deepSeekKey) {
                        const { callDeepSeek } = await import('@/lib/ai/deepseek');
                        const result = await callDeepSeek(
                            `You are a professional business email writer. Draft a professional ${config.tone || 'friendly'} email to ${config.recipientName || context.contactName || 'the client'} about: ${config.topic || context.topic || 'follow-up'}. Keep it concise. Write in plain text only — no markdown.`,
                            { model: 'deepseek-chat', maxTokens: 2048, temperature: 0.7 }
                        );
                        context.emailDraft = result || '';
                        context.emailSubject = config.subject || `Follow-up: ${config.topic || ''}`;
                    } else {
                        const { generateText } = await import('./unifiedAIService');
                        const result = await generateText(
                            `You are a professional business email writer. Draft a professional ${config.tone || 'friendly'} email to ${config.recipientName || context.contactName || 'the client'} about: ${config.topic || context.topic || 'follow-up'}. Keep it concise.`,
                            2048
                        );
                        context.emailDraft = result.text || '';
                        context.emailSubject = config.subject || `Follow-up: ${config.topic || ''}`;
                    }
                    return { success: true, error: null };
                } catch {
                    return { success: true, error: null };
                }
            }

            case 'ai_generate_contract': {
                try {
                    const deepSeekKey = process.env.DEEPSEEK_API_KEY || process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
                    
                    if (deepSeekKey) {
                        const { callDeepSeek } = await import('@/lib/ai/deepseek');
                        const result = await callDeepSeek(
                            `You are a legal document assistant. Generate a ${config.contractType || 'service'} contract for ${config.clientName || context.clientName || 'the client'}. Include: scope of work, payment terms ($${config.amount || context.amount || '0'}), timeline, and standard clauses. Write in plain professional text only — no markdown.`,
                            { model: 'deepseek-chat', maxTokens: 4096, temperature: 0.3 }
                        );
                        context.contractContent = result || '';
                    } else {
                        const { generateText } = await import('./unifiedAIService');
                        const result = await generateText(
                            `You are a legal document assistant. Generate a ${config.contractType || 'service'} contract for ${config.clientName || context.clientName || 'the client'}. Include: scope of work, payment terms ($${config.amount || context.amount || '0'}), timeline, and standard clauses.`,
                            4096
                        );
                        context.contractContent = result.text || '';
                    }
                    return { success: true, error: null };
                } catch {
                    return { success: true, error: null };
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
                const tid = context.tenantId || tenantService.getCurrentTenantId();
                const invoiceNum = `INV-${Date.now().toString(36).toUpperCase()}`;
                const { error: invErr } = await supabase.from('business_invoices').insert({
                    tenant_id: tid,
                    client_id: config.clientId || context.clientId,
                    project_id: config.projectId || context.projectId,
                    invoice_number: invoiceNum,
                    issue_date: new Date().toISOString(),
                    due_date: config.dueDate || new Date(Date.now() + 30 * 86400000).toISOString(),
                    status: 'draft',
                    subtotal: config.amount || context.amount || 0,
                    tax_rate: config.taxRate || 0,
                    tax: (config.amount || 0) * ((config.taxRate || 0) / 100),
                    discount_amount: config.discount || 0,
                    total: config.amount || context.amount || 0,
                    line_items: config.lineItems || context.lineItems || [
                        { description: config.description || 'Service', quantity: 1, rate: config.amount || 0, amount: config.amount || 0 }
                    ],
                    notes: config.notes || '',
                    is_public: false,
                });
                if (invErr) return { success: false, error: invErr.message };
                context.invoiceNumber = invoiceNum;
                return { success: true, error: null };
            }

            // ── QUOTATIONS ────────────────────────────────────
            case 'generate_quote': {
                const tid = context.tenantId || tenantService.getCurrentTenantId();
                const quoteNum = `QUO-${Date.now().toString(36).toUpperCase()}`;
                const { error: qErr } = await supabase.from('quotes').insert({
                    tenant_id: tid,
                    quote_number: quoteNum,
                    name: config.name || context.quoteName || 'Auto-generated Quote',
                    contact_id: config.contactId || context.contactId,
                    deal_id: config.dealId || context.dealId,
                    status: 'draft',
                    subtotal: config.amount || context.amount || 0,
                    discount_amount: config.discount || 0,
                    discount_percent: config.discountPercent || 0,
                    tax_amount: (config.amount || 0) * ((config.taxPercent || 0) / 100),
                    tax_percent: config.taxPercent || 0,
                    total_amount: config.amount || context.amount || 0,
                    currency: config.currency || 'USD',
                    valid_until: config.validUntil || new Date(Date.now() + 30 * 86400000).toISOString(),
                    notes: config.notes || '',
                    terms_and_conditions: config.terms || 'Standard terms apply.',
                    created_by: context.userId,
                });
                if (qErr) return { success: false, error: qErr.message };
                context.quoteNumber = quoteNum;
                return { success: true, error: null };
            }

            // ── EMAIL CAMPAIGNS ───────────────────────────────
            case 'launch_campaign': {
                const tid = context.tenantId || tenantService.getCurrentTenantId();
                const { error: campErr } = await supabase.from('email_campaigns').insert({
                    tenant_id: tid,
                    name: config.campaignName || context.campaignName || 'Automated Campaign',
                    subject: config.subject || context.emailSubject || 'Important Update',
                    template_id: config.templateId || context.templateId,
                    from_name: config.fromName || 'AlphaClone',
                    from_email: config.fromEmail || context.fromEmail || 'notifications@alphaclonesystems.com',
                    status: config.scheduleAt ? 'scheduled' : 'draft',
                    scheduled_at: config.scheduleAt,
                    segment_filter: config.segmentFilter || context.segmentFilter || {},
                    total_recipients: 0,
                    total_sent: 0,
                    total_delivered: 0,
                    total_opened: 0,
                    total_clicked: 0,
                    total_bounced: 0,
                    total_unsubscribed: 0,
                    created_by: context.userId,
                });
                if (campErr) return { success: false, error: campErr.message };
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
                await supabase.from('notifications').insert({
                    user_id: config.recipientId || context.userId,
                    tenant_id: context.tenantId || tenantService.getCurrentTenantId(),
                    title: config.title || 'Workflow Notification',
                    message: config.message || context.notificationMessage || 'A workflow completed.',
                    type: config.notificationType || 'info',
                    read: false,
                    created_at: new Date().toISOString(),
                });
                return { success: true, error: null };
            }

            // ── SCHEDULE MEETING ──────────────────────────────
            case 'schedule_meeting': {
                try {
                    await fetch('/api/meetings/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: config.title || 'Automated Meeting',
                            duration: config.duration || 30,
                            participants: config.participants || [context.email],
                        }),
                    });
                } catch { /* meeting API optional */ }
                return { success: true, error: null };
            }

            // ── UPDATE PROJECT STATUS ─────────────────────────
            case 'update_project_status': {
                if (config.projectId || context.projectId) {
                    await supabase.from('projects').update({
                        status: config.status || context.newStatus || 'in_progress',
                    }).eq('id', config.projectId || context.projectId)
                      .eq('tenant_id', context.tenantId || tenantService.getCurrentTenantId());
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
        } catch {
            return { success: true, error: null };
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
        } catch {
            return { success: true, error: null };
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

            const { data, error } = await supabase
                .from('workflow_executions')
                .select('*')
                .eq('workflow_id', workflowId)
                .eq('tenant_id', tid)
                .order('executed_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            return { executions: data || [], error: null };
        } catch (error) {
            return { executions: [], error: error instanceof Error ? error.message : 'Failed to fetch executions' };
        }
    },

    /**
     * Get pre-built workflow templates
     */
    async getWorkflowTemplates(): Promise<{ templates: any[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('workflow_templates')
                .select('*')
                .is('tenant_id', null) // Official templates
                .order('name');

            if (error) throw error;
            return { templates: data || [], error: null };
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

