const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/gi;

function linkifyPlainText(text: string): string {
  return escapeHtml(text).replace(URL_PATTERN, (url) => {
    let label = 'Open link';
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('alphaclone')) label = 'View in AlphaClone';
      else if (parsed.pathname.length <= 24) label = parsed.hostname.replace(/^www\./, '');
      else label = 'View details';
    } catch {
      // keep default label
    }
    return `<a href="${escapeHtml(url)}" style="color:#0f766e;text-decoration:underline;">${escapeHtml(label)}</a>`;
  });
}

export interface EmailContentInput {
  headline?: string;
  greeting?: string;
  body: string;
  cta?: { label: string; url: string };
  signatureHtml?: string;
  signatureText?: string;
}

export function buildEmailContentHtml(input: EmailContentInput): string {
  const parts: string[] = [];
  if (input.headline) {
    parts.push(
      `<h1 style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;color:#0f172a;">${escapeHtml(input.headline)}</h1>`,
    );
  }
  if (input.greeting) {
    parts.push(
      `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#334155;">${escapeHtml(input.greeting)}</p>`,
    );
  }

  const paragraphs = String(input.body || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  for (const paragraph of paragraphs) {
    const html = paragraph.includes('http')
      ? linkifyPlainText(paragraph).replace(/\n/g, '<br>')
      : escapeHtml(paragraph).replace(/\n/g, '<br>');
    parts.push(
      `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#334155;">${html}</p>`,
    );
  }

  if (input.cta?.url && input.cta.label) {
    parts.push(
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td style="border-radius:8px;background:#0f766e;">
<a href="${escapeHtml(input.cta.url)}" style="display:inline-block;padding:14px 24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;">${escapeHtml(input.cta.label)}</a>
</td></tr></table>`,
    );
  }

  if (input.signatureHtml) parts.push(input.signatureHtml);
  return parts.join('\n');
}

export function buildEmailContentText(input: EmailContentInput): string {
  const lines: string[] = [];
  if (input.headline) lines.push(input.headline, '');
  if (input.greeting) lines.push(input.greeting, '');
  lines.push(input.body.trim(), '');
  if (input.cta?.url && input.cta.label) lines.push(`${input.cta.label}: ${input.cta.url}`, '');
  if (input.signatureText) lines.push(input.signatureText);
  return lines.join('\n').trim();
}

export function stripRawHtmlDocument(html: string): string {
  const trimmed = html.trim();
  if (!/<html[\s>]/i.test(trimmed) && !/<body[\s>]/i.test(trimmed)) return trimmed;
  const bodyMatch = trimmed.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch?.[1]?.trim() || trimmed.replace(/<\/?(?:html|head|body)[^>]*>/gi, '').trim();
}
