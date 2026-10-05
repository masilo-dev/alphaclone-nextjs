import sanitizeHtml from 'sanitize-html';
import { escapeHtml } from '@/lib/email/escapeHtml';

const ALLOWED_TAGS = [
  ...sanitizeHtml.defaults.allowedTags,
  'img',
  'h1',
  'h2',
  'h3',
  'h4',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
];

const ALLOWED_ATTRIBUTES = {
  ...sanitizeHtml.defaults.allowedAttributes,
  '*': ['style', 'class'],
  a: ['href', 'name', 'target', 'rel', 'style'],
  img: ['src', 'alt', 'width', 'height', 'style', 'border'],
};

/** Server-safe HTML sanitizer for outbound email body fragments. */
export function sanitizeEmailHtmlServer(rawHtml?: string): string {
  const html = String(rawHtml || '').trim();
  if (!html) return '';

  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
    },
  });
}

/**
 * Outlook (Word rendering engine) often collapses bare `<div>` blocks and
 * drops unstyled fragments. Wrap sanitized HTML in a presentation table with
 * inline Arial styles so the message body stays readable in Outlook/OWA.
 */
export function buildSafeEmailBodyHtmlServer(bodyHtml?: string, fallbackText?: string): string {
  let safeBodyHtml = sanitizeEmailHtmlServer(bodyHtml);

  // Editors sometimes emit only <div>paragraph</div>; Outlook treats those poorly.
  if (safeBodyHtml) {
    safeBodyHtml = safeBodyHtml
      .replace(/<div(\s[^>]*)?>/gi, '<p$1>')
      .replace(/<\/div>/gi, '</p>')
      .replace(/<p([^>]*)>\s*<\/p>/gi, '<p$1>&nbsp;</p>');
  }

  if (!safeBodyHtml) {
    const safeFallbackText = escapeHtml(String(fallbackText || '').trim()).replace(/\r?\n/g, '<br />');
    safeBodyHtml = safeFallbackText
      ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">${safeFallbackText}</p>`
      : '';
  }

  if (!safeBodyHtml) return '';

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="left" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#334155;word-break:break-word;">
${safeBodyHtml}
</td></tr>
</table>`;
}
