'use client';

import React from 'react';
import {
  Building2,
  Palette,
  Users,
  LayoutGrid,
  Mail,
  Calendar,
  Wallet,
  Plug,
  Bot,
  Shield,
  Database,
  CreditCard,
} from 'lucide-react';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export type SettingsCategoryId =
  | 'workspace'
  | 'appearance'
  | 'team'
  | 'modules'
  | 'communications'
  | 'calendar'
  | 'finance'
  | 'integrations'
  | 'bonnie'
  | 'security'
  | 'data'
  | 'billing';

export interface SettingsCategory {
  id: SettingsCategoryId;
  label: string;
  description: string;
  /** Existing accordion / section anchors in SettingsPage */
  sectionIds: string[];
  icon: React.ComponentType<{ className?: string }>;
}

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    description: 'Business profile, locale, and branding',
    sectionIds: ['business_profile', 'regional', 'sectors', 'profile'],
    icon: Building2,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Light, dark, and interface density',
    sectionIds: ['appearance', 'mobile_app'],
    icon: Palette,
  },
  {
    id: 'team',
    label: 'Team and access',
    description: 'Users, roles, and ownership',
    sectionIds: ['team'],
    icon: Users,
  },
  {
    id: 'modules',
    label: 'Modules',
    description: 'Enable modules and custom fields',
    sectionIds: ['modules'],
    icon: LayoutGrid,
  },
  {
    id: 'communications',
    label: 'Communications',
    description: 'Email accounts, templates, notifications',
    sectionIds: ['email_provider', 'notifications'],
    icon: Mail,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    description: 'Connected calendars and availability',
    sectionIds: ['integ_calendly'],
    icon: Calendar,
  },
  {
    id: 'finance',
    label: 'Finance',
    description: 'Invoice numbering, taxes, payment methods',
    sectionIds: ['integ_stripe'],
    icon: Wallet,
  },
  {
    id: 'integrations',
    label: 'Integrations',
    description: 'Connected apps and OAuth status',
    sectionIds: ['integ_zoho', 'integ_m365', 'integ_resend', 'integ_sendgrid', 'integ_stripe', 'integ_calendly'],
    icon: Plug,
  },
  {
    id: 'bonnie',
    label: 'Bonnie AI',
    description: 'Permissions and confirmation rules',
    sectionIds: ['bonnie'],
    icon: Bot,
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Password, MFA, sessions, API access',
    sectionIds: ['security', 'mfa'],
    icon: Shield,
  },
  {
    id: 'data',
    label: 'Data and privacy',
    description: 'Export, retention, and deletion',
    sectionIds: ['deleted_records'],
    icon: Database,
  },
  {
    id: 'billing',
    label: 'Billing',
    description: 'Plan, usage, and payment method',
    sectionIds: ['billing'],
    icon: CreditCard,
  },
];

interface SettingsCategoryNavProps {
  activeId?: SettingsCategoryId | null;
  onSelect: (category: SettingsCategory) => void;
  className?: string;
}

export function SettingsCategoryNav({
  activeId,
  onSelect,
  className,
}: SettingsCategoryNavProps) {
  const { t } = useLanguage();
  return (
    <section className={cn('space-y-3', className)} aria-label={t('Settings categories')}>
      <div>
        <h2 className={WORKSPACE.typography.sectionTitle}>{t('Settings')}</h2>
        <p className="mt-1 text-sm text-[var(--ws-text-muted)]">
          {t('Administration organised by area — open a category to manage details.')}
        </p>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {SETTINGS_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const active = activeId === category.id;
          return (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => onSelect(category)}
                className={cn(
                  'w-full text-left rounded-[14px] border px-3.5 py-3 transition-colors duration-150',
                  active
                    ? 'border-[var(--brand-blue-500)] bg-[var(--ws-active)]'
                    : 'border-[var(--ws-border)] bg-[var(--ws-panel)] hover:border-[var(--ws-border-strong)] hover:bg-[var(--ws-hover)]'
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-[color-mix(in_srgb,var(--brand-blue-500)_12%,transparent)] text-[var(--brand-blue-500)]">
                    <Icon className="w-4 h-4" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold text-[var(--ws-text-primary)]">
                    {t(category.label)}
                  </span>
                </span>
                <span className="mt-1.5 block text-xs text-[var(--ws-text-muted)]">
                  {t(category.description)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
