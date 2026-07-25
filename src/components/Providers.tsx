'use client';

import React, { useState, useEffect, useLayoutEffect } from 'react';
import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readStoredAcTheme, applyAcThemeClass } from '@/lib/applyAcTheme';
import { TenantProvider } from '@/contexts/TenantContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { BackgroundTaskProvider } from '@/contexts/BackgroundTaskContext';
import { BonnieDrawerProvider } from '@/contexts/BonnieDrawerContext';
import { ToastProvider } from '@/components/Toast';
import { SuccessFeedbackProvider } from '@/components/ui/SuccessFeedback';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { UserPreferencesBootstrap } from '@/components/UserPreferencesBootstrap';
import ServiceWorkerBootstrap from '@/components/common/ServiceWorkerBootstrap';
import { setupGlobalErrorHandlers } from '@/utils/errorHandlers';
import { registerPlatformQueryClient } from '@/lib/platformReset';
import { alphacloneChakraTheme } from '@/theme/chakraTheme';
import { BonnieDrawer } from '@/components/ui/os/BonnieDrawer';

export function Providers({ children }: { children: React.ReactNode }) {
  // Create QueryClient inside component to avoid server/client hydration mismatch
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // Setup global error handlers
  useEffect(() => {
    const cleanup = setupGlobalErrorHandlers();
    return cleanup;
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
              <AuthProvider>
                <ThemeProvider>
                  <LanguageProvider>
                    <UserPreferencesBootstrap />
                    <ServiceWorkerBootstrap />
                    <TenantProvider>
                      <BackgroundTaskProvider>
                        <BonnieDrawerProvider>
                          {children}
                          <BonnieDrawer />
                        </BonnieDrawerProvider>
                      </BackgroundTaskProvider>
                    </TenantProvider>
                  </LanguageProvider>
                </ThemeProvider>
              </AuthProvider>
            </SuccessFeedbackProvider>
          </ToastProvider>
        </QueryClientProvider>
      </ChakraProvider>
    </GlobalErrorBoundary>
  );
}
