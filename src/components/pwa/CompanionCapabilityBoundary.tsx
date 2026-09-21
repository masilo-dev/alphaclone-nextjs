'use client';

import React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getCompanionCapabilityForPath, resolveCompanionModule } from '@/config/pwaCompanionCapabilities';
import DesktopRequired from '@/components/ui/os/DesktopRequired';

/**
 * Companion presentation boundary only. It never changes authorization or data.
 * Desktop-only surfaces remain discoverable, but installed phone/tablet users get
 * an intentional product handoff instead of a broken squeezed desktop workspace.
 */
export function CompanionCapabilityBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/dashboard';
  const searchParams = useSearchParams();
  const capability = getCompanionCapabilityForPath(pathname);
  const moduleId = resolveCompanionModule(pathname);
  const requestedDesktopExperience = searchParams.get('experience') === 'desktop';

  if (capability.level !== 'DESKTOP' || requestedDesktopExperience) return <>{children}</>;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-xl items-start px-4 pb-28 pt-5" data-companion-module={moduleId}>
      <DesktopRequired
        title={capability.desktopReason || 'Advanced controls are available on desktop.'}
        desktopHref={pathname}
        description="For the best experience, open this module on a laptop or desktop. Your work remains saved and available there."
      />
    </main>
  );
}

export default CompanionCapabilityBoundary;
