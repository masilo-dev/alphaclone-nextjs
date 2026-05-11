'use client';

import React, { useEffect, useRef, useState } from 'react';

interface EmailBodyProps {
  content: string;
  className?: string;
}

/**
 * Isolated Email Body renderer using an iframe to prevent style leakage
 * and ensure proper rendering of email HTML (which often has hardcoded styles).
 */
export const EmailBody: React.FC<EmailBodyProps> = ({ content, className = '' }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState('400px');

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    // We use a white background by default for emails as most are designed for light mode
    // but we inject a small script to detect if the content is mostly dark.
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              margin: 0;
              padding: 16px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              font-size: 14px;
              line-height: 1.5;
              color: #333;
              background-color: #fff;
              word-break: break-word;
              overflow-wrap: break-word;
            }
            img { max-width: 100%; height: auto; }
            a { color: #0ea5e9; }
          </style>
        </head>
        <body>
          ${content}
          <script>
            function updateHeight() {
              window.parent.postMessage({ 
                type: 'setHeight', 
                height: document.body.scrollHeight + 'px',
                id: '${content.slice(0, 10).replace(/[^a-z0-9]/gi, '')}'
              }, '*');
            }
            window.onload = updateHeight;
            // Also update on resize or any content change
            const observer = new ResizeObserver(updateHeight);
            observer.observe(document.body);
          </script>
        </body>
      </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

  }, [content]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'setHeight') {
        setHeight(event.data.height);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className={`w-full overflow-hidden rounded-xl border border-slate-800 bg-white ${className}`}>
      <iframe
        ref={iframeRef}
        title="Email Content"
        className="w-full border-none"
        style={{ height }}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
};
