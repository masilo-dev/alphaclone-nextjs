'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';

export function NativeScreen({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`native-screen min-h-full bg-[#0a0f1a] text-white ${className}`}>{children}</div>
  );
}

export function NativeScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <header className="native-screen-header sticky top-0 z-20 flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 bg-[#0a0f1a]/95 backdrop-blur-xl border-b border-white/5">
      {onBack ? (
        <button type="button" onClick={onBack} className="native-tap native-back-btn" aria-label="Back">
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
      ) : (
        <span className="w-10" />
      )}
      <h1 className="flex-1 text-lg font-semibold tracking-tight truncate">{title}</h1>
      <div className="w-10 flex justify-end">{right}</div>
    </header>
  );
}

export function NativeSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="px-4 mb-5">
      {title ? <h2 className="native-section-title">{title}</h2> : null}
      <div className="native-list-group">{children}</div>
    </section>
  );
}

export function NativeListTile({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
  selected,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`native-list-tile w-full text-left flex items-center gap-3 px-4 py-3.5 border-b border-white/5 last:border-b-0 ${
        onClick ? 'native-tap active:bg-white/5' : ''
      } ${selected ? 'bg-teal-500/10' : ''}`}
    >
      {icon ? <div className="native-list-icon shrink-0">{icon}</div> : null}
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-medium text-white/95 truncate">{title}</div>
        {subtitle ? <div className="text-xs text-white/45 mt-0.5 truncate">{subtitle}</div> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </Tag>
  );
}

export function NativeSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`native-switch ${checked ? 'native-switch-on' : ''}`}
    >
      <span className="native-switch-thumb" />
    </button>
  );
}

export function NativeChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`native-chip native-tap ${selected ? 'native-chip-selected' : ''}`}
    >
      {label}
    </button>
  );
}
