

import {
  LayoutDashboard,
  MessageSquare,
  Briefcase,
  Settings,
  Users,
  ShieldCheck,
  Video,
  Calendar,
  FileText,
  DollarSign,
  Activity,
  Clock,
  Layers,
  Palette,
  CheckSquare,
  TrendingUp,
  Mail,
  Zap,
  BarChart3,
  MapPin,
  FolderOpen,
  Presentation
} from 'lucide-react';
import { NavItem, DashboardStat } from './types';

export const APP_NAME = "AlphaClone Systems";

export const LOGO_URL = "/logo.png";

// --- CLIENT NAVIGATION ---
export const CLIENT_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', href: '/dashboard/projects', icon: Briefcase },
  { label: 'Calendar', href: '/dashboard/calendar', icon: Calendar },
  { label: 'Meetings', href: '/dashboard/conference', icon: Video },
  { label: 'Messages', href: '/dashboard/messages', icon: MessageSquare },
  { label: 'Mail', href: '/dashboard/mail', icon: Mail },
  { label: 'Finance', href: '/dashboard/finance', icon: DollarSign },
  { label: 'Contracts', href: '/dashboard/contracts', icon: FileText },
  { label: 'Creative Intel Lab', href: '/dashboard/ai-studio', icon: Palette },
  { label: 'Documents', href: '/dashboard/submit', icon: FileText },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

// --- ADMIN NAVIGATION ---
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Tenants', href: '/dashboard/admin/tenants', icon: Users },
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Live Stats', href: '/dashboard/analytics', icon: Activity },
  {
    label: 'Communication',
    href: '#',
    icon: MessageSquare,
    subItems: [
      { label: 'Calendar', href: '/dashboard/calendar' },
      { label: 'Meetings', href: '/dashboard/meetings' },
      { label: 'Mail', href: '/dashboard/mail' },
      { label: 'Messages', href: '/dashboard/messages' },
    ]
  },
  {
    label: 'Creative Intel',
    href: '#',
    icon: Layers,
    subItems: [
      { label: 'SEO', href: '/dashboard/articles' },
      { label: 'Allocation', href: '/dashboard/allocation' },
      { label: 'Improvements', href: '/dashboard/admin/improvements' },
    ]
  },
  {
    label: 'Enterprise CRM',
    href: '#',
    icon: TrendingUp,
    subItems: [
      { label: 'Tasks', href: '/dashboard/tasks' },
      { label: 'Deals', href: '/dashboard/deals' },
      { label: 'Forecast', href: '/dashboard/forecast' },
    ]
  },
  { label: 'Contracts', href: '/dashboard/contracts', icon: FileText },
  { label: 'Finance', href: '/dashboard/finance', icon: DollarSign },
  { label: 'Global Settings', href: '/dashboard/admin/settings', icon: Settings },
  { label: 'Security', href: '/dashboard/security', icon: ShieldCheck },
];

// --- TENANT_ADMIN NAVIGATION (Business Dashboard) ---
export const TENANT_ADMIN_NAV_ITEMS: NavItem[] = [
  // 1. Overview
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },

  // 2. Acquisition & Sales Pipeline
  { label: 'AI Growth', href: '/dashboard/sales-agent', icon: Zap },
  { label: 'Leads', href: '/dashboard/leads', icon: TrendingUp },
  { label: 'Contacts', href: '/dashboard/crm', icon: Users },

  // 3. Communication & Scheduling
  { label: 'Mail', href: '/dashboard/mail', icon: Mail },
  { label: 'Team Chat', href: '/dashboard/business/team-chat', icon: MessageSquare },
  { label: 'Calendar', href: '/dashboard/business/calendar', icon: Calendar },
  { label: 'Booking', href: '/dashboard/business/booking', icon: Clock },
  { label: 'Meetings', href: '/dashboard/business/meetings', icon: Video },

  // 4. Closing & Agreements
  { label: 'Quotes', href: '/dashboard/business/quotes', icon: FileText },
  { label: 'Contracts', href: '/dashboard/business/contracts', icon: FileText },

  // 5. Execution & Fulfillment 
  { label: 'Projects', href: '/dashboard/business/projects', icon: Briefcase },
  { label: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare },
  { label: 'Task Scheduler', href: '/dashboard/business/tasks', icon: Clock },
  { label: 'Resource Allocation', href: '/dashboard/business/resources', icon: TrendingUp },

  // 6. Finances & Records
  { label: 'Invoices', href: '/dashboard/business/billing', icon: DollarSign },
  { label: 'Finance', href: '/dashboard/accounting', icon: BarChart3 },
  { label: 'Documents', href: '/dashboard/business/documents', icon: FolderOpen },

  // 7. Integrations
  { label: 'Zoho CRM', href: '/dashboard/business/zoho', icon: Zap },

  // 8. Usage & Limits
  { label: 'Quota Manager', href: '/dashboard/business/quotas', icon: BarChart3 },
  { label: 'Presentations', href: '/dashboard/business/presentations', icon: Presentation },
  { label: 'Documents', href: '/dashboard/business/documents', icon: FileText },

  // 9. Daily Summary
  { label: 'Daily Summary', href: '/dashboard/business/daily-summary', icon: BarChart3 },

  // 10. Administration
  { label: 'Settings', href: '/dashboard/business/settings', icon: Settings },
];


export const ADMIN_STATS: DashboardStat[] = [
  { label: 'Total Clients', value: '24', icon: Users, color: 'bg-indigo-600' },
  { label: 'Active Projects', value: '18', icon: Briefcase, color: 'bg-teal-600' },
  { label: 'Revenue (MTD)', value: '$124k', icon: DollarSign, color: 'bg-green-600' },
  { label: 'System Health', value: '99.9%', icon: Activity, color: 'bg-rose-600' },
];

export const CLIENT_STATS: DashboardStat[] = [
  { label: 'Active Projects', value: '1', icon: Briefcase, color: 'bg-teal-600' },
  { label: 'Pending Invoices', value: '1', icon: DollarSign, color: 'bg-yellow-600' },
  { label: 'Unread Messages', value: '3', icon: MessageSquare, color: 'bg-blue-600' },
  { label: 'Upcoming Meetings', value: '2', icon: Video, color: 'bg-purple-600' },
];