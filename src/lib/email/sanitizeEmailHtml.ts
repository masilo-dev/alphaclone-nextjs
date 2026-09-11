'use client';

import DOMPurify from 'dompurify';
import { rewriteExternalEmailImageSources } from '@/lib/email/proxyImageUrl';

const CID_IMAGE_PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
