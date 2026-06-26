'use client';

interface DashboardPanelHeaderProps {
  title: string;
  subtitle?: string;
}

export function DashboardPanelHeader({ title, subtitle }: DashboardPanelHeaderProps) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {subtitle ? <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p> : null}
    </div>
  );
}
