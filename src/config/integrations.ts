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
  AVAILABLE: 'Ready to connect',
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
  integration('calcom', 'Cal.com', 'Scheduling connection for booking pages', 'COMING_SOON', 'scheduling'),
  integration('linkedin', 'LinkedIn', 'OAuth, posting, and lead forms', 'AVAILABLE', 'social'),
  integration('facebook', 'Facebook', 'Pages, posts, and lead capture', 'AVAILABLE', 'social'),
  integration('stripe', 'Stripe', 'Payment processing and connected billing', 'COMING_SOON', 'payments'),
  integration('microsoft365', 'Outlook', 'Outlook mail, calendar, and tasks', 'AVAILABLE', 'productivity'),
  integration('gmail', 'Gmail', 'Inbox read, compose, and reply', 'COMING_SOON', 'communication'),
  integration('zoho', 'Zoho', 'CRM and Mail integration', 'AVAILABLE', 'crm'),
  integration('hubspot', 'HubSpot', 'Contact and deal synchronisation', 'COMING_SOON', 'crm'),
  integration('calendly', 'Calendly', 'External scheduling sync', 'AVAILABLE', 'scheduling'),
  integration('google_calendar', 'Google Calendar', 'Calendar availability and event sync', 'COMING_SOON', 'scheduling'),
  integration('slack', 'Slack', 'Workspace notifications and collaboration', 'COMING_SOON', 'communication'),
  integration('whatsapp', 'WhatsApp', 'Dashboard connection and messaging', 'COMING_SOON', 'communication'),
  integration('instagram', 'Instagram', 'Business publishing and connected social workflows', 'AVAILABLE', 'social'),
  integration('mcp-cloud', 'MCP Cloud', 'Secure Model Context Protocol connections for approved business actions', 'AVAILABLE', 'ai'),
  integration('openai', 'OpenAI API', 'AI reasoning and execution planning', 'AVAILABLE', 'ai'),
];

export function getIntegrationsByStatus(status: IntegrationStatus): PublicIntegration[] {
  return PUBLIC_INTEGRATIONS.filter((i) => i.status === status);
}

export function getAvailableIntegrations(): PublicIntegration[] {
  return PUBLIC_INTEGRATIONS.filter((i) => i.status === 'AVAILABLE' || i.status === 'BETA');
}
