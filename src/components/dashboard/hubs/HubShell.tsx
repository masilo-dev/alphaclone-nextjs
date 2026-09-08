'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import ModuleJumpSelect from '../common/ModuleJumpSelect';
import { BonnieModulePageShell } from '../bonnie/BonnieModulePageShell';
import { WORKSPACE, MODULE_IDENTITY, type ModuleId } from '@/constants/design';
import { MODULE_ICONS } from '@/components/icons/alphaclone';
import { cn } from '@/lib/utils';
import { ExecutionDecisionGuide } from '@/components/dashboard/ExecutionDecisionGuide';
import { HUB_EXECUTION_STEPS } from '@/lib/ui/dashboardExecutionSteps';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChevronDown, Info, Maximize2, Minimize2 } from 'lucide-react';

export interface HubTab {
  label: string;
  href: string;
  icon?: LucideIcon;
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
  fullHeight?: boolean;
}

const LEGACY_ACCENT: Record<NonNullable<HubShellProps['accent']>, string> = {
  teal: '#0F9F8F',
  blue: '#356AF4',
  amber: '#E69222',
  violet: '#8950F5',
  rose: '#DE4C7A',
  green: '#16A36A',
};

const ROUTES_WITH_PAGE_GUIDES = new Set([
  '/dashboard/crm',
  '/dashboard/crm/workspace',
  '/dashboard/outreach',
  '/dashboard/deals',
  '/dashboard/tasks',
  '/dashboard/business/billing',
  '/dashboard/business/billing/manage',
  '/dashboard/finance',
  '/dashboard/finance/manage',
  '/dashboard/contracts',
  '/dashboard/business/contracts',
  '/dashboard/projects',
  '/dashboard/business/projects',
  '/dashboard/projects/manage',
  '/dashboard/business/projects/manage',
  '/dashboard/business/social',
  '/dashboard/social',
  '/dashboard/business/booking',
]);

export default function HubShell({
  title,
  description,
  tabs,
  children,
  dataTour,
  accent = 'blue',
  moduleId,
  fullHeight,
}: HubShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const identity = moduleId ? MODULE_IDENTITY[moduleId] : null;
  const accentColor = identity?.primary ?? LEGACY_ACCENT[accent];
  const ModuleIcon = moduleId ? MODULE_ICONS[moduleId] : null;
  const isFullHeight =
    fullHeight ??
    (moduleId === 'email' ||
      pathname?.includes('/comms') ||
      pathname?.includes('/mail') ||
      pathname?.includes('/unified-inbox'));
  const hubSteps = moduleId && pathname && !ROUTES_WITH_PAGE_GUIDES.has(pathname)
    ? HUB_EXECUTION_STEPS[moduleId]
    : undefined;
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div
      className={cn(
        'relative flex flex-col min-h-0 ac-enterprise-module ac-module-frame',
        isFocused
          ? 'fixed inset-0 z-[100] h-[100dvh] w-screen overflow-y-auto bg-[var(--ws-canvas)]'
          : isFullHeight
            ? 'h-full overflow-hidden'
            : 'ac-scroll-full'
      )}
      style={{ ['--module-accent' as string]: accentColor }}
      data-module={moduleId}
    >
      <div
        className={cn(
          'sticky top-0 z-20 flex-shrink-0 bg-[var(--ws-toolbar)] px-4 py-2 ac-workspace-toolbar border-b border-[var(--ws-border)]',
        )}
        {...(dataTour ? { 'data-tour': dataTour } : {})}
      >
        <div className="flex items-center gap-2.5">
          {ModuleIcon ? (
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] shrink-0"
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
            <h1 className="text-sm font-bold tracking-tight text-[var(--ws-text-primary)]">{t(title)}</h1>
            {description ? (
              <p className="hidden text-xs text-[var(--ws-text-muted)] lg:block">{t(description)}</p>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {hubSteps?.length ? (
              <button
                type="button"
                onClick={() => setOverviewOpen((open) => !open)}
                aria-expanded={overviewOpen}
                aria-controls="module-overview"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--ws-border)] px-2 text-[11px] font-semibold text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)]"
              >
                <Info className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">{t('Overview')}</span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', overviewOpen && 'rotate-180')} aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setIsFocused((focused) => !focused)}
              aria-pressed={isFocused}
              aria-label={isFocused ? t('Exit focus mode') : t('Focus this module')}
              title={isFocused ? t('Exit focus mode') : t('Focus this module')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--ws-border)] text-[var(--ws-text-muted)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)]"
            >
              {isFocused ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <ModuleJumpSelect
          options={tabs.map((tab) => ({ label: t(tab.label), href: tab.href }))}
          currentHref={pathname || undefined}
          label={`${t('Switch section')}: ${t(title)}`}
          onNavigate={(href) => router.push(href)}
          className="mt-2 md:hidden"
        />

        <div
          className="flex gap-0 overflow-x-auto ios-scroll mt-1 -mx-1 px-1"
          role="tablist"
          aria-label={`${t(title)} · ${t('Sections')}`}
        >
          {tabs.map((tab) => {
            const isActive =
              pathname != null &&
              (pathname === tab.href ||
                pathname.startsWith(`${tab.href}/`) ||
                pathname.startsWith(`${tab.href}?`));
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
                {t(tab.label)}
              </Link>
            );
          })}
        </div>

        {hubSteps?.length && overviewOpen ? (
          <div id="module-overview">
            <ExecutionDecisionGuide
              title="Module overview"
              description={description}
              steps={hubSteps}
              onNavigate={(href) => router.push(href)}
              className="mt-2"
            />
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          'flex-1 min-h-0 ac-safe-bottom',
          isFullHeight ? 'h-full overflow-hidden p-0' : 'ac-scroll-full px-4 py-3 md:py-4'
        )}
      >
        <BonnieModulePageShell showBonnieDock={!isFullHeight}>
          {children}
        </BonnieModulePageShell>
      </div>
    </div>
  );
}
