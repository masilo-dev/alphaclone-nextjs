import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Mail,
  UserCircle,
  CheckSquare,
  Video,
  MessageSquare,
  DollarSign,
  Briefcase,
  Globe,
  FileText,
  Target,
} from 'lucide-react';
import type { UserRole } from '@/types';

export interface PwaModuleDef {
  id: string;
  label: string;
  icon: LucideIcon;
  hrefForRole: (role: UserRole) => string;
  matchPrefixesForRole?: (role: UserRole) => string[];
}

export interface PwaNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  matchPrefixes?: string[];
  moduleId: string;
}

export const PWA_MAX_BOTTOM_SLOTS = 4;

export const PWA_MODULE_CATALOG: PwaModuleDef[] = [
  {
    id: 'home',
    label: 'Home',
    icon: LayoutDashboard,
    hrefForRole: () => '/dashboard',
    matchPrefixesForRole: () => ['/dashboard', '/dashboard/business'],
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: Users,
    hrefForRole: () => '/dashboard/crm',
    matchPrefixesForRole: () => ['/dashboard/crm'],
  },
  {
    id: 'mail',
    label: 'Mail',
    icon: Mail,
    hrefForRole: () => '/dashboard/mail',
    matchPrefixesForRole: () => ['/dashboard/mail'],
  },
  {
    id: 'clients',
    label: 'Clients',
    icon: UserCircle,
    hrefForRole: (role) =>
      role === 'tenant_admin' ? '/dashboard/business/clients' : '/dashboard/contacts',
    matchPrefixesForRole: (role) =>
      role === 'tenant_admin'
        ? ['/dashboard/business/clients', '/dashboard/leads']
        : ['/dashboard/contacts', '/dashboard/leads'],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: CheckSquare,
    hrefForRole: () => '/dashboard/tasks',
    matchPrefixesForRole: () => ['/dashboard/tasks', '/dashboard/business/tasks'],
  },
  {
    id: 'calls',
    label: 'Calls',
    icon: Video,
    hrefForRole: (role) =>
      role === 'tenant_admin' ? '/dashboard/business/meetings' : '/dashboard/calendar',
    matchPrefixesForRole: () => ['/dashboard/business/meetings', '/dashboard/calendar', '/call'],
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: MessageSquare,
    hrefForRole: (role) =>
      role === 'tenant_admin' ? '/dashboard/business/messages' : '/dashboard/messages',
    matchPrefixesForRole: (role) =>
      role === 'tenant_admin' ? ['/dashboard/business/messages'] : ['/dashboard/messages'],
  },
  {
    id: 'invoices',
    label: 'Invoices',
    icon: DollarSign,
    hrefForRole: (role) =>
      role === 'tenant_admin' ? '/dashboard/business/billing' : '/dashboard/finance',
    matchPrefixesForRole: () => ['/dashboard/finance', '/dashboard/business/billing'],
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: Briefcase,
    hrefForRole: () => '/dashboard/projects',
    matchPrefixesForRole: () => ['/dashboard/projects', '/dashboard/business/projects'],
  },
  {
    id: 'social',
    label: 'Social',
    icon: Globe,
    hrefForRole: () => '/dashboard/business/social',
    matchPrefixesForRole: () => ['/dashboard/social', '/dashboard/business/social'],
  },
  {
    id: 'contracts',
    label: 'Contracts',
    icon: FileText,
    hrefForRole: () => '/dashboard/contracts',
    matchPrefixesForRole: () => ['/dashboard/contracts', '/dashboard/business/contracts'],
  },
  {
    id: 'deals',
    label: 'Deals',
    icon: Target,
    hrefForRole: () => '/dashboard/deals',
    matchPrefixesForRole: () => ['/dashboard/deals'],
  },
];

const DEFAULT_MODULE_IDS = ['home', 'crm', 'mail', 'clients'];

export function moduleDefToNavItem(def: PwaModuleDef, role: UserRole): PwaNavItem {
  return {
    moduleId: def.id,
    label: def.label,
    href: def.hrefForRole(role),
    icon: def.icon,
    matchPrefixes: def.matchPrefixesForRole?.(role) ?? [def.hrefForRole(role)],
  };
}

export function getDefaultBottomNavModuleIds(): string[] {
  return [...DEFAULT_MODULE_IDS];
}

export function resolveBottomNavItems(
  role: UserRole,
  selectedIds?: string[] | null,
): PwaNavItem[] {
  const ids = (selectedIds?.length ? selectedIds : DEFAULT_MODULE_IDS).slice(0, PWA_MAX_BOTTOM_SLOTS);
  const catalog = new Map(PWA_MODULE_CATALOG.map((m) => [m.id, m]));

  const items: PwaNavItem[] = [];
  for (const id of ids) {
    const def = catalog.get(id);
    if (def) items.push(moduleDefToNavItem(def, role));
  }

  if (items.length === 0) {
    return DEFAULT_MODULE_IDS.map((id) => moduleDefToNavItem(catalog.get(id)!, role));
  }

  return items;
}

export function isPwaNavActive(activeTab: string, item: PwaNavItem): boolean {
  if (activeTab === item.href) return true;
  if (item.moduleId === 'home') {
    return activeTab === '/dashboard' || activeTab === '/dashboard/business';
  }
  return (item.matchPrefixes ?? [item.href]).some((prefix) => activeTab.startsWith(prefix));
}

/** @deprecated Use resolveBottomNavItems */
export function getPwaBottomNavItems(userRole: UserRole = 'client'): PwaNavItem[] {
  return resolveBottomNavItems(userRole);
}
