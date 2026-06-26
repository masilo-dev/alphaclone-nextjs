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
  BarChart3,
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
  description: string;
  href: string | ((role: UserRole) => string);
  icon: LucideIcon;
  primary?: boolean;
  tenantAdminOnly?: boolean;
}

export interface ModuleDashboardMeta {
  title: string;
  purpose: string;
  playbook: string[];
  chartNote: string;
  actions: ModuleDashboardAction[];
}

function hrefFor(role: UserRole, href: string | ((role: UserRole) => string)): string {
  return typeof href === 'function' ? href(role) : href;
}

const clientsPath = (role: UserRole) =>
  role === 'tenant_admin' ? '/dashboard/business/clients' : '/dashboard/contacts';

const billingPath = (role: UserRole) =>
  role === 'tenant_admin' ? '/dashboard/business/billing/manage' : '/dashboard/finance/manage';

const billingOverviewPath = (role: UserRole) =>
  role === 'tenant_admin' ? '/dashboard/business/billing' : '/dashboard/finance';

const contractsManagePath = (role: UserRole) =>
  role === 'tenant_admin' ? '/dashboard/business/contracts/manage' : '/dashboard/contracts/manage';

const projectsManagePath = (role: UserRole) =>
  role === 'tenant_admin' ? '/dashboard/business/projects/manage' : '/dashboard/projects/manage';

const socialComposePath = (role: UserRole) =>
  role === 'tenant_admin' ? '/dashboard/business/social/compose' : '/dashboard/social/compose';

const quotesPath = (role: UserRole) =>
  role === 'tenant_admin' ? '/dashboard/business/quotes' : '/dashboard/quotes';

const campaignsPath = (role: UserRole) =>
  role === 'tenant_admin' ? '/dashboard/business/campaigns' : '/dashboard/email-campaigns';

export const MODULE_DASHBOARD_META: Record<ModuleDashboardId, ModuleDashboardMeta> = {
  overview: {
    title: 'Workspace home',
    purpose:
      'This page shows how the business is performing across sales, money, and delivery. It is for reading — not for editing records.',
    playbook: [
      'Check the numbers below to see what needs attention (overdue invoices, open deals, tasks).',
      'Open the module where the work happens — CRM workspace, billing manager, or tasks.',
      'Do the work there, then come back here to confirm the metrics moved.',
    ],
    chartNote: 'Charts below are a read-only snapshot. They update after you work in the modules above.',
    actions: [
      {
        label: 'Open CRM workspace',
        description: 'Manage leads, clients, calls, and follow-ups.',
        href: '/dashboard/crm/workspace',
        icon: LayoutGrid,
        primary: true,
      },
      {
        label: 'Deals pipeline',
        description: 'Move opportunities and close revenue.',
        href: '/dashboard/deals',
        icon: Target,
      },
      {
        label: 'Invoice manager',
        description: 'Create, send, and track payments.',
        href: billingPath,
        icon: DollarSign,
      },
      {
        label: 'Outreach',
        description: 'Review sends and launch follow-up.',
        href: '/dashboard/outreach',
        icon: Send,
      },
      {
        label: 'Tasks',
        description: 'See what is due and assign work.',
        href: '/dashboard/tasks',
        icon: CheckSquare,
      },
    ],
  },
  crm: {
    title: 'CRM overview',
    purpose:
      'This page answers “how is my pipeline?” — contacts, deals, and conversion. You do not add or edit records here.',
    playbook: [
      'Open CRM workspace to work leads and clients (call, email, qualify).',
      'Move qualified leads into Deals and set a close date.',
      'Return here to see if pipeline value and conversion improved.',
    ],
    chartNote: 'Pipeline charts are for reporting. All CRM work happens in the workspace.',
    actions: [
      {
        label: 'Open CRM workspace',
        description: 'Your daily screen — leads, clients, calls, messages.',
        href: '/dashboard/crm/workspace',
        icon: LayoutGrid,
        primary: true,
      },
      {
        label: 'Add lead',
        description: 'Capture a new prospect with name and contact info.',
        href: '/dashboard/crm/workspace?quickAdd=true',
        icon: UserPlus,
      },
      {
        label: 'Deals pipeline',
        description: 'Drag deals through stages toward closed won.',
        href: '/dashboard/deals',
        icon: Target,
      },
      {
        label: 'Contacts',
        description: 'Browse and update client records.',
        href: clientsPath,
        icon: Users,
      },
      {
        label: 'Leads board',
        description: 'Review and qualify inbound leads.',
        href: '/dashboard/leads',
        icon: TrendingUp,
      },
      {
        label: 'CRM reports',
        description: 'Deeper tables and exports.',
        href: '/dashboard/crm/reports',
        icon: BarChart3,
      },
    ],
  },
  outreach: {
    title: 'Outreach overview',
    purpose:
      'This page tracks email and multi-channel outreach volume and replies. Campaigns are built and sent in the tools below.',
    playbook: [
      'Review open and reply rates here to see if messaging is working.',
      'Open campaigns or mail to send the next batch or reply to prospects.',
      'Convert replies into CRM contacts and deals so revenue is tracked.',
    ],
    chartNote: 'Send volume and channel charts are read-only. Sending happens in campaigns and mail.',
    actions: [
      {
        label: 'Email campaigns',
        description: 'Build, schedule, and send outreach sequences.',
        href: campaignsPath,
        icon: Mail,
        primary: true,
      },
      {
        label: 'Mail inbox',
        description: 'Read and reply to prospect email.',
        href: '/dashboard/mail',
        icon: Mail,
      },
      {
        label: 'CRM workspace',
        description: 'Log calls and follow up on warm replies.',
        href: '/dashboard/crm/workspace',
        icon: LayoutGrid,
      },
      {
        label: 'Deals pipeline',
        description: 'Turn interested replies into opportunities.',
        href: '/dashboard/deals',
        icon: Target,
      },
      {
        label: 'Lead finder',
        description: 'Source new prospects to contact.',
        href: '/dashboard/leads/campaigns',
        icon: Send,
        tenantAdminOnly: true,
      },
    ],
  },
  invoicing: {
    title: 'Invoicing overview',
    purpose:
      'This page shows money in vs outstanding. Invoices are created, sent, and marked paid in the billing manager.',
    playbook: [
      'Check overdue and outstanding totals here first.',
      'Open invoice manager to create or send what is due.',
      'When paid, record payment in accounting so reports stay accurate.',
    ],
    chartNote: 'Revenue charts reflect invoice data. Create and send invoices in the manager.',
    actions: [
      {
        label: 'Invoice manager',
        description: 'Create, edit, send, and download invoices.',
        href: billingPath,
        icon: DollarSign,
        primary: true,
      },
      {
        label: 'New invoice',
        description: 'Start a bill for a client right now.',
        href: (role) => `${billingPath(role)}?create=1`,
        icon: Plus,
      },
      {
        label: 'Quotes',
        description: 'Send a proposal before invoicing.',
        href: quotesPath,
        icon: FileText,
      },
      {
        label: 'Billing center',
        description: 'Overview of all billing activity.',
        href: billingOverviewPath,
        icon: BarChart3,
      },
      {
        label: 'Accounting',
        description: 'Record payments and run reports.',
        href: '/dashboard/accounting',
        icon: TrendingUp,
      },
    ],
  },
  contracts: {
    title: 'Contracts overview',
    purpose:
      'This page shows active agreements and what is expiring. Contracts are drafted and signed in the contract manager.',
    playbook: [
      'Review expiring and active counts here.',
      'Open contract manager to draft, send, and collect signatures.',
      'After signature, invoice the client and start delivery in projects.',
    ],
    chartNote: 'Contract status charts are read-only. Drafting and signing happen in the manager.',
    actions: [
      {
        label: 'Contract manager',
        description: 'Draft, send, track signatures, and store PDFs.',
        href: contractsManagePath,
        icon: FileText,
        primary: true,
      },
      {
        label: 'New contract',
        description: 'Start from a template or blank agreement.',
        href: (role) => `${contractsManagePath(role)}?new=1`,
        icon: Plus,
      },
      {
        label: 'Deals pipeline',
        description: 'Link contracts to opportunities.',
        href: '/dashboard/deals',
        icon: Target,
      },
      {
        label: 'Invoice manager',
        description: 'Bill after the contract is signed.',
        href: billingPath,
        icon: DollarSign,
      },
      {
        label: 'Document hub',
        description: 'Store signed files and related docs.',
        href: '/dashboard/business/documents',
        icon: Briefcase,
        tenantAdminOnly: true,
      },
    ],
  },
  projects: {
    title: 'Projects overview',
    purpose:
      'This page shows delivery health — open tasks, overdue work, and completion. Projects are managed in the project manager.',
    playbook: [
      'Check overdue tasks and utilisation here.',
      'Open project manager to assign work and update status.',
      'Bill milestones from invoicing when delivery is complete.',
    ],
    chartNote: 'Task and project charts are read-only. Assign and complete work in the manager.',
    actions: [
      {
        label: 'Project manager',
        description: 'Create projects, milestones, and owners.',
        href: projectsManagePath,
        icon: Briefcase,
        primary: true,
      },
      {
        label: 'Tasks',
        description: 'Your personal and team task list.',
        href: '/dashboard/tasks',
        icon: CheckSquare,
      },
      {
        label: 'Calendar',
        description: 'Schedule deadlines and client meetings.',
        href: (role) =>
          role === 'tenant_admin' ? '/dashboard/business/calendar' : '/dashboard/calendar',
        icon: LayoutGrid,
      },
      {
        label: 'Invoice manager',
        description: 'Bill for completed project work.',
        href: billingPath,
        icon: DollarSign,
      },
      {
        label: 'Team',
        description: 'See who owns what across the business.',
        href: '/dashboard/business/team',
        icon: Users,
        tenantAdminOnly: true,
      },
    ],
  },
  social: {
    title: 'Social overview',
    purpose:
      'This page tracks posts published and scheduled across networks. Content is created in the composer.',
    playbook: [
      'Review what went out and what is scheduled here.',
      'Open compose to write and schedule the next post.',
      'Reply to engagement and feed warm leads into CRM.',
    ],
    chartNote: 'Publishing charts are read-only. Compose and schedule in the social tools.',
    actions: [
      {
        label: 'Compose post',
        description: 'Write, attach media, and schedule publishing.',
        href: socialComposePath,
        icon: Globe,
        primary: true,
      },
      {
        label: 'Social hub',
        description: 'Manage connected accounts and history.',
        href: (role) =>
          role === 'tenant_admin' ? '/dashboard/business/social' : '/dashboard/social',
        icon: LayoutGrid,
      },
      {
        label: 'Campaigns',
        description: 'Coordinate social with email outreach.',
        href: campaignsPath,
        icon: Send,
      },
      {
        label: 'CRM workspace',
        description: 'Follow up on comments and DMs as leads.',
        href: '/dashboard/crm/workspace',
        icon: Users,
      },
      {
        label: 'Mail',
        description: 'Cross-post or email clients about content.',
        href: '/dashboard/mail',
        icon: Mail,
      },
    ],
  },
};

export function resolveModuleActions(moduleId: ModuleDashboardId, role: UserRole) {
  const meta = MODULE_DASHBOARD_META[moduleId];
  const visible = meta.actions.filter((action) => !action.tenantAdminOnly || role === 'tenant_admin');
  return {
    ...meta,
    actions: visible.map((action) => ({
      ...action,
      resolvedHref: hrefFor(role, action.href),
    })),
  };
}
