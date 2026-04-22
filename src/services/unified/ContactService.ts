import { supabase } from '@/lib/supabase';
import { tenantService } from '../tenancy/TenantService';
import { companyService } from './CompanyService';

export interface Contact {
  id: string;
  tenant_id: string;
  company_id?: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email?: string;
  phone?: string;
  mobile_phone?: string;
  title?: string;
  department?: string;
  linkedin_url?: string;
  twitter_handle?: string;
  lead_score: number;
  lifecycle_stage: 'lead' | 'mql' | 'sql' | 'opportunity' | 'customer' | 'evangelist' | 'churned';
  status: 'active' | 'inactive' | 'bounced' | 'unsubscribed';
  last_contacted_at?: string;
  last_activity_at?: string;
  next_followup_at?: string;
  email_opt_in: boolean;
  sms_opt_in: boolean;
  preferred_contact_method: 'email' | 'phone' | 'sms' | 'linkedin';
  assigned_to?: string;
  custom_fields?: Record<string, any>;
  tags?: string[];
  preferences?: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateContactParams {
  company_id?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  mobile_phone?: string;
  title?: string;
  department?: string;
  linkedin_url?: string;
  assigned_to?: string;
  lifecycle_stage?: string;
  custom_fields?: Record<string, any>;
  tags?: string[];
}

export class ContactService {
  /**
   * Get contact by ID
   */
  async get(id: string): Promise<Contact | null> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get contact with relations
   */
  async getWithRelations(id: string) {
    const [contact, company, activities, messages, opportunities] = await Promise.all([
      this.get(id),
      supabase.from('companies').select('*').eq('id', (await this.get(id))?.company_id || '').maybeSingle(),
      supabase
        .from('activities')
        .select('*')
        .eq('contact_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('unified_messages')
        .select('*')
        .eq('contact_id', id)
        .order('received_at', { ascending: false })
        .limit(20),
      supabase.from('opportunities').select('*').eq('primary_contact_id', id)
    ]);

    return {
      ...contact,
      company: company.data,
      activities: activities.data || [],
      messages: messages.data || [],
      opportunities: opportunities.data || []
    };
  }

  /**
   * List contacts
   */
  async list(filters: {
    search?: string;
    company_id?: string;
    lifecycle_stage?: string;
    status?: string;
    assigned_to?: string;
    tags?: string[];
    lead_score_min?: number;
    limit?: number;
    offset?: number;
  } = {}) {
    const tenantId = await tenantService.getCurrentTenantId();
    let query = supabase
      .from('contacts')
      .select('*, company:companies(*)', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (filters.search) {
      query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    }

    if (filters.company_id) {
      query = query.eq('company_id', filters.company_id);
    }

    if (filters.lifecycle_stage) {
      query = query.eq('lifecycle_stage', filters.lifecycle_stage);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to);
    }

    if (filters.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }

    if (filters.lead_score_min !== undefined) {
      query = query.gte('lead_score', filters.lead_score_min);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1);
    query = query.order('lead_score', { ascending: false });

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
   * Create contact
   */
  async create(params: CreateContactParams): Promise<Contact> {
    const tenantId = await tenantService.getCurrentTenantId();
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        tenant_id: tenantId,
        ...params,
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;

    // Create activity
    await supabase.from('activities').insert({
      tenant_id: tenantId,
      contact_id: data.id,
      company_id: data.company_id,
      type: 'note',
      subject: 'Contact created',
      description: `${data.full_name} was added to the system`,
      created_by: userId,
      is_automated: true,
      source: 'system'
    });

    // Update company last_activity_at
    if (data.company_id) {
      await companyService.touch(data.company_id);
    }

    return data;
  }

  /**
   * Update contact
   */
  async update(id: string, params: Partial<CreateContactParams>): Promise<Contact> {
    const { data, error } = await supabase
      .from('contacts')
      .update(params)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Update company activity
    if (data.company_id) {
      await companyService.touch(data.company_id);
    }

    return data;
  }

  /**
   * Delete contact
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('contacts').delete().eq('id', id);

    if (error) throw error;
  }

  /**
   * Find contact by email
   */
  async findByEmail(email: string): Promise<Contact | null> {
    const tenantId = await tenantService.getCurrentTenantId();

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Find contact by phone
   */
  async findByPhone(phone: string): Promise<Contact | null> {
    const tenantId = await tenantService.getCurrentTenantId();
    const normalized = String(phone || '').replace(/[^\d+]/g, '');
    if (!normalized) return null;

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('phone', normalized)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Get contacts for company
   */
  async getForCompany(companyId: string): Promise<Contact[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('company_id', companyId)
      .order('lead_score', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get contacts for user
   */
  async getForUser(userId: string): Promise<Contact[]> {
    const tenantId = await tenantService.getCurrentTenantId();

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('assigned_to', userId)
      .order('last_activity_at', { ascending: false, nullsFirst: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Touch contact (update last_activity_at)
   */
  async touch(id: string): Promise<void> {
    await this.update(id, { last_activity_at: new Date().toISOString() } as any);

    // Also touch company
    const contact = await this.get(id);
    if (contact?.company_id) {
      await companyService.touch(contact.company_id);
    }
  }

  /**
   * Update lead score
   */
  async updateLeadScore(id: string, score: number): Promise<void> {
    await supabase
      .from('contacts')
      .update({ lead_score: Math.max(0, Math.min(100, score)) })
      .eq('id', id);
  }

  /**
   * Calculate and update engagement score
   */
  async updateEngagementScore(id: string): Promise<number> {
    const { data, error } = await supabase.rpc('calculate_contact_engagement_score', {
      p_contact_id: id
    });

    if (error) throw error;

    const score = data as number;
    await this.updateLeadScore(id, score);

    return score;
  }

  /**
   * Add tag
   */
  async addTag(id: string, tag: string): Promise<void> {
    const contact = await this.get(id);
    if (contact && !contact.tags?.includes(tag)) {
      const updatedTags = [...(contact.tags || []), tag];
      await this.update(id, { tags: updatedTags });
    }
  }

  /**
   * Remove tag
   */
  async removeTag(id: string, tag: string): Promise<void> {
    const contact = await this.get(id);
    if (contact && contact.tags?.includes(tag)) {
      const updatedTags = contact.tags.filter(t => t !== tag);
      await this.update(id, { tags: updatedTags });
    }
  }

  /**
   * Search contacts
   */
  async search(query: string, limit: number = 20): Promise<Contact[]> {
    const tenantId = await tenantService.getCurrentTenantId();

    const { data, error } = await supabase
      .from('contacts')
      .select('*, company:companies(*)')
      .eq('tenant_id', tenantId)
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,title.ilike.%${query}%`)
      .limit(limit);

    if (error) throw error;
    return data || [];
  }
}

export const contactService = new ContactService();
