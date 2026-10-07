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
  'tfoot',
  'tr',
  'th',
  'td',
  'colgroup',
  'col',
  // Full branded documents from renderEmail() must survive outbound sanitize.
  'html',
  'head',
  'body',
  'meta',
  'title',
  'center',
];

const TABLE_LAYOUT_ATTRS = [
  'style',
  'class',
  'role',
  'width',
  'height',
  'cellpadding',
  'cellspacing',
  'border',
  'align',
  'valign',
  'bgcolor',
  'colspan',
  'rowspan',
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
  ...sanitizeHtml.defaults.allowedAttributes,
  '*': ['style', 'class', 'id', 'dir', 'lang'],
  a: ['href', 'name', 'target', 'rel', 'style'],
  img: ['src', 'alt', 'width', 'height', 'style', 'border', 'align'],
  table: TABLE_LAYOUT_ATTRS,
  thead: TABLE_LAYOUT_ATTRS,
  tbody: TABLE_LAYOUT_ATTRS,
  tfoot: TABLE_LAYOUT_ATTRS,
  tr: TABLE_LAYOUT_ATTRS,
  th: TABLE_LAYOUT_ATTRS,
  td: TABLE_LAYOUT_ATTRS,
  col: ['width', 'span', 'style'],
  colgroup: ['width', 'span', 'style'],
  meta: ['charset', 'name', 'content'],
  html: ['lang', 'xmlns', 'xmlns:v', 'xmlns:o'],
};

/** Shared sanitize-html options for outbound branded email (Outlook-safe tables). */
export const OUTBOUND_EMAIL_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTRIBUTES,
  allowedStyles: {
    '*': {
      color: [/^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\))$/i],
      'background-color': [/^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\))$/i],
      'font-family': [/^[\w\s,.'"-]+$/],
      'font-size': [/^[\d.]+(px|pt|em|rem|%)$/],
      'font-weight': [/^(normal|bold|[1-9]00)$/],
      'line-height': [/^[\d.]+(px|pt|em|rem|%)?$/],
      'text-align': [/^(left|right|center|justify)$/],
      'text-decoration': [/^(none|underline|line-through)$/],
      'vertical-align': [/^(top|middle|bottom|baseline)$/],
      display: [/^(block|inline|inline-block|table|table-cell|none)$/],
      margin: [/^[\d.\s%-]+(px|pt|em|rem|auto|[\d.\s%-])*$/],
      padding: [/^[\d.\s%]+(px|pt|em|rem|[\d.\s%])*$/],
      width: [/^([\d.]+(px|pt|em|rem|%)|auto)$/],
      height: [/^([\d.]+(px|pt|em|rem|%)|auto)$/],
      'max-width': [/^[\d.]+(px|pt|em|rem|%)$/],
      'border-radius': [/^[\d.]+(px|%)$/],
      border: [/^[\d.]+px\s+(solid|dashed|none)\s+(#[0-9a-f]{3,8}|[a-z]+)$/i],
      'border-collapse': [/^(collapse|separate)$/],
      'word-break': [/^(normal|break-word|break-all)$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  // Keep MSO conditional comments used by renderEmail for Outlook Desktop.
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript'],
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
};

/** Server-safe HTML sanitizer for outbound email body fragments. */
export function sanitizeEmailHtmlServer(rawHtml?: string): string {
  const html = String(rawHtml || '').trim();
  if (!html) return '';

  return sanitizeHtml(html, OUTBOUND_EMAIL_SANITIZE_OPTIONS);
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
