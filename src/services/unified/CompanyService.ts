import { supabase } from '@/lib/supabase';
import { tenantService } from '../tenancy/TenantService';

export interface Company {
  id: string;
  tenant_id: string;
  name: string;
  domain?: string;
  website?: string;
  industry?: string;
  employee_count?: number;
  annual_revenue?: number;
  lifecycle_stage: 'lead' | 'prospect' | 'customer' | 'churned';
  health_score: number;
  parent_company_id?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  last_activity_at?: string;
  next_followup_at?: string;
  last_contacted_at?: string;
  assigned_to?: string;
  custom_fields?: Record<string, any>;
  tags?: string[];
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateCompanyParams {
  name: string;
  domain?: string;
  website?: string;
  industry?: string;
  employee_count?: number;
  annual_revenue?: number;
  lifecycle_stage?: 'lead' | 'prospect' | 'customer' | 'churned';
  assigned_to?: string;
  custom_fields?: Record<string, any>;
  tags?: string[];
}

export interface UpdateCompanyParams extends Partial<CreateCompanyParams> {
  health_score?: number;
  last_activity_at?: string;
  next_followup_at?: string;
}

export class CompanyService {
  /**
   * Get company by ID
   */
  async get(id: string): Promise<Company | null> {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get company with all related data
   */
  async getWithRelations(id: string) {
    const [company, contacts, opportunities, activities] = await Promise.all([
      this.get(id),
      supabase.from('contacts').select('*').eq('company_id', id),
      supabase.from('opportunities').select('*').eq('company_id', id),
      supabase
        .from('activities')
        .select('*')
        .eq('company_id', id)
        .order('created_at', { ascending: false })
        .limit(50)
    ]);

    return {
      ...company,
      contacts: contacts.data || [],
      opportunities: opportunities.data || [],
      activities: activities.data || []
    };
  }

  /**
   * List companies with filters
   */
  async list(filters: {
    search?: string;
    lifecycle_stage?: string;
    assigned_to?: string;
    tags?: string[];
    health_score_min?: number;
    health_score_max?: number;
    limit?: number;
    offset?: number;
  } = {}) {
    const tenantId = await tenantService.getCurrentTenantId();
    let query = supabase
      .from('companies')
      .select('*, contacts:contacts(count)', { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Apply filters
    if (filters.search) {
      query = query.textSearch('name', filters.search);
    }

    if (filters.lifecycle_stage) {
      query = query.eq('lifecycle_stage', filters.lifecycle_stage);
    }

    if (filters.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to);
    }

    if (filters.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }

    if (filters.health_score_min !== undefined) {
      query = query.gte('health_score', filters.health_score_min);
    }

    if (filters.health_score_max !== undefined) {
      query = query.lte('health_score', filters.health_score_max);
    }

    // Pagination
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1);

    // Sort by last activity
    query = query.order('last_activity_at', { ascending: false, nullsFirst: false });

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
   * Create new company
   */
  async create(params: CreateCompanyParams): Promise<Company> {
    const tenantId = await tenantService.getCurrentTenantId();
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('companies')
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
      company_id: data.id,
      type: 'note',
      subject: 'Company created',
      description: `${data.name} was added to the system`,
      created_by: userId,
      is_automated: true,
      source: 'system'
    });

    return data;
  }

  /**
   * Update company
   */
  async update(id: string, params: UpdateCompanyParams): Promise<Company> {
    const { data, error } = await supabase
      .from('companies')
      .update(params)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete company
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('companies').delete().eq('id', id);

    if (error) throw error;
  }

  /**
   * Update health score
   */
  async updateHealthScore(id: string, score: number): Promise<void> {
    await this.update(id, { health_score: Math.max(0, Math.min(100, score)) });
  }

  /**
   * Increment health score
   */
  async incrementHealthScore(id: string, amount: number): Promise<void> {
    const company = await this.get(id);
    if (company) {
      await this.updateHealthScore(id, company.health_score + amount);
    }
  }

  /**
   * Touch company (update last_activity_at)
   */
  async touch(id: string): Promise<void> {
    await this.update(id, { last_activity_at: new Date().toISOString() });
  }

  /**
   * Find company by domain
   */
  async findByDomain(domain: string): Promise<Company | null> {
    const tenantId = await tenantService.getCurrentTenantId();

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('domain', domain)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Get companies at churn risk
   */
  async getChurnRisks(userId?: string): Promise<Company[]> {
    const tenantId = await tenantService.getCurrentTenantId();
    let query = supabase
      .from('companies')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('lifecycle_stage', 'customer')
      .lt('health_score', 40)
      .order('health_score', { ascending: true });

    if (userId) {
      query = query.eq('assigned_to', userId);
    }

    const { data, error } = await query.limit(10);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get companies for user
   */
  async getForUser(userId: string): Promise<Company[]> {
    const tenantId = await tenantService.getCurrentTenantId();

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('assigned_to', userId)
      .order('last_activity_at', { ascending: false, nullsFirst: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Search companies (full-text)
   */
  async search(query: string, limit: number = 20): Promise<Company[]> {
    const tenantId = await tenantService.getCurrentTenantId();

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('tenant_id', tenantId)
      .textSearch('name', query, { type: 'websearch' })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Add tag to company
   */
  async addTag(id: string, tag: string): Promise<void> {
    const company = await this.get(id);
    if (company && !company.tags?.includes(tag)) {
      const updatedTags = [...(company.tags || []), tag];
      await this.update(id, { tags: updatedTags });
    }
  }

  /**
   * Remove tag from company
   */
  async removeTag(id: string, tag: string): Promise<void> {
    const company = await this.get(id);
    if (company && company.tags?.includes(tag)) {
      const updatedTags = company.tags.filter(t => t !== tag);
      await this.update(id, { tags: updatedTags });
    }
  }
}

export const companyService = new CompanyService();
