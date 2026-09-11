import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  getSlackIntegrationWithSecrets,
  upsertSlackIntegration,
} from '@/services/slack/slackIntegrationService';

export interface SlackConfig {
  teamId: string;
  teamName: string;
  botUserId: string;
  botAccessToken: string;
  webhookUrl?: string;
  defaultChannel?: string;
}

export interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: SlackBlockElement[];
  accessory?: any;
}

export interface SlackAttachment {
  color?: string;
  title?: string;
  text?: string;
  fields?: Array<{ title: string; value: string; short: boolean }>;
  actions?: SlackBlockElement[];
}

export interface SlackBlockElement {
  type: string;
  text?: { type: string; text: string };
  url?: string;
  action_id?: string;
  value?: string;
  style?: string;
}

export const slackService = {
  /**
   * Get Slack integration for a tenant
   */
  async getSlackIntegration(tenantId: string) {
    const supabase = createSupabaseAdminClient();
    return getSlackIntegrationWithSecrets(supabase, tenantId);
  },

  /**
   * Save Slack integration for a tenant
   */
  async saveSlackIntegration(tenantId: string, config: SlackConfig) {
    const result = await upsertSlackIntegration({
      tenantId,
      teamId: config.teamId,
      teamName: config.teamName,
      botUserId: config.botUserId,
      botAccessToken: config.botAccessToken,
      webhookUrl: config.webhookUrl,
      defaultChannel: config.defaultChannel,
    });

    if (!result.integrationId) {
      return { data: null, error: { message: result.error || 'Failed to save' } };
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('slack_integrations')
      .select('id, tenant_id, team_id, team_name, default_channel, is_active')
      .eq('id', result.integrationId)
      .single();

    return { data, error };
  },

  /**
   * Send message via Slack webhook
   */
  async sendMessage(tenantId: string, channel: string, message: SlackMessage) {
    const integration = await this.getSlackIntegration(tenantId);
    
    if (!integration) {
      throw new Error('Slack integration not found for this tenant');
    }

    if (!integration?.webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    const payload = {
      channel,
      text: message.text,
      blocks: message.blocks || [],
      attachments: message.attachments || []
    };

    try {
      const response = await fetch(integration.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Log the message
      await this.logMessage(tenantId, channel, message, 'sent', result);
      
      return { success: true, data: result };
    } catch (error) {
      console.error('Error sending Slack message:', error);
      
      // Log the error
      await this.logMessage(tenantId, channel, message, 'failed', error);
      
      return { success: false, error };
    }
  },

  /**
   * Send interactive message with buttons
   */
  async sendInteractiveMessage(tenantId: string, channel: string, message: SlackMessage) {
    return this.sendMessage(tenantId, channel, message);
  },

  /**
   * Send project update notification
   */
  async sendProjectUpdate(tenantId: string, project: any, updateType: string) {
    const integration = await this.getSlackIntegration(tenantId);
    if (!integration) return;

    const message: SlackMessage = {
      text: `Project ${updateType}: ${project.name}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Project Update: ${updateType}*\n\n*Project:* ${project.name}\n*Status:* ${project.status}\n*Stage:* ${project.current_stage}`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Project' },
              url: `${process.env.APP_URL}/dashboard/projects/${project.id}`
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Tasks' },
              url: `${process.env.APP_URL}/dashboard/tasks?project=${project.id}`
            }
          ]
        }
      ]
    };

    return this.sendMessage(tenantId, integration.default_channel || '#general', message);
  },

  /**
   * Send invoice notification
   */
  async sendInvoiceNotification(tenantId: string, invoice: any, action: string) {
    const integration = await this.getSlackIntegration(tenantId);
    if (!integration) return;

    const message: SlackMessage = {
      text: `Invoice ${action}: #${invoice.invoice_number}`,
      attachments: [
        {
          color: action === 'created' ? '#36a64f' : action === 'paid' ? '#36a64f' : '#ff0000',
          title: `Invoice ${action}`,
          fields: [
            { title: 'Invoice #', value: invoice.invoice_number, short: true },
            { title: 'Client', value: invoice.client_name, short: true },
            { title: 'Amount', value: `$${invoice.total}`, short: true },
            { title: 'Due Date', value: new Date(invoice.due_date).toLocaleDateString(), short: true }
          ],
          actions: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Invoice' },
              url: `${process.env.APP_URL}/dashboard/finance/invoices/${invoice.id}`
            }
          ]
        }
      ]
    };

    return this.sendMessage(tenantId, integration.default_channel || '#general', message);
  },

  /**
   * Send deal notification
   */
  async sendDealNotification(tenantId: string, deal: any, action: string) {
    const integration = await this.getSlackIntegration(tenantId);
    if (!integration) return;

    const message: SlackMessage = {
      text: `Deal ${action}: ${deal.name}`,
      attachments: [
        {
          color: action === 'won' ? '#36a64f' : action === 'lost' ? '#ff0000' : '#36a64f',
          title: `Deal ${action}`,
          fields: [
            { title: 'Deal Name', value: deal.name, short: true },
            { title: 'Value', value: `$${deal.value}`, short: true },
            { title: 'Stage', value: deal.stage, short: true },
            { title: 'Contact', value: deal.contact_name, short: true }
          ],
          actions: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Deal' },
              url: `${process.env.APP_URL}/dashboard/crm/deals/${deal.id}`
            }
          ]
        }
      ]
    };

    return this.sendMessage(tenantId, integration.default_channel || '#general', message);
  },

  /**
   * Send task notification
   */
  async sendTaskNotification(tenantId: string, task: any, action: string) {
    const integration = await this.getSlackIntegration(tenantId);
    if (!integration) return;

    const message: SlackMessage = {
      text: `Task ${action}: ${task.title}`,
      attachments: [
        {
          color: action === 'completed' ? '#36a64f' : '#36a64f',
          title: `Task ${action}`,
          fields: [
            { title: 'Task', value: task.title, short: true },
            { title: 'Assigned To', value: task.assignee_name, short: true },
            { title: 'Priority', value: task.priority, short: true },
            { title: 'Due Date', value: task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date', short: true }
          ],
          actions: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View Task' },
              url: `${process.env.APP_URL}/dashboard/tasks/${task.id}`
            }
          ]
        }
      ]
    };

    return this.sendMessage(tenantId, integration.default_channel || '#general', message);
  },

  /**
   * Log message to database
   */
  async logMessage(tenantId: string, channel: string, message: SlackMessage, status: string, result: any) {
    const supabase = createSupabaseAdminClient();
    
    try {
      await supabase.from('slack_message_logs').insert({
        tenant_id: tenantId,
        channel,
        message_text: message.text,
        message_type: 'message',
        status,
        metadata: {
          message: message,
          result: result,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error logging Slack message:', error);
    }
  },

  /**
   * Get message logs for a tenant
   */
  async getMessageLogs(tenantId: string, limit: number = 50) {
    const supabase = createSupabaseAdminClient();
    
    const { data, error } = await supabase
      .from('slack_message_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching Slack message logs:', error);
      return [];
    }
    
    return data;
  },

  /**
   * Test Slack integration
   */
  async testIntegration(tenantId: string) {
    const integration = await this.getSlackIntegration(tenantId);
    
    if (!integration) {
      return { success: false, error: 'Slack integration not found' };
    }

    const testMessage: SlackMessage = {
      text: '🧪 Test message from AlphaClone',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🧪 Slack Integration Test*\n\nThis is a test message to verify your Slack integration is working correctly.'
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '✅ Test Successful' },
              action_id: 'test_success',
              style: 'primary'
            }
          ]
        }
      ]
    };

    return this.sendMessage(tenantId, integration.default_channel || '#general', testMessage);
  },

  /**
   * Disconnect Slack integration
   */
  async disconnectIntegration(tenantId: string) {
    const supabase = createSupabaseAdminClient();
    
    const { error } = await supabase
      .from('slack_integrations')
      .update({ 
        is_active: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('tenant_id', tenantId);
    
    if (error) {
      console.error('Error disconnecting Slack integration:', error);
      return { success: false, error };
    }
    
    return { success: true };
  }
};
