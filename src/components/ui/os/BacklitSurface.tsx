import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BacklightTone = 'teal' | 'coral' | 'navy';
type BacklightIntensity = 'idle' | 'hover' | 'active' | 'focus';

interface BacklitSurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  tone?: BacklightTone;
  intensity?: BacklightIntensity;
  children: ReactNode;
}

/**
 * Restrained depth primitive for selected, focused, or operationally important
 * surfaces. It never owns business state and should remain rare.
 */
export function BacklitSurface({
  as: Component = 'section',
  tone = 'teal',
  intensity = 'idle',
  className,
  children,
  style,
  ...props
}: BacklitSurfaceProps) {
  return (
    <Component
      className={cn('ac-backlit-surface', className)}
      data-backlight-tone={tone}
      data-backlight-intensity={intensity}
      style={style as CSSProperties}
      {...props}
    >
      {children}
    </Component>
  );
}
