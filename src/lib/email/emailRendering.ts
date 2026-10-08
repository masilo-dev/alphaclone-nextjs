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

/**
 * Converts inline Markdown (bold, italic, code, links, autolinks) to HTML.
 */
function renderInlineMarkdown(text: string): string {
  // Protect already-escaped or special placeholders
  let out = text;

  // 1. Inline code: `code`
  out = out.replace(/`([^`]+)`/g, (_match, code) => {
    return `<code style="background-color: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #0f172a;">${escapeHtmlText(code)}</code>`;
  });

  // 2. Markdown links: [label](url)
  // Handles [https://cal.com/foo](https://cal.com/foo) or [Book Demo](https://cal.com/foo)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, url) => {
    const cleanUrl = url.trim();
    if (!isSafeUrl(cleanUrl)) {
      return escapeHtmlText(label);
    }
    const safeHref = escapeAttribute(cleanUrl);
    const innerLabel = renderInlineMarkdown(label);
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 500;">${innerLabel}</a>`;
  });

  // 3. Autolinks: <https://...>
  out = out.replace(/<((https?:\/\/|mailto:)[^>\s]+)>/g, (_match, url) => {
    const safeHref = escapeAttribute(url.trim());
    const safeText = url.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 500;">${safeText}</a>`;
  });

  // 4. Standalone bare URLs (https://... or http://...) not already in href or tags
  out = out.replace(
    /(^|[\s(])((https?:\/\/)[^\s<>)"]+)(?=$|[\s)])/g,
    (_match, prefix, url) => {
      // Strip trailing punctuation that belongs to the sentence
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
      return `${prefix}<a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 500;">${safeText}</a>${trailingPunct}`;
    }
  );

  // 5. Bold: **text** or __text__
  out = out.replace(/\*\*([^*]+)\*\*/g, (_match, bold) => {
    return `<strong style="font-weight: 600; color: #0f172a;">${renderInlineMarkdown(bold)}</strong>`;
  });
  out = out.replace(/__([^_]+)__/g, (_match, bold) => {
    return `<strong style="font-weight: 600; color: #0f172a;">${renderInlineMarkdown(bold)}</strong>`;
  });

  // 6. Italic: *text* or _text_ (excluding word-internal underscores like variable_name)
  out = out.replace(/(^|[^\w*])\*([^*\n]+)\*([^\w*]|$)/g, (_match, pre, italic, post) => {
    return `${pre}<em>${renderInlineMarkdown(italic)}</em>${post}`;
  });
  out = out.replace(/(^|[^\w_])_([^_\n]+)_([^\w_]|$)/g, (_match, pre, italic, post) => {
    return `${pre}<em>${renderInlineMarkdown(italic)}</em>${post}`;
  });

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
    if (firstUnorderedIdx !== -1 && lines.slice(firstUnorderedIdx).every((l) => /^[-*]\s+/.test(l.trim()))) {
      if (firstUnorderedIdx > 0) {
        const leadLines = lines.slice(0, firstUnorderedIdx);
        const paraHtml = leadLines.map((l) => renderInlineMarkdown(escapeHtmlText(l))).join('<br />\n');
        renderedBlocks.push(`<p style="margin: 0 0 16px 0; line-height: 1.6; color: #1e293b; font-size: 15px;">${paraHtml}</p>`);
      }
      const listLines = lines.slice(firstUnorderedIdx);
      const items = listLines.map((l) => {
        const itemText = l.trim().replace(/^[-*]\s+/, '');
        return `<li style="margin-bottom: 6px;">${renderInlineMarkdown(escapeHtmlText(itemText))}</li>`;
      });
      renderedBlocks.push(
        `<ul style="margin: 0 0 16px 0; padding-left: 24px; color: #1e293b; line-height: 1.6;">${items.join('')}</ul>`
      );
      continue;
    }

    // Ordered List: lines starting with 1. 2. etc.
    const firstOrderedIdx = lines.findIndex((l) => /^\d+\.\s+/.test(l.trim()));
    if (firstOrderedIdx !== -1 && lines.slice(firstOrderedIdx).every((l) => /^\d+\.\s+/.test(l.trim()))) {
      if (firstOrderedIdx > 0) {
        const leadLines = lines.slice(0, firstOrderedIdx);
        const paraHtml = leadLines.map((l) => renderInlineMarkdown(escapeHtmlText(l))).join('<br />\n');
        renderedBlocks.push(`<p style="margin: 0 0 16px 0; line-height: 1.6; color: #1e293b; font-size: 15px;">${paraHtml}</p>`);
      }
      const listLines = lines.slice(firstOrderedIdx);
      const items = listLines.map((l) => {
        const itemText = l.trim().replace(/^\d+\.\s+/, '');
        return `<li style="margin-bottom: 6px;">${renderInlineMarkdown(escapeHtmlText(itemText))}</li>`;
      });
      renderedBlocks.push(
        `<ol style="margin: 0 0 16px 0; padding-left: 24px; color: #1e293b; line-height: 1.6;">${items.join('')}</ol>`
      );
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

/**
 * Centralized email rendering pipeline for outbound emails.
 * Guarantees that every outbound email has:
 * 1. Clean, email-client-compatible, sanitized `html`
 * 2. High-fidelity, readable `text`
 */
export function renderOutboundEmail(params: RenderOutboundEmailParams): OutboundEmailRenderResult {
  const rawHtml = String(params.html || '').trim();
  const rawText = String(params.text || '').trim();

  // Case 1: HTML is provided and actually contains HTML tags
  if (rawHtml && isHtmlContent(rawHtml)) {
    const sanitizedHtml = sanitizeHtml(rawHtml, OUTBOUND_EMAIL_SANITIZE_OPTIONS);
    const text = rawText || convertHtmlToPlainText(sanitizedHtml);
    return {
      html: sanitizedHtml,
      text,
      isMarkdownConverted: false,
    };
  }

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
  const plainText = convertMarkdownToPlainText(sourceText);

  return {
    html: sanitizedHtml,
    text: plainText,
    isMarkdownConverted: true,
  };
}
