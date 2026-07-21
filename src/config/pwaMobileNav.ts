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
  tileBg: string;
  tileBgMuted: string;
  labelActive: string;
  hrefForRole: (role: UserRole) => string;
  matchPrefixesForRole?: (role: UserRole) => string[];
}

export interface PwaNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  matchPrefixes?: string[];
  moduleId: string;
  tileBg: string;
  tileBgMuted: string;
  labelActive: string;
}

export const PWA_MAX_BOTTOM_SLOTS = 4;

export const PWA_MODULE_CATALOG: PwaModuleDef[] = [
  {
    id: 'home',
    label: 'Home',
    icon: LayoutDashboard,
    tileBg: 'bg-cyan-500',
    tileBgMuted: 'bg-cyan-500/20',
    labelActive: 'text-cyan-400',
    hrefForRole: () => '/dashboard',
    matchPrefixesForRole: () => ['/dashboard', '/dashboard/business'],
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: Users,
    tileBg: 'bg-orange-500',
    tileBgMuted: 'bg-orange-500/20',
    labelActive: 'text-orange-400',
    hrefForRole: () => '/dashboard/crm',
    matchPrefixesForRole: () => ['/dashboard/crm'],
  },
  {
    id: 'mail',
    label: 'Mail',
    icon: Mail,
    tileBg: 'bg-green-500',
    tileBgMuted: 'bg-green-500/20',
    labelActive: 'text-green-400',
    hrefForRole: () => '/dashboard/mail',
    matchPrefixesForRole: () => ['/dashboard/mail'],
  },
  {
    id: 'clients',
    label: 'Clients',
    icon: UserCircle,
    tileBg: 'bg-blue-500',
    tileBgMuted: 'bg-blue-500/20',
    labelActive: 'text-blue-400',
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
    tileBg: 'bg-rose-500',
    tileBgMuted: 'bg-rose-500/20',
    labelActive: 'text-rose-400',
    hrefForRole: () => '/dashboard/tasks',
    matchPrefixesForRole: () => ['/dashboard/tasks', '/dashboard/business/tasks'],
  },
  {
    id: 'calls',
    label: 'Calls',
    icon: Video,
    tileBg: 'bg-purple-500',
    tileBgMuted: 'bg-purple-500/20',
    labelActive: 'text-purple-400',
    hrefForRole: (role) =>
      role === 'tenant_admin' ? '/dashboard/business/meetings' : '/dashboard/calendar',
    matchPrefixesForRole: () => ['/dashboard/business/meetings', '/dashboard/calendar', '/call'],
  },
  {
    id: 'chat',
    label: 'Messages',
    icon: MessageSquare,
    tileBg: 'bg-emerald-500',
    tileBgMuted: 'bg-emerald-500/20',
    labelActive: 'text-emerald-400',
    hrefForRole: (role) =>
      role === 'tenant_admin' ? '/dashboard/business/messages' : '/dashboard/messages',
    matchPrefixesForRole: (role) =>
      role === 'tenant_admin' ? ['/dashboard/business/messages'] : ['/dashboard/messages'],
  },
  {
    id: 'invoices',
    label: 'Invoices',
    icon: DollarSign,
    tileBg: 'bg-amber-500',
    tileBgMuted: 'bg-amber-500/20',
    labelActive: 'text-amber-400',
    hrefForRole: (role) =>
      role === 'tenant_admin' ? '/dashboard/business/billing' : '/dashboard/finance',
    matchPrefixesForRole: () => ['/dashboard/finance', '/dashboard/business/billing'],
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: Briefcase,
    tileBg: 'bg-rose-600',
    tileBgMuted: 'bg-rose-600/20',
    labelActive: 'text-rose-300',
    hrefForRole: () => '/dashboard/projects',
    matchPrefixesForRole: () => ['/dashboard/projects', '/dashboard/business/projects'],
  },
  {
    id: 'social',
    label: 'Social',
    icon: Globe,
    tileBg: 'bg-indigo-500',
    tileBgMuted: 'bg-indigo-500/20',
    labelActive: 'text-indigo-400',
    hrefForRole: () => '/dashboard/business/social',
    matchPrefixesForRole: () => ['/dashboard/social', '/dashboard/business/social'],
  },
  {
    id: 'contracts',
    label: 'Contracts',
    icon: FileText,
    tileBg: 'bg-slate-500',
    tileBgMuted: 'bg-slate-500/20',
    labelActive: 'text-slate-300',
    hrefForRole: () => '/dashboard/contracts',
    matchPrefixesForRole: () => ['/dashboard/contracts', '/dashboard/business/contracts'],
  },
  {
    id: 'deals',
    label: 'Deals',
    icon: Target,
    tileBg: 'bg-teal-500',
    tileBgMuted: 'bg-teal-500/20',
    labelActive: 'text-teal-400',
    hrefForRole: () => '/dashboard/deals',
    matchPrefixesForRole: () => ['/dashboard/deals'],
  },
];

const DEFAULT_MODULE_IDS = ['home', 'crm', 'mail', 'clients'];
/** Phone browser: keep bottom bar home-first; full modules stay in the More menu. */
const PHONE_BROWSER_DEFAULT_MODULE_IDS = ['home'];

export function moduleDefToNavItem(def: PwaModuleDef, role: UserRole): PwaNavItem {
  return {
    moduleId: def.id,
    label: def.label,
    href: def.hrefForRole(role),
    icon: def.icon,
    matchPrefixes: def.matchPrefixesForRole?.(role) ?? [def.hrefForRole(role)],
    tileBg: def.tileBg,
    tileBgMuted: def.tileBgMuted,
    labelActive: def.labelActive,
  };
}

export function getDefaultBottomNavModuleIds(isPwa = true): string[] {
  return [...(isPwa ? DEFAULT_MODULE_IDS : PHONE_BROWSER_DEFAULT_MODULE_IDS)];
}

export function resolveBottomNavItems(
  role: UserRole,
  selectedIds?: string[] | null,
  options?: { isPwa?: boolean },
): PwaNavItem[] {
  const isPwa = options?.isPwa !== false;
  const fallbackIds = getDefaultBottomNavModuleIds(isPwa);
  // Custom bottom slots only apply inside the installed PWA.
  const ids = (isPwa && selectedIds?.length ? selectedIds : fallbackIds).slice(0, PWA_MAX_BOTTOM_SLOTS);
  const catalog = new Map(PWA_MODULE_CATALOG.map((m) => [m.id, m]));

  const items: PwaNavItem[] = [];
  for (const id of ids) {
    const def = catalog.get(id);
    if (def) items.push(moduleDefToNavItem(def, role));
  }

  if (items.length === 0) {
    return fallbackIds.map((id) => moduleDefToNavItem(catalog.get(id)!, role));
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
