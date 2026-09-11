'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';

type PendingDraft = {
  id: string;
  messageId: string;
  from: string;
  fromEmail: string | null;
  subject: string | null;
  body: string | null;
  status: string;
  createdAt: string;
};

type AiDraftReviewBannerProps = {
  onOpenDraft?: (draft: PendingDraft) => void;
};

export default function AiDraftReviewBanner({ onOpenDraft }: AiDraftReviewBannerProps) {
  const { currentTenant } = useTenant();
  const [drafts, setDrafts] = useState<PendingDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/email/auto-reply/pending?tenantId=${encodeURIComponent(currentTenant.id)}`,
        { credentials: 'include' }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) setDrafts(data.drafts || []);
    } catch {
      /* non-blocking */
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (dismissed || loading || drafts.length === 0) return null;

  const latest = drafts[0];

  return (
    <div
      className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-3 flex items-start gap-3"
      role="status"
      aria-live="polite"
      aria-label="AI draft replies awaiting review"
    >
      <Sparkles className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-violet-200">
          {drafts.length} AI draft{drafts.length === 1 ? '' : 's'} ready for review
        </p>
        <p className="text-[11px] text-slate-400 mt-1 truncate">
          Latest: reply to {latest.from || latest.fromEmail} — {latest.subject || '(no subject)'}
        </p>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => onOpenDraft?.(latest)}
            className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white"
          >
            Review draft
          </button>
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              toast('Open Drafts folder to review AI replies anytime.');
            }}
            className="text-[10px] font-semibold text-slate-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-slate-500 hover:text-white p-1"
        aria-label="Dismiss AI draft notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
