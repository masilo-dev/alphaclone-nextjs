'use client';

import React from 'react';

type BonnieModulePageShellProps = {
  children: React.ReactNode;
  className?: string;
  /**
   * Retained for call-site compatibility. Bonnie now lives in its dedicated
   * sidebar workspace, so module content always receives the full width.
   */
  showBonnieDock?: boolean;
};

/**
 * Preserves the module-shell API without permanently mounting Bonnie beside
 * every module. Open Bonnie from Intelligence → Bonnie AI in the sidebar, or
 * use contextual Ask Bonnie actions where they are useful.
 */
export function BonnieModulePageShell({
  children,
  className,
  showBonnieDock: _showBonnieDock = true,
}: BonnieModulePageShellProps) {
  void _showBonnieDock;
  return <div className={className}>{children}</div>;
}
