import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Users, Mail, UserCircle } from 'lucide-react';
import type { UserRole } from '@/types';

/** Max 1-word labels for PWA bottom bar and launcher tiles. */
export interface PwaNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  matchPrefixes?: string[];
}

export function getPwaBottomNavItems(userRole: UserRole = 'client'): PwaNavItem[] {
  const isTenantAdmin = userRole === 'tenant_admin';
  const clientsPath = isTenantAdmin ? '/dashboard/business/clients' : '/dashboard/contacts';
  const mailPath = isTenantAdmin ? '/dashboard/mail' : '/dashboard/mail';

  return [
    { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
    { label: 'CRM', href: '/dashboard/crm', icon: Users, matchPrefixes: ['/dashboard/crm'] },
    { label: 'Mail', href: mailPath, icon: Mail, matchPrefixes: ['/dashboard/mail', '/dashboard/messages'] },
    { label: 'Clients', href: clientsPath, icon: UserCircle, matchPrefixes: [clientsPath, '/dashboard/leads', '/dashboard/contacts'] },
  ];
}

export function isPwaNavActive(activeTab: string, item: PwaNavItem): boolean {
  if (activeTab === item.href) return true;
  if (item.href === '/dashboard') return activeTab === '/dashboard' || activeTab === '/dashboard/business';
  return (item.matchPrefixes ?? [item.href]).some((prefix) => activeTab.startsWith(prefix));
}
