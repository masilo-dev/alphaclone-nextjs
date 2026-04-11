import { supabase } from '@/lib/supabase';
import { tenantService } from '../tenancy/TenantService';

export type OpportunityStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

export interface Opportunity {
  id: string;
  tenant_id: string;
  company_id: string;
  primary_contact_id?: string;
  name: string;
  description?: string;
  amount?: number;
  currency: string;
  stage: OpportunityStage;
  probability?: number;
  expected_close_date?: string;
  actual_close_date?: string;
  lead_source?: string;
  campaign_id?: string;
  referral_source?: string;
  lost_reason?: string;
  lost_reason_detail?: string;
  competitor?: string;
  owner_id?: string;
  last_activity_at?: string;
  next_followup_at?: string;
  days_in_stage: number;
  stage_changed_at: string;
  custom_fields?: Record<string, any>;
  tags?: string[];
  created_at: string;
  updated_at: string;
  closed_at?: string;
  created_by?: string;
}

export interface CreateOpportunityParams {
  company_id: string;
  name: string;
  primary_contact_id?: string;
  description?: string;
  amount?: number;
  currency?: string;
  stage?: OpportunityStage;
  probability?: number;
  expected_close_date?: string;
  lead_source?: string;
  campaign_id?: string;
  referral_source?: string;
  owner_id?: string;
  custom_fields?: Record<string, any>;
  tags?: string[];
}

export interface UpdateOpportunityParams extends Partial<CreateOpportunityParams> {
  actual_close_date?: string;
  lost_reason?: string;
  lost_reason_detail?: string;
  competitor?: string;
  last_activity_at?: string;
  next_followup_at?: string;
  closed_at?: string;
}

export class OpportunityService {
  /**
   * Get opportunity by ID
   */
  async get(id: string): Promise<Opportunity | null> {
    const { data, error } = await supabase
      .from('opportunities')
      .select('*, company:companies(*), contact:contacts(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * List opportunities for a tenant/company
   */
  async list(filters: {
    company_id?: string;
    stage?: OpportunityStage;
    owner_id?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const tenantId = await tenantService.getCurrentTenantId();
    let query = supabase
      .from('opportunities')
      .select('*, company:companies(name)', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (filters.company_id) {
      query = query.eq('company_id', filters.company_id);
    }

    if (filters.stage) {
      query = query.eq('stage', filters.stage);
    }

    if (filters.owner_id) {
      query = query.eq('owner_id', filters.owner_id);
    }

    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

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
   * Create new opportunity
   */
  async create(params: CreateOpportunityParams): Promise<Opportunity> {
    const tenantId = await tenantService.getCurrentTenantId();
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('opportunities')
      .insert({
        tenant_id: tenantId,
        currency: 'USD',
        stage: 'lead',
        ...params,
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await supabase.from('activities').insert({
      tenant_id: tenantId,
      company_id: params.company_id,
      opportunity_id: data.id,
      contact_id: params.primary_contact_id,
      type: 'opportunity_won', // Using won as a 'success' type or just 'note'
      subject: `Opportunity Created: ${data.name}`,
      description: `New opportunity worth ${data.amount || 0} ${data.currency} added.`,
      created_by: userId,
      is_automated: true,
      source: 'system'
    }).catch((err: any) => console.error('Failed to log activity:', err));

    return data;
  }

  /**
   * Update opportunity
   */
  async update(id: string, params: UpdateOpportunityParams): Promise<Opportunity> {
    const { data, error } = await supabase
      .from('opportunities')
      .update(params)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Change stage
   */
  async setStage(id: string, stage: OpportunityStage): Promise<Opportunity> {
    const opportunity = await this.get(id);
    if (!opportunity) throw new Error('Opportunity not found');

    const update: UpdateOpportunityParams = { stage };
    
    if (stage === 'closed_won' || stage === 'closed_lost') {
      update.actual_close_date = new Date().toISOString();
      update.closed_at = new Date().toISOString();
    }

    const updated = await this.update(id, update);

    // Log stage change activity
    const userId = (await supabase.auth.getUser()).data.user?.id;
    await supabase.from('activities').insert({
      tenant_id: updated.tenant_id,
      company_id: updated.company_id,
      opportunity_id: updated.id,
      type: 'stage_change',
      subject: `Stage changed to ${stage}`,
      description: `Opportunity stage moved from ${opportunity.stage} to ${stage}`,
      created_by: userId,
      is_automated: true,
      source: 'system',
      metadata: { from_stage: opportunity.stage, to_stage: stage }
    }).catch((err: any) => console.error('Failed to log stage change:', err));

    return updated;
  }

  /**
   * Get pipeline summary
   */
  async getPipelineSummary() {
    const tenantId = await tenantService.getCurrentTenantId();
    const { data, error } = await supabase
      .from('opportunities')
      .select('stage, amount, probability')
      .eq('tenant_id', tenantId);

    if (error) throw error;

    const summary = {
      total_value: 0,
      weighted_value: 0,
      count_by_stage: {} as Record<string, number>,
      value_by_stage: {} as Record<string, number>
    };

    data?.forEach(opt => {
      const stage = opt.stage;
      const amount = Number(opt.amount) || 0;
      const probability = opt.probability || 0;

      summary.total_value += amount;
      summary.weighted_value += (amount * (probability / 100));
      
      summary.count_by_stage[stage] = (summary.count_by_stage[stage] || 0) + 1;
      summary.value_by_stage[stage] = (summary.value_by_stage[stage] || 0) + amount;
    });

    return summary;
  }
}

export const opportunityService = new OpportunityService();
