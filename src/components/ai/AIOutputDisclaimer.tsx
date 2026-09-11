'use client';

import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';

type DisclaimerType = 'email' | 'contract' | 'social' | 'invoice' | 'generic';

const STORAGE_KEY = 'ac_ai_disclaimer_dismissed';

function getCopy(type: DisclaimerType) {
  switch (type) {
    case 'contract':
      return 'AI-generated contract - have a lawyer review before signing';
    case 'invoice':
      return 'AI-generated invoice - confirm amounts and billing details before sending';
    case 'social':
      return 'AI-generated social post - review before publishing';
    case 'email':
      return 'AI-generated email - review before sending';
    default:
      return 'AI-generated - review before sending';
  }
}

export default function AIOutputDisclaimer({
  type = 'generic',
  onDismiss,
}: {
  type?: DisclaimerType;
  onDismiss?: () => void;
}) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHidden(window.localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  if (hidden) return null;

  const dismiss = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, '1');
    }
    setHidden(true);
    onDismiss?.();
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
      <div className="flex items-center gap-2">
        <TriangleAlert className="h-4 w-4 shrink-0 text-amber-300" />
        <span className="font-medium">{getCopy(type)}</span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="rounded-full px-2 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-400/10"
      >
        Dismiss
      </button>
    </div>
  );
}
