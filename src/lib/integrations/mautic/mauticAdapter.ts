/**
 * Mautic Marketing Sequences Adapter (Isolated).
 * Synchronizes marketing campaign stages while strictly honoring AlphaClone's
 * canonical contact suppression, GDPR unsubscribe policy, and tenant boundaries.
 * Disabled by default unless MAUTIC_API_URL, MAUTIC_PUBLIC_KEY, and MAUTIC_SECRET_KEY are configured.
 */

export interface MauticConfig {
  apiUrl?: string;
  publicKey?: string;
  secretKey?: string;
  enabled: boolean;
}

export function getMauticConfig(): MauticConfig {
  const apiUrl = process.env.MAUTIC_API_URL?.trim();
  const publicKey = process.env.MAUTIC_PUBLIC_KEY?.trim();
  const secretKey = process.env.MAUTIC_SECRET_KEY?.trim();
  return {
    apiUrl,
    publicKey,
    secretKey,
    enabled: Boolean(apiUrl && publicKey && secretKey),
  };
}

export interface SyncMauticContactParams {
  tenantId: string;
  email: string;
  firstname?: string;
  lastname?: string;
  company?: string;
  isSuppressed?: boolean;
}

export async function syncContactToMautic(
  params: SyncMauticContactParams
): Promise<{ success: boolean; mauticId?: number; error?: string }> {
  // Safety rule: never push marketing sync for contacts that are marked suppressed in AlphaClone
  if (params.isSuppressed) {
    return { success: true, error: 'Skipped sync: contact is suppressed in AlphaClone' };
  }

  const config = getMauticConfig();
  if (!config.enabled || !config.apiUrl) {
    return { success: false, error: 'Mautic integration is not enabled or configured' };
  }

  try {
    const authHeader = Buffer.from(`${config.publicKey}:${config.secretKey}`).toString('base64');
    const res = await fetch(`${config.apiUrl.replace(/\/$/, '')}/api/contacts/new`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json',
        'X-Tenant-ID': params.tenantId,
      },
      body: JSON.stringify({
        email: params.email,
        firstname: params.firstname,
        lastname: params.lastname,
        company: params.company,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return { success: false, error: `Mautic returned HTTP ${res.status}` };
    }

    const json = await res.json();
    return { success: true, mauticId: json?.contact?.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Mautic sync failed' };
  }
}
