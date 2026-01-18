/**
 * Workflow Examples
 * Demonstrates how to create and use workflows
 */

import { workflowService, workflowEngine } from './workflow';
import type { WorkflowDefinition } from './workflow';

// ============================================
// EXAMPLE 1: Client Onboarding Workflow
// ============================================

const clientOnboardingWorkflow: WorkflowDefinition = {
    name: 'Client Onboarding',
    description: 'Automated client onboarding process',
    trigger: {
        type: 'event',
        event: 'client.created'
    },
    steps: [
        {
            id: 'send_welcome_email',
            name: 'Send Welcome Email',
            type: 'email',
            config: {
                template: 'client_welcome',
                to: '{{client.email}}',
                subject: 'Welcome to AlphaClone Systems!',
                body: 'Hi {{client.name}}, welcome aboard!'
            }
        },
        {
            id: 'create_onboarding_project',
            name: 'Create Onboarding Project',
            type: 'action',
            config: {
                action: 'createProject',
                params: {
                    name: '{{client.name}} - Onboarding',
                    ownerId: '{{client.id}}',
                    status: 'active'
                }
            }
        },
        {
            id: 'schedule_kickoff_meeting',
            name: 'Schedule Kickoff Meeting',
            type: 'meeting',
            config: {
                title: 'Kickoff Meeting with {{client.name}}',
                duration: 60,
                participants: ['{{client.email}}', 'admin@alphaclone.tech']
            }
        },
        {
            id: 'wait_for_contract',
            name: 'Wait for Contract Signature',
            type: 'wait',
            config: {
                event: 'contract.signed',
                timeout: '7d'
            }
        },
        {
            id: 'activate_services',
            name: 'Activate Client Services',
            type: 'action',
            config: {
                action: 'activateClientServices',
                params: {
                    clientId: '{{client.id}}'
                }
            }
        },
        {
            id: 'send_activation_email',
            name: 'Send Activation Confirmation',
            type: 'email',
            config: {
                template: 'services_activated',
                to: '{{client.email}}',
                subject: 'Your services are now active!'
            }
        }
    ]
};

// ============================================
// EXAMPLE 2: Invoice Follow-up Workflow
// ============================================

const invoiceFollowupWorkflow: WorkflowDefinition = {
    name: 'Invoice Follow-up',
    description: 'Automated follow-up for overdue invoices',
    trigger: {
        type: 'event',
        event: 'invoice.overdue'
    },
    steps: [
        {
            id: 'send_first_reminder',
            name: 'Send First Reminder',
            type: 'email',
            config: {
                template: 'payment_reminder_1',
                to: '{{invoice.clientEmail}}',
                subject: 'Payment Reminder - Invoice #{{invoice.number}}'
            }
        },
        {
            id: 'wait_3_days',
            name: 'Wait 3 Days',
            type: 'wait',
            config: {
                duration: '3d'
            }
        },
        {
            id: 'check_payment_status',
            name: 'Check if Paid',
            type: 'condition',
            config: {
                condition: 'context.variables.invoice.status === "paid"',
                thenSteps: ['send_thank_you'],
                elseSteps: ['send_second_reminder']
            }
        },
        {
            id: 'send_second_reminder',
            name: 'Send Second Reminder',
            type: 'email',
            config: {
                template: 'payment_reminder_2',
                to: '{{invoice.clientEmail}}',
                subject: 'Urgent: Payment Overdue - Invoice #{{invoice.number}}'
            }
        },
        {
            id: 'wait_another_3_days',
            name: 'Wait Another 3 Days',
            type: 'wait',
            config: {
                duration: '3d'
            }
        },
        {
            id: 'create_follow_up_task',
            name: 'Create Follow-up Task',
            type: 'action',
            config: {
                action: 'createTask',
                params: {
                    title: 'Follow up on overdue invoice #{{invoice.number}}',
                    priority: 'high',
                    assignedTo: 'admin'
                }
            }
        },
        {
            id: 'send_notification',
            name: 'Notify Admin',
            type: 'notification',
            config: {
                title: 'Overdue Invoice Requires Attention',
                message: 'Invoice #{{invoice.number}} is {{invoice.daysOverdue}} days overdue',
                userId: 'admin',
                type: 'warning'
            }
        }
    ]
};

// ============================================
// EXAMPLE 3: Project Completion Workflow
// ============================================

const projectCompletionWorkflow: WorkflowDefinition = {
    name: 'Project Completion',
    description: 'Automated tasks when project is completed',
    trigger: {
        type: 'event',
        event: 'project.completed'
    },
    steps: [
        {
            id: 'generate_final_invoice',
            name: 'Generate Final Invoice',
            type: 'action',
            config: {
                action: 'generateInvoice',
                params: {
                    projectId: '{{project.id}}',
                    type: 'final',
                    amount: '{{project.remainingBalance}}'
                }
            }
        },
        {
            id: 'send_completion_email',
            name: 'Send Completion Email',
            type: 'email',
            config: {
                template: 'project_completed',
                to: '{{project.clientEmail}}',
                subject: 'Project Completed: {{project.name}}'
            }
        },
        {
            id: 'wait_2_days',
            name: 'Wait 2 Days',
            type: 'wait',
            config: {
                duration: '2d'
            }
        },
        {
            id: 'request_feedback',
            name: 'Request Client Feedback',
            type: 'email',
            config: {
                template: 'feedback_request',
                to: '{{project.clientEmail}}',
                subject: 'How was your experience with {{project.name}}?'
            }
        },
        {
            id: 'archive_project',
            name: 'Archive Project',
            type: 'action',
            config: {
                action: 'archiveProject',
                params: {
                    projectId: '{{project.id}}'
                }
            }
        }
    ]
};

// ============================================
// EXAMPLE 4: Using Workflows
// ============================================

export async function exampleUsage() {
    // Create a workflow
    const workflow = await workflowService.createWorkflow({
        name: 'My Custom Workflow',
        description: 'A custom workflow for my business',
        definition: clientOnboardingWorkflow,
        isActive: true
    });

    console.log('Created workflow:', workflow.id);

    // Execute workflow manually
    const instance = await workflowService.executeWorkflow(workflow.id, {
        client: {
            id: 'client-123',
            name: 'John Doe',
            email: 'john@example.com'
        }
    });

    console.log('Workflow instance:', instance.id);

    // Get workflow statistics
    const stats = await workflowService.getStatistics(workflow.id);
    console.log('Workflow stats:', stats);

    // List all workflow instances
    const instances = await workflowService.listInstances(workflow.id);
    console.log('Total instances:', instances.length);

    // Create workflow from template
    const fromTemplate = await workflowService.createFromTemplate(
        'template-id',
        'My Workflow from Template'
    );

    console.log('Created from template:', fromTemplate.id);
}

// ============================================
// EXAMPLE 5: Custom Step Executor
// ============================================

// Register a custom step executor
workflowEngine.registerExecutor('custom_action', async (step, context) => {
    console.log('Executing custom action:', step.config);

    // Your custom logic here
    return { success: true };
});

// ============================================
// EXAMPLE 6: Conditional Workflow
// ============================================

const conditionalWorkflow: WorkflowDefinition = {
    name: 'Conditional Approval',
    description: 'Workflow with conditional logic',
    steps: [
        {
            id: 'check_amount',
            name: 'Check Invoice Amount',
            type: 'condition',
            config: {
                condition: 'context.variables.invoice.amount > 10000',
                thenSteps: ['require_approval'],
                elseSteps: ['auto_approve']
            }
        },
        {
            id: 'require_approval',
            name: 'Require Manager Approval',
            type: 'approval',
            config: {
                approvers: ['manager@company.com'],
                message: 'Please approve invoice for ${{invoice.amount}}'
            }
        },
        {
            id: 'auto_approve',
            name: 'Auto Approve',
            type: 'action',
            config: {
                action: 'approveInvoice',
                params: {
                    invoiceId: '{{invoice.id}}'
                }
            }
        }
    ]
};

// Export example workflows
export const exampleWorkflows = {
    clientOnboarding: clientOnboardingWorkflow,
    invoiceFollowup: invoiceFollowupWorkflow,
    projectCompletion: projectCompletionWorkflow,
    conditional: conditionalWorkflow
};
