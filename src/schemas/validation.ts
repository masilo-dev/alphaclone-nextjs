import { z } from 'zod';

/**
 * Authentication Schemas
 */
export const signUpSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string()
        .min(12, 'Password must be at least 12 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be less than 100 characters')
        .regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters'),
});

export const signInSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
});

/**
 * Project Schemas
 */
export const projectSchema = z.object({
    name: z.string()
        .min(3, 'Project name must be at least 3 characters')
        .max(100, 'Project name must be less than 100 characters'),
    category: z.string().min(1, 'Category is required'),
    description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
    image: z.string().url('Invalid image URL').optional(),
    dueDate: z.string().optional(),
});

export const projectUpdateSchema = z.object({
    name: z.string().min(3).max(100).optional(),
    category: z.string().optional(),
    status: z.enum(['Active', 'Pending', 'Completed', 'Declined']).optional(),
    currentStage: z.enum(['Discovery', 'Design', 'Development', 'Testing', 'Deployment', 'Maintenance']).optional(),
    progress: z.number().min(0).max(100).optional(),
    description: z.string().max(1000).optional(),
});

/**
 * Message Schemas
 */
export const messageSchema = z.object({
    text: z.string()
        .min(1, 'Message cannot be empty')
        .max(5000, 'Message must be less than 5000 characters'),
    recipientId: z.string().uuid().optional(),
});

/**
 * Contact Form Schema
 */
export const contactSchema = z.object({
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be less than 100 characters'),
    email: z.string().email('Invalid email format'),
    message: z.string()
        .min(10, 'Message must be at least 10 characters')
        .max(2000, 'Message must be less than 2000 characters'),
    subject: z.string().max(200, 'Subject must be less than 200 characters').optional(),
    company: z.string().max(200, 'Company must be less than 200 characters').optional(),
});

export const leadsManagementSchema = z.object({
    tenantId: z.string().uuid('Invalid tenantId'),
    action: z.enum([
        'find_leads',
        'save_lead',
        'update_lead',
        'get_leads',
        'convert_lead',
        'delete_lead',
        'bulk_actions',
    ]),
    config: z.record(z.string(), z.unknown()).default({}),
});

export const outreachSendSchema = z.object({
    tenantId: z.string().uuid('Invalid tenantId'),
    leadEmail: z.string().email('Invalid leadEmail'),
    leadName: z.string().max(200).optional(),
    subject: z.string().min(1).max(250),
    body: z.string().min(1),
    pitchAngle: z.string().max(120).optional(),
    industry: z.string().max(120).optional(),
    score: z.number().min(0).max(100).optional(),
    fromAddress: z.string().email().optional(),
    queue: z.boolean().optional(),
    autoSend: z.boolean().optional(),
    consentGranted: z.boolean().optional(),
    confidenceScore: z.number().min(0).max(100).optional(),
    deliveryProviders: z.array(z.string()).optional(),
    preferredProvider: z.string().optional(),
    balanceByDailyLimit: z.boolean().optional(),
    language: z.string().max(40).optional(),
    languageMode: z.string().max(40).optional(),
    /** Direct compose/reply — skip CRM membership gate */
    skipCrmGate: z.boolean().optional(),
    directSend: z.boolean().optional(),
    entityType: z.enum(['invoice', 'contract', 'document', 'lead', 'client', 'direct']).optional(),
    entityId: z.string().uuid().optional(),
});

const tenantIdSchema = z.string().uuid('Invalid tenantId');
const emailSchema = z.string().email('Invalid email address');

export const emailCampaignCreateSchema = z.object({
    tenantId: tenantIdSchema,
    mode: z.string().optional(),
    name: z.string().min(1).max(200).optional(),
    subject: z.string().min(1).max(250).optional(),
    fromName: z.string().max(200).optional(),
    fromEmail: emailSchema.optional(),
    replyTo: emailSchema.optional().nullable(),
    scheduledAt: z.string().optional().nullable(),
    templateId: z.string().uuid().optional().nullable(),
    segmentFilter: z.record(z.string(), z.unknown()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    campaignId: z.string().uuid().optional(),
    contactIds: z.array(z.string().uuid()).optional(),
    skipPreviouslyContacted: z.boolean().optional(),
});

export const emailCampaignUpdateSchema = z.object({
    tenantId: tenantIdSchema,
    campaignId: z.string().uuid(),
    name: z.string().max(200).optional(),
    subject: z.string().max(250).optional(),
    status: z.string().max(50).optional(),
    scheduledAt: z.string().optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export const emailCampaignDeleteSchema = z.object({
    tenantId: tenantIdSchema,
    campaignId: z.string().uuid(),
});

export const campaignSendSchema = z.object({
    tenantId: tenantIdSchema,
    campaignId: z.string().uuid(),
});

export const providerSendSchema = z.object({
    tenantId: tenantIdSchema.optional(),
    tenant_id: tenantIdSchema.optional(),
    to: emailSchema,
    subject: z.string().min(1).max(250),
    message: z.string().min(1).max(10000),
}).refine((v) => Boolean(v.tenantId || v.tenant_id), { message: 'tenantId is required', path: ['tenantId'] });

export const integrationEmailProviderSchema = z.object({
    tenantId: tenantIdSchema,
    provider: z.enum(['sendgrid', 'resend', 'brevo', 'custom_smtp']),
    apiKey: z.string().optional(),
    fromEmail: emailSchema,
    fromName: z.string().min(1).max(200).optional(),
    deepseekApiKey: z.string().optional(),
    deepseekModel: z.enum(['deepseek-chat', 'deepseek-reasoner']).optional().default('deepseek-chat'),
}).passthrough();

export const integrationEmailProviderDeleteSchema = z.object({
    tenantId: tenantIdSchema,
    provider: z.enum(['sendgrid', 'resend', 'brevo', 'custom_smtp']),
});

export const resendConnectSchema = z.object({
    tenantId: tenantIdSchema.optional(),
    tenant_id: tenantIdSchema.optional(),
    api_key: z.string().min(10),
    domain: z.string().min(3),
}).refine((v) => Boolean(v.tenantId || v.tenant_id), { message: 'tenantId is required', path: ['tenantId'] });

export const resendDisconnectSchema = z.object({
    tenantId: tenantIdSchema.optional(),
    tenant_id: tenantIdSchema.optional(),
}).refine((v) => Boolean(v.tenantId || v.tenant_id), { message: 'tenantId is required', path: ['tenantId'] });

export const scraperSearchSchema = z.object({
    niche: z.string().min(1).max(200),
    location: z.string().max(200).optional().default(''),
    sortBy: z.string().optional().default('default'),
    radiusKm: z.number().min(1).max(100).optional().default(25),
    tenantId: tenantIdSchema,
    sources: z.array(z.string()).optional(),
    useApollo: z.boolean().optional(),
});

export const scraperAffordableSchema = z.object({
    action: z.enum(['hunter_domain', 'hunter_verify', 'builtwith', 'google_places', 'enrich_lead']),
    domain: z.string().optional(),
    email: emailSchema.optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    organization_name: z.string().optional(),
    linkedin_url: z.string().url().optional(),
    query: z.string().optional(),
    location: z.string().optional(),
    tenant_id: tenantIdSchema.optional(),
});

export const scraperEmailDiscoverySchema = z.object({
    domain: z.string().min(3),
    company_name: z.string().optional(),
    methods: z.array(z.string()).optional(),
    verify: z.boolean().optional(),
});

export const scraperDeepCrawlSchema = z.object({
    url: z.string().min(3),
    usePlaywright: z.boolean().optional(),
});

export const slackResendSchema = z.object({
    tenantId: z.string().uuid().optional(),
    tenant_id: z.string().uuid().optional(),
    notificationId: z.string().uuid().optional(),
    notification_id: z.string().uuid().optional(),
}).refine((v) => Boolean(v.tenantId || v.tenant_id), { message: 'tenantId is required', path: ['tenantId'] })
  .refine((v) => Boolean(v.notificationId || v.notification_id), { message: 'notificationId is required', path: ['notificationId'] });

export const integrationActionSchema = z.object({
    tenantId: z.string().uuid(),
    integrationType: z.enum(['slack', 'facebook', 'twilio', 'google_calendar', 'stripe', 'hubspot', 'sendgrid']),
    action: z.string().min(1).max(80),
    config: z.record(z.string(), z.unknown()).default({}),
});

export const scraperJobCreateSchema = z.object({
    tenantId: z.string().uuid(),
    niche: z.string().min(1).max(200),
    location: z.string().max(200).optional().default(''),
    sortBy: z.string().optional().default('default'),
    usePlaywright: z.boolean().optional().default(false),
    radiusKm: z.number().min(1).max(100).optional().default(25),
    sources: z.array(z.string()).optional(),
    useApollo: z.boolean().optional(),
});

/**
 * Type exports
 */
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type LeadsManagementInput = z.infer<typeof leadsManagementSchema>;
export type OutreachSendInput = z.infer<typeof outreachSendSchema>;
