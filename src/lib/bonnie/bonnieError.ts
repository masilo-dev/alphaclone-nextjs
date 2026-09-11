/**
 * Standard Bonnie error shape — all MCP and agent errors should converge here.
 * @see docs/BONNIE_MASTER_TRAINING_v3.md §6.4
 */

export interface BonnieError {
  error: string;
  message: string;
  action: string;
  recoverable: boolean;
  tenant_id?: string;
  retry_after?: number;
}

export function toBonnieError(
  error: string,
  message: string,
  action: string,
  options?: { recoverable?: boolean; tenant_id?: string; retry_after?: number }
): BonnieError {
  return {
    error,
    message,
    action,
    recoverable: options?.recoverable ?? false,
    ...(options?.tenant_id ? { tenant_id: options.tenant_id } : {}),
    ...(options?.retry_after ? { retry_after: options.retry_after } : {}),
  };
}

export function bonnieErrorMessage(err: BonnieError): string {
  return `${err.message} ${err.action}`.trim();
}

export const BONNIE_KNOWN_ERRORS = {
  zoho_auth_expired: (tenantId?: string): BonnieError =>
    toBonnieError(
      'zoho_auth_expired',
      'Zoho Mail connection has expired',
      'Settings → Integrations → Zoho Mail → Reconnect',
      { recoverable: false, tenant_id: tenantId }
    ),
  campaign_quality_failed: (score: number, warnings: string[]): BonnieError =>
    toBonnieError(
      'campaign_quality_failed',
      `Campaign quality score ${score}/100 — rewrite before send`,
      `Fix: ${warnings.slice(0, 3).join('; ')}`,
      { recoverable: true }
    ),
  invoice_send_failed: (): BonnieError =>
    toBonnieError(
      'invoice_send_failed',
      'Invoice could not be sent — missing logo URL',
      'Use send_transactional_email with base64 PDF as workaround',
      { recoverable: true }
    ),
} as const;
