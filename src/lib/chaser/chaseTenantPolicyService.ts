/**
 * Tenant policy overrides from agent_chasing_policies + tenants.settings.
 */

import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getChasePolicy, type ChasePolicyDefinition } from '@/lib/chaser/policyRegistry';
import type { ChaseAutomationMode, ChasePolicyKey } from '@/lib/chaser/types';

export type TenantChasePolicyOverride = {
  policyKey: ChasePolicyKey;
  active: boolean;
  maxAttempts?: number;
  requiresApproval?: boolean;
  automationMode?: ChaseAutomationMode;
  followUpIntervalHours?: number[];
  escalationOwnerUserId?: string | null;
  source: 'registry' | 'agent_chasing_policies' | 'tenant_settings';
};

const POLICY_KEY_TO_ENTITY: Record<string, ChasePolicyKey> = {
  task: 'task_chaser',
  task_chaser: 'task_chaser',
  project: 'project_chaser',
  project_chaser: 'project_chaser',
  lead: 'lead_chaser',
  lead_chaser: 'lead_chaser',
  deal: 'prospect_deal_chaser',
  prospect_deal_chaser: 'prospect_deal_chaser',
  contact: 'contact_chaser',
  contact_chaser: 'contact_chaser',
  client: 'client_chaser',
  client_chaser: 'client_chaser',
  quote: 'quote_proposal_chaser',
  proposal: 'quote_proposal_chaser',
  quote_proposal_chaser: 'quote_proposal_chaser',
  contract: 'contract_chaser',
  contract_chaser: 'contract_chaser',
  invoice: 'invoice_chaser',
  unpaid_invoice: 'invoice_chaser',
  invoice_chaser: 'invoice_chaser',
  social: 'social_chaser',
  social_account: 'social_chaser',
  social_chaser: 'social_chaser',
  campaign: 'campaign_chaser',
  campaign_chaser: 'campaign_chaser',
  goal: 'goal_chaser',
  goal_chaser: 'goal_chaser',
};

function mapDbRowToPolicyKey(name: string, targetEntityType: string): ChasePolicyKey | null {
  return (
    POLICY_KEY_TO_ENTITY[name] ||
    POLICY_KEY_TO_ENTITY[targetEntityType] ||
    (name in POLICY_KEY_TO_ENTITY ? (name as ChasePolicyKey) : null)
  );
}

export async function loadTenantChasePolicyOverride(
  tenantId: string,
  policyKey: ChasePolicyKey,
): Promise<TenantChasePolicyOverride> {
  const defaults = getChasePolicy(policyKey);
  const admin = createSupabaseAdminClient();

  const { data: rows } = await admin
    .from('agent_chasing_policies')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  const match = (rows || []).find((row) => mapDbRowToPolicyKey(row.name, row.target_entity_type) === policyKey);

  if (match) {
    return {
      policyKey,
      active: match.active !== false,
      maxAttempts: match.max_attempts ?? defaults.maxAttempts,
      requiresApproval: match.requires_approval ?? defaults.approvalRequired,
      followUpIntervalHours: match.follow_up_intervals_hours ?? defaults.defaultIntervalHours,
      escalationOwnerUserId: match.escalation_owner_user_id,
      automationMode: match.requires_approval ? 'approval_required' : 'automated',
      source: 'agent_chasing_policies',
    };
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .maybeSingle();
  const settings = ((tenant?.settings || {}) as Record<string, unknown>).chaser_policies as
    | Record<string, Record<string, unknown>>
    | undefined;
  const setting = settings?.[policyKey];
  if (setting) {
    return {
      policyKey,
      active: setting.active !== false,
      maxAttempts: Number(setting.max_attempts ?? defaults.maxAttempts),
      requiresApproval: Boolean(setting.requires_approval ?? defaults.approvalRequired),
      automationMode: (setting.automation_mode as ChaseAutomationMode) || undefined,
      source: 'tenant_settings',
    };
  }

  return {
    policyKey,
    active: true,
    maxAttempts: defaults.maxAttempts,
    requiresApproval: defaults.approvalRequired,
    automationMode: defaults.defaultAutomationMode,
    source: 'registry',
  };
}

export async function upsertTenantChasePolicy(params: {
  tenantId: string;
  policyKey: ChasePolicyKey;
  requiresApproval?: boolean;
  maxAttempts?: number;
  followUpIntervalHours?: number[];
  active?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const admin = createSupabaseAdminClient();
  const defaults = getChasePolicy(params.policyKey);
  const name = params.policyKey;

  const { error } = await admin.from('agent_chasing_policies').upsert(
    {
      tenant_id: params.tenantId,
      name,
      target_entity_type: defaults.entityType,
      terminal_outcomes: defaults.verifiedStopOutcomes,
      follow_up_intervals_hours:
        params.followUpIntervalHours || defaults.defaultIntervalHours,
      max_attempts: params.maxAttempts ?? defaults.maxAttempts,
      communication_channel: defaults.channel === 'mixed' ? 'email' : defaults.channel,
      requires_approval: params.requiresApproval ?? defaults.approvalRequired,
      active: params.active ?? true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,name' },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function mergePolicyWithOverride(
  defaults: ChasePolicyDefinition,
  override: TenantChasePolicyOverride,
): ChasePolicyDefinition {
  return {
    ...defaults,
    maxAttempts: override.maxAttempts ?? defaults.maxAttempts,
    approvalRequired: override.requiresApproval ?? defaults.approvalRequired,
    defaultAutomationMode: override.automationMode ?? defaults.defaultAutomationMode,
    defaultIntervalHours: override.followUpIntervalHours ?? defaults.defaultIntervalHours,
  };
}
