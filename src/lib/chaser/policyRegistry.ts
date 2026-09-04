/**
 * Typed Universal Chaser policy registry — tenant overrides merge onto defaults.
 */

import type { ChaseAutomationMode, ChaseEntityType, ChasePolicyKey } from '@/lib/chaser/types';
import { resolveEffectiveAutomationMode } from '@/lib/chaser/chaseConfig';

export type ChasePolicyDefinition = {
  key: ChasePolicyKey;
  label: string;
  entityType: ChaseEntityType;
  detectDescription: string;
  initialAction: string;
  escalationAction: string;
  verifiedStopOutcomes: string[];
  defaultIntervalHours: number[];
  maxAttempts: number;
  escalationAfterAttempts: number;
  channel: 'email' | 'task' | 'notification' | 'mixed';
  defaultAutomationMode: ChaseAutomationMode;
  approvalRequired: boolean;
  respectQuietHours: boolean;
  respectOptOut: boolean;
};

const DEFAULT_POLICIES: Record<ChasePolicyKey, ChasePolicyDefinition> = {
  task_chaser: {
    key: 'task_chaser',
    label: 'Task chaser',
    entityType: 'task',
    detectDescription: 'Due soon, overdue, blocked, or stale with no update',
    initialAction: 'Notify assignee/owner and request status',
    escalationAction: 'Reassign or escalate to owner with downstream impact',
    verifiedStopOutcomes: ['completed', 'cancelled', 'done', 'archived'],
    defaultIntervalHours: [24, 24, 72, 168],
    maxAttempts: 5,
    escalationAfterAttempts: 3,
    channel: 'notification',
    defaultAutomationMode: 'internal',
    approvalRequired: false,
    respectQuietHours: true,
    respectOptOut: false,
  },
  project_chaser: {
    key: 'project_chaser',
    label: 'Project chaser',
    entityType: 'project',
    detectDescription: 'No progress, overdue milestone, or client waiting',
    initialAction: 'Produce recovery action list and owner task',
    escalationAction: 'Critical brief / client-risk escalation',
    verifiedStopOutcomes: ['completed', 'on_track', 'replanned'],
    defaultIntervalHours: [72, 72, 168],
    maxAttempts: 4,
    escalationAfterAttempts: 2,
    channel: 'mixed',
    defaultAutomationMode: 'internal',
    approvalRequired: false,
    respectQuietHours: true,
    respectOptOut: false,
  },
  lead_chaser: {
    key: 'lead_chaser',
    label: 'Lead chaser',
    entityType: 'lead',
    detectDescription: 'New untouched lead or overdue next action',
    initialAction: 'Draft/execute first touch and set reply SLA',
    escalationAction: 'Owner task to recycle or disqualify',
    verifiedStopOutcomes: ['replied', 'qualified', 'disqualified', 'opted_out', 'bounced'],
    defaultIntervalHours: [0, 48, 120, 216],
    maxAttempts: 4,
    escalationAfterAttempts: 3,
    channel: 'email',
    defaultAutomationMode: 'approval_required',
    approvalRequired: true,
    respectQuietHours: true,
    respectOptOut: true,
  },
  prospect_deal_chaser: {
    key: 'prospect_deal_chaser',
    label: 'Prospect / deal chaser',
    entityType: 'deal',
    detectDescription: 'Stage age exceeded or missing next action',
    initialAction: 'Stage-specific follow-up',
    escalationAction: 'Sales-owner escalation',
    verifiedStopOutcomes: ['won', 'lost', 'meeting_booked', 'next_action_set'],
    defaultIntervalHours: [72, 120, 168],
    maxAttempts: 4,
    escalationAfterAttempts: 2,
    channel: 'mixed',
    defaultAutomationMode: 'approval_required',
    approvalRequired: true,
    respectQuietHours: true,
    respectOptOut: true,
  },
  contact_chaser: {
    key: 'contact_chaser',
    label: 'Contact chaser',
    entityType: 'contact',
    detectDescription: 'Missing owner, status, or next action',
    initialAction: 'Request CRM state update',
    escalationAction: 'Data-quality escalation',
    verifiedStopOutcomes: ['fields_complete', 'next_action_set'],
    defaultIntervalHours: [168, 336],
    maxAttempts: 3,
    escalationAfterAttempts: 2,
    channel: 'task',
    defaultAutomationMode: 'internal',
    approvalRequired: false,
    respectQuietHours: true,
    respectOptOut: false,
  },
  client_chaser: {
    key: 'client_chaser',
    label: 'Client chaser',
    entityType: 'client',
    detectDescription: 'Client owes input/approval or has waited on us',
    initialAction: 'Chase responsible party',
    escalationAction: 'Account-owner / SLA escalation',
    verifiedStopOutcomes: ['reply', 'approval', 'delivery', 'resolved'],
    defaultIntervalHours: [48, 120, 168],
    maxAttempts: 4,
    escalationAfterAttempts: 2,
    channel: 'mixed',
    defaultAutomationMode: 'approval_required',
    approvalRequired: true,
    respectQuietHours: true,
    respectOptOut: true,
  },
  quote_proposal_chaser: {
    key: 'quote_proposal_chaser',
    label: 'Quote / proposal chaser',
    entityType: 'quote',
    detectDescription: 'Sent or viewed without decision',
    initialAction: 'Professional follow-up with quote link',
    escalationAction: 'Expiry / revision / owner escalation',
    verifiedStopOutcomes: ['accepted', 'rejected', 'expired', 'withdrawn', 'converted'],
    defaultIntervalHours: [48, 24, 96, 168],
    maxAttempts: 5,
    escalationAfterAttempts: 3,
    channel: 'email',
    defaultAutomationMode: 'approval_required',
    approvalRequired: true,
    respectQuietHours: true,
    respectOptOut: true,
  },
  contract_chaser: {
    key: 'contract_chaser',
    label: 'Contract chaser',
    entityType: 'contract',
    detectDescription: 'Sent but unsigned',
    initialAction: 'Signature reminder',
    escalationAction: 'Owner / legal escalation',
    verifiedStopOutcomes: ['signed', 'declined', 'voided', 'expired'],
    defaultIntervalHours: [72, 120, 168],
    maxAttempts: 4,
    escalationAfterAttempts: 2,
    channel: 'email',
    defaultAutomationMode: 'approval_required',
    approvalRequired: true,
    respectQuietHours: true,
    respectOptOut: true,
  },
  invoice_chaser: {
    key: 'invoice_chaser',
    label: 'Invoice chaser',
    entityType: 'invoice',
    detectDescription: 'Upcoming due, due, viewed unpaid, or overdue',
    initialAction: 'Invoice reminder with payment link',
    escalationAction: 'Firmer reminder then finance/owner escalation',
    verifiedStopOutcomes: ['paid', 'disputed', 'payment_plan', 'cancelled', 'void'],
    defaultIntervalHours: [72, 168, 336],
    maxAttempts: 5,
    escalationAfterAttempts: 3,
    channel: 'email',
    defaultAutomationMode: 'approval_required',
    approvalRequired: true,
    respectQuietHours: true,
    respectOptOut: true,
  },
  social_chaser: {
    key: 'social_chaser',
    label: 'Social chaser',
    entityType: 'social_account',
    detectDescription: 'Enabled account missing verified publish in cadence',
    initialAction: 'Create post task/draft',
    escalationAction: 'Owner alert or integration-health incident',
    verifiedStopOutcomes: ['published', 'paused', 'disabled'],
    defaultIntervalHours: [24, 48, 72],
    maxAttempts: 3,
    escalationAfterAttempts: 2,
    channel: 'task',
    defaultAutomationMode: 'internal',
    approvalRequired: false,
    respectQuietHours: false,
    respectOptOut: false,
  },
  campaign_chaser: {
    key: 'campaign_chaser',
    label: 'Campaign chaser',
    entityType: 'campaign',
    detectDescription: 'Active campaign with no sends or progress',
    initialAction: 'Resume/reconcile next safe batch',
    escalationAction: 'Marketing owner / platform incident',
    verifiedStopOutcomes: ['completed', 'paused', 'cancelled', 'exhausted'],
    defaultIntervalHours: [24, 72],
    maxAttempts: 3,
    escalationAfterAttempts: 2,
    channel: 'notification',
    defaultAutomationMode: 'internal',
    approvalRequired: false,
    respectQuietHours: true,
    respectOptOut: false,
  },
  goal_chaser: {
    key: 'goal_chaser',
    label: 'Goal chaser',
    entityType: 'goal',
    detectDescription: 'Checkpoint missed or no linked progress',
    initialAction: 'Generate next task and owner reminder',
    escalationAction: 'Priority escalation / replan request',
    verifiedStopOutcomes: ['milestone_met', 'revised', 'stopped'],
    defaultIntervalHours: [72, 168],
    maxAttempts: 3,
    escalationAfterAttempts: 2,
    channel: 'notification',
    defaultAutomationMode: 'internal',
    approvalRequired: false,
    respectQuietHours: true,
    respectOptOut: false,
  },
};

export function getChasePolicy(key: ChasePolicyKey): ChasePolicyDefinition {
  return DEFAULT_POLICIES[key];
}

export function listChasePolicies(): ChasePolicyDefinition[] {
  return Object.values(DEFAULT_POLICIES);
}

export function resolveChaseAutomationMode(
  policy: { defaultAutomationMode: ChaseAutomationMode; approvalRequired: boolean },
  tenantOverride?: ChaseAutomationMode | null,
): ChaseAutomationMode {
  return resolveEffectiveAutomationMode({
    policyDefault: policy.defaultAutomationMode,
    policyApprovalRequired: policy.approvalRequired,
    tenantOverride,
  });
}

export function buildChaseIdempotencyKey(params: {
  tenantId: string;
  policyKey: ChasePolicyKey;
  entityType: string;
  entityId: string;
}): string {
  return `${params.tenantId}:${params.policyKey}:${params.entityType}:${params.entityId}`;
}
