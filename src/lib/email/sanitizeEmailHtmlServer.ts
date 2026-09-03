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

export function buildSafeEmailBodyHtmlServer(bodyHtml?: string, fallbackText?: string): string {
  const safeBodyHtml = sanitizeEmailHtmlServer(bodyHtml);
  if (safeBodyHtml) return safeBodyHtml;

  const safeFallbackText = escapeHtml(String(fallbackText || '').trim()).replace(/\r?\n/g, '<br />');
  return safeFallbackText ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#334155;">${safeFallbackText}</p>` : '';
}
