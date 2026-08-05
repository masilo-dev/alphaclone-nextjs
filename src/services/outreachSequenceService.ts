/**
 * Multi-Step Outreach Drip Sequence Service
 * Automated multi-channel sequences (Day 1 Brevo Email, Day 3 Follow-up, Day 5 WhatsApp Link)
 */

export type DripStep = {
  day: number;
  channel: 'email' | 'whatsapp' | 'task';
  title: string;
  template: string;
};

export type OutreachSequence = {
  id: string;
  name: string;
  description: string;
  steps: DripStep[];
};

export const DEFAULT_SEQUENCES: OutreachSequence[] = [
  {
    id: 'b2b-high-value',
    name: 'B2B Enterprise Lead Nurturing',
    description: '5-Day high-touch email and WhatsApp outreach sequence for qualified leads',
    steps: [
      {
        day: 1,
        channel: 'email',
        title: 'Initial Enterprise Pitch',
        template: 'Hi {{name}}, saw your business {{company}} and wanted to share how AlphaClone helps optimize operations.',
      },
      {
        day: 3,
        channel: 'email',
        title: 'Case Study & Value Proposition',
        template: 'Hi {{name}}, quick follow-up on our enterprise platform overview.',
      },
      {
        day: 5,
        channel: 'whatsapp',
        title: 'Direct Executive WhatsApp Outreach',
        template: 'Hi {{name}}, following up regarding {{company}} on WhatsApp.',
      },
    ],
  },
  {
    id: 'quick-intro',
    name: 'Standard Lead Welcome',
    description: '3-Day quick welcome sequence for new inbound website leads',
    steps: [
      {
        day: 1,
        channel: 'email',
        title: 'Welcome & Discovery Call Invite',
        template: 'Welcome {{name}}! Thank you for reaching out to us.',
      },
      {
        day: 3,
        channel: 'email',
        title: 'Product Overview & Demo Link',
        template: 'Hi {{name}}, check out our quick 2-minute interactive demo.',
      },
    ],
  },
];

export const outreachSequenceService = {
  getSequences(): OutreachSequence[] {
    return DEFAULT_SEQUENCES;
  },

  generateWhatsAppUrl(phone: string, text: string): string {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const encodedText = encodeURIComponent(text);
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  },
};
