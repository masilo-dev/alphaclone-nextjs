/**
 * Integration Service
 * 
 * Single source of truth for all integrations.
 * - INTEGRATION_CATALOG: static metadata (what integrations exist, their features)
 * - DB operations: per-tenant connection state stored in `tenant_integrations` table
 * - No hardcoding of connection status — always read from DB
 */

import { supabase } from '../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export type IntegrationCategory =
  | 'communication'
  | 'payment'
  | 'crm'
  | 'productivity'
  | 'accounting'
  | 'analytics';

export type IntegrationStatus = 'available' | 'connected' | 'disabled' | 'coming_soon';

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
  async getIntegrationsForTenant(tenantId: string): Promise<TenantIntegration[]> {
    if (!tenantId) {
      return INTEGRATION_CATALOG.map(entry => ({ ...entry, status: 'available' as IntegrationStatus }));
    }

    const { data, error } = await supabase
      .from('tenant_integrations')
      .select('integration_id, status, connected_at, configured_by, metadata')
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[integrationService] getIntegrationsForTenant:', error.message);
      return INTEGRATION_CATALOG.map(entry => ({ ...entry, status: 'available' as IntegrationStatus }));
    }

    const rowMap = new Map(
      (data as IntegrationRow[] || []).map((row: IntegrationRow) => [row.integration_id, row])
    );

    return INTEGRATION_CATALOG.map(entry => {
      const row = rowMap.get(entry.id);
      
      let status = (row?.status as IntegrationStatus) ?? 'available';

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
    userId: string,
    metadata?: Record<string, unknown>
  ): Promise<ConnectResult> {
    if (!tenantId || !integrationId) {
      return { success: false, error: 'Missing tenantId or integrationId' };
    }

    const catalog = INTEGRATION_CATALOG.find(e => e.id === integrationId);
    if (!catalog) {
      return { success: false, error: `Unknown integration: ${integrationId}` };
    }

    // OAuth integrations: return a redirect URL for the OAuth flow
    if (catalog.oauthFlow) {
      const redirectMap: Record<string, string> = {
        slack: '/api/slack/oauth',
        stripe: '/api/stripe/connect',
        hubspot: '/api/hubspot/oauth',
        'google-calendar': '/api/google/oauth?scope=calendar',
        'google-analytics': '/api/google/oauth?scope=analytics',
        zoom: '/api/zoom/oauth',
        'facebook-leads': '/api/facebook/oauth',
        'zoho-mail': '/api/zoho/oauth',
        calendly: '/api/calendly/oauth',
      };
      const url = redirectMap[integrationId];
      if (url) return { success: true, redirectUrl: url };
    }

    // API-key integrations: upsert the row as connected
    const { error } = await supabase
      .from('tenant_integrations')
      .upsert({
        tenant_id: tenantId,
        integration_id: integrationId,
        status: 'connected',
        connected_at: new Date().toISOString(),
        configured_by: userId,
        metadata: metadata ?? {},
      }, { onConflict: 'tenant_id,integration_id' });

    if (error) {
      console.error('[integrationService] connect:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  /**
   * Disconnects an integration for a tenant.
   */
  async disconnect(tenantId: string, integrationId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('tenant_integrations')
      .update({ status: 'available', metadata: {} })
      .eq('tenant_id', tenantId)
      .eq('integration_id', integrationId);

    if (error) {
      console.error('[integrationService] disconnect:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  /**
   * Returns whether a specific integration is connected for a tenant.
   */
  async isConnected(tenantId: string, integrationId: string): Promise<boolean> {
    if (!tenantId) return false;
    const { data } = await supabase
      .from('tenant_integrations')
      .select('status')
      .eq('tenant_id', tenantId)
      .eq('integration_id', integrationId)
      .single();
    return data?.status === 'connected';
  },

  /**
   * Returns all connected integrations for a tenant.
   */
  async getConnected(tenantId: string): Promise<string[]> {
    if (!tenantId) return [];
    const { data } = await supabase
      .from('tenant_integrations')
      .select('integration_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'connected');
    return (data as IntegrationRow[] || []).map((r: IntegrationRow) => r.integration_id);
  },
};
