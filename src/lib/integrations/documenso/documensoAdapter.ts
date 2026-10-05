import crypto from 'node:crypto';

/**
 * Documenso E-Sign Engine Adapter (Isolated).
 * Handles cryptographic signature verification and contract lifecycle synchronization.
 * Disabled by default unless DOCUMENSO_API_URL and DOCUMENSO_WEBHOOK_SECRET are configured.
 */

export interface DocumensoConfig {
  apiUrl?: string;
  webhookSecret?: string;
  enabled: boolean;
}

export function getDocumensoConfig(): DocumensoConfig {
  const apiUrl = process.env.DOCUMENSO_API_URL?.trim();
  const webhookSecret = process.env.DOCUMENSO_WEBHOOK_SECRET?.trim();
  return {
    apiUrl,
    webhookSecret,
    enabled: Boolean(apiUrl && webhookSecret),
  };
}

/**
 * Validates HMAC SHA-256 webhook signature from Documenso.
 */
export function verifyDocumensoSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;
  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = signatureHeader.replace(/^sha256=/, '').trim();
    if (expected.length !== provided.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    return false;
  }
}
