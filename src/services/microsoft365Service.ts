/**
 * Legacy compatibility wrapper around the new Microsoft auth + Graph services.
 * Existing dashboard modules still import this file for connection state and
 * Teams-style presence hints, so keep the API stable while routing real data
 * through delegated OAuth.
 */

import { microsoftAuthService } from '@/services/microsoftAuthService';
import { microsoftGraphService } from '@/services/microsoftGraphService';

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
   * Get Microsoft 365 delegated connection metadata for the current user.
   */
  async getMicrosoft365Config(tenantId: string): Promise<{ config: Microsoft365Config | null; error: string | null }> {
    try {
      const connection = await microsoftAuthService.getConnection();
      if (!connection) {
        return { config: null, error: null };
      }

      const config: Microsoft365Config = {
        id: connection.id || connection.user_id,
        tenantId,
        clientId: '',
        clientSecret: '',
        tenantDomain: 'common',
        enabled: true,
        services: {
          outlook: true,
          calendar: true,
          onedrive: true,
          sharepoint: false,
          teams: true,
        },
        metadata: {
          microsoftEmail: connection.microsoft_email,
          displayName: connection.display_name,
        },
        createdAt: connection.created_at || new Date().toISOString(),
        updatedAt: connection.updated_at || new Date().toISOString(),
      };

      return { config, error: null };
    } catch (err) {
      return { config: null, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Delegated OAuth does not store tenant-managed credentials in the browser.
   */
  async saveMicrosoft365Config(tenantId: string, config: Omit<Microsoft365Config, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<{ config: Microsoft365Config | null; error: string | null }> {
    try {
      return {
        config: {
          id: 'delegated-oauth',
          tenantId,
          clientId: config.clientId,
          clientSecret: '',
          tenantDomain: config.tenantDomain,
          enabled: true,
          services: config.services,
          metadata: config.metadata || {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        error: null,
      };
    } catch (err) {
      return { config: null, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Fetch emails from Outlook
   */
  async fetchOutlookEmails(tenantId: string, limit: number = 50): Promise<{ emails: Microsoft365Email[]; error: string | null }> {
    try {
      const emails = await microsoftGraphService.getInboxMessages(limit);
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
      const events = await microsoftGraphService.getCalendarEvents(startDate, endDate);
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
      const created = await microsoftGraphService.createCalendarEvent({
        subject: event.subject,
        start: event.start,
        end: event.end,
        attendees: event.attendees,
        location: event.location,
        isOnlineMeeting: event.isOnlineMeeting,
      });
      return { eventId: created.id, error: null };
    } catch (err) {
      return { eventId: null, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  },

  /**
   * Send email via Outlook
   */
  async sendEmail(tenantId: string, to: string[], subject: string, body: string): Promise<{ success: boolean; error: string | null }> {
    try {
      await microsoftGraphService.sendEmail({ to, subject, body });
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
      await microsoftGraphService.getCurrentUser();
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
      await microsoftAuthService.disconnect();
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
      const connected = await microsoftAuthService.isConnected();
      if (!connected) {
        return { status: 'offline', error: 'Teams not configured or enabled' };
      }

      const presence = await microsoftGraphService.getPresence(email);
      const value = `${presence.availability || ''} ${presence.activity || ''}`.toLowerCase();
      const status: 'online' | 'away' | 'busy' | 'offline' =
        value.includes('busy') || value.includes('donotdisturb') || value.includes('inacall') || value.includes('inmeeting')
          ? 'busy'
          : value.includes('away') || value.includes('berightback')
            ? 'away'
            : value.includes('available')
              ? 'online'
              : 'offline';
      return { status, error: null };
    } catch (err) {
      return { status: 'offline', error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
};
