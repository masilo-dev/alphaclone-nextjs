import { generateText } from './unifiedAIService';
import { taskService } from './taskService';
import { businessInvoiceService } from './businessInvoiceService';
import { contractService } from './contractService';
import { analyticsService } from './analyticsService';

export interface VoiceIntent {
    action: 'create_task' | 'create_invoice' | 'create_contract' | 'get_summary' | 'navigate' | 'search_leads' | 'create_event' | 'check_facebook' | 'send_email' | 'unknown';
    entities: {
        title?: string;
        description?: string;
        amount?: number;
        dueDate?: string;
        clientName?: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
        target?: string; // For navigation (e.g., 'leads', 'invoices')
        searchTerm?: string; // For searching leads/data
        recipientEmail?: string; // For emails
        startTime?: string; // For calendar events
    };
}

export const voiceCommandService = {
    /**
     * Process a transcript to extract intent and entities
     */
    async processTranscript(transcript: string): Promise<VoiceIntent> {
        const prompt = `
            Extract business operations intent from the following voice transcript: "${transcript}"
            
            Actions supported:
            - create_task: Creating a to-do, objective, or task.
            - create_invoice: Generating a bill or invoice.
            - create_contract: Drafting an agreement or contract.
            - get_summary: Asking for a summary, status report, or dashboard analysis.
            - navigate: Requesting to open, go to, or find a specific page/section (e.g., "open leads", "find invoices").
            - search_leads: Searching for a specific person, company, or lead by name or industry.
            - create_event: Adding a meeting, appointment, or event to the calendar.
            - check_facebook: Requesting status on Facebook ads, leads, or page activity.
            - send_email: Drafting or sending an email to a recipient.
            
            Return a JSON object with the following structure:
            {
                "action": "create_task" | "create_invoice" | "create_contract" | "get_summary" | "navigate" | "unknown",
                "entities": {
                    "title": "string",
                    "description": "string",
                    "amount": number,
                    "dueDate": "YYYY-MM-DD",
                    "clientName": "string",
                    "priority": "low" | "medium" | "high" | "urgent",
                    "target": "string",
                    "searchTerm": "string",
                    "recipientEmail": "string",
                    "startTime": "YYYY-MM-DD HH:mm"
                }
            }
            
            Rules:
            - If date/time like "tomorrow" is mentioned, convert it to YYYY-MM-DD (Today is ${new Date().toISOString().split('T')[0]}).
            - For navigation, normalize 'target' to one of: 'dashboard', 'leads', 'invoices', 'projects', 'calendar', 'documents', 'settings', 'mail'.
            - Keep descriptions concise.
            - Return ONLY the JSON object.
        `;

        const { text, error } = await generateText(prompt, 500, 'deepseek-chat');

        if (error || !text) {
            return { action: 'unknown', entities: {} };
        }

        try {
            // Clean markdown blocks if present
            const cleanJson = text.replace(/```json|```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (e) {
            console.error('Failed to parse voice intent JSON:', e);
            return { action: 'unknown', entities: {} };
        }
    },

    /**
     * Execute the extracted intent
     */
    async executeIntent(userId: string, intent: VoiceIntent): Promise<{ success: boolean; message: string; data?: any; redirect?: string }> {
        const { action, entities } = intent;

        switch (action) {
            case 'create_task':
                const { task, error: taskError } = await taskService.createTask(userId, {
                    title: entities.title || "Voice Captured Task",
                    description: entities.description,
                    dueDate: entities.dueDate,
                    priority: entities.priority || 'medium'
                });
                return {
                    success: !taskError,
                    message: taskError ? `Failed: ${taskError}` : "Objective initialized successfully",
                    data: task
                };

            case 'create_invoice':
                const { invoice, error: invError } = await businessInvoiceService.createInvoice(
                    "", // Tenant ID will be pulled from service internal context
                    {
                        invoiceNumber: `V-${Date.now().toString().slice(-4)}`,
                        total: entities.amount || 0,
                        notes: entities.description || "Voice generated invoice",
                        dueDate: entities.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                        status: 'draft',
                        lineItems: [{
                            description: entities.title || "Services Rendered",
                            quantity: 1,
                            rate: entities.amount || 0,
                            amount: entities.amount || 0
                        }]
                    }
                );
                return {
                    success: !invError,
                    message: invError ? `Failed: ${invError}` : "Invoice draft prepared",
                    data: invoice
                };

            case 'create_contract':
                const { contract, error: conError } = await contractService.createContract({
                    title: entities.title || "Voice Generated Agreement",
                    content: entities.description || "Agreement details pending...",
                    payment_amount: entities.amount,
                    payment_due_date: entities.dueDate
                });
                return {
                    success: !conError,
                    message: conError ? `Failed: ${conError.message}` : "Contract framework established",
                    data: contract
                };

            case 'get_summary':
                try {
                    const analytics = await analyticsService.getAnalytics('30d');
                    if (!analytics.data) throw new Error("Could not fetch analytics data");

                    const summaryPrompt = `
                        Analyze this business dashboard data and provide a concise audio-friendly summary.
                        Highlight key metrics (Revenue, Projects, Users) and suggest 1 key improvement area.
                        
                        Data: ${JSON.stringify(analytics.data)}
                        
                        Format: 2-3 short paragraphs. Friendly professional tone.
                    `;
                    
                    const { text: summaryText } = await generateText(summaryPrompt, 300, 'deepseek-chat');
                    return {
                        success: true,
                        message: summaryText || "Here is your dashboard summary.",
                        data: { summary: summaryText, analytics: analytics.data }
                    };
                } catch (e) {
                    return { success: false, message: "Failed to generate summary analysis." };
                }

            case 'search_leads':
                return {
                    success: true,
                    message: `Searching for "${entities.searchTerm || entities.clientName || 'leads'}"...`,
                    redirect: `/dashboard/leads?search=${encodeURIComponent(entities.searchTerm || entities.clientName || '')}`
                };

            case 'create_event':
                return {
                    success: true,
                    message: "Opening calendar to schedule your event...",
                    redirect: `/dashboard/calendar?action=create&title=${encodeURIComponent(entities.title || '')}&date=${entities.dueDate || ''}`
                };

            case 'check_facebook':
                return {
                    success: true,
                    message: "Analyzing Facebook integration status and recent activity...",
                    redirect: '/dashboard/facebook?tab=activity'
                };

            case 'send_email':
                return {
                    success: true,
                    message: `Preparing email draft for ${entities.recipientEmail || entities.clientName || 'recipient'}...`,
                    redirect: `/dashboard/mail?action=compose&to=${encodeURIComponent(entities.recipientEmail || '')}&subject=${encodeURIComponent(entities.title || '')}`
                };

            default:
                return { success: false, message: "Intent could not be mapped to an operational command." };
        }
    }
};
