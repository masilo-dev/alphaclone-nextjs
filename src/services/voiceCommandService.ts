import { generateText } from './unifiedAIService';
import { taskService } from './taskService';
import { businessInvoiceService } from './businessInvoiceService';
import { contractService } from './contractService';

export interface VoiceIntent {
    action: 'create_task' | 'create_invoice' | 'create_contract' | 'unknown';
    entities: {
        title?: string;
        description?: string;
        amount?: number;
        dueDate?: string;
        clientName?: string;
        priority?: 'low' | 'medium' | 'high' | 'urgent';
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
            
            Return a JSON object with the following structure:
            {
                "action": "create_task" | "create_invoice" | "create_contract" | "unknown",
                "entities": {
                    "title": "string",
                    "description": "string",
                    "amount": number,
                    "dueDate": "YYYY-MM-DD",
                    "clientName": "string",
                    "priority": "low" | "medium" | "high" | "urgent"
                }
            }
            
            Rules:
            - If date/time like "tomorrow" is mentioned, convert it to YYYY-MM-DD (Today is ${new Date().toISOString().split('T')[0]}).
            - Keep descriptions concise.
            - Return ONLY the JSON object.
        `;

        const { text, error } = await generateText(prompt, 500);

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
    async executeIntent(userId: string, intent: VoiceIntent): Promise<{ success: boolean; message: string; data?: any }> {
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

            default:
                return { success: false, message: "Intent could not be mapped to an operation." };
        }
    }
};
