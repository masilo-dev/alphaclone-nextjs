'use client';

import React, { useState, useEffect, useLayoutEffect } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { readStoredAcTheme, applyAcThemeClass } from '@/lib/applyAcTheme';
import { initTabFocusCoordinator, TAB_VISIBLE_EVENT } from '@/lib/sync/tabFocusCoordinator';

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
            retry: 1,
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
                        <BackgroundTaskProvider>
                          <BonnieDrawerProvider>
                            <BookingModalProvider>
                              {children}
                              <AlphaCloneBookingModal />
                              <BonnieDrawer />
                            </BookingModalProvider>
                          </BonnieDrawerProvider>
                        </BackgroundTaskProvider>
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
