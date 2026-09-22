/**
 * Approval-led business workflow positioning (public marketing SSOT).
 * Use these strings instead of hard-coding hero/CTA copy across pages.
 */

export const EXECUTION_LAYER = {
  category: 'AI Business Execution Layer',
  primaryLine: 'AI that does not stop at answers.',
  categoryLine: 'From intention to accountable impact.',
  problemLine: 'Your tools hold the data. Your team carries the handoffs.',
  explanatoryLine:
    'AlphaClone turns approved AI instructions into accountable work across the tools your business already uses.',
  differentiationLine:
    'AI provides the intelligence and conversation. AlphaClone provides business context, permissions, workflows, execution, and verification.',
  mechanism: ['Decide', 'Approve', 'Execute', 'Verify'] as const,
  heroHeadline: 'You type. We make it happen.',
  heroSubhead:
    'AlphaClone turns approved AI instructions into accountable work across the tools your business already uses.',
  primaryCta: 'Book a demo',
  secondaryCta: 'See a 30-second workflow',
  executionSessionPath: '/execution-session',
  workflowPath: '/#workflow',
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
