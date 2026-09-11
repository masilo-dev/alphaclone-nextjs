'use client';

import React from 'react';

/** Desktop-only table wrapper (hidden below md). */
export function ResponsiveTableDesktop({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`hidden md:block overflow-x-auto min-w-0 ac-scroll-full ${className}`}>
      {children}
    </div>
  );
}

/** Mobile-only card list (hidden from md up). */
export function ResponsiveTableMobile({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`md:hidden space-y-3 ${className}`}>{children}</div>;
}

/** Standard mobile data card shell. */
export function MobileDataCard({
  children,
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-left rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3 min-h-11 ${onClick ? 'active:scale-[0.99] transition-transform' : ''} ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Row actions visible on touch; hover-only on desktop. */
export const rowActionsClass =
  'flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity';
