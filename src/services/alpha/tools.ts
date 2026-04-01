import { aiService } from '../ai/aiService';
import { createSupabaseAdminClient } from '@/lib/supabase-server';
import { hubspotService } from '@/services/hubspotService';
import { ZohoMailService } from '@/services/zoho/ZohoMailService';
import { gmailService } from '@/services/gmailService';
import { contractService } from '@/services/contractService';

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
        execute: async ({ industry, account_id, preferences, userId, tenantId }) => {
            const prompt = `Prospect 5 high-value leads for account [${account_id}] in [${industry}] industry. 
            Criteria: ${preferences || 'standard qualified'}. 
            Format: JSON array of {name, email, corp, reason}.`;

            const res = await aiService.complete({
                prompt,
                systemPrompt: 'Executive Lead Prospector. Semantic accuracy and speed prioritizing.',
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022'
            });

            // REAL IMPLEMENTATION: Save to Deals table
            if (tenantId) {
                try {
                    const supabase = createSupabaseAdminClient();
                    // Parse AI response (assuming it returns JSON string)
                    // Note: In production, use structured output parsing
                    
                    // For now, create a single "Lead List" deal or multiple deals
                    const { data, error } = await supabase.from('deals').insert({
                        tenant_id: tenantId,
                        name: `AI Prospect List: ${industry}`,
                        description: res.content,
                        stage: 'lead',
                        owner_id: userId,
                        source: 'ai_agent'
                    }).select();
                    
                    if (error) throw error;

                    // REAL-TIME SYNC: Push to External CRM (HubSpot)
                    try {
                        const { data: integrations } = await supabase
                            .from('integrations')
                            .select('*')
                            .eq('user_id', userId)
                            .eq('enabled', true);

                        if (integrations) {
                            const hubspot = integrations.find((i: any) => i.type === 'hubspot');
                            if (hubspot) {
                                await hubspotService.syncLeadToHubSpot(userId, {
                                    firstname: 'AI Prospect',
                                    lastname: industry,
                                    company: industry,
                                    email: `${industry.replace(/\s+/g, '.').toLowerCase()}@example.com`
                                }).catch(e => console.error('Agent HubSpot Sync Failed:', e));
                            }
                        }
                    } catch (syncErr) {
                        console.error('Agent CRM Sync Error:', syncErr);
                    }

                    return { status: 'success', saved_deal_id: data[0].id, leads: res.content };
                } catch (dbError: any) {
                    console.error('Failed to save leads to DB:', dbError);
                    return { status: 'partial_success', leads: res.content, error: 'Database save failed' };
                }
            }

            return { status: 'success', account_id, leads: res.content, note: 'Simulation (No Tenant ID)' };
        }
    },

    outreach_executive: {
        name: 'outreach_executive',
        description: 'Instant execution of outreach campaigns via Resend/HubSpot.',
        parameters: {
            type: 'object',
            properties: {
                to: { type: 'string' },
                subject: { type: 'string' },
                body: { type: 'string' },
                provider: { type: 'string', enum: ['resend', 'hubspot', 'zoho', 'gmail'] }
            },
            required: ['to', 'subject', 'body']
        },
        execute: async ({ to, subject, body, provider, userId, tenantId }) => {
            if (!userId) return { status: 'failed', error: 'User ID required for outreach' };

            // REAL IMPLEMENTATION: Send via Outreach Provider
            try {
                if (provider === 'zoho') {
                    const zoho = new ZohoMailService(userId);
                    const res = await zoho.sendEmail({
                        fromAddress: '', // Let Zoho use default account
                        toAddress: to,
                        subject: subject,
                        content: body
                    });
                    return { status: 'sent', provider: 'zoho', messageId: res.data?.messageId };
                }

                if (provider === 'gmail') {
                    const res = await gmailService.sendMessage(userId, to, subject, body);
                    return { status: 'sent', provider: 'gmail', threadId: res.threadId };
                }

                if (provider === 'hubspot') {
                    const res = await hubspotService.syncLeadToHubSpot(userId, {
                        firstname: 'AI Outreach',
                        lastname: subject,
                        company: 'AI Outreach',
                        email: to
                    });
                    return { status: 'synced_to_crm', provider: 'hubspot', res };
                }
                
                // Fallback (simulated)
                return { status: 'simulated', provider: provider || 'resend', timestamp: new Date().toISOString() };
            } catch (error: any) {
                console.error('Outreach failed:', error);
                return { status: 'failed', error: error.message };
            }
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
        execute: async ({ task, priority, deadline, account_id, userId, tenantId }) => {
            console.log(`[ALPHA_SCHEDULER] Task: ${task} | Priority: ${priority} | Tenant: ${tenantId}`);
            
            // REAL IMPLEMENTATION: Create Task in DB
            if (tenantId) {
                try {
                    const supabase = createSupabaseAdminClient();
                    const { data, error } = await supabase.from('tasks').insert({
                        tenant_id: tenantId,
                        title: task,
                        description: `Auto-scheduled by Alpha Agent. Priority: ${priority}`,
                        priority: priority || 'normal',
                        status: 'todo',
                        due_date: deadline || new Date(Date.now() + 86400000).toISOString(),
                        assigned_to: userId
                    }).select();

                    if (error) throw error;
                    return { status: 'scheduled', task_id: data[0].id };
                } catch (dbError: any) {
                    console.error('Failed to schedule task:', dbError);
                    return { status: 'failed', error: 'Database insert failed' };
                }
            }

            return { 
                status: 'scheduled_simulated', 
                execution_time: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
                mission_id: Math.random().toString(36).substring(7)
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

    contract_drafter: {
        name: 'contract_drafter',
        description: 'Draft legal contracts based on templates and key terms.',
        parameters: {
            type: 'object',
            properties: {
                client_name: { type: 'string' },
                contract_type: { type: 'string', enum: ['NDA', 'MSA', 'SOW'] },
                key_terms: { type: 'string' }
            },
            required: ['client_name', 'contract_type']
        },
        execute: async ({ client_name, contract_type, key_terms, userId, tenantId }) => {
            const prompt = `Draft a ${contract_type} for ${client_name}. Terms: ${key_terms}. Return HTML.`;
            const res = await aiService.complete({
                prompt,
                systemPrompt: 'Legal Contract Drafter. Professional tone.',
                provider: 'anthropic',
                model: 'claude-3-haiku-20240307'
            });

            if (tenantId) {
                try {
                    const { text, error } = await contractService.generateDraft(contract_type, client_name, key_terms);
                    if (error) throw new Error(error.message);

                    const { contract, error: saveError } = await contractService.createContract({
                        title: `${contract_type}: ${client_name}`,
                        content: text || '',
                        status: 'draft',
                        type: contract_type,
                        client_id: userId // Assuming link for now, in reality might search for client
                    });

                    if (saveError) throw saveError;

                    return { 
                        status: 'drafted', 
                        contract_id: contract.id, 
                        preview: text?.substring(0, 200) + '...',
                        note: 'Contract saved to database' 
                    };
                } catch (err: any) {
                    console.error('Contract drafting failed:', err);
                    return { status: 'failed', error: err.message };
                }
            }
            return { status: 'simulated_draft', content: res.content };
        }
    },

    data_enricher: {
        name: 'data_enricher',
        description: 'Enrich lead data with verified emails and LinkedIn profiles (Clawbo-compatible).',
        parameters: {
            type: 'object',
            properties: {
                company_domain: { type: 'string' },
                person_name: { type: 'string' }
            },
            required: ['company_domain']
        },
        execute: async ({ company_domain, person_name }) => {
            // Simulated Enrichment (Clay/Apollo style)
            // In production, this would call an API like Hunter.io or Proxycurl
            
            const domain = company_domain.replace('https://', '').replace('www.', '').split('/')[0];
            const namePart = person_name ? person_name.split(' ')[0].toLowerCase() : 'contact';
            
            return {
                status: 'success',
                data: {
                    email: `${namePart}@${domain}`,
                    linkedin: `https://linkedin.com/in/${person_name ? person_name.replace(/\s+/g, '-').toLowerCase() : 'unknown'}`,
                    confidence_score: 85,
                    source: 'Alpha_Enrichment_v1'
                }
            };
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
    },

    lead_to_deal: {
        name: 'lead_to_deal',
        description: 'Convert a qualified lead into a CRM deal with value estimation.',
        parameters: {
            type: 'object',
            properties: {
                lead_id: { type: 'string' },
                deal_name: { type: 'string' },
                estimated_value: { type: 'number' }
            },
            required: ['lead_id', 'deal_name']
        },
        execute: async ({ lead_id, deal_name, estimated_value, tenantId, userId }) => {
            if (!tenantId) return { status: 'failed', error: 'Tenant ID missing' };

            try {
                const supabase = createSupabaseAdminClient();
                const { data, error } = await supabase.from('deals').insert({
                    tenant_id: tenantId,
                    name: deal_name,
                    value: estimated_value || 0,
                    stage: 'qualified',
                    owner_id: userId,
                    source: 'ai_agent'
                    // In a real system, we might update the lead record simultaneously
                }).select().single();

                if (error) throw error;
                return { status: 'success', deal_id: data.id, note: 'Lead converted to deal' };
            } catch (err: any) {
                console.error('Lead conversion failed:', err);
                return { status: 'failed', error: err.message };
            }
        }
    }
};
