import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export function outreachFingerprint(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
export function outreachOperationKey(userId: string, payload: unknown): string {
  const input = payload as Record<string, unknown>;
  // Non-message annotations must not create a second send identity on retry.
  const identity = { tenantId: input.tenantId, recipient: String(input.leadEmail || '').trim().toLowerCase(),
    subject: String(input.subject || '').trim(), body: input.body, fromAddress: input.fromAddress,
    preferredProvider: input.preferredProvider, deliveryProviders: Array.isArray(input.deliveryProviders) ? [...input.deliveryProviders].sort() : [],
    attachments: input.attachments, cc: input.cc, bcc: input.bcc };
  return `ui-outreach:${outreachFingerprint({ userId, identity })}`;
}
export function signOutreachApproval(secret: string, userId: string, payload: unknown, senderRevision: string, now = Date.now()): string {
  if (!secret) throw new Error('OUTREACH_APPROVAL_SECRET_MISSING');
  const claims = Buffer.from(JSON.stringify({ userId, digest: outreachFingerprint(payload), senderRevision, expires: now + 10 * 60_000 })).toString('base64url');
  return `${claims}.${createHmac('sha256', secret).update(claims).digest('base64url')}`;
}
export function verifyOutreachApproval(token: string, secret: string, userId: string, payload: unknown, senderRevision: string, now = Date.now()): boolean {
  if (!secret || !token || token.length > 2048) return false;
  const [claims, signature, extra] = token.split('.');
  if (!claims || !signature || extra) return false;
  const expected = createHmac('sha256', secret).update(claims).digest();
  const supplied = Buffer.from(signature, 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(claims, 'base64url').toString());
    return data.userId === userId && data.digest === outreachFingerprint(payload) && data.senderRevision === senderRevision && data.expires > now;
  } catch { return false; }
}
