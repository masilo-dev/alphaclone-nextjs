'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ModuleId } from '@/constants/brand';
import { MODULE_IDENTITY } from '@/constants/brand';
import { useLanguage } from '@/contexts/LanguageContext';

export interface SubNavItem {
  id: string;
  label: string;
  href: string;
  badge?: number | string;
}

interface SubNavigationProps {
  moduleId: ModuleId;
  items: SubNavItem[];
  activeHref?: string;
  className?: string;
}

export function SubNavigation({ moduleId, items, activeHref, className }: SubNavigationProps) {
  const identity = MODULE_IDENTITY[moduleId];
  const { t } = useLanguage();

  return (
    <nav
      aria-label={`${t(identity.label)} · ${t('Sections')}`}
      className={cn(
        'ac-module-subnav flex gap-1 overflow-x-auto pb-px border-b border-[var(--ws-border)]',
        className
      )}
      style={{ ['--module-accent' as string]: identity.primary }}
    >
      {items.map((item) => {
        const active =
          activeHref === item.href ||
          (activeHref?.startsWith(item.href) && item.href !== '#' && item.href.length > 1);
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              'relative inline-flex items-center gap-2 whitespace-nowrap px-3 min-h-10 text-[13px] font-medium transition-colors duration-150',
              active
                ? 'text-[var(--ws-text-primary)]'
                : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)]'
            )}
          >
            {t(item.label)}
            {item.badge != null ? (
              <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-[var(--ws-surface-tertiary)] px-1 text-[10px] font-semibold text-[var(--ws-text-secondary)]">
                {item.badge}
              </span>
            ) : null}
            {active ? (
              <span
                className="absolute left-2 right-2 bottom-0 h-0.5 rounded-full"
                style={{ background: 'var(--module-accent)' }}
                aria-hidden
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
