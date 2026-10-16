/**
 * Dashboard helper: start invoice lifecycle via authenticated API (no MCP/AI required).
 */
export async function startInvoiceLifecycleFromDashboard(params: {
  tenantId: string;
  invoiceId: string;
  recipients?: string | string[];
  subject?: string;
  message?: string;
  attachments?: Array<{
    name: string;
    storagePath?: string;
    storage_path?: string;
    contentType?: string;
    content_type?: string;
    size?: number;
  }>;
  resend?: boolean;
  accessToken?: string | null;
}): Promise<{
  ok: boolean;
  runId?: string;
  status: 'sent' | 'queued';
  canonicalDeliveryStatus: 'provider_accepted' | 'queued';
  provider?: string | null;
  emailId?: string | null;
  actionUrl?: string;
  message: string;
}> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (params.accessToken) {
    headers.Authorization = `Bearer ${params.accessToken}`;
  }

  const normalizedAttachments = Array.isArray(params.attachments)
    ? params.attachments
        .map((a) => ({
          name: a.name,
          storage_path: a.storage_path || a.storagePath || '',
          content_type: a.content_type || a.contentType || 'application/octet-stream',
          size: a.size,
        }))
        .filter((a) => Boolean(a.name && a.storage_path))
    : undefined;

  const response = await fetch('/api/invoices/lifecycle', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      tenantId: params.tenantId,
      invoiceId: params.invoiceId,
      recipients: params.recipients,
      subject: params.subject,
      message: params.message,
      attachments: normalizedAttachments,
      resend: params.resend,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Invoice lifecycle failed (${response.status})`);
  }

  const isSent =
    payload?.status === 'sent' || payload?.canonical_delivery_status === 'provider_accepted';

  return {
    ok: true,
    runId: payload?.run_id || payload?.runId,
    status: isSent ? 'sent' : 'queued',
    canonicalDeliveryStatus: isSent ? 'provider_accepted' : 'queued',
    provider: payload?.provider ?? null,
    emailId: payload?.email_id ?? null,
    actionUrl: payload?.action_url ?? undefined,
    message:
      payload?.message ||
      (isSent
        ? 'Invoice sent and accepted by the email provider.'
        : 'Invoice queued for background delivery; email acceptance is not yet confirmed.'),
  };
}
