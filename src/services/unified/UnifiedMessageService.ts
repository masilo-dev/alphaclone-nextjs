import { supabase } from '@/lib/supabase';
import { tenantService } from '../tenancy/TenantService';

export type MessageSource =
  | 'internal'
  | 'gmail'
  | 'zoho'
  | 'sms'
  | 'slack'
  | 'teams'
  | 'brevo'
  | 'resend'
  | 'sendgrid'
  | 'facebook'
  | 'whatsapp'
  | 'linkedin'
  | 'mcp';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageChannel = 'email' | 'chat' | 'sms' | 'call';

export interface UnifiedMessage {
  id: string;
  tenant_id: string;
  company_id?: string;
  contact_id?: string;
  opportunity_id?: string;
  source: MessageSource;
  external_id?: string;
  thread_id?: string;
  direction: MessageDirection;
  channel: MessageChannel;
  subject?: string;
  body?: string;
  html_body?: string;
  attachments?: any[];
  from_address?: string;
  from_name?: string;
  to_address?: string;
  to_name?: string;
  cc_address?: string;
  bcc_address?: string;
  read: boolean;
  replied: boolean;
  starred: boolean;
  archived: boolean;
  folder: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category?: string;
  intent?: string;
  needs_response: boolean;
  auto_replied: boolean;
  sent_at?: string;
  received_at?: string;
  read_at?: string;
  replied_at?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  created_at: string;
  synced_at: string;
}

export class UnifiedMessageService {
  /**
   * Get message by ID
   */
  async get(id: string): Promise<UnifiedMessage | null> {
    const { data, error } = await supabase
      .from('unified_messages')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * List messages for a tenant (Universal Inbox)
   */
  async listInbox(filters: {
    folder?: string;
    source?: MessageSource;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const tenantId = await tenantService.getCurrentTenantId();
    let query = supabase
      .from('unified_messages')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (filters.folder) {
      query = query.eq('folder', filters.folder);
    } else {
      query = query.eq('folder', 'inbox');
    }

    if (filters.source) {
      query = query.eq('source', filters.source);
    }

    if (filters.search) {
      query = query.textSearch('search_vector', filters.search);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1).order('received_at', { ascending: false, nullsFirst: false });

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      data: data || [],
      total: count || 0,
      limit,
      offset
    };
  }

  /**
   * Sync a message from an external source
   */
  async syncExternalMessage(params: Partial<UnifiedMessage>): Promise<UnifiedMessage> {
    const tenantId = await tenantService.getCurrentTenantId();
    
    // Check for existing message to avoid duplicates
    if (params.external_id && params.source) {
      const { data: existing } = await supabase
        .from('unified_messages')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('source', params.source)
        .eq('external_id', params.external_id)
        .maybeSingle();
      
      if (existing) {
        const { data, error } = await supabase
          .from('unified_messages')
          .update({ ...params, synced_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    }

    const { data, error } = await supabase
      .from('unified_messages')
      .insert({
        tenant_id: tenantId,
        priority: 'normal',
        folder: 'inbox',
        read: false,
        replied: false,
        archived: false,
        synced_at: new Date().toISOString(),
        ...params
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Mark message as read
   */
  async markAsRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('unified_messages')
      .update({ 
        read: true, 
        read_at: new Date().toISOString(),
        needs_response: false 
      })
      .eq('id', id);
    
    if (error) throw error;
  }

  /**
   * Archive message
   */
  async archive(id: string): Promise<void> {
    const { error } = await supabase
      .from('unified_messages')
      .update({ folder: 'archive', archived: true })
      .eq('id', id);
    if (error) throw error;
  }

  /**
   * Get thread messages
   */
  async getThread(threadId: string) {
    const tenantId = await tenantService.getCurrentTenantId();
    const { data, error } = await supabase
      .from('unified_messages')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('thread_id', threadId)
      .order('received_at', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }
}

export const unifiedMessageService = new UnifiedMessageService();
