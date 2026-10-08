import { z } from 'zod';

export function explicitRecipients(value: string | string[]): string[] {
  const values = Array.isArray(value) ? value : [value];
  if (!values.length || values.length > 100)
    throw new Error(
      'EMAIL_RECIPIENT_INVALID: supply 1–100 explicit email addresses',
    );
  return values.map((address) => z.string().email().parse(address.trim()));
}

export function mailboxDate(value: unknown): string | null {
  if (!value) return null;
  const raw = String(value);
  const time = /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw);
  if (!Number.isFinite(time))
    throw new Error('EMAIL_PROVIDER_INVALID_TIMESTAMP');
  return new Date(
    time < 100000000000 && /^\d+$/.test(raw) ? time * 1000 : time,
  ).toISOString();
}

export function replyRecipients(
  source: { from: string; to: string[]; cc: string[]; reply_to?: string },
  own: string[],
  all: boolean,
) {
  const address = (raw: string) =>
    raw
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .match(/<([^>]+)>/)?.[1] || raw.trim();
  const excluded = new Set(own.map((email) => email.toLowerCase()));
  const seen = new Set<string>();
  const unique = (raw: string[]) =>
    raw.map(address).filter((email) => {
      const key = email.toLowerCase();
      if (excluded.has(key) || seen.has(key)) return false;
      explicitRecipients(email);
      seen.add(key);
      return true;
    });
  const to = unique([
    source.reply_to || source.from,
    ...(all ? source.to : []),
  ]);
  const cc = all ? unique(source.cc) : [];
  if (!to.length) throw new Error('EMAIL_REPLY_RECIPIENT_REQUIRED');
  return { to, cc };
}
