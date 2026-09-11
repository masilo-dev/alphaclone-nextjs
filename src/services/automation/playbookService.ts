export type PlaybookStepRisk = 'low' | 'high';

export type PlaybookStep = {
  id: string;
  action: string;
  risk: PlaybookStepRisk;
  config?: Record<string, unknown>;
};

export type PlaybookDefinition = {
  id: string;
  name: string;
  description: string;
  steps: PlaybookStep[];
};

const PLAYBOOKS: Record<string, PlaybookDefinition> = {
  inbound_lead_qualification: {
    id: 'inbound_lead_qualification',
    name: 'Inbound lead qualification',
    description: 'Create a lead, create a follow-up task, send outreach, and verify delivery.',
    steps: [
      { id: 'create_lead', action: 'create_lead', risk: 'low' },
      { id: 'create_task', action: 'create_task', risk: 'low' },
      { id: 'send_outreach', action: 'send_outreach', risk: 'high' },
      { id: 'verify_outreach', action: 'verify_outreach_delivery', risk: 'low' },
    ],
  },
  overdue_invoice_reminder: {
    id: 'overdue_invoice_reminder',
    name: 'Overdue invoice reminder',
    description: 'Send invoice reminder and verify reminder/send evidence.',
    steps: [
      { id: 'send_invoice_reminder', action: 'send_invoice_reminder', risk: 'high' },
      { id: 'verify_invoice', action: 'verify_invoice_sent', risk: 'low' },
    ],
  },
};

export function listBuiltInPlaybooks(): PlaybookDefinition[] {
  return Object.values(PLAYBOOKS);
}

export function getPlaybookDefinition(playbookId: string): PlaybookDefinition | null {
  return PLAYBOOKS[playbookId] || null;
}

