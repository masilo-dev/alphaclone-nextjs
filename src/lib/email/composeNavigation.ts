export function buildMailComposeUrl(to: string | string[], subject?: string): string {
  const recipients = Array.isArray(to) ? to : [to];
  const normalized = recipients
    .map((value) => value.trim())
    .filter(Boolean);
  const params = new URLSearchParams({
    action: 'compose',
    to: normalized.join(', '),
  });
  if (subject?.trim()) {
    params.set('subject', subject.trim());
  }
  return `/dashboard/mail?${params.toString()}`;
}

export { extractEmailAddress } from '@/lib/email/parseEmailHeader';
