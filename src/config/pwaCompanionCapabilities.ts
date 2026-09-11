export type MobileCapabilityLevel = 'FULL' | 'COMPANION' | 'READ_ONLY' | 'DESKTOP';

export type CompanionModuleId =
  | 'home'
  | 'bonnie'
  | 'notifications'
  | 'calendar'
  | 'tasks'
  | 'projects'
  | 'crm'
  | 'leads'
  | 'invoices'
  | 'quotes'
  | 'contracts'
  | 'social'
  | 'documents'
  | 'marketing'
  | 'money'
  | 'reporting'
  | 'goals'
  | 'nexus'
  | 'control'
  | 'settings'
  | 'admin'
  | 'bulk_operations'
  | 'workflow_builders'
  | 'advanced_configuration';

export interface CompanionCapability {
  level: MobileCapabilityLevel;
  quickActions: string[];
  desktopReason?: string;
}

export const PWA_COMPANION_CAPABILITIES: Record<CompanionModuleId, CompanionCapability> = {
  home: { level: 'FULL', quickActions: ['view_attention', 'view_today', 'quick_create', 'ask_bonnie'] },
  bonnie: { level: 'FULL', quickActions: ['ask', 'summarize', 'prepare_action', 'approve_safe_action'] },
  notifications: { level: 'FULL', quickActions: ['view', 'deep_link', 'mark_read'] },
  calendar: { level: 'FULL', quickActions: ['today', 'upcoming', 'create_event', 'book_meeting', 'reschedule'] },
  tasks: { level: 'FULL', quickActions: ['view', 'create', 'complete', 'change_status', 'comment'] },
  projects: { level: 'COMPANION', quickActions: ['view_health', 'view_tasks', 'view_milestones', 'comment', 'approve', 'ask_bonnie'], desktopReason: 'Advanced project controls are available on desktop.' },
  crm: { level: 'COMPANION', quickActions: ['search', 'view_client', 'add_contact', 'add_note', 'follow_up', 'ask_bonnie'], desktopReason: 'Advanced CRM controls are available on desktop.' },
  leads: { level: 'COMPANION', quickActions: ['search', 'view', 'add', 'change_status', 'note', 'approved_outreach'], desktopReason: 'Bulk lead generation and advanced campaign controls are available on desktop.' },
  invoices: { level: 'COMPANION', quickActions: ['view', 'create_draft', 'send_approved', 'view_payment', 'download'], desktopReason: 'Advanced finance controls are available on desktop.' },
  quotes: { level: 'COMPANION', quickActions: ['view', 'view_status', 'approve', 'remind', 'ask_bonnie'], desktopReason: 'Complex quote editing is available on desktop.' },
  contracts: { level: 'COMPANION', quickActions: ['view', 'view_signature', 'approve', 'remind', 'ask_bonnie'], desktopReason: 'Complex legal editing is available on desktop.' },
  social: { level: 'COMPANION', quickActions: ['view_scheduled', 'view_status', 'create_simple', 'preview', 'approve', 'publish'], desktopReason: 'Advanced content planning and analytics are available on desktop.' },
  documents: { level: 'COMPANION', quickActions: ['browse', 'search', 'preview', 'upload', 'share', 'summarize'], desktopReason: 'For full document editing, open AlphaClone on desktop.' },
  marketing: { level: 'COMPANION', quickActions: ['view_campaigns', 'view_stats', 'preview', 'approve', 'pause_resume_safe'], desktopReason: 'Campaign builders and advanced segmentation are available on desktop.' },
  money: { level: 'COMPANION', quickActions: ['revenue_summary', 'view_invoices', 'view_payments', 'view_overdue', 'ask_bonnie'], desktopReason: 'Accounting setup, reconciliation and bulk finance operations are available on desktop.' },
  reporting: { level: 'READ_ONLY', quickActions: ['view_summary'], desktopReason: 'Interactive reporting and report configuration are available on desktop.' },
  goals: { level: 'COMPANION', quickActions: ['view', 'update_progress', 'ask_bonnie'] },
  nexus: { level: 'READ_ONLY', quickActions: ['status', 'executions', 'failures', 'safe_retry'], desktopReason: 'Integration and workflow configuration is available on desktop.' },
  control: { level: 'READ_ONLY', quickActions: ['system_status', 'business_logs', 'automation_health', 'safe_retry'], desktopReason: 'Infrastructure and control configuration is available on desktop.' },
  settings: { level: 'COMPANION', quickActions: ['profile', 'notifications', 'basic_preferences'], desktopReason: 'Advanced workspace administration is available on desktop.' },
  admin: { level: 'DESKTOP', quickActions: [], desktopReason: 'Admin and Super Admin controls are available on desktop.' },
  bulk_operations: { level: 'DESKTOP', quickActions: [], desktopReason: 'Large bulk operations are available on desktop.' },
  workflow_builders: { level: 'DESKTOP', quickActions: [], desktopReason: 'Workflow builders are available on desktop.' },
  advanced_configuration: { level: 'DESKTOP', quickActions: [], desktopReason: 'Advanced configuration is available on desktop.' },
};

export function getCompanionCapability(moduleId: CompanionModuleId): CompanionCapability {
  return PWA_COMPANION_CAPABILITIES[moduleId];
}

export function isDesktopFirst(moduleId: CompanionModuleId): boolean {
  return PWA_COMPANION_CAPABILITIES[moduleId].level === 'DESKTOP';
}
