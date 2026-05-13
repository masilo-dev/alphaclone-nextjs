'use client';

import React, { useEffect, useState, useMemo } from 'react';

interface EmailBodyProps {
  content: string;
  className?: string;
}

/**
 * Isolated Email Body renderer using an iframe to prevent style leakage
 * and ensure proper rendering of email HTML (which often has hardcoded styles).
 */
export const EmailBody: React.FC<EmailBodyProps> = ({ content, className = '' }) => {
  const [height, setHeight] = useState('400px');

  const htmlContent = useMemo(() => {
    // We use a white background by default for emails as most are designed for light mode
    return `
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
                height: document.body.scrollHeight + 'px'
              }, '*');
            }
            window.onload = updateHeight;
            // Also update on resize or any content change
            const observer = new ResizeObserver(updateHeight);
            observer.observe(document.body);
            // Backup update
            setTimeout(updateHeight, 1000);
          </script>
        </body>
      </html>
    `;
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
        title="Email Content"
        className="w-full border-none"
        style={{ height }}
        srcDoc={htmlContent}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
};
