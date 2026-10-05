'use client';

import Link from 'next/link';
import { formatCopyrightLine, formatLegalAddress, COMPANY_LEGAL } from '@/lib/seo/siteEntity';

interface AppLegalFooterProps {
  compact?: boolean;
}

export default function AppLegalFooter({ compact = false }: AppLegalFooterProps) {
  return (
    <footer
      className={`w-full border-t border-[var(--ws-border)] bg-[var(--ws-canvas)]/70 px-4 type-caption text-[var(--ws-text-muted)] ${
        compact ? 'py-3' : 'py-6'
      }`}
    >
      <div className={`mx-auto flex max-w-7xl flex-col ${compact ? 'gap-2' : 'gap-4'}`}>
        <div
          className={`flex flex-col ${compact ? 'gap-2 md:flex-row md:items-center md:justify-between' : 'gap-1 sm:flex-row sm:items-start sm:justify-between'}`}
        >
          <div className={`text-[var(--ws-text-muted)] ${compact ? 'space-y-0.5 type-ui' : 'space-y-1'}`}>
            <p>{formatCopyrightLine()}</p>
            <p>{formatLegalAddress()}</p>
            <p className={compact ? 'truncate md:max-w-[34rem]' : ''}>
              {COMPANY_LEGAL.jurisdiction} · Filing ID {COMPANY_LEGAL.filingId}
            </p>
          </div>
          <nav className={`flex flex-wrap items-center ${compact ? 'gap-x-3 gap-y-1 type-ui' : 'gap-x-4 gap-y-2'}`}>
            <Link className="hover:text-[var(--ws-text-secondary)]" href="/legal/privacy">Privacy</Link>
            <Link className="hover:text-[var(--ws-text-secondary)]" href="/legal/terms">Terms</Link>
            <Link className="hover:text-[var(--ws-text-secondary)]" href="/legal/cookies">Cookies</Link>
            <Link className="hover:text-[var(--ws-text-secondary)]" href="/legal/subprocessors">Subprocessors</Link>
            <Link className="hover:text-[var(--ws-text-secondary)]" href="/legal/refund">Refund</Link>
            {!compact ? (
              <Link className="hover:text-[var(--ws-text-secondary)]" href="/legal/acceptable-use">Acceptable Use</Link>
            ) : null}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('ac:open-cookie-preferences'))}
              className="hover:text-[var(--brand-blue-300)] transition-colors"
            >
              Cookie preferences
            </button>
          </nav>
        </div>
      </div>
    </footer>
  );
}
