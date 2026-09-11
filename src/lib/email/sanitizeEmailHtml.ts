'use client';

import DOMPurify from 'dompurify';
import { escapeHtml } from '@/lib/email/escapeHtml';
import { rewriteExternalEmailImageSources } from '@/lib/email/proxyImageUrl';

export { escapeHtml } from '@/lib/email/escapeHtml';

const CID_IMAGE_PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function normalizeTextHtml(value: string) {
  return escapeHtml(value).replace(/\r?\n/g, '<br />');
}

function replaceCidImageSources(html: string) {
  return html.replace(
    /src=(['"])cid:[^'"]+\1/gi,
    `src="${CID_IMAGE_PLACEHOLDER}" style="display:none;"`
  );
}

export function sanitizeEmailHtml(rawHtml?: string) {
  const html = String(rawHtml || '').trim();
  if (!html) return '';

  return DOMPurify.sanitize(rewriteExternalEmailImageSources(replaceCidImageSources(html)), {
    USE_PROFILES: { html: true },
  });
}

export function buildSafeEmailBodyHtml(bodyHtml?: string, fallbackText?: string) {
  const safeBodyHtml = sanitizeEmailHtml(bodyHtml);
  if (safeBodyHtml) return safeBodyHtml;

  const safeFallbackText = normalizeTextHtml(String(fallbackText || '').trim());
  return safeFallbackText ? `<p>${safeFallbackText}</p>` : '';
}
