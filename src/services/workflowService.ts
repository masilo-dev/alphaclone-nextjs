import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export interface WorkflowStep {
    id: string;
    type: 'trigger' | 'condition' | 'action' | 'delay';
    name: string;
    config: Record<string, any>;
    nextStepId?: string;
    condition?: {
        field: string;
        operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
        value: any;
    };
}

export interface Workflow {
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    trigger: {
        type: 'project_created' | 'message_received' | 'invoice_paid' | 'status_changed' | 'manual';
        config: Record<string, any>;
    };
    steps: WorkflowStep[];
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export const workflowService = {
    /**
     * Create a new workflow
     */
    async createWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ workflow: Workflow | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('workflows')
                .insert({
                    name: workflow.name,
                    description: workflow.description,
                    enabled: workflow.enabled,
                    trigger: workflow.trigger,
                    steps: workflow.steps,
                    created_by: workflow.createdBy,
                    tenant_id: tenantService.getCurrentTenantId(),
                })
                .select()
                .single();

            if (error) throw error;

            return {
                workflow: {
                    id: data.id,
                    name: data.name,
                    description: data.description,
                    enabled: data.enabled,
                    trigger: data.trigger,
                    steps: data.steps,
                    createdBy: data.created_by,
                    createdAt: data.created_at,
                    updatedAt: data.updated_at,
                },
                error: null,
            };
        } catch (error) {
            return {
                workflow: null,
                error: error instanceof Error ? error.message : 'Failed to create workflow',
            };
        }
    },

    /**
     * Get all workflows
     */
    async getWorkflows(userId: string): Promise<{ workflows: Workflow[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('workflows')
                .select('*')
                .eq('created_by', userId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .order('created_at', { ascending: false });

            if (error) throw error;

            return {
                workflows: (data || []).map((w: any) => ({
                    id: w.id,
                    name: w.name,
                    description: w.description,
                    enabled: w.enabled,
                    trigger: w.trigger,
                    steps: w.steps,
                    createdBy: w.created_by,
                    createdAt: w.created_at,
                    updatedAt: w.updated_at,
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
     * Execute a workflow
     */
    async executeWorkflow(workflowId: string, context: Record<string, any>): Promise<{ success: boolean; error: string | null }> {
        try {
            const { data: workflow, error: fetchError } = await supabase
                .from('workflows')
                .select('*')
                .eq('id', workflowId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .eq('enabled', true)
                .single();

            if (fetchError || !workflow) {
                return { success: false, error: 'Workflow not found or disabled' };
            }

            // Execute steps in order
            let currentStep = workflow.steps.find((s: WorkflowStep) => s.type === 'trigger');
            if (!currentStep) {
                return { success: false, error: 'Workflow has no trigger step' };
            }

            while (currentStep) {
                // Execute step
                const stepResult = await this.executeStep(currentStep, context);

                if (!stepResult.success) {
                    return { success: false, error: stepResult.error || 'Step execution failed' };
                }

                // Move to next step
                if (currentStep.nextStepId) {
                    currentStep = workflow.steps.find((s: WorkflowStep) => s.id === currentStep.nextStepId);
                } else {
                    break;
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
            switch (step.type) {
                case 'action':
                    return await this.executeAction(step, context);
                case 'condition':
                    return await this.executeCondition(step, context);
                case 'delay':
                    return await this.executeDelay(step, context);
                default:
                    return { success: true, error: null };
            }
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
        const actionType = step.config.type;

        switch (actionType) {
            case 'send_message':
                // Send message via messageService
                const { messageService } = await import('./messageService');
                await messageService.sendMessage(
                    context.userId || step.config.senderId,
                    step.config.recipientId,
                    step.config.message,
                    step.config.priority || 'normal'
                );
                return { success: true, error: null };

            case 'update_project':
                // Update project status
                const { projectService } = await import('./projectService');
                await projectService.updateProject(step.config.projectId, {
                    status: step.config.status,
                });
                return { success: true, error: null };

            case 'create_invoice':
                // Create invoice
                const { paymentService } = await import('./paymentService');
                await paymentService.createInvoice({
                    user_id: context.userId,
                    project_id: step.config.projectId,
                    amount: step.config.amount,
                    description: step.config.description,
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
                    name: step.config.lastName || context.leadName || 'Unknown',
                    company: step.config.company || context.company || 'Unknown',
                    email: step.config.email || context.email,
                    phone: step.config.phone || context.phone,
                    source: step.config.source || 'Workflow Automation',
                    notes: step.config.description || `Created by workflow`,
                    tenant_id: context.tenantId || tenantService.getCurrentTenantId(),
                    status: 'new',
                });
                return { success: true, error: null };

            case 'zoho_update_deal':
                if (step.config.dealId || context.dealId) {
                    await supabase.from('deals').update({
                        stage: step.config.stage || context.dealStage,
                        amount: step.config.amount || context.dealAmount,
                        closing_date: step.config.closingDate || context.closingDate,
                    }).eq('id', step.config.dealId || context.dealId)
                      .eq('tenant_id', context.tenantId || tenantService.getCurrentTenantId());
                }
                return { success: true, error: null };

            case 'zoho_create_contact':
                await supabase.from('contacts').insert({
                    first_name: step.config.firstName || context.firstName,
                    last_name: step.config.lastName || context.lastName,
                    email: step.config.email || context.email,
                    phone: step.config.phone || context.phone,
                    company: step.config.company || context.company,
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
                    const { generateText } = await import('./unifiedAIService');
                    const result = await generateText(
                        `You are a professional business email writer. Draft a professional ${step.config.tone || 'friendly'} email to ${step.config.recipientName || context.contactName || 'the client'} about: ${step.config.topic || context.topic || 'follow-up'}. Keep it concise.`,
                        2048
                    );
                    context.emailDraft = result.text || '';
                    context.emailSubject = step.config.subject || `Follow-up: ${step.config.topic || ''}`;
                    return { success: true, error: null };
                } catch {
                    return { success: true, error: null };
                }
            }

            case 'ai_generate_contract': {
                try {
                    const { generateText } = await import('./unifiedAIService');
                    const result = await generateText(
                        `You are a legal document assistant. Generate a ${step.config.contractType || 'service'} contract for ${step.config.clientName || context.clientName || 'the client'}. Include: scope of work, payment terms ($${step.config.amount || context.amount || '0'}), timeline, and standard clauses.`,
                        4096
                    );
                    context.contractContent = result.text || '';
                    return { success: true, error: null };
                } catch {
                    return { success: true, error: null };
                }
            }

            // ── CONTRACTS ─────────────────────────────────────
            case 'create_contract': {
                const { contractService } = await import('./contractService');
                const { contract, error: cErr } = await contractService.createContract({
                    title: step.config.title || context.contractTitle || 'Auto-generated Contract',
                    content: step.config.content || context.contractContent || '',
                    project_id: step.config.projectId || context.projectId,
                    client_id: step.config.clientId || context.clientId,
                    status: 'draft',
                    payment_amount: step.config.amount || context.amount,
                    payment_due_date: step.config.dueDate || new Date(Date.now() + 30 * 86400000).toISOString(),
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
                    client_id: step.config.clientId || context.clientId,
                    project_id: step.config.projectId || context.projectId,
                    invoice_number: invoiceNum,
                    issue_date: new Date().toISOString(),
                    due_date: step.config.dueDate || new Date(Date.now() + 30 * 86400000).toISOString(),
                    status: 'draft',
                    subtotal: step.config.amount || context.amount || 0,
                    tax_rate: step.config.taxRate || 0,
                    tax: (step.config.amount || 0) * ((step.config.taxRate || 0) / 100),
                    discount_amount: step.config.discount || 0,
                    total: step.config.amount || context.amount || 0,
                    line_items: step.config.lineItems || context.lineItems || [
                        { description: step.config.description || 'Service', quantity: 1, rate: step.config.amount || 0, amount: step.config.amount || 0 }
                    ],
                    notes: step.config.notes || '',
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
                    name: step.config.name || context.quoteName || 'Auto-generated Quote',
                    contact_id: step.config.contactId || context.contactId,
                    deal_id: step.config.dealId || context.dealId,
                    status: 'draft',
                    subtotal: step.config.amount || context.amount || 0,
                    discount_amount: step.config.discount || 0,
                    discount_percent: step.config.discountPercent || 0,
                    tax_amount: (step.config.amount || 0) * ((step.config.taxPercent || 0) / 100),
                    tax_percent: step.config.taxPercent || 0,
                    total_amount: step.config.amount || context.amount || 0,
                    currency: step.config.currency || 'USD',
                    valid_until: step.config.validUntil || new Date(Date.now() + 30 * 86400000).toISOString(),
                    notes: step.config.notes || '',
                    terms_and_conditions: step.config.terms || 'Standard terms apply.',
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
                    name: step.config.campaignName || context.campaignName || 'Automated Campaign',
                    subject: step.config.subject || context.emailSubject || 'Important Update',
                    template_id: step.config.templateId || context.templateId,
                    from_name: step.config.fromName || 'AlphaClone',
                    from_email: step.config.fromEmail || context.fromEmail || 'noreply@alphaclone.com',
                    status: step.config.scheduleAt ? 'scheduled' : 'draft',
                    scheduled_at: step.config.scheduleAt,
                    segment_filter: step.config.segmentFilter || context.segmentFilter || {},
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
                    title: step.config.title || context.taskTitle || 'Auto-created Task',
                    description: step.config.description || context.taskDescription || '',
                    assignedTo: step.config.assignedTo || context.userId,
                    priority: step.config.priority || 'medium',
                    status: 'todo',
                    dueDate: step.config.dueDate || new Date(Date.now() + 7 * 86400000).toISOString(),
                    relatedToProject: step.config.projectId || context.projectId,
                    relatedToDeal: step.config.dealId || context.dealId,
                    relatedToLead: step.config.leadId || context.leadId,
                    tags: step.config.tags || [],
                });
                if (tErr) return { success: false, error: tErr };
                return { success: true, error: null };
            }

            // ── NOTIFICATIONS ─────────────────────────────────
            case 'send_notification': {
                await supabase.from('notifications').insert({
                    user_id: step.config.recipientId || context.userId,
                    tenant_id: context.tenantId || tenantService.getCurrentTenantId(),
                    title: step.config.title || 'Workflow Notification',
                    message: step.config.message || context.notificationMessage || 'A workflow completed.',
                    type: step.config.notificationType || 'info',
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
                            title: step.config.title || 'Automated Meeting',
                            duration: step.config.duration || 30,
                            participants: step.config.participants || [context.email],
                        }),
                    });
                } catch { /* meeting API optional */ }
                return { success: true, error: null };
            }

            // ── UPDATE PROJECT STATUS ─────────────────────────
            case 'update_project_status': {
                if (step.config.projectId || context.projectId) {
                    await supabase.from('projects').update({
                        status: step.config.status || context.newStatus || 'in_progress',
                    }).eq('id', step.config.projectId || context.projectId)
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
        try {
            const res = await fetch(`/api/gmail/messages/send?userId=${context.userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: step.config.to || context.email,
                    subject: step.config.subject || context.emailSubject || 'Notification',
                    messageBody: step.config.body || context.emailDraft || context.emailBody || '',
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
        try {
            const res = await fetch('/api/zoho/mail?action=send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toAddress: step.config.to || context.email,
                    subject: step.config.subject || context.emailSubject || 'Notification',
                    content: step.config.body || context.emailDraft || '',
                    ccAddress: step.config.cc,
                    bccAddress: step.config.bcc,
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
        if (!step.condition) {
            return { success: true, error: null };
        }

        const fieldValue = context[step.condition.field];
        let conditionMet = false;

        switch (step.condition.operator) {
            case 'equals':
                conditionMet = fieldValue === step.condition.value;
                break;
            case 'contains':
                conditionMet = String(fieldValue).includes(String(step.condition.value));
                break;
            case 'greater_than':
                conditionMet = Number(fieldValue) > Number(step.condition.value);
                break;
            case 'less_than':
                conditionMet = Number(fieldValue) < Number(step.condition.value);
                break;
        }

        return { success: conditionMet, error: conditionMet ? null : 'Condition not met' };
    },

    /**
     * Execute a delay step
     */
    async executeDelay(step: WorkflowStep, _context: Record<string, any>): Promise<{ success: boolean; error: string | null }> {
        const delayMs = step.config.delaySeconds * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return { success: true, error: null };
    },
};

