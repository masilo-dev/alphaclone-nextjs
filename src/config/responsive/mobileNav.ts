import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Sparkles,
  Target,
  TrendingUp,
  FileText,
  Layers,
  CheckSquare,
  FolderOpen,
  Calendar,
  DollarSign,
  Receipt,
  BarChart3,
  Globe,
  Presentation,
  PenSquare,
  Workflow,
  Settings,
  Plug,
  Mail,
  MessageSquare,
  Ticket,
} from 'lucide-react';
import type { UserRole } from '@/types';

export interface MobileBottomDestination {
  id: 'home' | 'crm' | 'work' | 'bonnie' | 'more';
  label: string;
  icon: LucideIcon;
  hrefForRole: (role: UserRole) => string;
  matchPrefixesForRole: (role: UserRole) => string[];
}

export interface MoreCatalogueItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface MoreCatalogueGroup {
  id: string;
  label: string;
  items: MoreCatalogueItem[];
}

/** Fixed five-slot phone bottom nav (More opens catalogue). */
export const MOBILE_BOTTOM_DESTINATIONS: MobileBottomDestination[] = [
  {
    id: 'home',
    label: 'Home',
    icon: LayoutDashboard,
    hrefForRole: () => '/dashboard',
    matchPrefixesForRole: () => ['/dashboard'],
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: Users,
    hrefForRole: (role) =>
      role === 'tenant_admin' || role === 'business_dashboard'
        ? '/dashboard/crm/workspace'
        : '/dashboard/contacts',
    matchPrefixesForRole: (role) =>
      role === 'tenant_admin' || role === 'business_dashboard'
        ? [
            '/dashboard/crm',
            '/dashboard/contacts',
            '/dashboard/business/clients',
            '/dashboard/leads',
            '/dashboard/clients',
          ]
        : ['/dashboard/contacts', '/dashboard/clients', '/dashboard/crm'],
  },
  {
    id: 'work',
    label: 'Work',
    icon: Briefcase,
    hrefForRole: (role) =>
      role === 'tenant_admin' || role === 'business_dashboard'
        ? '/dashboard/tasks'
        : '/dashboard/projects',
    matchPrefixesForRole: () => [
      '/dashboard/tasks',
      '/dashboard/business/tasks',
      '/dashboard/projects',
      '/dashboard/business/projects',
      '/dashboard/deals',
      '/dashboard/goals',
    ],
  },
  {
    id: 'bonnie',
    label: 'Bonnie',
    icon: Sparkles,
    hrefForRole: (role) =>
      role === 'tenant_admin' || role === 'business_dashboard'
        ? '/dashboard/business/bonnie'
        : '/dashboard/bonnie',
    matchPrefixesForRole: () => ['/dashboard/bonnie', '/dashboard/business/bonnie'],
  },
  {
    id: 'more',
    label: 'More',
    icon: Layers,
    hrefForRole: () => '#more',
    matchPrefixesForRole: () => [],
  },
];

export function getMoreCatalogue(role: UserRole): MoreCatalogueGroup[] {
  const isTenant = role === 'tenant_admin' || role === 'business_dashboard';
  const moneyInvoices = isTenant
    ? '/dashboard/business/billing/manage'
    : '/dashboard/finance/manage';
  const expenses = isTenant ? '/dashboard/business/expenses' : '/dashboard/finance/manage';
  const projects = isTenant ? '/dashboard/business/projects' : '/dashboard/projects';
  const calendar = isTenant ? '/dashboard/business/calendar' : '/dashboard/calendar';
  const contracts = isTenant ? '/dashboard/business/contracts' : '/dashboard/contracts';
  const documents = isTenant ? '/dashboard/business/documents' : '/dashboard/submit';
  const settings = isTenant ? '/dashboard/business/settings' : '/dashboard/settings';
  const campaigns = isTenant ? '/dashboard/business/campaigns' : '/dashboard/email-campaigns';
  const social = isTenant ? '/dashboard/business/social' : '/dashboard/social';

  return [
    {
      id: 'sell',
      label: 'Sell',
      items: [
        { label: 'CRM workspace', href: '/dashboard/crm/workspace', icon: Users },
        { label: 'Leads', href: '/dashboard/leads', icon: TrendingUp },
        { label: 'Lead Finder', href: '/dashboard/leads/campaigns', icon: Target },
        { label: 'Deals', href: '/dashboard/deals', icon: Target },
        {
          label: 'Quotes',
          href: isTenant ? '/dashboard/business/quotes' : '/dashboard/quotes',
          icon: FileText,
        },
      ],
    },
    {
      id: 'deliver',
      label: 'Deliver',
      items: [
        { label: 'Projects', href: projects, icon: Layers },
        { label: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare },
        { label: 'Documents', href: documents, icon: FolderOpen },
        { label: 'Calendar', href: calendar, icon: Calendar },
        { label: 'Contracts', href: contracts, icon: FileText },
      ],
    },
    {
      id: 'get-paid',
      label: 'Get paid',
      items: [
        { label: 'Invoices', href: moneyInvoices, icon: DollarSign },
        { label: 'Expenses', href: expenses, icon: Receipt },
        { label: 'Accounting', href: '/dashboard/accounting', icon: BarChart3 },
        {
          label: 'Cash flow',
          href: isTenant ? '/dashboard/business/cash-flow' : '/dashboard/finance',
          icon: DollarSign,
        },
      ],
    },
    {
      id: 'grow',
      label: 'Grow',
      items: [
        { label: 'Campaigns', href: campaigns, icon: Presentation },
        { label: 'Social', href: social, icon: Globe },
        {
          label: 'Compose post',
          href: isTenant ? '/dashboard/business/social/compose' : '/dashboard/social/compose',
          icon: PenSquare,
        },
        {
          label: 'Forms',
          href: isTenant ? '/dashboard/business/forms' : '/dashboard/business/forms',
          icon: FileText,
        },
        { label: 'Mail', href: '/dashboard/mail', icon: Mail },
      ],
    },
    {
      id: 'operate',
      label: 'Operate',
      items: [
        { label: 'Unified inbox', href: '/dashboard/comms', icon: Mail },
        {
          label: 'Reports',
          href: isTenant ? '/dashboard/business/reports' : '/dashboard/reporting',
          icon: BarChart3,
        },
        {
          label: 'Workflows',
          href: isTenant ? '/dashboard/business/workflows' : '/dashboard/automations',
          icon: Workflow,
        },
        { label: 'Tickets', href: isTenant ? '/dashboard/business/tickets' : '/dashboard/tickets', icon: Ticket },
        {
          label: 'Team messages',
          href: isTenant ? '/dashboard/business/messages' : '/dashboard/messages',
          icon: MessageSquare,
        },
        { label: 'Integrations', href: '/dashboard/marketplace', icon: Plug },
        { label: 'Settings', href: settings, icon: Settings },
      ],
    },
  ];
}

export function isMobileBottomActive(
  activeTab: string,
  dest: MobileBottomDestination,
  role: UserRole,
): boolean {
  if (dest.id === 'more') return false;
  if (dest.id === 'home') {
    return activeTab === '/dashboard' || activeTab === '/dashboard/business';
  }
  const prefixes = dest.matchPrefixesForRole(role);
  if (dest.id === 'crm') {
    return prefixes.some(
      (p) =>
        activeTab === p ||
        activeTab.startsWith(`${p}/`) ||
        (p === '/dashboard/crm' && activeTab.startsWith('/dashboard/crm')),
    );
  }
  return prefixes.some((p) => activeTab === p || activeTab.startsWith(`${p}/`) || activeTab.startsWith(p));
}
