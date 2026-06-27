'use client';

import { useCallback, useEffect, useState } from 'react';

export type BonnieMorningBriefData = {
  summary: string;
  attentionItems: string[];
  notificationId?: string;
  read?: boolean;
};

export function useBonnieMorningBrief(tenantId: string | undefined) {
  const [brief, setBrief] = useState<BonnieMorningBriefData | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!tenantId) {
      setBrief(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/bonnie/briefing?tenantId=${tenantId}`);
      const data = await res.json();
      if (data.success && data.brief) {
        setBrief({
          summary: data.brief.summary,
          attentionItems: data.brief.attentionItems || [],
          notificationId: data.brief.notificationId,
          read: data.brief.read,
        });
      } else {
        setBrief(null);
      }
    } catch {
      setBrief(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 5 * 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { brief, loading, refresh };
}
