/**
 * Dashboard helper: start invoice lifecycle via authenticated API (no MCP/AI required).
 */
export async function startInvoiceLifecycleFromDashboard(params: {
  tenantId: string;
  invoiceId: string;
  recipients?: string | string[];
  accessToken?: string | null;
}): Promise<{ runId?: string; message: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (params.accessToken) {
    headers.Authorization = `Bearer ${params.accessToken}`;
  }

  const response = await fetch('/api/invoices/lifecycle', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      tenantId: params.tenantId,
      invoiceId: params.invoiceId,
      recipients: params.recipients,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Invoice lifecycle failed (${response.status})`);
  }
  return {
    runId: payload?.runId,
    message: payload?.message || 'Invoice delivery queued',
  };
}
