'use client';

export default function DpaActions() {
  return (
    <div className="flex flex-wrap gap-3">
      <a
        href="/legal/dpa/download"
        className="rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm font-semibold text-teal-300 hover:bg-teal-500/20"
      >
        Download PDF
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
      >
        Print / Save as PDF
      </button>
    </div>
  );
}
