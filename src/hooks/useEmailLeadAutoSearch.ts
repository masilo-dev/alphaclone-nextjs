'use client';

import { useEffect, useRef, useState } from 'react';
import type { EmailContextResult } from '@/lib/scraper/emailLeadAutoSearch';

export function useEmailLeadAutoSearch(
  from: string | null | undefined,
  subject?: string | null,
  tenantId?: string | null
) {
  const [result, setResult] = useState<EmailContextResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastKey = useRef('');

  useEffect(() => {
    const trimmed = (from || '').trim();
    if (!trimmed || !trimmed.includes('@') || !tenantId) {
      setResult(null);
      setError(null);
      return;
    }

    const key = `${tenantId}|${trimmed}|${subject || ''}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/scraper/email-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        tenantId,
        from: trimmed,
        subject: subject || undefined,
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Search failed');
        if (!cancelled) setResult(data as EmailContextResult);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Search failed');
          setResult(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [from, subject, tenantId]);

  return { result, loading, error };
}
