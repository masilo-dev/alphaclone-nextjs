'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const params = searchParams.toString();
        const target = params ? `/auth/login?${params}` : '/auth/login';
        router.replace(target);
    }, [router, searchParams]);

    return null;
}
