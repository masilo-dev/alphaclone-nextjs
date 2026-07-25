'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ModuleId } from '@/constants/brand';
import { MODULE_IDENTITY } from '@/constants/brand';
import { getModuleIcon } from '@/components/icons/alphaclone';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';

export interface ModuleLauncherItem {
  id: ModuleId;
  href: string;
  purpose: string;
  summary?: string;
  pinned?: boolean;
}

interface ModuleLauncherProps {
  items: ModuleLauncherItem[];
  className?: string;
  title?: string;
}

export function ModuleLauncher({
  items,
  className,
  title = 'Your modules',
}: ModuleLauncherProps) {
  const visible = items.slice(0, 10);

  return (
    <section className={cn(WORKSPACE.panel.base, 'p-4 md:p-5', className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={WORKSPACE.typography.sectionTitle}>{title}</h2>
        <span className="text-xs text-[var(--ws-text-muted)]">{visible.length} visible</span>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visible.map((item) => {
          const identity = MODULE_IDENTITY[item.id];
          const Icon = getModuleIcon(item.id);
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group flex items-center gap-3 rounded-[12px] px-3 py-3 transition-colors duration-150 hover:bg-[var(--ws-hover)]"
              >
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] shrink-0"
                  style={{
                    background: `color-mix(in srgb, ${identity.primary} 14%, transparent)`,
                    color: identity.primary,
                  }}
                >
                  <Icon size={18} variant="duotone" decorative />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--ws-text-primary)]">
                    {identity.label}
                  </span>
                  <span className="block text-xs text-[var(--ws-text-muted)] truncate">
                    {item.summary || item.purpose}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-[var(--ws-text-disabled)] group-hover:text-[var(--ws-text-secondary)] shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
