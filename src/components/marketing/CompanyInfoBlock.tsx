import { COMPANY_LEGAL, formatLegalAddress } from '@/lib/seo/siteEntity';

type CompanyInfoBlockProps = {
  className?: string;
  compact?: boolean;
};

/** Registered entity details for legal hub, compliance, and trust pages. */
export default function CompanyInfoBlock({ className = '', compact = false }: CompanyInfoBlockProps) {
  return (
    <div
      className={`rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 via-slate-950/80 to-blue-500/5 p-5 sm:p-6 ${className}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/90 mb-3">
        Registered company
      </p>
      <p className="text-base font-bold text-white">{COMPANY_LEGAL.legalName}</p>
      <p className="text-sm text-slate-300 mt-1">{formatLegalAddress()}</p>
      {!compact && (
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-400">
          <div>
            <dt className="font-semibold text-slate-500 uppercase tracking-wide">Jurisdiction</dt>
            <dd className="text-slate-300 mt-0.5">{COMPANY_LEGAL.jurisdiction}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500 uppercase tracking-wide">Filing ID</dt>
            <dd className="text-slate-300 mt-0.5">{COMPANY_LEGAL.filingId}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500 uppercase tracking-wide">Formed</dt>
            <dd className="text-slate-300 mt-0.5">{COMPANY_LEGAL.formedDate}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500 uppercase tracking-wide">Status</dt>
            <dd className="text-slate-300 mt-0.5">{COMPANY_LEGAL.status} · Good standing</dd>
          </div>
        </dl>
      )}
      <p className="mt-4 text-xs text-slate-500">
        {COMPANY_LEGAL.displayName} is the trade name for {COMPANY_LEGAL.legalName}.
      </p>
    </div>
  );
}
