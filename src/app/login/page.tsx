'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { sanitizeInternalRedirect } from '@/lib/security/safeRedirect';

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (!searchParams) return;

        const params = new URLSearchParams(searchParams.toString());
        for (const key of ['redirect', 'next', 'returnTo']) {
            const raw = params.get(key);
            if (!raw) continue;
            const safe = sanitizeInternalRedirect(raw);
            if (safe) params.set(key, safe);
            else params.delete(key);
        }

        const query = params.toString();
        const target = query ? `/auth/login?${query}` : '/auth/login';
        router.replace(target);
    }, [router, searchParams]);

    return null;
}

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginContent />
        </Suspense>
    );
}
