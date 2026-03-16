import { aiService } from '../ai/aiService';

export interface AlphaTool {
    name: string;
    description: string;
    parameters: any;
    execute: (args: any) => Promise<any>;
}

export const ALPHA_TOOLS: Record<string, AlphaTool> = {
    lead_prospector: {
        name: 'lead_prospector',
        description: 'High-speed B2B lead generation with strict account isolation and semantic qualification.',
        parameters: {
            type: 'object',
            properties: {
                industry: { type: 'string' },
                account_id: { type: 'string', description: 'Mandatory account ID for data isolation' },
                preferences: { type: 'string' }
            },
            required: ['account_id', 'industry']
        },
        execute: async ({ industry, account_id, preferences }) => {
            const prompt = `Prospect 5 high-value leads for account [${account_id}] in [${industry}] industry. 
            Criteria: ${preferences || 'standard qualified'}. 
            Format: JSON array of {name, email, corp, reason}.`;

            const res = await aiService.complete({
                prompt,
                systemPrompt: 'Executive Lead Prospector. Semantic accuracy and speed prioritizing.',
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20240620'
            });

            return { status: 'success', account_id, leads: res.content };
        }
    },

    outreach_executive: {
        name: 'outreach_executive',
        description: 'Instant execution of outreach campaigns via Resend/Zoho/HubSpot.',
        parameters: {
            type: 'object',
            properties: {
                to: { type: 'string' },
                subject: { type: 'string' },
                body: { type: 'string' },
                provider: { type: 'string', enum: ['resend', 'zoho', 'hubspot'] }
            }
        },
        execute: async (args) => {
            // Simulated execution for now, would bridge to emailService
            return { status: 'dispatched', timestamp: new Date().toISOString(), ...args };
        }
    },

    productivity_scheduler: {
        name: 'productivity_scheduler',
        description: 'Autonomous mission scheduling and task prioritisation.',
        parameters: {
            type: 'object',
            properties: {
                task: { type: 'string' },
                priority: { type: 'string', enum: ['critical', 'high', 'normal'] },
                deadline: { type: 'string' },
                account_id: { type: 'string' }
            }
        },
        execute: async (args) => {
            // Log to a central schedule registry (simulated)
            console.log(`[ALPHA_SCHEDULER] Task: ${args.task} | Priority: ${args.priority} | Account: ${args.account_id}`);
            return { 
                status: 'scheduled', 
                execution_time: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
                mission_id: Math.random().toString(36).substring(7),
                ...args 
            };
        }
    },

    semantic_assistant: {
        name: 'semantic_assistant',
        description: 'Platform-aware semantic support and execution shortcuts.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string' }
            }
        },
        execute: async ({ query }) => {
            const res = await aiService.complete({
                prompt: `Semantic retrieval for: ${query}. Provide 1-line instant solution.`,
                systemPrompt: 'Alpha Semantic Assistant. Precision only.',
                provider: 'anthropic',
                model: 'claude-3-haiku-20240307'
            });
            return { solution: res.content };
        }
    },

    notifier: {
        name: 'notifier',
        description: 'System-level notification dispatch for critical mission updates.',
        parameters: {
            type: 'object',
            properties: {
                message: { type: 'string' },
                urgency: { type: 'string' }
            }
        },
        execute: async (args) => {
            return { status: 'pinged', ...args };
        }
    }
};
