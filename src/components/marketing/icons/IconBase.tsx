import type { ReactNode, SVGProps } from 'react';
import type { AlphaSvgProps } from './types';

export function IconBase({
  title,
  decorative = true,
  children,
  className = '',
  viewBox = '0 0 48 48',
  ...props
}: AlphaSvgProps & { children: ReactNode; viewBox?: string }) {
  const labelled = Boolean(title) && !decorative;

  return (
    <svg
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`alpha-icon ${className}`.trim()}
      aria-hidden={decorative || !labelled ? true : undefined}
      role={labelled ? 'img' : undefined}
      focusable="false"
      {...(props as SVGProps<SVGSVGElement>)}
    >
      {labelled ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}
