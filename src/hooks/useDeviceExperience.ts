'use client';

import { useMemo } from 'react';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { usePWA } from '@/contexts/PWAContext';

export type DeviceClass = 'mobile' | 'tablet' | 'desktop';

export interface DeviceExperience {
  deviceClass: DeviceClass;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isStandalonePWA: boolean;
  isInstalledMobileCompanion: boolean;
  supportsAdvancedWorkspace: boolean;
  supportsDenseTables: boolean;
  supportsDragDrop: boolean;
  supportsLargeEditor: boolean;
  supportsDesktopOnlyAction: boolean;
}

export function useDeviceExperience(): DeviceExperience {
  const breakpoint = useBreakpoint();
  const { isPWA, appSurface } = usePWA();

  return useMemo(() => {
    const deviceClass: DeviceClass = breakpoint.isMobile ? 'mobile' : breakpoint.isTablet ? 'tablet' : 'desktop';
    const isInstalledMobileCompanion = isPWA && (appSurface === 'pwa-mobile' || appSurface === 'pwa-tablet');
    const isDesktop = deviceClass === 'desktop';

    return {
      deviceClass,
      isMobile: deviceClass === 'mobile',
      isTablet: deviceClass === 'tablet',
      isDesktop,
      isStandalonePWA: isPWA,
      isInstalledMobileCompanion,
      supportsAdvancedWorkspace: isDesktop,
      supportsDenseTables: isDesktop,
      supportsDragDrop: isDesktop,
      supportsLargeEditor: isDesktop,
      supportsDesktopOnlyAction: isDesktop,
    };
  }, [appSurface, breakpoint.isMobile, breakpoint.isTablet, isPWA]);
}
