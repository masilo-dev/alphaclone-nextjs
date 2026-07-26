export const CONTRACT_STATUSES = [
  'request', 'draft', 'internal_review', 'changes_requested', 'pending_approval',
  'approved', 'ready_to_send', 'sent', 'viewed', 'negotiating',
  'awaiting_signature', 'partially_signed', 'signed', 'active', 'suspended',
  'expiring', 'renewal_review', 'renewed', 'completed', 'terminated', 'expired', 'archived',
] as const;

export type ContractManagerStatus = (typeof CONTRACT_STATUSES)[number];

export const VALID_CONTRACT_TRANSITIONS: Readonly<Record<ContractManagerStatus, readonly ContractManagerStatus[]>> = {
  request: ['draft'],
  draft: ['internal_review', 'pending_approval', 'archived'],
  internal_review: ['draft', 'changes_requested', 'pending_approval'],
  changes_requested: ['draft', 'internal_review'],
  pending_approval: ['draft', 'approved'],
  approved: ['ready_to_send', 'draft'],
  ready_to_send: ['sent', 'draft'],
  sent: ['viewed', 'negotiating', 'awaiting_signature'],
  viewed: ['negotiating', 'awaiting_signature'],
  negotiating: ['draft', 'awaiting_signature'],
  awaiting_signature: ['partially_signed', 'signed'],
  partially_signed: ['signed'],
  signed: ['active'],
  active: ['suspended', 'expiring', 'completed', 'terminated'],
  suspended: ['active', 'terminated'],
  expiring: ['renewal_review', 'expired', 'completed', 'terminated'],
  renewal_review: ['renewed', 'expired', 'terminated'],
  renewed: ['active'],
  completed: ['archived'],
  terminated: ['archived'],
  expired: ['archived'],
  archived: [],
};

export function canTransitionContract(from: string, to: string): boolean {
  if (!CONTRACT_STATUSES.includes(from as ContractManagerStatus)) return false;
  if (!CONTRACT_STATUSES.includes(to as ContractManagerStatus)) return false;
  return VALID_CONTRACT_TRANSITIONS[from as ContractManagerStatus].includes(to as ContractManagerStatus);
}

export type ContractRiskSignal = { code: string; reason: string; severity: 'moderate' | 'high' | 'critical' };

export function explainContractRisk(input: {
  status: string;
  endDate?: string | null;
  noticeDeadline?: string | null;
  signatureStatus?: string | null;
  overdueObligations?: number;
  now?: Date;
}): { level: 'low' | 'moderate' | 'high' | 'critical'; reasons: ContractRiskSignal[] } {
  const now = input.now ?? new Date();
  const reasons: ContractRiskSignal[] = [];
  const daysUntil = (value?: string | null) =>
    value ? Math.ceil((new Date(value).getTime() - now.getTime()) / 86_400_000) : null;
  const noticeDays = daysUntil(input.noticeDeadline);
  const endDays = daysUntil(input.endDate);

  if (input.status === 'active' && input.signatureStatus !== 'signed') {
    reasons.push({ code: 'active_without_signature', reason: 'Contract is active without a completed signature.', severity: 'critical' });
  }
  if ((input.overdueObligations ?? 0) > 0) {
    reasons.push({ code: 'overdue_obligations', reason: `${input.overdueObligations} obligation(s) are overdue.`, severity: 'high' });
  }
  if (noticeDays !== null && noticeDays >= 0 && noticeDays <= 30) {
    reasons.push({ code: 'notice_deadline', reason: `Notice deadline is in ${noticeDays} day(s).`, severity: noticeDays <= 7 ? 'critical' : 'high' });
  }
  if (endDays !== null && endDays >= 0 && endDays <= 60) {
    reasons.push({ code: 'contract_expiry', reason: `Contract ends in ${endDays} day(s).`, severity: 'moderate' });
  }

  const rank = { moderate: 1, high: 2, critical: 3 };
  const highest = reasons.reduce((value, item) => Math.max(value, rank[item.severity]), 0);
  return { level: highest === 3 ? 'critical' : highest === 2 ? 'high' : highest === 1 ? 'moderate' : 'low', reasons };
}
