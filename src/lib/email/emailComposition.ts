const DEFAULT_SYSTEM_FOOTER_LINES: string[] = [
  'AlphaClone Systems LLC',
  'alphaclonesystems.com',
  'Unsubscribe: {{{unsubscribe_url}}}',
  'Privacy: https://alphaclonesystems.com/legal/privacy',
  'Terms: https://alphaclonesystems.com/legal/terms',
  'If you received this email in error, please disregard and delete it.',
];

const HTML_FOOTER_STYLE = [
  'margin-top:24px',
  'padding-top:16px',
  'border-top:1px solid #e2e8f0',
  'font-family:Arial,Helvetica,sans-serif',
  'font-size:12px',
  'line-height:1.6',
  'color:#64748b',
  'text-align:center',
].join(';');

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtmlFooter(lines: string[]): string {
  const escapedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return '';

    const urlMatch = trimmed.match(/^(.*?):\s*(https?:\/\/\S+)$/i);
    if (urlMatch) {
      const label = escapeHtml(urlMatch[1]);
      const url = escapeHtml(urlMatch[2]);
      return `<div><span>${label}:</span> <a href="${url}" style="color:#475569;text-decoration:none;">${url}</a></div>`;
    }

    return `<div>${escapeHtml(trimmed)}</div>`;
  }).join('');

  return `<div style="${HTML_FOOTER_STYLE}">${escapedLines}</div>`;
}

export function ensureFooter(content: string): string {
  const body = String(content || '').trim();
  const footer = getSystemFooter().trim();
  if (!footer) return body;
  if (!body) return footer;
  if (body.includes(footer)) return body;

  if (/<[a-z][\s\S]*>/i.test(body)) {
    return `${body}${buildHtmlFooter(footer.split('\n'))}`;
  }

  return `${body}\n\n${footer}`;
}
