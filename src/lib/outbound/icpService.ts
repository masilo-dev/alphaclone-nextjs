/**
 * Outbound ICP (Ideal Customer Profile) Service
 * Tenant-scoped ICP definitions — CRUD + scoring helper
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export interface ICPCriteria {
  industries?: string[];
  locations?: string[];
  company_size_min?: number;
  company_size_max?: number;
  revenue_min?: number;
  revenue_max?: number;
  business_types?: string[];
  job_titles?: string[];
  seniority_levels?: string[];
  technology_signals?: string[];
  website_required?: boolean;
  social_required?: boolean;
  pain_points?: string[];
  excluded_industries?: string[];
  excluded_keywords?: string[];
  excluded_domains?: string[];
  custom_criteria?: Record<string, unknown>;
}

export interface ICP extends ICPCriteria {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export async function listICPs(tenantId: string): Promise<ICP[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('outbound_icps')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ICP[];
}

export async function getICP(tenantId: string, icpId: string): Promise<ICP | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('outbound_icps')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', icpId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data as ICP | null;
}

export async function getDefaultICP(tenantId: string): Promise<ICP | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('outbound_icps')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data as ICP | null;
}

export async function createICP(
  tenantId: string,
  userId: string,
  input: { name: string; description?: string; is_default?: boolean } & ICPCriteria
): Promise<ICP> {
  const admin = createSupabaseAdminClient();

  // If this will be default, clear existing default first
  if (input.is_default) {
    await admin
      .from('outbound_icps')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('is_default', true);
  }

  const { data, error } = await admin
    .from('outbound_icps')
    .insert({
      tenant_id: tenantId,
      created_by: userId,
      name: input.name,
      description: input.description || null,
      is_default: input.is_default ?? false,
      industries: input.industries || [],
      locations: input.locations || [],
      company_size_min: input.company_size_min ?? null,
      company_size_max: input.company_size_max ?? null,
      revenue_min: input.revenue_min ?? null,
      revenue_max: input.revenue_max ?? null,
      business_types: input.business_types || [],
      job_titles: input.job_titles || [],
      seniority_levels: input.seniority_levels || [],
      technology_signals: input.technology_signals || [],
      website_required: input.website_required ?? false,
      social_required: input.social_required ?? false,
      pain_points: input.pain_points || [],
      excluded_industries: input.excluded_industries || [],
      excluded_keywords: input.excluded_keywords || [],
      excluded_domains: input.excluded_domains || [],
      custom_criteria: input.custom_criteria || {},
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ICP;
}

export async function updateICP(
  tenantId: string,
  icpId: string,
  updates: Partial<{ name: string; description: string; is_default: boolean } & ICPCriteria>
): Promise<ICP> {
  const admin = createSupabaseAdminClient();

  if (updates.is_default) {
    await admin
      .from('outbound_icps')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('is_default', true)
      .neq('id', icpId);
  }

  const { data, error } = await admin
    .from('outbound_icps')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', icpId)
    .select('*')
    .single();
  if (error) throw error;
  return data as ICP;
}

export async function deleteICP(tenantId: string, icpId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('outbound_icps')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', icpId);
  if (error) throw error;
}

/**
 * Score a lead/company profile against an ICP.
 * Returns 0–100 with matched and failed criteria lists.
 * Pure function — no DB calls — used by AI qualification as pre-check.
 */
export function scoreAgainstICP(
  icp: ICP,
  profile: {
    industry?: string;
    location?: string;
    company_size?: number;
    revenue?: number;
    job_title?: string;
    website?: string;
    social_links?: Record<string, string>;
    pain_points?: string[];
    technology_stack?: string[];
    domain?: string;
    business_type?: string;
  }
): { score: number; matched: string[]; failed: string[]; excluded: boolean } {
  const matched: string[] = [];
  const failed: string[] = [];
  let excluded = false;

  // Exclusion checks (hard fail)
  if (
    profile.industry &&
    icp.excluded_industries?.some(
      (ex) => profile.industry?.toLowerCase().includes(ex.toLowerCase())
    )
  ) {
    excluded = true;
  }
  if (
    profile.domain &&
    icp.excluded_domains?.some((ex) =>
      profile.domain?.toLowerCase().includes(ex.toLowerCase())
    )
  ) {
    excluded = true;
  }

  if (excluded) return { score: 0, matched: [], failed: ['excluded'], excluded: true };

  let total = 0;
  let points = 0;

  // Industry match
  if (icp.industries && icp.industries.length > 0) {
    total += 20;
    if (
      profile.industry &&
      icp.industries.some((ind) =>
        profile.industry?.toLowerCase().includes(ind.toLowerCase())
      )
    ) {
      points += 20;
      matched.push(`industry: ${profile.industry}`);
    } else {
      failed.push('industry does not match ICP');
    }
  }

  // Location match
  if (icp.locations && icp.locations.length > 0) {
    total += 10;
    if (
      profile.location &&
      icp.locations.some((loc) =>
        profile.location?.toLowerCase().includes(loc.toLowerCase())
      )
    ) {
      points += 10;
      matched.push(`location: ${profile.location}`);
    } else {
      failed.push('location does not match ICP');
    }
  }

  // Company size
  if (icp.company_size_min !== undefined || icp.company_size_max !== undefined) {
    total += 15;
    if (profile.company_size !== undefined) {
      const inRange =
        (icp.company_size_min === undefined || profile.company_size >= icp.company_size_min) &&
        (icp.company_size_max === undefined || profile.company_size <= icp.company_size_max);
      if (inRange) {
        points += 15;
        matched.push(`company size: ${profile.company_size}`);
      } else {
        failed.push('company size outside ICP range');
      }
    }
  }

  // Job title
  if (icp.job_titles && icp.job_titles.length > 0) {
    total += 20;
    if (
      profile.job_title &&
      icp.job_titles.some((title) =>
        profile.job_title?.toLowerCase().includes(title.toLowerCase())
      )
    ) {
      points += 20;
      matched.push(`job title: ${profile.job_title}`);
    } else {
      failed.push('job title does not match ICP');
    }
  }

  // Website required
  if (icp.website_required) {
    total += 10;
    if (profile.website) {
      points += 10;
      matched.push('has website');
    } else {
      failed.push('no website (ICP requires one)');
    }
  }

  // Social presence
  if (icp.social_required) {
    total += 10;
    if (profile.social_links && Object.keys(profile.social_links).length > 0) {
      points += 10;
      matched.push('has social presence');
    } else {
      failed.push('no social presence (ICP requires one)');
    }
  }

  // Technology signals
  if (icp.technology_signals && icp.technology_signals.length > 0 && profile.technology_stack) {
    total += 15;
    const matchedTech = icp.technology_signals.filter((sig) =>
      profile.technology_stack?.some((t) => t.toLowerCase().includes(sig.toLowerCase()))
    );
    if (matchedTech.length > 0) {
      points += 15;
      matched.push(`technology signals: ${matchedTech.join(', ')}`);
    } else {
      failed.push('no matching technology signals');
    }
  }

  const score = total > 0 ? Math.round((points / total) * 100) : 50;
  return { score, matched, failed, excluded: false };
}
