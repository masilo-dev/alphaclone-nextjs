'use client';

import { WORKSPACE } from '@/constants/design';

interface DashboardPanelHeaderProps {
  title: string;
  subtitle?: string;
}

export function DashboardPanelHeader({ title, subtitle }: DashboardPanelHeaderProps) {
  return (
    <div className="mb-3">
      <h3 className={WORKSPACE.typography.panelTitle}>{title}</h3>
      {subtitle ? <p className={`${WORKSPACE.typography.panelSubtitle} mt-0.5`}>{subtitle}</p> : null}
    </div>
  );
}
