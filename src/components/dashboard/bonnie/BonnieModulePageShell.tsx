'use client';

import React from 'react';

type BonnieModulePageShellProps = {
  children: React.ReactNode;
  className?: string;
};

/** Legacy wrapper — Bonnie no longer embeds a dock on module pages. */
export function BonnieModulePageShell({ children, className }: BonnieModulePageShellProps) {
  return <div className={className}>{children}</div>;
}
