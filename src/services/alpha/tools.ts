import { aiService } from '../ai/aiService';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { hubspotService } from '@/services/hubspotService';
import { ZohoMailService } from '@/services/zoho/ZohoMailService';
import { gmailService } from '@/services/gmailService';
import { sendWithProviderSdk } from '@/lib/email/providerSdk';

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
            return {
                status: 'redirected',
                error: 'lead_prospector is retired. Use Lead Finder (find_and_qualify_leads / create_scraper_campaign) so only real businesses with source evidence are saved.',
                next: {
                    tool: 'find_and_qualify_leads',
                    industry,
                    account_id,
                    preferences,
                    userId,
                    tenantId,
                },
            };
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
                    if (!tenantId) return { status: 'failed', error: 'Workspace ID required for Zoho outreach' };
                    const zoho = new ZohoMailService(userId, tenantId);
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
                    const res = await hubspotService.syncLeadToHubSpot(userId, tenantId, {
                        firstname: 'AI Outreach',
                        lastname: subject,
                        company: 'AI Outreach',
                        email: to
                    });
                    return { status: 'synced_to_crm', provider: 'hubspot', res };
                }
                
                const apiKey = process.env.RESEND_API_KEY;
                const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.DEFAULT_FROM_EMAIL;
                if (!apiKey || !fromEmail) {
                    return { status: 'failed', error: 'Resend delivery is not configured' };
                }
                const sent = await sendWithProviderSdk('resend', {
                    apiKey,
                    fromEmail,
                    fromName: process.env.DEFAULT_FROM_NAME || 'AlphaClone',
                    to,
                    subject,
                    text: body,
                    html: `<div style="white-space:pre-wrap">${String(body).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c))}</div>`,
                });
                if (!sent.ok) return { status: 'failed', error: sent.error || 'Delivery failed' };
                return { status: 'sent', provider: 'resend', messageId: sent.emailId };
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

            return { status: 'failed', error: 'Authenticated workspace context is required' };
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
                provider: 'auto'
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
            if (!tenantId || !userId) return { status: 'failed', error: 'Authenticated workspace context is required' };
            const prompt = `Draft a complete ${contract_type} for ${client_name}. Terms: ${key_terms || 'standard commercial terms'}. Return clean HTML with numbered sections. Do not invent addresses, registration numbers, pricing, dates, or governing jurisdictions; clearly identify any information the operator must complete before sending.`;
            const res = await aiService.complete({
                prompt,
                systemPrompt: 'Professional contract drafting assistant. Produce an editable draft, preserve uncertainty, and never present the output as legal advice.',
                provider: 'auto'
            });

            try {
                const admin = createSupabaseAdminClient();
                const { data: contract, error } = await admin.from('contracts').insert({
                    tenant_id: tenantId,
                    owner_id: userId,
                    title: `${contract_type}: ${client_name}`,
                    content: res.content,
                    status: 'draft',
                    type: contract_type,
                    signing_token: crypto.randomUUID(),
                    metadata: { client_name, source: 'alpha_contract_drafter', requires_human_review: true },
                }).select('id').single();
                if (error || !contract) throw error || new Error('Contract draft was not saved');
                return {
                    status: 'drafted',
                    contract_id: contract.id,
                    preview: `${res.content.substring(0, 200)}...`,
                    note: 'Editable contract draft saved for human review',
                };
            } catch (err: any) {
                console.error('Contract drafting failed:', err);
                return { status: 'failed', error: err.message };
            }
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
        execute: async ({ company_domain, person_name, tenantId }) => {
            if (!tenantId) return { status: 'failed', error: 'Authenticated workspace context is required' };
            const domain = String(company_domain || '').trim().toLowerCase()
                .replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
            if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
                return { status: 'failed', error: 'A valid public company domain is required' };
            }
            const apiKey = process.env.HUNTER_API_KEY;
            if (!apiKey) return { status: 'failed', error: 'Email discovery provider is not configured' };
            const query = new URL('https://api.hunter.io/v2/email-finder');
            query.searchParams.set('domain', domain);
            query.searchParams.set('api_key', apiKey);
            const parts = String(person_name || '').trim().split(/\s+/).filter(Boolean);
            if (parts[0]) query.searchParams.set('first_name', parts[0]);
            if (parts.length > 1) query.searchParams.set('last_name', parts.slice(1).join(' '));
            const response = await fetch(query, { signal: AbortSignal.timeout(15_000) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.data?.email) return { status: 'failed', error: 'No verified email was found' };
            return { status: 'success', data: { email: payload.data.email, score: payload.data.score, source: 'hunter' } };
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
