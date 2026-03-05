

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
  FolderOpen
} from 'lucide-react';
import { NavItem, DashboardStat } from './types';

export const APP_NAME = "AlphaClone Systems";

export const LOGO_URL = "/logo.png";

// --- CLIENT NAVIGATION ---
export const CLIENT_NAV_ITEMS: NavItem[] = [
  { label: 'Business Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Mission Control', href: '/dashboard/projects', icon: Briefcase },
  { label: 'Operations Calendar', href: '/dashboard/calendar', icon: Calendar },
  { label: 'High-Definition Ops', href: '/dashboard/conference', icon: Video },
  { label: 'Communication Hub', href: '/dashboard/messages', icon: MessageSquare },
  { label: 'Email Sync (Gmail)', href: '/dashboard/gmail', icon: Mail },
  { label: 'Revenue & Payments', href: '/dashboard/finance', icon: DollarSign },
  { label: 'Agreement Lifecycle', href: '/dashboard/contracts', icon: FileText },
  { label: 'Creative Intel Lab', href: '/dashboard/ai-studio', icon: Palette, comingSoon: true },
  { label: 'Operational Request', href: '/dashboard/submit', icon: FileText },
  { label: 'System Settings', href: '/dashboard/settings', icon: Settings },
];

// --- ADMIN NAVIGATION ---
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Platform Command', href: '/dashboard/admin/tenants', icon: Users },

  { label: 'Command Center', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Live Operations', href: '/dashboard/analytics', icon: Activity },
  {
    label: 'Unified Intelligence',
    href: '#',
    icon: Users,
    subItems: [
      { label: 'Intelligence CRM', href: '/dashboard/clients' },
      { label: 'Autonomous Growth', href: '/dashboard/sales-agent' },
      { label: 'Mission Control', href: '/dashboard/projects' },
      { label: 'Onboarding Pipelines', href: '/dashboard/onboarding' },
    ]
  },
  {
    label: 'Communication',
    href: '#',
    icon: MessageSquare,
    subItems: [
      { label: 'Calendar', href: '/dashboard/calendar' },
      { label: 'Meetings', href: '/dashboard/meetings' },
      { label: 'Gmail', href: '/dashboard/gmail' },
      { label: 'Inbox', href: '/dashboard/messages' },
    ]
  },
  {
    label: 'Creative Intel',
    href: '#',
    icon: Layers,
    subItems: [
      { label: 'SEO Engine', href: '/dashboard/articles' },
      { label: 'Portfolio Ops', href: '/dashboard/portfolio-manager' },
      { label: 'Resource Allocation', href: '/dashboard/allocation' },
      { label: 'System Improvements', href: '/dashboard/admin/improvements' },
    ]
  },
  {
    label: 'Enterprise CRM',
    href: '#',
    icon: TrendingUp,
    subItems: [
      { label: 'Tasks', href: '/dashboard/tasks' },
      { label: 'Deals Pipeline', href: '/dashboard/deals' },
      { label: 'Sales Forecast', href: '/dashboard/forecast' },
    ]
  },
  { label: 'Contracts', href: '/dashboard/contracts', icon: FileText },
  { label: 'Financials', href: '/dashboard/finance', icon: DollarSign },
  { label: 'Security (SIEM)', href: '/dashboard/security', icon: ShieldCheck },
];

// --- TENANT ADMIN NAVIGATION (Business Dashboard) ---
export const TENANT_ADMIN_NAV_ITEMS: NavItem[] = [
  // 1. Overview
  { label: 'Business Command', href: '/dashboard', icon: LayoutDashboard },

  // 2. Acquisition & Sales Pipeline
  { label: 'Autonomous Growth', href: '/dashboard/sales-agent', icon: Zap },
  { label: 'Growth Pipeline', href: '/dashboard/leads', icon: TrendingUp },
  { label: 'Unified Client Intel', href: '/dashboard/crm', icon: Users },

  // 3. Communication & Scheduling
  { label: 'Email Sync', href: '/dashboard/gmail', icon: Mail },
  { label: 'Ops Calendar', href: '/dashboard/business/calendar', icon: Calendar },
  { label: 'Auto-Booking', href: '/dashboard/business/booking', icon: Clock },
  { label: 'Huddle / Meetings', href: '/dashboard/business/meetings', icon: Video },

  // 4. Closing & Agreements
  { label: 'Revenue Quotes', href: '/dashboard/business/quotes', icon: FileText },
  { label: 'Agreement Lifecycle', href: '/dashboard/business/contracts', icon: FileText },

  // 5. Execution & Fulfillment 
  { label: 'Mission Control', href: '/dashboard/business/projects', icon: Briefcase },
  { label: 'Task Execution', href: '/dashboard/tasks', icon: CheckSquare },

  // 6. Finances & Records
  { label: 'Revenue Center', href: '/dashboard/business/billing', icon: DollarSign },
  { label: 'Profit & Loss Intel', href: '/dashboard/accounting', icon: BarChart3 },
  { label: 'Unified Doc Hub', href: '/dashboard/business/documents', icon: FolderOpen },

  // 7. Administration
  { label: 'System Settings', href: '/dashboard/business/settings', icon: Settings },
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