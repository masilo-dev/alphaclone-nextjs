/**
 * Integration Service
 * 
 * Single source of truth for all integrations.
 * - INTEGRATION_CATALOG: static metadata (what integrations exist, their features)
 * - DB operations: per-tenant connection state stored in `tenant_integrations` table
 * - No hardcoding of connection status — always read from DB
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type IntegrationCategory =
  | 'communication'
  | 'payment'
  | 'crm'
  | 'productivity'
  | 'accounting'
  | 'analytics';

export type IntegrationStatus = 'available' | 'connected';

export interface IntegrationCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  features: string[];
  docsUrl?: string;
  oauthFlow?: boolean;   // true = OAuth redirect; false = API key entry
  popular?: boolean;
  new?: boolean;
  /** When no row exists in tenant_integrations, use this instead of "available". */
  defaultStatus?: IntegrationStatus;
}

export interface TenantIntegration extends IntegrationCatalogEntry {
  status: IntegrationStatus;
  connectedAt?: string;
  configuredBy?: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectResult {
  success: boolean;
  error?: string;
  redirectUrl?: string; // for OAuth flows
}

// ── Catalog (static metadata — never changes per tenant) ─────────────────────

export const INTEGRATION_CATALOG: IntegrationCatalogEntry[] = [
  // ── Communication ─────────────────────────────────────────────────────────
  {
    id: 'slack',
    name: 'Slack',
    description: 'Real-time notifications, lead alerts, and daily summaries in Slack.',
    category: 'communication',
    features: ['Payment notifications', 'Lead alerts', 'Task reminders', 'Daily summaries'],
    oauthFlow: true,
    popular: true,
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Professional email delivery, campaigns, and analytics.',
    category: 'communication',
    features: ['Email campaigns', 'Automated sequences', 'Analytics & tracking', 'Template management'],
    oauthFlow: false,
  },
  {
    id: 'resend',
    name: 'Resend',
    description: 'Modern transactional email API with developer-friendly tooling.',
    category: 'communication',
    features: ['Transactional email', 'React email templates', 'Delivery analytics', 'Bulk sending'],
    oauthFlow: false,
    new: true,
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'SMS outreach, voice calls, and WhatsApp messaging.',
    category: 'communication',
    features: ['SMS campaigns', 'Voice calls', 'WhatsApp', 'Two-way messaging'],
    oauthFlow: false,
  },
  {
    id: 'zoho-mail',
    name: 'Zoho Mail',
    description: 'Read, send, and manage business email from within the platform.',
    category: 'communication',
    features: ['Read inbox', 'Send emails', 'Folder management', 'AI-powered replies'],
    oauthFlow: true,
  },
  // ── Payment ───────────────────────────────────────────────────────────────
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Accept payments, manage subscriptions, and track revenue.',
    category: 'payment',
    features: ['Payment processing', 'Subscription management', 'Invoicing', 'Financial reporting'],
    oauthFlow: true,
    popular: true,
  },
  // ── CRM & Sales ───────────────────────────────────────────────────────────
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Two-way contact and deal sync with HubSpot CRM.',
    category: 'crm',
    features: ['Contact sync', 'Deal tracking', 'Two-way sync', 'Custom field mapping'],
    oauthFlow: true,
  },
  {
    id: 'facebook-leads',
    name: 'Facebook Lead Ads',
    description: 'Automatically capture Facebook Lead Ads into your CRM pipeline.',
    category: 'crm',
    features: ['Lead capture', 'Auto-qualify leads', 'Instant notifications', 'CRM sync'],
    oauthFlow: true,
  },
  // ── Productivity ──────────────────────────────────────────────────────────
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync meetings, appointments, and booking links with Google Calendar.',
    category: 'productivity',
    features: ['Meeting sync', 'Appointment booking', 'Event reminders', 'Availability management'],
    oauthFlow: true,
  },
  {
    id: 'calendly',
    name: 'Calendly',
    description: 'Embed Calendly booking links and sync scheduled events.',
    category: 'productivity',
    features: ['Booking links', 'Auto-add to CRM', 'Event webhooks', 'Reminder sequences'],
    oauthFlow: false,
  },
  {
    id: 'zoom',
    name: 'Zoom',
    description: 'Create and join Zoom meetings directly from the platform.',
    category: 'productivity',
    features: ['Video meetings', 'Screen sharing', 'Recording', 'Calendar integration'],
    oauthFlow: true,
    new: false,
    docsUrl: 'https://developers.zoom.us/docs/integrations/oauth/',
  },
  // ── Analytics ─────────────────────────────────────────────────────────────
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    description: 'Website and funnel analytics surfaced inside your dashboard.',
    category: 'analytics',
    features: ['Traffic analysis', 'Conversion tracking', 'Custom reports', 'Real-time data'],
    oauthFlow: true,
  },
  // ── AI & Agents (Model Context Protocol) ──────────────────────────────────
  {
    id: 'claude-mcp',
    name: 'Claude Desktop (MCP)',
    description: 'Allow Claude to securely read your leads, draft contracts, and orchestrate workflows via the Model Context Protocol.',
    category: 'productivity',
    features: ['Lead generation', 'Contract review', 'Direct database queries', 'Action execution'],
    oauthFlow: false,
    new: true,
  },
  {
    id: 'manus-mcp',
    name: 'Manus AI (MCP)',
    description: 'Connect Manus Agent to your CRM to autonomously research prospects and update records.',
    category: 'crm',
    features: ['Autonomous execution', 'Prospect research', 'Background tasks'],
    oauthFlow: false,
    new: true,
  },
  {
    id: 'chatgpt-mcp',
    name: 'ChatGPT Connector (MCP)',
    description: 'Connect ChatGPT to your workspace with OAuth so it can access tools without disturbing existing Claude or Manus connections.',
    category: 'productivity',
    features: ['OAuth connection', 'Workspace-safe access', 'Tool usage', 'ChatGPT connector setup'],
    oauthFlow: false,
    new: true,
  },
];

// ── DB row shape (mirrors tenant_integrations table) ───────────────────────────
interface IntegrationRow {
  integration_id: string;
  status: string;
  connected_at?: string;
  configured_by?: string;
  metadata?: Record<string, unknown>;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const integrationService = {

  /**
   * Returns the static catalog enriched with per-tenant connection status.
   * Falls back to 'available' if DB row is absent.
   */
  async getIntegrationsForTenant(
    tenantId: string,
    _currentUserId?: string | null
  ): Promise<TenantIntegration[]> {
    if (!tenantId) {
      return INTEGRATION_CATALOG.map(entry => ({ ...entry, status: 'available' as IntegrationStatus }));
    }

    const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/integrations`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Integrations could not be loaded');
    const payload = await response.json() as {
      integrations?: Array<{ integrationId: string; status: string; connectedAt?: string; configuredBy?: string; metadata?: Record<string, unknown> }>;
      personalConnections?: { mcpApiKey?: boolean; chatgpt?: boolean };
      providerConnections?: { slack?: boolean };
    };
    const data = (payload.integrations || []).map(row => ({
      integration_id: row.integrationId,
      status: row.status,
      connected_at: row.connectedAt,
      configured_by: row.configuredBy,
      metadata: row.metadata,
    }));

    const rowMap = new Map(
      (data as IntegrationRow[] || []).map((row: IntegrationRow) => [row.integration_id, row])
    );

    return INTEGRATION_CATALOG.map((entry) => {
      const row = rowMap.get(entry.id);

      let status: IntegrationStatus = row?.status === 'connected' ? 'connected' : 'available';

      if ((entry.id === 'claude-mcp' || entry.id === 'manus-mcp') && payload.personalConnections?.mcpApiKey) {
        status = 'connected';
      }
      if (entry.id === 'chatgpt-mcp' && payload.personalConnections?.chatgpt) {
        status = 'connected';
      }
      if (entry.id === 'slack' && payload.providerConnections?.slack) status = 'connected';

      return {
        ...entry,
        status,
        connectedAt: row?.connected_at,
        configuredBy: row?.configured_by,
        metadata: row?.metadata ?? {},
      };
    });
  },

  /**
   * Marks an integration as connected for a tenant.
   * OAuth flows should call this after successful token exchange.
   */
  async connect(
    tenantId: string,
    integrationId: string,
    _userId: string,
    _metadata?: Record<string, unknown>
  ): Promise<ConnectResult> {
    if (!tenantId || !integrationId) {
      return { success: false, error: 'Missing tenantId or integrationId' };
    }

    const catalog = INTEGRATION_CATALOG.find(e => e.id === integrationId);
    if (!catalog) {
      return { success: false, error: `Unknown integration: ${integrationId}` };
    }

    if (integrationId === 'zoom') {
      return {
        success: true,
        redirectUrl: `/api/zoom/oauth?tenant_id=${encodeURIComponent(tenantId)}`,
      };
    }

    if (integrationId === 'claude-mcp' || integrationId === 'manus-mcp') {
      const mcp = integrationId === 'manus-mcp' ? 'manus' : 'claude';
      return { success: true, redirectUrl: `/dashboard/marketplace?mcp=${mcp}` };
    }

    if (integrationId === 'chatgpt-mcp') {
      return { success: true, redirectUrl: '/dashboard/marketplace?mcp=chatgpt' };
    }

    if (integrationId === 'facebook-leads') {
      const returnTo = encodeURIComponent('/dashboard/business/facebook');
      return {
        success: true,
        redirectUrl: `/api/auth/facebook/connect?tenant_id=${encodeURIComponent(tenantId)}&return_to=${returnTo}`,
      };
    }

    const configurationRoutes: Record<string, string> = {
      sendgrid: '/dashboard/business/settings?tab=integrations&provider=sendgrid',
      resend: '/dashboard/business/settings?tab=integrations&provider=resend',
      twilio: '/dashboard/business/settings?tab=integrations&provider=twilio',
      calendly: `/api/auth/calendly/connect?tenantId=${encodeURIComponent(tenantId)}`,
      stripe: '/dashboard/business/settings?tab=billing',
    };
    if (configurationRoutes[integrationId]) {
      return { success: true, redirectUrl: configurationRoutes[integrationId] };
    }

    // OAuth integrations: return a redirect URL for the OAuth flow
    if (catalog.oauthFlow) {
      const redirectMap: Record<string, string> = {
        slack: `/api/slack/oauth/authorize?tenantId=${encodeURIComponent(tenantId)}`,
        hubspot: `/api/auth/hubspot/connect?tenantId=${encodeURIComponent(tenantId)}`,
        'google-calendar': `/api/auth/google/calendar/connect?tenantId=${encodeURIComponent(tenantId)}`,
        'google-analytics': '/dashboard/business/settings?tab=integrations&provider=google-analytics',
        'zoho-mail': `/api/auth/zoho/connect?tenantId=${encodeURIComponent(tenantId)}`,
      };
      const url = redirectMap[integrationId];
      if (url) return { success: true, redirectUrl: url };
    }

    return { success: false, error: 'This integration requires configuration from Workspace Settings.' };
  },

  /**
   * Disconnects an integration for a tenant.
   */
  async disconnect(
    tenantId: string,
    integrationId: string,
    _currentUserId?: string | null
  ): Promise<{ success: boolean; error?: string }> {
    const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/integrations`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ integrationId }),
    });
    const payload = await response.json().catch(() => ({}));
    return response.ok ? { success: true } : { success: false, error: payload.error || 'Disconnect failed' };
  },
};
