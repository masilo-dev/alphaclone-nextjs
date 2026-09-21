'use client';

import React from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useDeviceExperience } from '@/hooks/useDeviceExperience';

interface DetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Wider drawer on desktop (forms, quote editor) */
  size?: 'default' | 'wide' | 'fullscreen';
}

/**
 * Responsive detail panel: bottom drawer on mobile, right drawer on desktop.
 * Full scrollable content — no max-height clipping of fields.
 */
export function DetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  size = 'default',
}: DetailDrawerProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const { isInstalledMobileCompanion } = useDeviceExperience();
  const useNativeSheet = isInstalledMobileCompanion || isMobile;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={useNativeSheet ? 'bottom' : 'right'}
        className={cn(
          size === 'fullscreen' || isInstalledMobileCompanion
            ? 'inset-0 h-[100dvh] !w-screen max-w-none rounded-none border-0'
            : isMobile
              ? 'max-h-[85vh]'
              : size === 'wide'
                ? 'h-full !w-[min(100vw,44rem)] !p-4 !gap-2'
                : 'h-full',
          className
        )}
      >
        <SheetHeader className={cn(isInstalledMobileCompanion && 'sticky top-0 z-20 border-b border-white/5 bg-[var(--ws-toolbar)] px-4 py-3')}>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className={cn('flex-1 min-h-0 overflow-y-auto ac-scroll-full pb-safe', isInstalledMobileCompanion && 'px-3 py-3')}>{children}</div>
      </SheetContent>
    </Sheet>
  );
}
