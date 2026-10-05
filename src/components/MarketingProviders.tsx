'use client';

import React, { Suspense, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { BookingModalProvider } from '@/contexts/BookingModalContext';
import AlphaCloneBookingModal from '@/components/marketing/system/AlphaCloneBookingModal';
import { ToastProvider } from '@/components/Toast';

/**
 * Lightweight provider tree for public marketing pages.
 * Avoids Chakra, tenant CRM contexts, Bonnie drawer, and other dashboard-only JS.
 */
export function MarketingProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <ThemeProvider>
              <LanguageProvider>
                <BookingModalProvider>
                  {children}
                  <AlphaCloneBookingModal />
                </BookingModalProvider>
              </LanguageProvider>
            </ThemeProvider>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
