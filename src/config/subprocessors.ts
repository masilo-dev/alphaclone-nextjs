export interface Subprocessor {
  id: string;
  name: string;
  corporateEntity: string;
  purpose: string;
  dataProcessed: string;
  location: string;
  safeguard: string;
  website: string;
}

export const PLATFORM_SUBPROCESSORS: Subprocessor[] = [
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    corporateEntity: 'Cloudflare, Inc.',
    purpose: 'Edge routing, content delivery network (CDN), DDoS mitigation, Turnstile bot verification, and Zaraz consent tag management.',
    dataProcessed: 'IP addresses, request headers, client security telemetry.',
    location: 'Global Edge Network (US Headquarters)',
    safeguard: 'EU Standard Contractual Clauses (SCCs), Cloudflare DPA, UK IDTA',
    website: 'https://www.cloudflare.com',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    corporateEntity: 'Supabase, Inc.',
    purpose: 'Production database hosting, encrypted document storage, user authentication, and row-level security policy enforcement.',
    dataProcessed: 'User accounts, tenant profile details, encrypted client and document records, compliance logs.',
    location: 'United States (AWS us-east-1)',
    safeguard: 'EU Standard Contractual Clauses (SCCs), Supabase DPA',
    website: 'https://supabase.com',
  },
  {
    id: 'railway',
    name: 'Railway',
    corporateEntity: 'Railway Corp.',
    purpose: 'Container application infrastructure, server-side Next.js execution layer, background queue workers.',
    dataProcessed: 'Application logs, transient request payloads, session tokens.',
    location: 'United States (AWS us-east-1)',
    safeguard: 'EU Standard Contractual Clauses (SCCs), Railway DPA',
    website: 'https://railway.app',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    corporateEntity: 'Anthropic, PBC',
    purpose: 'Bonnie AI cognitive assistant processing (contract drafting, CRM intelligence, autonomous workflows). No customer data is used to train foundation models.',
    dataProcessed: 'User prompts, selected workspace contexts submitted for AI generation.',
    location: 'United States',
    safeguard: 'Anthropic Commercial Terms, EU SCCs, Zero Data Retention for Model Training',
    website: 'https://www.anthropic.com',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    corporateEntity: 'OpenAI, LLC',
    purpose: 'Secondary LLM synthesis, text embeddings, and semantic vector operations.',
    dataProcessed: 'Prompt text, embeddings indices.',
    location: 'United States',
    safeguard: 'OpenAI Business Terms, Zero Data Retention / No Training Policy, EU SCCs',
    website: 'https://openai.com',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    corporateEntity: 'DeepSeek Technologies Co., Ltd.',
    purpose: 'Specialized code generation, technical analysis, and structured reasoning engines.',
    dataProcessed: 'Transient code snippets and structured query templates.',
    location: 'Global API Gateways',
    safeguard: 'API Enterprise Agreement, Ephemeral Processing',
    website: 'https://www.deepseek.com',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    corporateEntity: 'Stripe, Inc.',
    purpose: 'Subscription payment processing, invoice checkout, and fraud monitoring.',
    dataProcessed: 'Billing addresses, payment methods, transaction receipts.',
    location: 'United States and EU',
    safeguard: 'PCI-DSS Level 1 Service Provider, Stripe DPA, EU SCCs',
    website: 'https://stripe.com',
  },
  {
    id: 'brevo',
    name: 'Brevo / Sendinblue',
    corporateEntity: 'Brevo SAS (formerly Sendinblue)',
    purpose: 'Transactional email delivery, password resets, signature notifications, and data subject request receipts.',
    dataProcessed: 'Recipient email addresses, notification subject lines, email delivery logs.',
    location: 'European Union (France / Germany)',
    safeguard: 'EU GDPR Native Compliance, Brevo DPA',
    website: 'https://www.brevo.com',
  },
  {
    id: 'sentry',
    name: 'Sentry',
    corporateEntity: 'Functional Software, Inc. (Sentry)',
    purpose: 'Application error logging, crash diagnostics, and performance monitoring.',
    dataProcessed: 'Client stack traces, browser user-agent, error metadata (PII scrubbed by default).',
    location: 'United States',
    safeguard: 'EU Standard Contractual Clauses (SCCs), Sentry DPA',
    website: 'https://sentry.io',
  },
];
