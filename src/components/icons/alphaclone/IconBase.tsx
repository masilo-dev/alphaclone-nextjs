'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type IconVariant = 'outline' | 'filled' | 'duotone';
export type IconSize = 'small' | 'medium' | 'large' | number;

export interface AlphacloneIconProps extends React.SVGAttributes<SVGSVGElement> {
  variant?: IconVariant;
  size?: IconSize;
  /** Soften for dark surfaces */
  tone?: 'light' | 'dark' | 'inherit';
  title?: string;
  decorative?: boolean;
}

const SIZE_MAP: Record<'small' | 'medium' | 'large', number> = {
  small: 16,
  medium: 20,
  large: 24,
};

export function resolveIconSize(size: IconSize = 'medium'): number {
  return typeof size === 'number' ? size : SIZE_MAP[size];
}

export function AlphacloneIconRoot({
  size = 'medium',
  className,
  title,
  decorative = true,
  children,
  tone = 'inherit',
  ...rest
}: AlphacloneIconProps & { children: React.ReactNode }) {
  const px = resolveIconSize(size);
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        'ac-icon shrink-0',
        tone === 'light' && 'ac-icon--light',
        tone === 'dark' && 'ac-icon--dark',
        className
      )}
      role={decorative ? 'presentation' : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={!decorative && title ? title : undefined}
      {...rest}
    >
      {!decorative && title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const iconStroke = {
  outline: 1.75,
  filled: 0,
  duotone: 1.5,
} as const;
