import type { LucideIcon } from 'lucide-react';
import {
  Users,
  Receipt,
  FileText,
  Mail,
  Briefcase,
  CheckSquare,
  Globe,
  DollarSign,
  MessageCircle,
  Calendar,
  Bell,
  Target,
} from 'lucide-react';

export interface EmptyStateQuickAction {
  label: string;
  href?: string;
  onAction?: () => void;
}

export interface EmptyStatePreset {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  bonnieSuggestion?: string;
  quickActions?: EmptyStateQuickAction[];
  templateLinks?: { label: string; href: string }[];
  importOptions?: { label: string; description: string; href?: string }[];
}

export type EmptyStateModuleId =
  | 'crm'
  | 'invoices'
  | 'quotes'
  | 'contracts'
  | 'projects'
  | 'tasks'
  | 'campaigns'
  | 'social'
  | 'accounting'
  | 'messages'
  | 'calendar'
  | 'notifications'
  | 'deals'
  | 'clients'
  | 'forms'
  | 'documents';

export const EMPTY_STATE_PRESETS: Record<EmptyStateModuleId, EmptyStatePreset> = {
  crm: {
    icon: Users,
    title: 'Add your first customer',
    description: 'Start with one client — Bonnie can help you track conversations, deals, and follow-ups from here.',
    actionLabel: 'Add a customer',
    bonnieSuggestion: 'Ask Bonnie: "Help me add my first customer and set up follow-ups."',
    quickActions: [
      { label: 'Import contacts', href: '/dashboard/business/ingestion' },
      { label: 'Create from lead', href: '/dashboard/leads' },
    ],
    templateLinks: [{ label: 'Sample customer workflow', href: '/dashboard/help' }],
  },
  invoices: {
    icon: Receipt,
    title: 'Send your first invoice',
    description: 'Create a professional invoice with your branding. Clients can pay online from a secure link.',
    actionLabel: 'Create invoice',
    bonnieSuggestion: 'Bonnie can draft an invoice from a quote or contract — just ask.',
    quickActions: [
      { label: 'From quote', href: '/dashboard/business/quotes' },
      { label: 'Recurring invoice', href: '/dashboard/business/billing/manage' },
    ],
  },
  quotes: {
    icon: FileText,
    title: 'Create a quote or proposal',
    description: 'Send a polished sales document your client can review, accept, and sign online.',
    actionLabel: 'New quote',
    bonnieSuggestion: 'Bonnie can write a proposal from a deal — open a deal and ask for help.',
    templateLinks: [{ label: 'Browse templates', href: '/dashboard/business/documents' }],
  },
  contracts: {
    icon: FileText,
    title: 'Draft your first contract',
    description: 'Create a contract from a template, send for signature, and track status in one place.',
    actionLabel: 'New contract',
    bonnieSuggestion: 'After a quote is accepted, Bonnie can suggest generating a contract.',
    templateLinks: [{ label: 'Contract templates', href: '/dashboard/business/contracts/manage' }],
  },
  projects: {
    icon: Briefcase,
    title: 'Start a project',
    description: 'Link a client, tasks, and documents so you can track delivery from one workspace.',
    actionLabel: 'New project',
    bonnieSuggestion: 'When an invoice is paid, Bonnie can suggest creating a project.',
  },
  tasks: {
    icon: CheckSquare,
    title: 'Nothing due today — nice work',
    description: 'Add tasks to stay on top of follow-ups, deliveries, and daily priorities.',
    actionLabel: 'Add a task',
    bonnieSuggestion: 'Ask Bonnie to create tasks from a meeting or deal.',
  },
  campaigns: {
    icon: Mail,
    title: 'Launch your first campaign',
    description: 'Reach customers with branded emails. Start from a template or let Bonnie draft one.',
    actionLabel: 'Create campaign',
    bonnieSuggestion: 'Bonnie can suggest subject lines and write your first email.',
    templateLinks: [{ label: 'Email templates', href: '/dashboard/business/campaigns' }],
  },
  social: {
    icon: Globe,
    title: 'Schedule your first post',
    description: 'Connect a social account, compose a post, and preview before publishing.',
    actionLabel: 'Compose post',
    quickActions: [{ label: 'Connect LinkedIn', href: '/dashboard/business/linkedin' }],
  },
  accounting: {
    icon: DollarSign,
    title: 'Track money in and out',
    description: 'Connect banking or add your first transaction to see cash flow at a glance.',
    actionLabel: 'Add transaction',
    bonnieSuggestion: 'Bonnie can explain overdue invoices and bills to pay.',
    quickActions: [{ label: 'Connect bank', href: '/dashboard/accounting/banking' }],
  },
  messages: {
    icon: MessageCircle,
    title: 'Your inbox is clear',
    description: 'Connect email or WhatsApp to see all customer conversations in one timeline.',
    actionLabel: 'Open communication hub',
    quickActions: [
      { label: 'Connect email', href: '/dashboard/comms' },
      { label: 'Connect WhatsApp', href: '/dashboard/business/whatsapp' },
    ],
  },
  calendar: {
    icon: Calendar,
    title: 'Nothing scheduled yet',
    description: 'Add meetings, tasks, and deadlines to see your full business schedule.',
    actionLabel: 'Add event',
    quickActions: [{ label: 'Booking links', href: '/dashboard/business/booking' }],
  },
  notifications: {
    icon: Bell,
    title: "You're all caught up",
    description: 'Important alerts — overdue invoices, pending approvals, and customer replies — will appear here.',
    bonnieSuggestion: 'Bonnie sends proactive alerts when something needs your attention.',
  },
  deals: {
    icon: Target,
    title: 'Track your first deal',
    description: 'Move opportunities from first contact to signed contract with clear next steps.',
    actionLabel: 'Add a deal',
    bonnieSuggestion: 'Bonnie warns if a deal skips steps like proposal or contract.',
  },
  clients: {
    icon: Users,
    title: 'Build your client list',
    description: 'Every client gets a workspace with messages, invoices, contracts, and projects together.',
    actionLabel: 'Add client',
    importOptions: [{ label: 'CSV import', description: 'Upload a spreadsheet of contacts' }],
  },
  forms: {
    icon: FileText,
    title: 'Capture leads with a form',
    description: 'Create a branded form for your website. Submissions flow into CRM automatically.',
    actionLabel: 'Create form',
  },
  documents: {
    icon: FileText,
    title: 'Organize your business documents',
    description: 'Store contracts, proposals, and files linked to clients and projects.',
    actionLabel: 'Upload document',
    templateLinks: [{ label: 'Template library', href: '/dashboard/business/documents' }],
  },
};

export function getEmptyStatePreset(moduleId: EmptyStateModuleId): EmptyStatePreset {
  return EMPTY_STATE_PRESETS[moduleId];
}
