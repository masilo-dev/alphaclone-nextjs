'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TenantProvider } from '@/contexts/TenantContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { BackgroundTaskProvider } from '@/contexts/BackgroundTaskContext';
import { ToastProvider } from '@/components/Toast';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { ThemeProvider } from '@/contexts/ThemeContext';
import LanguageDetector from '@/components/common/LanguageDetector';
import LocalizationWrapper from '@/components/common/LocalizationWrapper';



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



    return (
        <GlobalErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <ToastProvider>
                    <ThemeProvider>
                        <LocalizationWrapper>
                            <LanguageDetector onLanguageChange={(lang) => console.log('Language detected:', lang)} />
                            <AuthProvider>
                                <TenantProvider>
                                    <BackgroundTaskProvider>
                                        {children}
                                    </BackgroundTaskProvider>
                                </TenantProvider>
                            </AuthProvider>
                        </LocalizationWrapper>
                    </ThemeProvider>
                </ToastProvider>
            </QueryClientProvider>
        </GlobalErrorBoundary>
    );
}
