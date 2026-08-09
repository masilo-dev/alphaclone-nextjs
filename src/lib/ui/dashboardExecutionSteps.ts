import type { ExecutionDecisionStep } from '@/components/dashboard/ExecutionDecisionGuide';
import type { ModuleId } from '@/constants/brand';

export const BOOKING_EXECUTION_STEPS: ExecutionDecisionStep[] = [
  {
    id: 'booking-connect',
    label: 'Connect',
    title: 'Confirm booking source',
    description: 'Use native booking, Cal.com/Cal.diy, or Calendly and verify the public link is live.',
    status: 'active',
    href: '/dashboard/business/settings',
  },
  {
    id: 'booking-sync',
    label: 'Sync',
    title: 'Pull meetings into AlphaClone',
    description: 'Webhook and sync events should create calendar entries, leads, tasks, and notifications.',
    status: 'running',
    href: '/dashboard/business/calendar',
  },
  {
    id: 'booking-follow-up',
    label: 'Follow up',
    title: 'Convert the appointment',
    description: 'After the meeting, move the person into CRM, deals, or project delivery.',
    status: 'neutral',
    href: '/dashboard/crm/workspace',
  },
];

export const BILLING_MANAGER_EXECUTION_STEPS: ExecutionDecisionStep[] = [
  {
    id: 'billing-create',
    label: 'Create',
    title: 'Build the invoice',
    description: 'Choose client, invoice number, line items, due date, payment terms, and project link.',
    status: 'active',
  },
  {
    id: 'billing-send',
    label: 'Send',
    title: 'Email the secure client link',
    description: 'Send or resend the invoice, then watch sent, partial, paid, and overdue status.',
    status: 'running',
  },
  {
    id: 'billing-reconcile',
    label: 'Reconcile',
    title: 'Record money received',
    description: 'Log payments and keep paid so far, balance due, and accounting reports aligned.',
    status: 'neutral',
    href: '/dashboard/accounting',
  },
];

export const PROJECT_MANAGER_EXECUTION_STEPS: ExecutionDecisionStep[] = [
  {
    id: 'project-plan',
    label: 'Plan',
    title: 'Create the delivery record',
    description: 'Set client, owner, stage, deadline, milestones, portal password, and public link settings.',
    status: 'active',
  },
  {
    id: 'project-update',
    label: 'Update',
    title: 'Move stage and progress',
    description: 'Stage changes notify the owner and client portal while tasks keep the team moving.',
    status: 'running',
    href: '/dashboard/tasks',
  },
  {
    id: 'project-close',
    label: 'Close',
    title: 'Finish, invoice, and expire',
    description: 'Complete delivery, bill the remaining balance, and let the portal expiry protect the link.',
    status: 'neutral',
    href: '/dashboard/business/billing/manage',
  },
];

export const CRM_WORKSPACE_EXECUTION_STEPS: ExecutionDecisionStep[] = [
  {
    id: 'crm-capture',
    label: 'Capture',
    title: 'Add real contact details',
    description: 'Start with name plus email or phone, then enrich company and source.',
    status: 'active',
  },
  {
    id: 'crm-qualify',
    label: 'Qualify',
    title: 'Decide the next action',
    description: 'Call, email, note, or disqualify. Qualified leads should move toward a deal.',
    status: 'running',
    href: '/dashboard/deals',
  },
  {
    id: 'crm-deliver',
    label: 'Deliver',
    title: 'Turn work into revenue',
    description: 'Use quotes, invoices, projects, and booking links once the relationship is active.',
    status: 'neutral',
    href: '/dashboard/business/quotes',
  },
];

export const DEALS_EXECUTION_STEPS: ExecutionDecisionStep[] = [
  {
    id: 'deals-value',
    label: 'Value',
    title: 'Set amount and close date',
    description: 'Every deal should have an owner, value, expected close date, and next step.',
    status: 'active',
  },
  {
    id: 'deals-stage',
    label: 'Stage',
    title: 'Move the pipeline forward',
    description: 'Keep stages honest so forecast, CRM reports, and Bonnie advice stay useful.',
    status: 'running',
  },
  {
    id: 'deals-convert',
    label: 'Convert',
    title: 'Quote, invoice, or project',
    description: 'Won deals should create the next business object instead of sitting in the board.',
    status: 'neutral',
    href: '/dashboard/business/quotes',
  },
];

export const TASKS_EXECUTION_STEPS: ExecutionDecisionStep[] = [
  {
    id: 'tasks-triage',
    label: 'Triage',
    title: 'Sort today’s work',
    description: 'Check overdue, due today, and blocked tasks before adding new work.',
    status: 'warning',
  },
  {
    id: 'tasks-execute',
    label: 'Execute',
    title: 'Complete or reassign',
    description: 'Move tasks forward with owner, due date, notes, and linked project/client context.',
    status: 'running',
  },
  {
    id: 'tasks-confirm',
    label: 'Confirm',
    title: 'Verify the record moved',
    description: 'Return to projects, CRM, or billing to confirm progress updated where it matters.',
    status: 'neutral',
    href: '/dashboard/business/projects/manage',
  },
];

export const HUB_EXECUTION_STEPS: Partial<Record<ModuleId, ExecutionDecisionStep[]>> = {
  crm: [
    {
      id: 'hub-sales-record',
      label: 'Record',
      title: 'Capture the customer signal',
      description: 'Start with leads, contacts, company records, activities, or tasks so sales work has source data.',
      status: 'active',
      href: '/dashboard/crm/workspace',
    },
    {
      id: 'hub-sales-move',
      label: 'Move',
      title: 'Advance the relationship',
      description: 'Qualify, follow up, create deals, and keep stages aligned with the real conversation.',
      status: 'running',
      href: '/dashboard/deals',
    },
    {
      id: 'hub-sales-close',
      label: 'Close',
      title: 'Convert into money or delivery',
      description: 'Use quotes, invoices, projects, and bookings once the opportunity is ready.',
      status: 'neutral',
      href: '/dashboard/business/quotes',
    },
  ],
  money: [
    {
      id: 'hub-money-review',
      label: 'Review',
      title: 'Check cash position',
      description: 'Read accounting, banking, bills, expenses, invoice aging, and cash flow before making changes.',
      status: 'active',
      href: '/dashboard/accounting',
    },
    {
      id: 'hub-money-collect',
      label: 'Collect',
      title: 'Send and chase revenue',
      description: 'Create invoices, send reminders, track partial payments, and keep balances accurate.',
      status: 'running',
      href: '/dashboard/business/billing/manage',
    },
    {
      id: 'hub-money-reconcile',
      label: 'Reconcile',
      title: 'Match records to reality',
      description: 'Keep vendors, bills, expenses, tax, and reports aligned with payment activity.',
      status: 'neutral',
      href: '/dashboard/accounting/banking',
    },
  ],
  marketing: [
    {
      id: 'hub-marketing-plan',
      label: 'Plan',
      title: 'Choose audience and message',
      description: 'Use campaigns, forms, and CRM context to pick who should hear from you next.',
      status: 'active',
      href: '/dashboard/business/campaigns',
    },
    {
      id: 'hub-marketing-publish',
      label: 'Publish',
      title: 'Send, schedule, or post',
      description: 'Launch email, SMS, social, or form workflows from the correct channel page.',
      status: 'running',
      href: '/dashboard/business/social/compose',
    },
    {
      id: 'hub-marketing-convert',
      label: 'Convert',
      title: 'Feed response back to sales',
      description: 'Move replies, submissions, and engagement into CRM leads, contacts, deals, or tasks.',
      status: 'neutral',
      href: '/dashboard/crm/workspace',
    },
  ],
  reports: [
    {
      id: 'hub-reports-read',
      label: 'Read',
      title: 'Find the strongest signal',
      description: 'Use executive, analytics, performance, reports, and notifications to decide what needs attention.',
      status: 'active',
      href: '/dashboard/executive',
    },
    {
      id: 'hub-reports-investigate',
      label: 'Inspect',
      title: 'Open the source module',
      description: 'Jump from a metric to CRM, billing, projects, marketing, or support before acting.',
      status: 'running',
      href: '/dashboard/analytics',
    },
    {
      id: 'hub-reports-confirm',
      label: 'Confirm',
      title: 'Verify the change',
      description: 'After work is done, come back to confirm the number, status, or alert moved.',
      status: 'neutral',
      href: '/dashboard/performance',
    },
  ],
  documents: [
    {
      id: 'hub-docs-create',
      label: 'Create',
      title: 'Prepare the file or contract',
      description: 'Start from documents, vault, contracts, projects, onboarding, or page assets.',
      status: 'active',
      href: '/dashboard/business/documents',
    },
    {
      id: 'hub-docs-send',
      label: 'Send',
      title: 'Share with the right person',
      description: 'Use contract manager, project portal, onboarding, or page links with controlled access.',
      status: 'running',
      href: '/dashboard/business/contracts/manage',
    },
    {
      id: 'hub-docs-expire',
      label: 'Protect',
      title: 'Audit and expire access',
      description: 'Keep signed files, portal passwords, expiry dates, and client visibility under control.',
      status: 'neutral',
      href: '/dashboard/business/vault',
    },
  ],
  email: [
    {
      id: 'hub-channels-triage',
      label: 'Triage',
      title: 'Read inbound work',
      description: 'Check tickets, team messages, mail, and WhatsApp before sending new communication.',
      status: 'active',
      href: '/dashboard/mail',
    },
    {
      id: 'hub-channels-reply',
      label: 'Reply',
      title: 'Answer or assign',
      description: 'Reply, create a task, open a ticket, or route the conversation to the right owner.',
      status: 'running',
      href: '/dashboard/business/tickets',
    },
    {
      id: 'hub-channels-log',
      label: 'Log',
      title: 'Attach the conversation',
      description: 'Connect useful conversations to CRM, projects, invoices, or support history.',
      status: 'neutral',
      href: '/dashboard/crm/workspace',
    },
  ],
  calendar: [
    {
      id: 'hub-schedule-plan',
      label: 'Plan',
      title: 'Choose the time workflow',
      description: 'Use calendar, booking, meetings, or Teams depending on whether it is internal or client-facing.',
      status: 'active',
      href: '/dashboard/business/calendar',
    },
    {
      id: 'hub-schedule-book',
      label: 'Book',
      title: 'Create or sync the event',
      description: 'Booking webhooks should update calendar, CRM, tasks, and client notifications.',
      status: 'running',
      href: '/dashboard/business/booking',
    },
    {
      id: 'hub-schedule-follow',
      label: 'Follow up',
      title: 'Turn meetings into records',
      description: 'After the call, update CRM, deal, project, invoice, or support context.',
      status: 'neutral',
      href: '/dashboard/crm/workspace',
    },
  ],
  nexus: [
    {
      id: 'hub-nexus-connect',
      label: 'Connect',
      title: 'Configure the system',
      description: 'Use marketplace, workflows, settings, jobs, help, and Zoho sync to wire operations together.',
      status: 'active',
      href: '/dashboard/marketplace',
    },
    {
      id: 'hub-nexus-verify',
      label: 'Verify',
      title: 'Check health and queues',
      description: 'Review jobs, quotas, webhooks, provider status, and automation output before scaling.',
      status: 'running',
      href: '/dashboard/jobs',
    },
    {
      id: 'hub-nexus-operate',
      label: 'Operate',
      title: 'Run the connected workflow',
      description: 'Once configured, let workflows move data between booking, CRM, mail, projects, and billing.',
      status: 'neutral',
      href: '/dashboard/business/workflows',
    },
  ],
};
