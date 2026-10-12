'use client';

import React, { Suspense, useState, useEffect, useLayoutEffect } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { readStoredAcTheme, applyAcThemeClass } from '@/lib/applyAcTheme';
import { initTabFocusCoordinator, TAB_VISIBLE_EVENT } from '@/lib/sync/tabFocusCoordinator';
import { TenantProvider } from '@/contexts/TenantContext';
import { RelationshipProvider } from '@/contexts/RelationshipContext';
import { Customer360Provider } from '@/contexts/Customer360Context';
import { AuthProvider } from '@/contexts/AuthContext';
import { BackgroundTaskProvider } from '@/contexts/BackgroundTaskContext';
import { BonnieDrawerProvider } from '@/contexts/BonnieDrawerContext';
import { ToastProvider } from '@/components/Toast';
import { SuccessFeedbackProvider } from '@/components/ui/SuccessFeedback';
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialog';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { UserPreferencesBootstrap } from '@/components/UserPreferencesBootstrap';
import ServiceWorkerBootstrap from '@/components/common/ServiceWorkerBootstrap';
import { setupGlobalErrorHandlers } from '@/utils/errorHandlers';
import { usePhoneViewport } from '@/hooks/usePhoneViewport';
import { clearSavedStats } from '@/lib/dashboard/clientStatsCache';
import { registerPlatformQueryClient } from '@/lib/platformReset';
import { alphacloneChakraTheme } from '@/theme/chakraTheme';
import { BonnieDrawer } from '@/components/ui/os/BonnieDrawer';
import { BookingModalProvider } from '@/contexts/BookingModalContext';
import AlphaCloneBookingModal from '@/components/marketing/system/AlphaCloneBookingModal';
import { PwaPushBootstrap } from '@/components/pwa/PwaPushBootstrap';

// Configure TanStack Query focus manager with deduplicated tab focus coordinator
if (typeof window !== 'undefined') {
  focusManager.setEventListener((handleFocus) => {
    const cleanup = initTabFocusCoordinator(5000);
    const onTabVisible = () => handleFocus();
    window.addEventListener(TAB_VISIBLE_EVENT, onTabVisible);
    return () => {
      cleanup();
      window.removeEventListener(TAB_VISIBLE_EVENT, onTabVisible);
    };
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  usePhoneViewport();
  // Create QueryClient inside component to avoid server/client hydration mismatch
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            // The data transport owns bounded read retries; avoid layered retry storms.
            retry: false,
          },
        },
      }),
  );

  // Setup global error handlers and tab focus coordinator
  useEffect(() => {
    const cleanup = setupGlobalErrorHandlers();
    const cleanupFocus = initTabFocusCoordinator(5000);
    return () => {
      cleanup();
      cleanupFocus();
    };
  }, []);

  useEffect(() => registerPlatformQueryClient(queryClient), [queryClient]);

  useEffect(() => {
    const invalidate = (event: Event) => {
      const tenantId = (event as CustomEvent<{ tenantId?: string }>).detail?.tenantId;
      clearSavedStats(tenantId);
      void queryClient.invalidateQueries({ predicate: query =>
        query.queryKey[0] === 'tenant' && query.queryKey[2] === 'stats' && (!tenantId || query.queryKey[1] === tenantId),
      });
    };
    window.addEventListener('ac:crm-stats-invalidate', invalidate);
    return () => window.removeEventListener('ac:crm-stats-invalidate', invalidate);
  }, [queryClient]);

  useLayoutEffect(() => {
    applyAcThemeClass(readStoredAcTheme());
  }, []);

  return (
    <GlobalErrorBoundary>
      <ChakraProvider theme={alphacloneChakraTheme} resetCSS={false}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <SuccessFeedbackProvider>
              <ConfirmDialogProvider>
                <AuthProvider>
                  <ThemeProvider>
                    <LanguageProvider>
                      <UserPreferencesBootstrap />
                      <ServiceWorkerBootstrap />
                      <TenantProvider>
                        <Suspense fallback={null}>
                          <PwaPushBootstrap />
                          <RelationshipProvider>
                            <Customer360Provider>
                            <BackgroundTaskProvider>
                          <BonnieDrawerProvider>
                            <BookingModalProvider>
                              {children}
                              <AlphaCloneBookingModal />
                              <BonnieDrawer />
                            </BookingModalProvider>
                          </BonnieDrawerProvider>
                            </BackgroundTaskProvider>
                            </Customer360Provider>
                          </RelationshipProvider>
                        </Suspense>
                      </TenantProvider>
                    </LanguageProvider>
                  </ThemeProvider>
                </AuthProvider>
              </ConfirmDialogProvider>
            </SuccessFeedbackProvider>
          </ToastProvider>
        </QueryClientProvider>
      </ChakraProvider>
    </GlobalErrorBoundary>
  );
}
