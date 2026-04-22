'use client';

import { useEffect } from 'react';

type AuthorizeAliasPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function AuthorizeAliasPage({ searchParams }: AuthorizeAliasPageProps) {
  useEffect(() => {
    const qs = new URLSearchParams();

    for (const [key, value] of Object.entries(searchParams || {})) {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === 'string') qs.append(key, item);
        });
      } else if (typeof value === 'string') {
        qs.set(key, value);
      }
    }

    // Preserve OAuth params if an integration placed them in the hash fragment.
    if (typeof window !== 'undefined' && window.location.hash.length > 1) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      hashParams.forEach((value, key) => {
        if (!qs.has(key)) qs.set(key, value);
      });
    }

    const query = qs.toString();
    const destination = query ? `/oauth/authorize?${query}` : '/oauth/authorize';
    window.location.replace(destination);
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
      Redirecting to authorization...
    </div>
  );
}
