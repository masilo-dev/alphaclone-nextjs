/**
 * Public-facing integration catalog — single source of truth for marketing pages.
 * Status reflects product availability as implemented in the codebase.
 * Do not mark AVAILABLE unless OAuth/connect flows exist in the application.
 */

export type IntegrationStatus = 'AVAILABLE' | 'BETA' | 'COMING_SOON' | 'DEPRECATED';

export interface PublicIntegration {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  /** Short label for UI badges */
  statusLabel: string;
  category: 'communication' | 'crm' | 'payments' | 'scheduling' | 'social' | 'ai' | 'productivity' | 'platform';
  /** Optional docs anchor on /docs or /ecosystem */
  docsPath?: string;
}

const STATUS_LABELS: Record<IntegrationStatus, string> = {
  AVAILABLE: 'Available',
  BETA: 'Beta',
  COMING_SOON: 'Coming soon',
  DEPRECATED: 'Deprecated',
};

function integration(
  id: string,
  name: string,
  description: string,
  status: IntegrationStatus,
  category: PublicIntegration['category'],
  docsPath?: string,
): PublicIntegration {
  return {
    id,
    name,
    description,
    status,
    statusLabel: STATUS_LABELS[status],
    category,
    docsPath,
  };
}

/** Integrations shown on /ecosystem and future /integrations/* pages. */
export const PUBLIC_INTEGRATIONS: PublicIntegration[] = [
  integration('calcom', 'Cal.com', 'Platform demo scheduling and native booking pages', 'AVAILABLE', 'scheduling'),
  integration('linkedin', 'LinkedIn', 'OAuth, posting, and lead forms', 'AVAILABLE', 'social'),
  integration('facebook', 'Facebook', 'Pages, posts, and lead capture', 'AVAILABLE', 'social'),
  integration('stripe', 'Stripe', 'Payment processing and Connect', 'AVAILABLE', 'payments'),
  integration('microsoft365', 'Microsoft 365', 'Outlook, calendar, and tasks', 'AVAILABLE', 'productivity'),
  integration('gmail', 'Gmail', 'OAuth inbox read, compose, and reply', 'AVAILABLE', 'communication'),
  integration('zoho', 'Zoho', 'CRM and Mail integration', 'AVAILABLE', 'crm'),
  integration('hubspot', 'HubSpot', 'Contact and deal sync via OAuth', 'AVAILABLE', 'crm'),
  integration('calendly', 'Calendly', 'External scheduling sync', 'AVAILABLE', 'scheduling'),
  integration('google_calendar', 'Google Calendar', 'Bi-directional calendar sync', 'AVAILABLE', 'scheduling'),
  integration('slack', 'Slack', 'Workspace notifications and OAuth', 'BETA', 'communication'),
  integration('whatsapp', 'WhatsApp', 'Dashboard connection and messaging', 'COMING_SOON', 'communication'),
  integration('instagram', 'Instagram', 'Business publishing and inbox', 'COMING_SOON', 'social'),
  integration('deepseek', 'DeepSeek API', 'Bonnie planning provider', 'AVAILABLE', 'ai'),
  integration('claude', 'Claude API', 'AI reasoning and MCP agent workflows', 'AVAILABLE', 'ai'),
  integration('openai', 'OpenAI API', 'Generation and AI fallback', 'AVAILABLE', 'ai'),
  integration('openrouter', 'OpenRouter', 'Optional model routing', 'AVAILABLE', 'ai'),
  integration('supabase', 'Supabase', 'Database, auth, and realtime infrastructure', 'AVAILABLE', 'platform'),
];

export function getIntegrationsByStatus(status: IntegrationStatus): PublicIntegration[] {
  return PUBLIC_INTEGRATIONS.filter((i) => i.status === status);
}

export function getAvailableIntegrations(): PublicIntegration[] {
  return PUBLIC_INTEGRATIONS.filter((i) => i.status === 'AVAILABLE' || i.status === 'BETA');
}
