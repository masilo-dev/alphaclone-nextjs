/**
 * Event → Bonnie reasoning.
 * Every business event should create a cognitive run.
 */

import { runCognitiveLoop } from './cognitiveLoop';
import type { CognitiveRunResult } from './types';

export const BONNIE_EVENT_GOALS: Record<string, (payload?: Record<string, unknown>) => string> = {
  lead_created: (p) =>
    `New lead received${p?.leadId ? ` (${p.leadId})` : ''}. Research company, analyze CRM, find previous interactions, generate qualification score, create outreach plan, schedule follow-up, notify salesperson, update dashboards, and audit everything.`,
  deal_stage_changed: (p) =>
    `Deal stage changed${p?.dealId ? ` for deal ${p.dealId}` : ''}. Analyze pipeline impact, recommend next sales actions, update related tasks, and record evidence.`,
  invoice_created: (p) =>
    `Invoice created${p?.invoiceId ? ` (${p.invoiceId})` : ''}. Verify accounting consistency, check client status, and recommend delivery/follow-up steps.`,
  invoice_overdue: (p) =>
    `Invoice overdue${p?.invoiceId ? ` (${p.invoiceId})` : ''}. Analyze AR risk, propose collection strategy, draft reminder plan, and notify finance with approval-aware actions.`,
  invoice_paid: (p) =>
    `Invoice paid${p?.invoiceId ? ` (${p.invoiceId})` : ''}. Confirm accounting state, update customer health, and surface revenue insight.`,
  contract_signed: (p) =>
    `Contract signed${p?.contractId ? ` (${p.contractId})` : ''}. Trigger onboarding/customer success checklist, finance handoff, and audit trail.`,
  task_overdue: (p) =>
    `Task overdue${p?.taskId ? ` (${p.taskId})` : ''}. Identify owner/blocker, propose recovery plan, and escalate if delivery risk is high.`,
  task_created: (p) =>
    `Task created${p?.taskId ? ` (${p.taskId})` : ''}. Ensure assignment, due date, and related CRM context are coherent.`,
  ticket_created: (p) =>
    `Support ticket created${p?.ticketId ? ` (${p.ticketId})` : ''}. Triage severity, suggest resolution path, and protect customer success.`,
  email_received: () =>
    `New email event. Classify intent, link to CRM entities, draft response plan, and queue follow-ups with approval when sending.`,
  meeting_scheduled: () =>
    `Meeting scheduled. Prepare agenda from CRM context, identify stakeholders, and set post-meeting follow-up tasks.`,
  payment_failed: () =>
    `Payment failed. Assess financial/customer risk, propose recovery outreach, and keep finance + support coordinated.`,
  employee_updated: () =>
    `Employee/HR change detected. Check permissions, workload, and compliance implications.`,
  approval_requested: () =>
    `Approval requested. Audit evidence, risk class, and recommend approve/edit/reject with clear rationale.`,
};

export function isBonnieReasoningEvent(eventType: string): boolean {
  return Boolean(BONNIE_EVENT_GOALS[eventType]);
}

export async function reasonAboutBusinessEvent(params: {
  tenantId: string;
  userId?: string;
  eventType: string;
  eventId?: string;
  payload?: Record<string, unknown>;
  executeActions?: boolean;
}): Promise<CognitiveRunResult | null> {
  const goalBuilder = BONNIE_EVENT_GOALS[params.eventType];
  if (!goalBuilder) return null;

  return runCognitiveLoop({
    tenantId: params.tenantId,
    userId: params.userId,
    goal: goalBuilder(params.payload),
    triggerType: 'event',
    triggerRef: params.eventId || params.eventType,
    eventType: params.eventType,
    eventPayload: params.payload,
    executeActions: params.executeActions,
  });
}
