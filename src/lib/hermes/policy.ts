export type HermesExecutionPolicy = 'READ' | 'CREATE' | 'EXTERNAL_ACTION' | 'SENSITIVE';

export type HermesPolicyDecision = {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
};

export function evaluateHermesPolicy(policy: HermesExecutionPolicy): HermesPolicyDecision {
  if (process.env.HERMES_GLOBAL_DISABLED === 'true') {
    return { allowed: false, requiresApproval: false, reason: 'Hermes is disabled globally' };
  }

  if (policy === 'SENSITIVE') {
    return { allowed: false, requiresApproval: true, reason: 'Sensitive actions require explicit AlphaClone approval' };
  }

  if (policy === 'EXTERNAL_ACTION') {
    return { allowed: false, requiresApproval: true, reason: 'External actions require AlphaClone approval before execution' };
  }

  return { allowed: true, requiresApproval: false, reason: 'Allowed by AlphaClone execution policy' };
}

export function normalizeHermesPolicy(value: unknown): HermesExecutionPolicy {
  const policy = String(value || 'READ').toUpperCase();
  if (policy === 'CREATE' || policy === 'EXTERNAL_ACTION' || policy === 'SENSITIVE') return policy;
  return 'READ';
}
