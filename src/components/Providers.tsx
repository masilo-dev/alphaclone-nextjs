'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TenantProvider } from '@/contexts/TenantContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/Toast';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';

import { AICopilot } from '@/components/dashboard/AICopilot';

import { usePathname } from 'next/navigation';

export function Providers({ children }: { children: React.ReactNode }) {
    // Create QueryClient inside component to avoid server/client hydration mismatch
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000,
                refetchOnWindowFocus: false,
            },
        },
    }));

    const pathname = usePathname();
    const showCopilot = pathname?.startsWith('/dashboard');

    return (
        <GlobalErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <ToastProvider>
                    <AuthProvider>
                        <TenantProvider>
                            {children}
                            {showCopilot && <AICopilot />}
                        </TenantProvider>
                    </AuthProvider>
                </ToastProvider>
            </QueryClientProvider>
        </GlobalErrorBoundary>
    );
}
