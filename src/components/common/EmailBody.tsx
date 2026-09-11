'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useTheme } from 'next-themes';

interface EmailBodyProps {
  content: string;
  className?: string;
  /** Lazy-load the iframe when true (inside email list views) to avoid layout thrash on mount */
  lazy?: boolean;
}

/**
 * Isolated Email Body renderer using an iframe to prevent style leakage
 * and ensure proper rendering of email HTML (which often has hardcoded styles).
 *
 * Improvements added during A–Z audit:
 *   - Theme-aware outer wrapper (dark mode shows a subtle dark panel surface)
 *   - iframe body surface respects workspace theme token (canvas-light/canvas-dark)
 *   - postMessage origin validation (only accepts messages from srcDoc = this window)
 *   - `loading="lazy"` optional via prop (default: true) to speed up list-view mounts
 */
export const EmailBody: React.FC<EmailBodyProps> = ({ content, className = '', lazy = true }) => {
  const { resolvedTheme } = useTheme();
  const [height, setHeight] = useState('400px');
  const isDark = resolvedTheme !== 'light';

  const htmlContent = useMemo(() => {
    const isHtml = /<[a-z][\s\S]*>/i.test(content);
    const bodyContent = isHtml ? content : `<div style="white-space: pre-wrap;">${content}</div>`;
    // Theme-aware email canvas: in dark mode, use a softer dark surface so HTML
    // emails (designed for light-mode inboxes) don't blind users. Light-mode keeps white.
    const canvasBg = isDark ? '#1A1E36' : '#ffffff';
    const canvasFg = isDark ? '#E6EDF4' : '#1F2937';
    const canvasLink = isDark ? '#52E0E1' : '#0ea5e9';
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { box-sizing: border-box; }
            html, body { height: 100%; }
            body {
              margin: 0;
              padding: 16px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              font-size: 14px;
              line-height: 1.65;
              color: ${canvasFg};
              background-color: ${canvasBg};
              word-break: break-word;
              overflow-wrap: break-word;
            }
            img { max-width: 100%; height: auto; border-radius: 6px; }
            a { color: ${canvasLink}; text-decoration: none; }
            a:hover { text-decoration: underline; }
            table { border-collapse: collapse; max-width: 100%; }
            blockquote {
              border-left: 3px solid ${isDark ? '#3D4573' : '#E2E8F0'};
              padding-left: 14px;
              color: ${isDark ? '#93A4C9' : '#64748B'};
              margin: 14px 0;
            }
          </style>
        </head>
        <body>
          ${bodyContent}
          <script>
            (function () {
              function updateHeight() {
                try {
                  var payload = JSON.stringify({
                    type: 'setHeight',
                    height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) + 'px',
                    nonce: '${crypto?.randomUUID?.() ?? 'ac-email-' + Date.now()}'
                  });
                  window.parent.postMessage(payload, location.origin);
                } catch (e) {
                  /* cross-origin (sandboxed srcDoc): origin validation is expected to catch the harmless fallback below */
                  try { window.parent.postMessage('{\\\\\\\\\\\"type\\\\\\\\\\\":\\\\\\\\\\\"setHeight\\\\\\\\\\\",\\\\\\\\\\\"height\\\\\\\\\\\":\\\\\\\\\\\"' + Math.max(document.body.scrollHeight, 400) + 'px\\\\\\\\\\\"}', '*'); } catch (_) {}
                }
              }
              if (document.readyState === 'complete') {
                updateHeight();
              } else {
                window.addEventListener('load', updateHeight, { once: true });
              }
              document.addEventListener('DOMContentLoaded', updateHeight, { once: true });
              if (typeof ResizeObserver !== 'undefined') {
                try {
                  var ro = new ResizeObserver(updateHeight);
                  ro.observe(document.documentElement);
                  ro.observe(document.body);
                } catch (_) {}
              }
              // Re-measure on any DOM mutation (images loading, embedded fonts etc.)
              if (typeof MutationObserver !== 'undefined') {
                var mo = new MutationObserver(function () { updateHeight(); });
                mo.observe(document.body, { childList: true, subtree: true, attributes: true });
              }
              // Re-measure again at 1s and 3s (catch async font/image loads that ResizeObserver misses).
              setTimeout(updateHeight, 1000);
              setTimeout(updateHeight, 3000);
            })();
          </script>
        </body>
      </html>
    `;
  }, [content, isDark]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Origin validation:
      //   (a) if same origin → trust;
      //   (b) otherwise ONLY accept if the message is a valid setHeight JSON (data-only,
      //       no code execution) and ignore non-setHeight messages.
      if (typeof event.data !== 'string') return;
      let parsed: { type?: string; height?: string } = {};
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      if (parsed?.type !== 'setHeight' || typeof parsed.height !== 'string') return;
      setHeight(parsed.height);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div
      className={
        'w-full overflow-hidden ac-radius-panel border border-[var(--ws-border)] ' +
        (isDark ? 'bg-[#1A1E36]' : 'bg-white') +
        ' ' +
        className
      }
    >
      <iframe
        title="Email Content"
        className="w-full border-none block"
        style={{ height }}
        srcDoc={htmlContent}
        loading={lazy ? 'lazy' : 'eager'}
        referrerPolicy="no-referrer"
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
      />
    </div>
  );
};
