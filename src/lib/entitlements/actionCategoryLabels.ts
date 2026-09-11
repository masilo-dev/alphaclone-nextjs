import type { QuotaResourceType } from '@/services/quotaService';

/** Human-readable labels aligned across dashboard, pricing, MCP errors, and Bonnie. */
export const ACTION_CATEGORY_LABELS: Record<QuotaResourceType, { label: string; icon: string; group: string }> = {
  leads: { label: 'Leads Added', icon: '👥', group: 'CRM & Leads' },
  outreach_actions: { label: 'Outreach Actions', icon: '⚡', group: 'Outreach' },
  linkedin_posts: { label: 'Social Publishing', icon: '📣', group: 'Social' },
  facebook_posts: { label: 'Social Publishing', icon: '📣', group: 'Social' },
  instagram_posts: { label: 'Social Publishing', icon: '📣', group: 'Social' },
  emails_sent: { label: 'Emails Sent', icon: '📤', group: 'Email' },
  email_replies: { label: 'Email Replies', icon: '↩️', group: 'Email' },
  email_transactional: { label: 'Transactional Emails', icon: '🧾', group: 'Email' },
  email_actions: { label: 'Email Actions (legacy)', icon: '✉️', group: 'Email' },
  mcp_executions: { label: 'MCP / Automation Executions', icon: '🤖', group: 'MCP & Agents' },
  contracts: { label: 'Contracts & Proposals', icon: '📄', group: 'Documents' },
  invoices: { label: 'Invoices & Quotations', icon: '🧾', group: 'Documents' },
  receipts: { label: 'Receipts & Payments', icon: '💳', group: 'Documents' },
};

/** Primary metrics shown in usage dashboard (deduplicated groups). */
export const PRIMARY_USAGE_METRICS: QuotaResourceType[] = [
  'emails_sent',
  'leads',
  'mcp_executions',
  'outreach_actions',
  'linkedin_posts',
  'contracts',
  'invoices',
];
