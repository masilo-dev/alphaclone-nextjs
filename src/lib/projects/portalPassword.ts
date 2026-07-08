import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export function hashPortalPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(`${salt}:${password}`).digest('hex');
  return `sha256:${salt}:${hash}`;
}

export function verifyPortalPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || !password) return false;
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'sha256') return false;
  const [, salt, expected] = parts;
  const attempt = createHash('sha256').update(`${salt}:${password}`).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(attempt));
  } catch {
    return false;
  }
}
