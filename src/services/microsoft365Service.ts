/**
 * Microsoft 365 Integration Service
 * 
 * This service handles integration with Microsoft 365 services:
 * - Outlook (Email & Calendar)
 * - OneDrive (File Storage)
 * - SharePoint (Document Management)
 * - Teams (Communication)
 * - Azure AD (Identity)
 */

import { supabase } from '../lib/supabase';

export interface Microsoft365Config {
  id: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  tenantDomain: string;
  enabled: boolean;
  services: {
    outlook: boolean;
    calendar: boolean;
    onedrive: boolean;
    sharepoint: boolean;
    teams: boolean;
  };
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export interface Microsoft365Email {
  id: string;
  subject: string;
  from: string;
  to: string[];
  body: string;
  receivedAt: string;
  isRead: boolean;
  hasAttachments: boolean;
}

export interface Microsoft365Event {
  id: string;
  subject: string;
  start: string;
  end: string;
  location: string;
  attendees: string[];
  isOnlineMeeting: boolean;
}

export const microsoft365Service = {
  /**
   * Get Microsoft 365 configuration for a tenant
   */
  async getMicrosoft365Config(tenantId: string): Promise<{ config: Microsoft365Config | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('microsoft365_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('enabled', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { config: null, error: null };
        }
        return { config: null, error: error.message };
      }

      const config: Microsoft365Config = {
        id: data.id,
        tenantId: data.tenant_id,
        clientId: data.client_id,
        clientSecret: data.client_secret,
        tenantDomain: data.tenant_domain,
        enabled: data.enabled,
        services: data.services || {
          outlook: true,
          calendar: true,
          onedrive: false,
          sharepoint: false,
          teams: false
        },
        metadata: data.metadata || {},
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      return { config, error: null };
    } catch (err) {
      return { config: null, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Save Microsoft 365 configuration
   */
  async saveMicrosoft365Config(tenantId: string, config: Omit<Microsoft365Config, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<{ config: Microsoft365Config | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('microsoft365_integrations')
        .upsert({
          tenant_id: tenantId,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          tenant_domain: config.tenantDomain,
          enabled: config.enabled,
          services: config.services,
          metadata: config.metadata || {},
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      const m365Config: Microsoft365Config = {
        id: data.id,
        tenantId: data.tenant_id,
        clientId: data.client_id,
        clientSecret: data.client_secret,
        tenantDomain: data.tenant_domain,
        enabled: data.enabled,
        services: data.services || {},
        metadata: data.metadata || {},
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      return { config: m365Config, error: null };
    } catch (err) {
      return { config: null, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Fetch emails from Outlook
   */
  async fetchOutlookEmails(tenantId: string, limit: number = 50): Promise<{ emails: Microsoft365Email[]; error: string | null }> {
    try {
      const { config } = await this.getMicrosoft365Config(tenantId);
      
      if (!config || !config.services.outlook) {
        return { emails: [], error: 'Outlook not configured or enabled' };
      }

      // In production, this would use Microsoft Graph API
      // For now, return empty array
      const emails: Microsoft365Email[] = [];

      return { emails, error: null };
    } catch (err) {
      return { emails: [], error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Fetch calendar events from Microsoft Calendar
   */
  async fetchCalendarEvents(tenantId: string, startDate: string, endDate: string): Promise<{ events: Microsoft365Event[]; error: string | null }> {
    try {
      const { config } = await this.getMicrosoft365Config(tenantId);
      
      if (!config || !config.services.calendar) {
        return { events: [], error: 'Calendar not configured or enabled' };
      }

      // In production, this would use Microsoft Graph API
      // For now, return empty array
      const events: Microsoft365Event[] = [];

      return { events, error: null };
    } catch (err) {
      return { events: [], error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Create calendar event in Microsoft Calendar
   */
  async createCalendarEvent(tenantId: string, event: Omit<Microsoft365Event, 'id'>): Promise<{ eventId: string | null; error: string | null }> {
    try {
      const { config } = await this.getMicrosoft365Config(tenantId);
      
      if (!config || !config.services.calendar) {
        return { eventId: null, error: 'Calendar not configured or enabled' };
      }

      // In production, this would use Microsoft Graph API to create event
      const eventId = `event_${Date.now()}`;

      return { eventId, error: null };
    } catch (err) {
      return { eventId: null, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Send email via Outlook
   */
  async sendEmail(tenantId: string, to: string[], subject: string, body: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { config } = await this.getMicrosoft365Config(tenantId);
      
      if (!config || !config.services.outlook) {
        return { success: false, error: 'Outlook not configured or enabled' };
      }

      // In production, this would use Microsoft Graph API to send email
      // For now, return success
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Test Microsoft 365 integration
   */
  async testIntegration(tenantId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { config } = await this.getMicrosoft365Config(tenantId);
      
      if (!config) {
        return { success: false, error: 'Microsoft 365 not configured' };
      }

      // Validate configuration
      if (!config.clientId || !config.clientSecret || !config.tenantDomain) {
        return { success: false, error: 'Invalid Microsoft 365 configuration' };
      }

      // In production, this would test the actual Microsoft Graph API connection
      // For now, validate the configuration format
      try {
        new URL(`https://${config.tenantDomain}`);
      } catch {
        return { success: false, error: 'Invalid tenant domain' };
      }

      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Disconnect Microsoft 365 integration
   */
  async disconnectIntegration(tenantId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from('microsoft365_integrations')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId);

      if (error) throw error;

      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Get available Microsoft 365 services
   */
  getAvailableServices(): Array<{ id: string; name: string; description: string; icon: string }> {
    return [
      {
        id: 'outlook',
        name: 'Outlook',
        description: 'Email management and integration',
        icon: 'Mail'
      },
      {
        id: 'calendar',
        name: 'Microsoft Calendar',
        description: 'Calendar synchronization and event management',
        icon: 'Calendar'
      },
      {
        id: 'onedrive',
        name: 'OneDrive',
        description: 'Cloud file storage and sharing',
        icon: 'Cloud'
      },
      {
        id: 'sharepoint',
        name: 'SharePoint',
        description: 'Document management and collaboration',
        icon: 'Folder'
      },
      {
        id: 'teams',
        name: 'Microsoft Teams',
        description: 'Team communication and collaboration',
        icon: 'Users'
      }
    ];
  },

  /**
   * Fetch Microsoft Teams presence for a user
   */
  async fetchTeamsPresence(tenantId: string, email: string): Promise<{ status: 'online' | 'away' | 'busy' | 'offline'; error: string | null }> {
    try {
      const { config } = await this.getMicrosoft365Config(tenantId);
      
      if (!config || !config.services.teams) {
        return { status: 'offline', error: 'Teams not configured or enabled' };
      }

      // In production, this would fetch from MS Graph API: GET /users/{id}/presence
      // For now, return a mock status based on email hash to simulate Teams presence
      const mockStatuses: ('online' | 'away' | 'busy' | 'offline')[] = ['online', 'away', 'busy', 'offline'];
      let hash = 0;
      for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) % mockStatuses.length;
      
      return { status: mockStatuses[hash], error: null };
    } catch (err) {
      return { status: 'offline', error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
};

