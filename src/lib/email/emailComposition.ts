const DEFAULT_SYSTEM_FOOTER_LINES: string[] = [];

export function normalizeEmailSubject(subject: string): string {
  return String(subject || '').trim().replace(/\s+/g, ' ');
}

export function getSystemFooter(): string {
  const envFooter = String(process.env.SYSTEM_EMAIL_FOOTER || '').trim();
  if (envFooter.length > 0) {
    return envFooter;
  }
  return DEFAULT_SYSTEM_FOOTER_LINES.join('\n');
}

export function ensureFooter(content: string): string {
  const body = String(content || '').trim();
  const footer = getSystemFooter().trim();
  if (!footer) return body;
  if (!body) return footer;
  if (body.includes(footer)) return body;
  return `${body}\n\n${footer}`;
}

