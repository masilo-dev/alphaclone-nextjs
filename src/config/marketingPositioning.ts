/**
 * AI Business Execution Layer — category positioning (public marketing SSOT).
 * Use these strings instead of hard-coding hero/CTA copy across pages.
 */

export const EXECUTION_LAYER = {
  category: 'AI Business Execution Layer',
  primaryLine: 'You give the instruction. AlphaClone handles the execution.',
  categoryLine: 'Your AI can think. Now let it execute.',
  problemLine: 'The software works. But you’re still doing the work.',
  explanatoryLine:
    'AlphaClone connects ChatGPT, Claude, and other compatible AI interfaces to the systems that run your business—so AI can send, post, update, create, follow up, and execute real work.',
  differentiationLine:
    'AI provides the intelligence and conversation. AlphaClone provides business context, permissions, workflows, execution, and verification.',
  mechanism: ['Decide', 'Approve', 'Execute', 'Verify'] as const,
  heroHeadline: 'Your AI can think. Now let it execute.',
  heroSubhead:
    'AlphaClone connects ChatGPT, Claude, and other AI assistants to the applications that run your business—so AI can send, post, update, create, follow up, and execute real work.',
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
