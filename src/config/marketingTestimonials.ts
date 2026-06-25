/** Representative outcome scenarios — not verified customer testimonials. Replace with named quotes when available. */

export type MarketingTestimonial = {
  quote: string;
  persona: string;
  outcome: string;
};

export const MARKETING_TESTIMONIALS: MarketingTestimonial[] = [
  {
    quote:
      'We stopped re-entering the same client details in CRM, invoicing, and project tools. Onboarding a new client now takes minutes instead of juggling five tabs.',
    persona: 'Agency operations lead',
    outcome: 'Faster client onboarding',
  },
  {
    quote:
      'The pipeline and contract flow mean we never lose context between sales and delivery. We know what was promised before we invoice.',
    persona: 'Founder, boutique consultancy',
    outcome: 'Sales-to-delivery continuity',
  },
  {
    quote:
      'Follow-ups and invoice status live next to the client record — not buried in a separate inbox or spreadsheet.',
    persona: 'Solo professional services consultant',
    outcome: 'Fewer dropped follow-ups',
  },
  {
    quote:
      'Our field team checks tasks and billing from their phones on client sites instead of calling the office for updates.',
    persona: 'Field services business owner',
    outcome: 'Team alignment on the go',
  },
];
