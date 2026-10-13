import type { ValidationFinding, DocumentValidationResult } from '@/lib/documents/documentValidationEngine';

/** Owners choose contract terms. Content review records advice, not a sending veto. */
export function contractSendReview(validation: DocumentValidationResult, legalFindings: ValidationFinding[], unresolvedTokens: string[] = []) {
  const findings: ValidationFinding[] = [...validation.findings, ...legalFindings,
    ...(unresolvedTokens.length ? [{ id: 'unresolved-template-tokens', severity: 'warning' as const,
      message: `Contract contains unfilled template fields: ${unresolvedTokens.join(', ')}`, field: 'content' }] : [])
  ].map(finding => {
    // Only an explicitly labelled conflicting client identity blocks routing.
    if (finding.id === 'inconsistent-client-email') return finding;
    return finding.severity === 'critical' ? { ...finding, severity: 'warning' as const,
      evidence: { ...finding.evidence, original_severity: finding.severity, send_policy: 'owner_controlled_content' } } : finding;
  });
  const canSend = !findings.some(finding => finding.severity === 'critical');
  return { ...validation, findings, valid: canSend, can_send: canSend };
}
export function sendsDraftReview(config: { isDraft?: unknown; draftReview?: unknown; send_draft_for_review?: unknown }) {
  return Boolean(config.isDraft || config.draftReview || config.send_draft_for_review);
}
