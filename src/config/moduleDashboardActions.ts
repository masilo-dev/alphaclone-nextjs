import type { LucideIcon } from 'lucide-react';
import {
  LayoutGrid,
  UserPlus,
  Target,
  Users,
  Mail,
  DollarSign,
  FileText,
  Briefcase,
  Globe,
  Send,
  Plus,
  TrendingUp,
  CheckSquare,
} from 'lucide-react';
import type { UserRole } from '@/types';

export type ModuleDashboardId =
  | 'overview'
  | 'crm'
  | 'outreach'
  | 'invoicing'
  | 'contracts'
  | 'projects'
  | 'social';

export interface ModuleDashboardAction {
  label: string;
  href: string | ((role: UserRole) => string);
  icon: LucideIcon;
  primary?: boolean;
}

export interface ModuleDashboardMeta {
  title: string;
  hint: string;
  actions: ModuleDashboardAction[];
}

function hrefFor(role: UserRole, href: string | ((role: UserRole) => string)): string {
  return typeof href === 'function' ? href(role) : href;
}

const clientsPath = (role: UserRole) =>
  role === 'tenant_admin' ? '/dashboard/business/clients' : '/dashboard/contacts';

const billingPath = (role: UserRole) =>
  role === 'tenant_admin' ? '/dashboard/business/billing/manage' : '/dashboard/finance/manage';

const contractsManagePath = (role: UserRole) =>
  role === 'tenant_admin' ? '/dashboard/business/contracts/manage' : '/dashboard/contracts/manage';

const projectsManagePath = (role: UserRole) =>
  role === 'tenant_admin' ? '/dashboard/business/projects/manage' : '/dashboard/projects/manage';

const socialComposePath = (role: UserRole) =>
  role === 'tenant_admin' ? '/dashboard/business/social/compose' : '/dashboard/social/compose';

export const MODULE_DASHBOARD_META: Record<ModuleDashboardId, ModuleDashboardMeta> = {
  overview: {
    title: 'Workspace overview',
    hint: 'Numbers and charts show health — pick an action below to do real work.',
    actions: [
      { label: 'Open CRM workspace', href: '/dashboard/crm/workspace', icon: LayoutGrid, primary: true },
      { label: 'Deals pipeline', href: '/dashboard/deals', icon: Target },
      { label: 'Send outreach', href: '/dashboard/outreach', icon: Send },
      { label: 'Billing', href: billingPath, icon: DollarSign },
      { label: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare },
    ],
  },
  crm: {
    title: 'CRM overview',
    hint: 'This page is your pipeline snapshot. Day-to-day selling happens in the workspace.',
    actions: [
      { label: 'Open CRM workspace', href: '/dashboard/crm/workspace', icon: LayoutGrid, primary: true },
      { label: 'Add lead', href: '/dashboard/crm/workspace?quickAdd=true', icon: UserPlus },
      { label: 'Deals pipeline', href: '/dashboard/deals', icon: Target },
      { label: 'Contacts', href: clientsPath, icon: Users },
      { label: 'Leads board', href: '/dashboard/leads', icon: TrendingUp },
    ],
  },
  outreach: {
    title: 'Outreach overview',
    hint: 'Track sends and replies here — launch campaigns and follow up in the tools below.',
    actions: [
      {
        label: 'Email campaigns',
        href: (role) =>
          role === 'tenant_admin' ? '/dashboard/business/campaigns' : '/dashboard/outreach',
        icon: Mail,
        primary: true,
      },
      { label: 'Mail inbox', href: '/dashboard/mail', icon: Mail },
      { label: 'CRM workspace', href: '/dashboard/crm/workspace', icon: LayoutGrid },
      { label: 'Deals', href: '/dashboard/deals', icon: Target },
    ],
  },
  invoicing: {
    title: 'Invoicing overview',
    hint: 'Charts show cash flow — create and send invoices in the billing manager.',
    actions: [
      { label: 'Invoice manager', href: billingPath, icon: DollarSign, primary: true },
      { label: 'New invoice', href: (role) => `${billingPath(role)}?create=1`, icon: Plus },
      { label: 'Quotes', href: '/dashboard/business/quotes', icon: FileText },
      { label: 'Accounting', href: '/dashboard/accounting', icon: TrendingUp },
    ],
  },
  contracts: {
    title: 'Contracts overview',
    hint: 'See portfolio status here — draft, send, and sign in the contract manager.',
    actions: [
      { label: 'Contract manager', href: contractsManagePath, icon: FileText, primary: true },
      { label: 'New contract', href: (role) => `${contractsManagePath(role)}?new=1`, icon: Plus },
      { label: 'Deals', href: '/dashboard/deals', icon: Target },
      { label: 'Billing', href: billingPath, icon: DollarSign },
    ],
  },
  projects: {
    title: 'Projects overview',
    hint: 'Track delivery health here — assign tasks and manage projects in the manager.',
    actions: [
      { label: 'Project manager', href: projectsManagePath, icon: Briefcase, primary: true },
      { label: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare },
      {
        label: 'Calendar',
        href: (role) =>
          role === 'tenant_admin' ? '/dashboard/business/calendar' : '/dashboard/calendar',
        icon: LayoutGrid,
      },
      { label: 'Billing', href: billingPath, icon: DollarSign },
    ],
  },
  social: {
    title: 'Social overview',
    hint: 'See publishing activity here — compose and schedule posts in the composer.',
    actions: [
      { label: 'Compose post', href: socialComposePath, icon: Globe, primary: true },
      {
        label: 'Social hub',
        href: (role) =>
          role === 'tenant_admin' ? '/dashboard/business/social' : '/dashboard/social',
        icon: LayoutGrid,
      },
      { label: 'Campaigns', href: '/dashboard/business/campaigns', icon: Send },
      { label: 'Mail', href: '/dashboard/mail', icon: Mail },
    ],
  },
};

export function resolveModuleActions(moduleId: ModuleDashboardId, role: UserRole) {
  const meta = MODULE_DASHBOARD_META[moduleId];
  return {
    ...meta,
    actions: meta.actions.map((action) => ({
      ...action,
      resolvedHref: hrefFor(role, action.href),
    })),
  };
}
