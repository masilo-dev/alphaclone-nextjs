'use client';

import Link from 'next/link';
import { formatCopyrightLine, formatLegalAddress, COMPANY_LEGAL } from '@/lib/seo/siteEntity';

interface AppLegalFooterProps {
  compact?: boolean;
}

export default function AppLegalFooter({ compact = false }: AppLegalFooterProps) {
  return (
    <footer
      className={`w-full border-t border-slate-800 bg-slate-950/70 px-4 text-xs text-slate-400 ${
        compact ? 'py-3' : 'py-6'
      }`}
    >
      <div className={`mx-auto flex max-w-7xl flex-col ${compact ? 'gap-2' : 'gap-4'}`}>
        <div
          className={`flex flex-col ${compact ? 'gap-2 md:flex-row md:items-center md:justify-between' : 'gap-1 sm:flex-row sm:items-start sm:justify-between'}`}
        >
          <div className={`text-slate-500 ${compact ? 'space-y-0.5 text-[11px]' : 'space-y-1'}`}>
            <p>{formatCopyrightLine()}</p>
            <p>{formatLegalAddress()}</p>
            <p className={compact ? 'truncate md:max-w-[34rem]' : ''}>
              {COMPANY_LEGAL.jurisdiction} · Filing ID {COMPANY_LEGAL.filingId}
            </p>
          </div>
          <nav className={`flex flex-wrap ${compact ? 'gap-x-3 gap-y-1 text-[11px]' : 'gap-x-4 gap-y-2'}`}>
            <Link className="hover:text-slate-200" href="/privacy-policy">Privacy</Link>
            <Link className="hover:text-slate-200" href="/terms-of-service">Terms</Link>
            <Link className="hover:text-slate-200" href="/cookie-policy">Cookies</Link>
            <Link className="hover:text-slate-200" href="/legal/refund">Refund</Link>
            {!compact ? (
              <Link className="hover:text-slate-200" href="/legal/acceptable-use">Acceptable Use</Link>
            ) : null}
          </nav>
        </div>
      </div>
    </footer>
  );
}
