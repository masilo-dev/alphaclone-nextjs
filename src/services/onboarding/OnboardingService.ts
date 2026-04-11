import { supabase } from '@/lib/supabase';
import { tenantService } from '../tenancy/TenantService';

export interface BusinessGoals {
  goals: string[];
  companySize: string;
  industry: string;
  mainChallenge: string;
  sourceOfConfidence: string;
  completedAt?: string;
}

export class OnboardingService {
  /**
   * Save onboarding goals for the current tenant
   */
  async saveGoals(goals: Partial<BusinessGoals>): Promise<void> {
    const tenantId = await tenantService.getCurrentTenantId();
    
    // Get existing goals to merge
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_goals')
      .eq('id', tenantId)
      .single();

    const mergedGoals = {
      ...(tenant?.business_goals || {}),
      ...goals,
      completedAt: goals.completedAt || new Date().toISOString()
    };

    const { error } = await supabase
      .from('tenants')
      .update({ business_goals: mergedGoals })
      .eq('id', tenantId);

    if (error) throw error;
  }

  /**
   * Get onboarding goals for the current tenant
   */
  async getGoals(): Promise<BusinessGoals | null> {
    const tenantId = await tenantService.getCurrentTenantId();
    const { data, error } = await supabase
      .from('tenants')
      .select('business_goals')
      .eq('id', tenantId)
      .single();

    if (error) throw error;
    return data?.business_goals as BusinessGoals || null;
  }

  /**
   * Check if onboarding is completed
   */
  async isCompleted(): Promise<boolean> {
    const goals = await this.getGoals();
    return !!goals?.completedAt;
  }
}

export const onboardingService = new OnboardingService();
