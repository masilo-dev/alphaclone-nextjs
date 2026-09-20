/**
 * Approval-led business workflow positioning (public marketing SSOT).
 * Use these strings instead of hard-coding hero/CTA copy across pages.
 */

export const EXECUTION_LAYER = {
  category: 'The execution layer between AI and business systems',
  primaryLine: 'Turn AI instructions into real business actions—with every decision owned.',
  categoryLine: 'Connect the decision to the action.',
  problemLine: 'Your systems hold the data. Your team still carries the handoffs.',
  explanatoryLine:
    'AI can understand what you want. AlphaClone connects that intent to CRM, email, social, projects, contracts, invoices, and other business systems—so approved work can run and be verified.',
  differentiationLine:
    'AI provides the intelligence and conversation. AlphaClone provides business context, permissions, workflows, execution, and verification.',
  mechanism: ['Decide', 'Approve', 'Execute', 'Verify'] as const,
  heroHeadline: 'Turn AI instructions into real business actions.',
  heroSubhead:
    'AI can understand what you want. AlphaClone connects that intent to the systems where the work happens, then keeps approval, execution, verification, and the business record together.',
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
