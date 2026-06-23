export function buildMailComposeUrl(to: string, subject?: string): string {
  const params = new URLSearchParams({ action: 'compose', to: to.trim() });
  if (subject?.trim()) {
    params.set('subject', subject.trim());
  }
  return `/dashboard/mail?${params.toString()}`;
}

export function extractEmailAddress(value?: string | null): string {
  if (!value) return '';
  const match = value.match(/[\w.+-]+@[\w.-]+\.\w+/);
  return match?.[0] || value.trim();
}
