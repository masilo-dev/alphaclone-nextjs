/**
 * Business Execution Layer — category positioning (public marketing SSOT).
 * Use these strings instead of hard-coding hero/CTA copy across pages.
 */

export const EXECUTION_LAYER = {
  category: 'Business Execution Layer',
  primaryLine: 'You direct. AlphaClone executes.',
  categoryLine: 'Your business has tools. Now give it an execution layer.',
  problemLine: 'The software works. But you’re still doing the work.',
  explanatoryLine:
    'AlphaClone turns your instructions into coordinated action across connected business systems while you retain control over important decisions.',
  differentiationLine:
    'Chatbots produce answers. AlphaClone helps coordinate what happens after the answer.',
  mechanism: ['Decide', 'Approve', 'Execute', 'Verify'] as const,
  heroHeadline: 'Your business has tools. Now give it an execution layer.',
  heroSubhead:
    'AlphaClone turns your instructions into coordinated action across connected business systems while you retain control over important decisions.',
  primaryCta: 'Execute your first workflow',
  secondaryCta: 'Book an execution session',
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
