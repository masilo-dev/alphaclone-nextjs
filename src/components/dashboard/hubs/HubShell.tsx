'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import ModuleJumpSelect from '../common/ModuleJumpSelect';
import { BonnieModulePageShell } from '../bonnie/BonnieModulePageShell';
import { WORKSPACE, MODULE_IDENTITY, type ModuleId } from '@/constants/design';
import { MODULE_ICONS } from '@/components/icons/alphaclone';
import { cn } from '@/lib/utils';

export interface HubTab {
  label: string;
  href: string;
  icon?: LucideIcon;
  aliases?: string[];
}

interface HubShellProps {
  title: string;
  description?: string;
  tabs: HubTab[];
  children: React.ReactNode;
  dataTour?: string;
  /** @deprecated Prefer moduleId for Alphaclone OS identity */
  accent?: 'teal' | 'blue' | 'amber' | 'violet' | 'rose' | 'green';
  moduleId?: ModuleId;
}

const LEGACY_ACCENT: Record<NonNullable<HubShellProps['accent']>, string> = {
  teal: '#0F9F8F',
  blue: '#356AF4',
  amber: '#E69222',
  violet: '#8950F5',
  rose: '#DE4C7A',
  green: '#16A36A',
};

export default function HubShell({
  title,
  description,
  tabs,
  children,
  dataTour,
  accent = 'blue',
  moduleId,
}: HubShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const identity = moduleId ? MODULE_IDENTITY[moduleId] : null;
  const accentColor = identity?.primary ?? LEGACY_ACCENT[accent];
  const ModuleIcon = moduleId ? MODULE_ICONS[moduleId] : null;
  const currentHref = `${pathname || ''}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`;

  return (
    <div
      className="flex flex-col min-h-0 ac-scroll-full ac-enterprise-module ac-module-frame"
      style={{ ['--module-accent' as string]: accentColor }}
      data-module={moduleId}
    >
      <div
        className={cn(
          'flex-shrink-0 px-4 pt-4 pb-0 ac-workspace-toolbar border-b border-[var(--ws-border)]',
        )}
        {...(dataTour ? { 'data-tour': dataTour } : {})}
      >
        <div className="flex items-center gap-2.5">
          {ModuleIcon ? (
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] shrink-0"
              style={{
                background: `color-mix(in srgb, ${accentColor} 14%, transparent)`,
                color: accentColor,
              }}
            >
              <ModuleIcon size={18} variant="duotone" decorative />
            </span>
          ) : (
            <span
              className="w-1 h-4 rounded-full shrink-0"
              style={{ background: accentColor }}
              aria-hidden
            />
          )}
          <div className="min-w-0">
            <h1 className={WORKSPACE.typography.pageTitle}>{title}</h1>
            {description ? (
              <p className="text-[13px] text-[var(--ws-text-muted)] mt-0.5">{description}</p>
            ) : null}
          </div>
        </div>

        <ModuleJumpSelect
          options={tabs.map((t) => ({ label: t.label, href: t.href }))}
          currentHref={pathname || undefined}
          label={`Switch ${title} section`}
          onNavigate={(href) => router.push(href)}
          className="mt-3 md:hidden"
        />

        <div
          className="flex gap-0 overflow-x-auto ios-scroll mt-3 -mx-1 px-1 border-b border-[var(--ws-border)]"
          role="tablist"
          aria-label={`${title} sections`}
        >
          {tabs.map((tab) => {
            const tabHasQuery = tab.href.includes('?');
            const activeHrefs = [tab.href, ...(tab.aliases || [])];
            const isActive =
              pathname != null &&
              activeHrefs.some((href) => {
                const hrefHasQuery = href.includes('?');
                return hrefHasQuery
                  ? currentHref === href || currentHref.startsWith(`${href}&`)
                  : pathname === href || pathname.startsWith(`${href}/`);
              });
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  WORKSPACE.tab.base,
                  'flex-shrink-0 whitespace-nowrap relative',
                  isActive && WORKSPACE.tab.active,
                )}
                style={
                  isActive
                    ? { borderBottomColor: accentColor, color: 'var(--ws-text-primary)' }
                    : undefined
                }
              >
                {Icon ? <Icon className="w-3.5 h-3.5" aria-hidden /> : null}
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 ac-scroll-full px-4 py-4 md:py-5 ac-safe-bottom">
        <BonnieModulePageShell showBonnieDock={false}>{children}</BonnieModulePageShell>
      </div>
    </div>
  );
}
