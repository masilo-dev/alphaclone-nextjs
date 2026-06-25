export function buildMailComposeUrl(to: string, subject?: string): string {
  const params = new URLSearchParams({ action: 'compose', to: to.trim() });
  if (subject?.trim()) {
    params.set('subject', subject.trim());
  }
  return `/dashboard/mail?${params.toString()}`;
}

export { extractEmailAddress } from '@/lib/email/parseEmailHeader';
