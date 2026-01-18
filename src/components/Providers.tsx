'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TenantProvider } from '@/contexts/TenantContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/Toast';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';

import { AICopilot } from '@/components/dashboard/AICopilot';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
        },
    },
});

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <GlobalErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <ToastProvider>
                    <AuthProvider>
                        <TenantProvider>
                            {children}
                            <AICopilot />
                        </TenantProvider>
                    </AuthProvider>
                </ToastProvider>
            </QueryClientProvider>
        </GlobalErrorBoundary>
    );
}
