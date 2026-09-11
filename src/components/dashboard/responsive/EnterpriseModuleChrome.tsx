'use client';

import React from 'react';
import { PageHeader, type PageHeaderAction } from './PageHeader';
import { ModulePageLayout } from '@/components/ui/ModulePageLayout';
import { cn } from '@/lib/utils';

export type EnterpriseModuleMeta = {
  moduleLabel: string;
  title: string;
  description?: string;
};

/** Canonical enterprise titles for overview + list modules. */
export const ENTERPRISE_MODULE_META: Record<string, EnterpriseModuleMeta> = {
  overview: {
    moduleLabel: 'Home',
    title: 'Workspace overview',
    description: 'Cross-module snapshot of activity, money, and next steps.',
  },
  crm: {
    moduleLabel: 'Sell',
    title: 'CRM overview',
    description: 'Pipeline health, contacts, and customer momentum.',
  },
  outreach: {
    moduleLabel: 'Sell',
    title: 'Outreach overview',
    description: 'Campaign and follow-up performance at a glance.',
  },
  invoicing: {
    moduleLabel: 'Get paid',
    title: 'Billing overview',
    description: 'Invoices, collections, and cash coming in.',
  },
  contracts: {
    moduleLabel: 'Deliver',
    title: 'Contracts overview',
    description: 'Drafts, signatures, and agreement status.',
  },
  projects: {
    moduleLabel: 'Deliver',
    title: 'Projects overview',
    description: 'Delivery progress across active work.',
  },
  social: {
    moduleLabel: 'Grow',
    title: 'Social overview',
    description: 'Publishing and engagement across connected channels.',
  },
  deals: {
    moduleLabel: 'Sell',
    title: 'Deals',
    description: 'Move opportunities through the pipeline.',
  },
  accounting: {
    moduleLabel: 'Get paid',
    title: 'Accounting',
    description: 'Books, cash position, and financial controls.',
  },
  documents: {
    moduleLabel: 'Deliver',
    title: 'Documents',
    description: 'Files, templates, and workspace records.',
  },
  calendar: {
    moduleLabel: 'Deliver',
    title: 'Calendar',
    description: 'Meetings, bookings, and schedule.',
  },
  campaigns: {
    moduleLabel: 'Grow',
    title: 'Campaigns',
    description: 'Email and outreach campaigns.',
  },
  forms: {
    moduleLabel: 'Grow',
    title: 'Forms',
    description: 'Capture leads and requests.',
  },
  reports: {
    moduleLabel: 'Operate',
    title: 'Reports',
    description: 'Business performance and analytics.',
  },
  workflows: {
    moduleLabel: 'Operate',
    title: 'Workflows',
    description: 'Automations that run your processes.',
  },
  marketplace: {
    moduleLabel: 'Operate',
    title: 'Marketplace',
    description: 'Apps and integrations for your workspace.',
  },
  leads: {
    moduleLabel: 'Sell',
    title: 'Lead Finder',
    description: 'Find and qualify new prospects.',
  },
  goals: {
    moduleLabel: 'Sell',
    title: 'Goals',
    description: 'Targets Bonnie and your team are driving.',
  },
  vendors: {
    moduleLabel: 'Get paid',
    title: 'Vendors',
    description: 'Suppliers and payables relationships.',
  },
  notifications: {
    moduleLabel: 'Operate',
    title: 'Notifications',
    description: 'Workspace alerts and activity.',
  },
  help: {
    moduleLabel: 'Operate',
    title: 'Help',
    description: 'Guides and platform support.',
  },
  tickets: {
    moduleLabel: 'Inbox',
    title: 'Support desk',
    description: 'Customer tickets and resolution queue.',
  },
  projects_manage: {
    moduleLabel: 'Deliver',
    title: 'Projects',
    description: 'Plan and deliver client work.',
  },
  contracts_manage: {
    moduleLabel: 'Deliver',
    title: 'Contracts',
    description: 'Create, send, and track agreements.',
  },
  cashflow: {
    moduleLabel: 'Get paid',
    title: 'Cash flow',
    description: 'Forecast inflows and outflows.',
  },
  banking: {
    moduleLabel: 'Get paid',
    title: 'Banking',
    description: 'Accounts, reconciliation, and transfers.',
  },
  executive: {
    moduleLabel: 'Operate',
    title: 'Executive',
    description: 'Leadership view of the business.',
  },
  analytics: {
    moduleLabel: 'Operate',
    title: 'Analytics',
    description: 'Trends across your workspace.',
  },
  jobs: {
    moduleLabel: 'Operate',
    title: 'Jobs',
    description: 'Background jobs and queue health.',
  },
  webhooks: {
    moduleLabel: 'Operate',
    title: 'Webhooks',
    description: 'Outbound event integrations.',
  },
  planning: {
    moduleLabel: 'Sell',
    title: 'Annual planning',
    description: 'Plan targets across the year.',
  },
  forecasts: {
    moduleLabel: 'Sell',
    title: 'Forecast',
    description: 'Projected pipeline and revenue.',
  },
  accounts: {
    moduleLabel: 'Sell',
    title: 'Accounts',
    description: 'Company accounts in your CRM.',
  },
  vault: {
    moduleLabel: 'Deliver',
    title: 'Document vault',
    description: 'Secure file storage for the workspace.',
  },
  booking: {
    moduleLabel: 'Deliver',
    title: 'Booking',
    description: 'Scheduling links and availability.',
  },
  meetings: {
    moduleLabel: 'Deliver',
    title: 'Meetings',
    description: 'Live and upcoming meetings.',
  },
  submissions: {
    moduleLabel: 'Deliver',
    title: 'Contact submissions',
    description: 'Inbound form and contact requests.',
  },
  bills: {
    moduleLabel: 'Get paid',
    title: 'Bills payable',
    description: 'Money you owe vendors.',
  },
  period_close: {
    moduleLabel: 'Get paid',
    title: 'Period close',
    description: 'Close books for the period.',
  },
  approvals: {
    moduleLabel: 'Operate',
    title: 'Approvals',
    description: 'Actions waiting for your OK.',
  },
};

type EnterpriseModuleChromeProps = {
  moduleKey: string;
  meta?: Partial<EnterpriseModuleMeta>;
  primaryAction?: PageHeaderAction;
  secondaryActions?: PageHeaderAction[];
  toolbar?: React.ReactNode;
  stats?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  phoneNavSafe?: boolean;
  headerChildren?: React.ReactNode;
};

/**
 * Standard SaaS enterprise module frame:
 * PageHeader → optional toolbar/stats → scrollable body.
 */
export function EnterpriseModuleChrome({
  moduleKey,
  meta,
  primaryAction,
  secondaryActions,
  toolbar,
  stats,
  children,
  className,
  phoneNavSafe = true,
  headerChildren,
}: EnterpriseModuleChromeProps) {
  const base = ENTERPRISE_MODULE_META[moduleKey] || {
    moduleLabel: 'Workspace',
    title: moduleKey,
  };
  const resolved = {
    moduleLabel: meta?.moduleLabel || base.moduleLabel,
    title: meta?.title || base.title,
    description: meta?.description ?? base.description,
  };

  return (
    <div className={cn('ac-scroll-full ac-enterprise-module', className)}>
      <ModulePageLayout
        phoneNavSafe={phoneNavSafe}
        header={
          <div>
            <PageHeader
              moduleLabel={resolved.moduleLabel}
              title={resolved.title}
              description={resolved.description}
              primaryAction={primaryAction}
              secondaryActions={secondaryActions}
            />
            {headerChildren}
          </div>
        }
        toolbar={toolbar}
        stats={stats}
      >
        {children}
      </ModulePageLayout>
    </div>
  );
}

/** Lightweight header-only helper when a screen already has its own layout. */
export function EnterprisePageHeader({
  moduleKey,
  meta,
  primaryAction,
  secondaryActions,
  children,
  className,
}: {
  moduleKey: string;
  meta?: Partial<EnterpriseModuleMeta>;
  primaryAction?: PageHeaderAction;
  secondaryActions?: PageHeaderAction[];
  children?: React.ReactNode;
  className?: string;
}) {
  const base = ENTERPRISE_MODULE_META[moduleKey] || {
    moduleLabel: 'Workspace',
    title: moduleKey,
  };
  return (
    <PageHeader
      className={className}
      moduleLabel={meta?.moduleLabel || base.moduleLabel}
      title={meta?.title || base.title}
      description={meta?.description ?? base.description}
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
    >
      {children}
    </PageHeader>
  );
}
