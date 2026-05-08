'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (!searchParams) return;
        const params = searchParams.toString();
        const target = params ? `/auth/login?${params}` : '/auth/login';
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
