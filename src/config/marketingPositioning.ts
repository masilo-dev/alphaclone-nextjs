/**
 * Approval-led business workflow positioning (public marketing SSOT).
 * Use these strings instead of hard-coding hero/CTA copy across pages.
 */

export const EXECUTION_LAYER = {
  category: 'Business workflows with an approval trail',
  primaryLine: 'Turn an approved instruction into accountable business work.',
  categoryLine: 'Connect the decision to the action.',
  problemLine: 'Your systems hold the data. Your team still carries the handoffs.',
  explanatoryLine:
    'AlphaClone connects ChatGPT, Claude, and other compatible AI interfaces to the systems that run your business—so an approved instruction can update a CRM record, prepare an email, create an invoice, or start a follow-up workflow.',
  differentiationLine:
    'AI provides the intelligence and conversation. AlphaClone provides business context, permissions, workflows, execution, and verification.',
  mechanism: ['Decide', 'Approve', 'Execute', 'Verify'] as const,
  heroHeadline: 'Connect the decision to the action.',
  heroSubhead:
    'AlphaClone connects ChatGPT, Claude, and other AI assistants to the applications that run your business—so an approved instruction can update records, prepare communications, create invoices, and start follow-up workflows.',
  primaryCta: 'Start with AlphaClone',
  secondaryCta: 'Watch AlphaClone Execute',
  executionSessionPath: '/execution-session',
  howItWorksPath: '/how-it-works',
  reliabilityPath: '/reliability',
} as const;

/** Anchor workflow for demos and first-session offer */
export const ANCHOR_WORKFLOW = {
  id: 'quote-to-cash',
  title: 'Quote to cash',
  summary:
    'Create an invoice on the client record, send it with a payment link, and track payment status — without re-entering details in another app.',
  steps: [
    'Select the client or deal in CRM',
    'Create or confirm the invoice',
    'Review before send (approval)',
    'Send with PDF and payment link',
    'Verify delivery and payment status',
  ],
} as const;
