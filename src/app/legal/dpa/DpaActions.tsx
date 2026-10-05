'use client';

export default function DpaActions() {
  return (
    <div className="flex flex-wrap gap-3">
      <a
        href="/legal/dpa/download"
        className="rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-2 type-ui font-semibold text-[var(--brand-blue-300)] hover:bg-teal-500/20"
      >
        Download PDF
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-full border border-[var(--ws-border)] bg-[var(--ws-panel)] px-4 py-2 type-ui font-semibold text-[var(--ws-text-secondary)] hover:bg-[var(--ws-surface-secondary)]"
      >
        Print / Save as PDF
      </button>
    </div>
  );
}
