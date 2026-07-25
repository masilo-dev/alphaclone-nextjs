import type { ReactNode } from 'react';
import type { AlphaIconAccent } from './types';

type IconFrameProps = {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'display';
  accent?: AlphaIconAccent | 'default';
  className?: string;
};

export default function IconFrame({
  children,
  size = 'md',
  accent = 'default',
  className = '',
}: IconFrameProps) {
  return (
    <span
      className={`alpha-icon-frame alpha-icon-frame--${size} alpha-icon-frame--${accent} ${className}`.trim()}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
