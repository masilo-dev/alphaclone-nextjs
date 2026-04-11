import { supabase } from '@/lib/supabase';
import { tenantService } from '../tenancy/TenantService';

export type ActivityType = 
  | 'note' | 'call' | 'email' | 'meeting' | 'task'
  | 'contract_signed' | 'invoice_sent' | 'invoice_paid' | 'payment_received'
  | 'opportunity_won' | 'opportunity_lost' | 'stage_change'
  | 'email_opened' | 'email_clicked' | 'form_submitted'
  | 'document_viewed' | 'churn_risk_detected' | 'health_score_change';

export interface Activity {
  id: string;
  tenant_id: string;
  company_id?: string;
  contact_id?: string;
  opportunity_id?: string;
  project_id?: string;
  invoice_id?: string;
  contract_id?: string;
  type: ActivityType;
  subject: string;
  description?: string;
  outcome?: string;
  created_by?: string;
  assigned_to?: string;
  scheduled_at?: string;
  completed_at?: string;
  due_date?: string;
  duration_minutes?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, any>;
  is_automated: boolean;
  source?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateActivityParams {
  type: ActivityType;
  subject: string;
  company_id?: string;
  contact_id?: string;
  opportunity_id?: string;
  project_id?: string;
  invoice_id?: string;
  contract_id?: string;
  description?: string;
  outcome?: string;
  assigned_to?: string;
  scheduled_at?: string;
  due_date?: string;
  duration_minutes?: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, any>;
  is_automated?: boolean;
  source?: string;
}

export class ActivityService {
  /**
   * Get activity by ID
   */
  async get(id: string): Promise<Activity | null> {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * List activities for an entity
   */
  async listForEntity(entity: {
    company_id?: string;
    contact_id?: string;
    opportunity_id?: string;
    project_id?: string;
  }, limit: number = 50) {
    const tenantId = await tenantService.getCurrentTenantId();
    let query = supabase
      .from('activities')
      .select()
      .eq('tenant_id', tenantId);

    if (entity.company_id) query = query.eq('company_id', entity.company_id);
    if (entity.contact_id) query = query.eq('contact_id', entity.contact_id);
    if (entity.opportunity_id) query = query.eq('opportunity_id', entity.opportunity_id);
    if (entity.project_id) query = query.eq('project_id', entity.project_id);

    query = query.order('created_at', { ascending: false }).limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Log an activity
   */
  async log(params: CreateActivityParams): Promise<Activity> {
    const tenantId = await tenantService.getCurrentTenantId();
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase
      .from('activities')
      .insert({
        tenant_id: tenantId,
        created_by: userId,
        status: params.type === 'note' || params.type === 'email' ? 'completed' : 'pending',
        priority: 'normal',
        is_automated: false,
        source: 'manual',
        ...params
      })
      .select()
      .single();

    if (error) throw error;
    
    // Update company/contact last_activity_at
    if (data.company_id) {
      await supabase.from('companies').update({ last_activity_at: new Date().toISOString() }).eq('id', data.company_id);
    }
    if (data.contact_id) {
      await supabase.from('contacts').update({ last_activity_at: new Date().toISOString() }).eq('id', data.contact_id);
    }

    return data;
  }

  /**
   * Mark activity as completed
   */
  async complete(id: string, outcome?: string): Promise<Activity> {
    const { data, error } = await supabase
      .from('activities')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        outcome
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get upcoming tasks for a tenant user
   */
  async getUpcomingTasks(userId: string) {
    const tenantId = await tenantService.getCurrentTenantId();
    const { data, error } = await supabase
      .from('activities')
      .select('*, company:companies(name)')
      .eq('tenant_id', tenantId)
      .eq('assigned_to', userId)
      .eq('status', 'pending')
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })
      .limit(20);

    if (error) throw error;
    return data || [];
  }
}

export const activityService = new ActivityService();
