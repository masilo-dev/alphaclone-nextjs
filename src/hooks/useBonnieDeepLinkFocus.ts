'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

export type BonnieFocusState = {
  tab?: string;
  focus?: string;
  recordId?: string;
  workflowId?: string;
  reason?: string;
};

type UseBonnieDeepLinkFocusOptions = {
  onFocus?: (state: BonnieFocusState) => void;
  showToast?: boolean;
};

export function useBonnieDeepLinkFocus(options: UseBonnieDeepLinkFocusOptions = {}) {
  const searchParams = useSearchParams();
  const { onFocus, showToast = true } = options;

  const fromUrl = useMemo<BonnieFocusState>(() => ({
    tab: searchParams?.get('tab') || undefined,
    focus: searchParams?.get('focus') || undefined,
    recordId: searchParams?.get('id') || undefined,
    workflowId: searchParams?.get('workflow') || undefined,
    reason: searchParams?.get('bonnieReason') || undefined,
  }), [searchParams]);

  useEffect(() => {
    if (!onFocus) return;
    if (!fromUrl.tab && !fromUrl.focus && !fromUrl.recordId && !fromUrl.workflowId) return;
    onFocus(fromUrl);
    if (showToast && fromUrl.reason) {
      toast(fromUrl.reason, { icon: '🧭', duration: 3500 });
    }
  }, [fromUrl, onFocus, showToast]);

  useEffect(() => {
    if (!onFocus) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<BonnieFocusState>).detail;
      if (!detail) return;
      onFocus(detail);
      if (showToast && detail.reason) {
        toast(detail.reason, { icon: '🧭', duration: 3500 });
      }
    };
    window.addEventListener('bonnie:focus', handler);
    return () => window.removeEventListener('bonnie:focus', handler);
  }, [onFocus, showToast]);

  return fromUrl;
}
