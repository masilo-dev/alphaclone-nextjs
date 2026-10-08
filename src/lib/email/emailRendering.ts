import sanitizeHtml from 'sanitize-html';
import { OUTBOUND_EMAIL_SANITIZE_OPTIONS } from '@/lib/email/sanitizeEmailHtmlServer';
import { decodeHtmlEntities } from '@/lib/email/decodeHtmlEntities';

export interface OutboundEmailRenderResult {
  html: string;
  text: string;
  isMarkdownConverted: boolean;
}

export interface RenderOutboundEmailParams {
  html?: string;
  text?: string;
  preserveContent?: boolean;
  unsubscribeUrl?: string;
  includeFooter?: boolean;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^(https?:\/\/|mailto:)/i.test(trimmed);
}

function renderInlineFormattingOnly(text: string): string {
  let out = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Bold
  out = out.replace(/\*\*([^*]+)\*\*/g, (_m, b) => `<strong style="font-weight: 600; color: #0f172a;">${b}</strong>`);
  out = out.replace(/__([^_]+)__/g, (_m, b) => `<strong style="font-weight: 600; color: #0f172a;">${b}</strong>`);
  // Italic
  out = out.replace(/(^|[^\w*])\*([^*\n]+)\*([^\w*]|$)/g, (_m, pre, it, post) => `${pre}<em>${it}</em>${post}`);
  out = out.replace(/(^|[^\w_])_([^_\n]+)_([^\w_]|$)/g, (_m, pre, it, post) => `${pre}<em>${it}</em>${post}`);
  return out;
}

/**
 * Converts inline Markdown (bold, italic, code, links, autolinks) to HTML.
 * Uses placeholder tokens to prevent nested anchors and double-replacement.
 */
function renderInlineMarkdown(text: string): string {
  const tokens: string[] = [];

  // 1. Inline code: `code`
  let out = text.replace(/`([^`]+)`/g, (_match, code) => {
    const idx = tokens.length;
    tokens.push(`<code style="background-color: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #0f172a;">${escapeHtmlText(code)}</code>`);
    return `__INLINE_TOKEN_${idx}__`;
  });

  // 2. Markdown links: [label](url)
  // Handles [https://cal.com/foo](https://cal.com/foo) or [Book Demo](https://cal.com/foo)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, url) => {
    const cleanUrl = url.trim();
    if (!isSafeUrl(cleanUrl)) {
      return escapeHtmlText(label);
    }
    const safeHref = escapeAttribute(cleanUrl);
    // Format label without converting bare URLs inside label into links
    const safeLabel = renderInlineFormattingOnly(label);
    const idx = tokens.length;
    tokens.push(`<a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 500;">${safeLabel}</a>`);
    return `__INLINE_TOKEN_${idx}__`;
  });

  // 3. Autolinks: <https://...>
  out = out.replace(/<((https?:\/\/|mailto:)[^>\s]+)>/g, (_match, url) => {
    const safeHref = escapeAttribute(url.trim());
    const safeText = url.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const idx = tokens.length;
    tokens.push(`<a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 500;">${safeText}</a>`);
    return `__INLINE_TOKEN_${idx}__`;
  });

  // 4. Standalone bare URLs (https://... or http://...)
  out = out.replace(
    /(^|[\s(])((https?:\/\/)[^\s<>)"]+)(?=$|[\s)])/g,
    (_match, prefix, url) => {
      let cleanUrl = url;
      let trailingPunct = '';
      const punctMatch = cleanUrl.match(/[.,;:!?]+$/);
      if (punctMatch) {
        trailingPunct = punctMatch[0];
        cleanUrl = cleanUrl.slice(0, -trailingPunct.length);
      }
      if (!isSafeUrl(cleanUrl)) return prefix + url;
      const safeHref = escapeAttribute(cleanUrl);
      const safeText = cleanUrl.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const idx = tokens.length;
      tokens.push(`${prefix}<a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 500;">${safeText}</a>${trailingPunct}`);
      return `__INLINE_TOKEN_${idx}__`;
    }
  );

  // 5. Bold & Italic on remaining text
  out = out.replace(/\*\*([^*]+)\*\*/g, (_match, bold) => `<strong style="font-weight: 600; color: #0f172a;">${renderInlineFormattingOnly(bold)}</strong>`);
  out = out.replace(/__([^_]+)__/g, (_match, bold) => `<strong style="font-weight: 600; color: #0f172a;">${renderInlineFormattingOnly(bold)}</strong>`);
  out = out.replace(/(^|[^\w*])\*([^*\n]+)\*([^\w*]|$)/g, (_match, pre, italic, post) => `${pre}<em>${renderInlineFormattingOnly(italic)}</em>${post}`);
  out = out.replace(/(^|[^\w_])_([^_\n]+)_([^\w_]|$)/g, (_match, pre, italic, post) => `${pre}<em>${renderInlineFormattingOnly(italic)}</em>${post}`);

  // 6. Restore all tokens
  out = out.replace(/__INLINE_TOKEN_(\d+)__/g, (_match, idx) => tokens[Number(idx)]);

  return out;
}

/**
 * Converts Markdown text into clean, email-client-compatible HTML.
 */
export function convertMarkdownToEmailHtml(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const codeBlocks: string[] = [];
  const withPlaceholders = normalized.replace(/```[a-z0-9_-]*\n[\s\S]*?```/gi, (match) => {
    const idx = codeBlocks.length;
    codeBlocks.push(match);
    return `\n\n__FENCED_CODE_BLOCK_${idx}__\n\n`;
  });

  const blocks = withPlaceholders.split(/\n\n+/);
  const renderedBlocks: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Fenced Code Block: placeholder from pre-extraction or direct
    const codeMatch = trimmed.match(/^__FENCED_CODE_BLOCK_(\d+)__$/);
    if (codeMatch) {
      const codeBlockRaw = codeBlocks[Number(codeMatch[1])];
      const codeLines = codeBlockRaw.split('\n');
      const codeContent = codeLines.slice(1, codeLines[codeLines.length - 1].startsWith('```') ? -1 : undefined).join('\n');
      renderedBlocks.push(
        `<pre style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #0f172a; overflow-x: auto; margin: 0 0 16px 0;"><code>${escapeHtmlText(codeContent)}</code></pre>`
      );
      continue;
    }
    if (trimmed.startsWith('```')) {
      const codeLines = trimmed.split('\n');
      const codeContent = codeLines.slice(1, codeLines[codeLines.length - 1].startsWith('```') ? -1 : undefined).join('\n');
      renderedBlocks.push(
        `<pre style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #0f172a; overflow-x: auto; margin: 0 0 16px 0;"><code>${escapeHtmlText(codeContent)}</code></pre>`
      );
      continue;
    }

    // Horizontal Rule: --- or ***
    if (/^([-*_]){3,}$/.test(trimmed)) {
      renderedBlocks.push('<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />');
      continue;
    }

    // Headings: #, ##, ###
    if (/^#{1,3}\s+/.test(trimmed)) {
      const levelMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
      if (levelMatch) {
        const level = levelMatch[1].length;
        const headingText = renderInlineMarkdown(escapeHtmlText(levelMatch[2].trim()));
        if (level === 1) {
          renderedBlocks.push(`<h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.3;">${headingText}</h1>`);
        } else if (level === 2) {
          renderedBlocks.push(`<h2 style="margin: 0 0 14px 0; font-size: 18px; font-weight: 600; color: #0f172a; line-height: 1.3;">${headingText}</h2>`);
        } else {
          renderedBlocks.push(`<h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #0f172a; line-height: 1.3;">${headingText}</h3>`);
        }
        continue;
      }
    }

    // Blockquote: > line
    if (trimmed.startsWith('>')) {
      const quoteLines = trimmed.split('\n').map((l) => l.replace(/^>\s?/, ''));
      const quoteContent = quoteLines.map((l) => renderInlineMarkdown(escapeHtmlText(l))).join('<br />');
      renderedBlocks.push(
        `<blockquote style="margin: 0 0 16px 0; padding-left: 14px; border-left: 3px solid #cbd5e1; color: #475569; font-style: italic;">${quoteContent}</blockquote>`
      );
      continue;
    }

    // Unordered List: lines starting with - or * (either entire block or following intro text)
    const lines = trimmed.split('\n');
    const firstUnorderedIdx = lines.findIndex((l) => /^[-*]\s+/.test(l.trim()));
    if (firstUnorderedIdx !== -1) {
      let lastUnorderedIdx = firstUnorderedIdx;
      while (lastUnorderedIdx + 1 < lines.length && /^[-*]\s+/.test(lines[lastUnorderedIdx + 1].trim())) {
        lastUnorderedIdx++;
      }
      if (firstUnorderedIdx > 0) {
        const leadLines = lines.slice(0, firstUnorderedIdx).filter((l) => l.trim().length > 0);
        if (leadLines.length > 0) {
          const paraHtml = leadLines.map((l) => renderInlineMarkdown(escapeHtmlText(l))).join('<br />\n');
          renderedBlocks.push(`<p style="margin: 0 0 16px 0; line-height: 1.6; color: #1e293b; font-size: 15px;">${paraHtml}</p>`);
        }
      }
      const listLines = lines.slice(firstUnorderedIdx, lastUnorderedIdx + 1);
      const items = listLines.map((l) => {
        const itemText = l.trim().replace(/^[-*]\s+/, '');
        return `<li style="margin-bottom: 6px;">${renderInlineMarkdown(escapeHtmlText(itemText))}</li>`;
      });
      renderedBlocks.push(
        `<ul style="margin: 0 0 16px 0; padding-left: 24px; color: #1e293b; line-height: 1.6;">${items.join('')}</ul>`
      );
      if (lastUnorderedIdx + 1 < lines.length) {
        const trailLines = lines.slice(lastUnorderedIdx + 1).filter((l) => l.trim().length > 0);
        if (trailLines.length > 0) {
          const paraHtml = trailLines.map((l) => renderInlineMarkdown(escapeHtmlText(l))).join('<br />\n');
          renderedBlocks.push(`<p style="margin: 0 0 16px 0; line-height: 1.6; color: #1e293b; font-size: 15px;">${paraHtml}</p>`);
        }
      }
      continue;
    }

    // Ordered List: lines starting with 1. 2. etc.
    const firstOrderedIdx = lines.findIndex((l) => /^\d+\.\s+/.test(l.trim()));
    if (firstOrderedIdx !== -1) {
      let lastOrderedIdx = firstOrderedIdx;
      while (lastOrderedIdx + 1 < lines.length && /^\d+\.\s+/.test(lines[lastOrderedIdx + 1].trim())) {
        lastOrderedIdx++;
      }
      if (firstOrderedIdx > 0) {
        const leadLines = lines.slice(0, firstOrderedIdx).filter((l) => l.trim().length > 0);
        if (leadLines.length > 0) {
          const paraHtml = leadLines.map((l) => renderInlineMarkdown(escapeHtmlText(l))).join('<br />\n');
          renderedBlocks.push(`<p style="margin: 0 0 16px 0; line-height: 1.6; color: #1e293b; font-size: 15px;">${paraHtml}</p>`);
        }
      }
      const listLines = lines.slice(firstOrderedIdx, lastOrderedIdx + 1);
      const items = listLines.map((l) => {
        const itemText = l.trim().replace(/^\d+\.\s+/, '');
        return `<li style="margin-bottom: 6px;">${renderInlineMarkdown(escapeHtmlText(itemText))}</li>`;
      });
      renderedBlocks.push(
        `<ol style="margin: 0 0 16px 0; padding-left: 24px; color: #1e293b; line-height: 1.6;">${items.join('')}</ol>`
      );
      if (lastOrderedIdx + 1 < lines.length) {
        const trailLines = lines.slice(lastOrderedIdx + 1).filter((l) => l.trim().length > 0);
        if (trailLines.length > 0) {
          const paraHtml = trailLines.map((l) => renderInlineMarkdown(escapeHtmlText(l))).join('<br />\n');
          renderedBlocks.push(`<p style="margin: 0 0 16px 0; line-height: 1.6; color: #1e293b; font-size: 15px;">${paraHtml}</p>`);
        }
      }
      continue;
    }

    // Standard Paragraph: lines within paragraph joined with <br />
    const paraHtml = lines
      .map((line) => renderInlineMarkdown(escapeHtmlText(line)))
      .join('<br />\n');
    renderedBlocks.push(
      `<p style="margin: 0 0 16px 0; line-height: 1.6; color: #1e293b; font-size: 15px;">${paraHtml}</p>`
    );
  }

  // Wrap in a clean, email-client-friendly container without promotional clutter
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #1e293b; max-width: 600px;">\n${renderedBlocks.join('\n')}\n</div>`;
}

/**
 * Converts HTML to clean plain text.
 */
export function convertHtmlToPlainText(html: string): string {
  if (!html) return '';

  let text = html;

  // Replace links: <a href="url">label</a> -> label (url) or url if equal
  text = text.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href, label) => {
    const cleanLabel = label.replace(/<[^>]+>/g, '').trim();
    const cleanHref = href.trim();
    if (!cleanLabel || cleanLabel.toLowerCase() === cleanHref.toLowerCase()) {
      return cleanHref;
    }
    return `${cleanLabel} (${cleanHref})`;
  });

  // Convert break tags and paragraph/block closures to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|div|h[1-6]|tr|li|blockquote|pre)>/gi, '\n\n');
  text = text.replace(/<(hr)\s*\/?>/gi, '\n---\n');

  // Strip all other HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Normalize whitespace and blank lines
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

/**
 * Converts Markdown to clean plain text.
 */
export function convertMarkdownToPlainText(markdown: string): string {
  if (!markdown) return '';

  let text = markdown;

  // Links: [label](url) -> label (url) or url if label === url
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, url) => {
    const cleanLabel = label.trim();
    const cleanUrl = url.trim();
    if (cleanLabel.toLowerCase() === cleanUrl.toLowerCase()) {
      return cleanUrl;
    }
    return `${cleanLabel} (${cleanUrl})`;
  });

  // Autolinks: <url> -> url
  text = text.replace(/<((https?:\/\/|mailto:)[^>\s]+)>/g, '$1');

  // Headers: # Header -> Header
  text = text.replace(/^#{1,6}\s+(.*)$/gm, '$1');

  // Bold & Italic
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/(^|[^\w*])\*([^*\n]+)\*([^\w*]|$)/g, '$1$2$3');
  text = text.replace(/(^|[^\w_])_([^_\n]+)_([^\w_]|$)/g, '$1$2$3');

  // Inline code: `code` -> code
  text = text.replace(/`([^`]+)`/g, '$1');

  // Fenced code blocks
  text = text.replace(/```[a-z]*\n([\s\S]*?)```/gi, '$1');

  // Blockquotes: > quote -> quote
  text = text.replace(/^>\s?/gm, '');

  return text.trim();
}

/**
 * Checks whether a given string is predominantly HTML content.
 */
export function isHtmlContent(content: string): boolean {
  if (!content) return false;
  return /<[a-z][\s\S]*>/i.test(content);
}

export interface OutboundComplianceFooterOptions {
  unsubscribeUrl?: string;
  privacyUrl?: string;
  termsUrl?: string;
  companyName?: string;
  address?: string;
}

export function buildOutboundComplianceFooter(options?: OutboundComplianceFooterOptions): { html: string; text: string } {
  const unsubUrl = options?.unsubscribeUrl || 'https://alphaclonesystems.com/unsubscribe';
  const privacyUrl = options?.privacyUrl || 'https://alphaclonesystems.com/privacy-policy';
  const termsUrl = options?.termsUrl || 'https://alphaclonesystems.com/terms-of-service';
  const companyName = options?.companyName || 'Alphaclone Systems, LLC';
  const address = options?.address || '30 N Gould St, Sheridan, WY 82801, USA';

  const html = [
    '<div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.6; color: #64748b; text-align: center;">',
    '  <p style="margin: 0 0 10px 0; color: #64748b;">',
    `    <a href="${privacyUrl}" target="_blank" rel="noopener noreferrer" style="color: #64748b; text-decoration: underline;">Privacy Policy</a> &nbsp;&bull;&nbsp;`,
    `    <a href="${termsUrl}" target="_blank" rel="noopener noreferrer" style="color: #64748b; text-decoration: underline;">Terms</a> &nbsp;&bull;&nbsp;`,
    `    <a href="${unsubUrl}" target="_blank" rel="noopener noreferrer" style="color: #64748b; text-decoration: underline;">Unsubscribe</a> &nbsp;&bull;&nbsp;`,
    '    <a href="https://alphaclonesystems.com" target="_blank" rel="noopener noreferrer" style="color: #64748b; text-decoration: underline;">Website</a>',
    '  </p>',
    `  <p style="margin: 0 0 4px 0; font-weight: 600; color: #0f172a;">${companyName}</p>`,
    `  <p style="margin: 0 0 8px 0; color: #64748b;">${address}</p>`,
    '  <p style="margin: 0; font-size: 11px; color: #94a3b8;">If you received this email in error, please disregard and delete it.</p>',
    '</div>',
  ].join('\n');

  const text = [
    '',
    '---',
    `Privacy Policy: ${privacyUrl}`,
    `Terms: ${termsUrl}`,
    `Unsubscribe: ${unsubUrl}`,
    `${companyName} — a Wyoming registered company`,
    address,
    'If you received this email in error, please disregard and delete it.',
  ].join('\n');

  return { html, text };
}

export function hasComplianceFooterMarkers(content: string): boolean {
  const text = String(content || '');
  if (!text.trim()) return false;

  // HTML structural footer containers or anchors
  if (/<div[^>]+border-top:\s*1px\s+solid/i.test(text) && (/privacy-policy/i.test(text) || /unsubscribe/i.test(text))) return true;
  if (/<table[^>]+role=["']presentation["']/i.test(text) && (/privacy-policy/i.test(text) || /unsubscribe/i.test(text))) return true;
  if (/<a[^>]+href=["'][^"']*\/privacy-policy/i.test(text) && /<a[^>]+href=["'][^"']*(?:\/unsubscribe|\/api\/unsubscribe|\{\{\{unsubscribe_url\}\}\})/i.test(text)) return true;

  // Plain text footer markers (must be structured footer prefixes, not casual body mentions)
  const hasUnsubPrefix = /(?:Unsubscribe|unsubscribe):\s*(?:https?:\/\/|\{\{\{)/i.test(text) || text.includes('{{{unsubscribe_url}}}');
  const hasPrivacyPrefix = /(?:Privacy(?:\s+Policy)?):\s*https?:\/\//i.test(text);
  if (hasUnsubPrefix && hasPrivacyPrefix) return true;
  if (text.includes('---') && hasUnsubPrefix) return true;

  return false;
}

/**
 * Centralized email rendering pipeline for outbound emails.
 * Guarantees that every outbound email has:
 * 1. Clean, email-client-compatible, sanitized `html`
 * 2. High-fidelity, readable `text`
 * 3. Standard compliance footer when requested or when an unsubscribe URL is provided.
 */
export function renderOutboundEmail(params: RenderOutboundEmailParams): OutboundEmailRenderResult {
  const rawHtml = String(params.html || '').trim();
  const rawText = String(params.text || '').trim();

  let resultHtml = '';
  let resultText = '';
  let isMarkdownConverted = false;

  // Case 1: HTML is provided and actually contains HTML tags
  if (rawHtml && isHtmlContent(rawHtml)) {
    const sanitizedHtml = sanitizeHtml(rawHtml, OUTBOUND_EMAIL_SANITIZE_OPTIONS);
    resultHtml = sanitizedHtml;
    resultText = rawText || convertHtmlToPlainText(sanitizedHtml);
    isMarkdownConverted = false;
  } else {
    // Case 2: Only Markdown / plain text is provided (or HTML is just text without tags)
    const sourceText = rawText || rawHtml;
    if (!sourceText) {
      return {
        html: '',
        text: '',
        isMarkdownConverted: false,
      };
    }

    // Convert Markdown to clean email HTML
    const rawRenderedHtml = convertMarkdownToEmailHtml(sourceText);
    const sanitizedHtml = sanitizeHtml(rawRenderedHtml, OUTBOUND_EMAIL_SANITIZE_OPTIONS);
    resultHtml = sanitizedHtml;
    resultText = convertMarkdownToPlainText(sourceText);
    isMarkdownConverted = true;
  }

  // Attach compliant footer if requested or when unsubscribe URL is provided (unless explicitly skipped)
  const shouldAttachFooter = params.includeFooter !== false && (params.includeFooter === true || Boolean(params.unsubscribeUrl));
  if (shouldAttachFooter) {
    const hasExistingFooter = hasComplianceFooterMarkers(resultHtml) || hasComplianceFooterMarkers(resultText);
    if (!hasExistingFooter) {
      const footer = buildOutboundComplianceFooter({
        unsubscribeUrl: params.unsubscribeUrl,
      });

      if (resultHtml.endsWith('</div>')) {
        resultHtml = `${resultHtml.slice(0, -6)}\n${footer.html}\n</div>`;
      } else {
        resultHtml = `${resultHtml}\n${footer.html}`;
      }

      resultText = `${resultText.trimEnd()}${footer.text}`;
    }
  }

  return {
    html: resultHtml,
    text: resultText,
    isMarkdownConverted,
  };
}
