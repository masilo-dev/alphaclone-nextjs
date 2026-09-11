import { z } from 'zod';
import { CONTRACT_STATUSES, canTransitionContract } from '@/lib/contracts/contractManagerDomain';

export const INVOICE_LIFECYCLE_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'sent',
  'viewed',
  'partially_paid',
  'paid',
  'overdue',
  'disputed',
  'void',
] as const;

export type InvoiceLifecycleStatus = (typeof INVOICE_LIFECYCLE_STATUSES)[number];

export const INVOICE_TRANSITIONS: Record<InvoiceLifecycleStatus, readonly InvoiceLifecycleStatus[]> = {
  draft: ['pending_approval', 'approved', 'void'],
  pending_approval: ['draft', 'approved', 'void'],
  approved: ['sent', 'void'],
  sent: ['viewed', 'partially_paid', 'paid', 'overdue', 'disputed', 'void'],
  viewed: ['partially_paid', 'paid', 'overdue', 'disputed', 'void'],
  partially_paid: ['paid', 'overdue', 'disputed', 'void'],
  paid: [],
  overdue: ['partially_paid', 'paid', 'disputed', 'void'],
  disputed: ['sent', 'partially_paid', 'paid', 'overdue', 'void'],
  void: [],
};

export function canTransitionInvoice(from: string, to: string): boolean {
  if (!INVOICE_LIFECYCLE_STATUSES.includes(from as InvoiceLifecycleStatus)) return false;
  if (!INVOICE_LIFECYCLE_STATUSES.includes(to as InvoiceLifecycleStatus)) return false;
  return INVOICE_TRANSITIONS[from as InvoiceLifecycleStatus].includes(to as InvoiceLifecycleStatus);
}

export const revenueEntityTypeSchema = z.enum([
  'lead', 'contact', 'client', 'deal', 'campaign', 'outreach', 'contract',
  'document', 'invoice', 'payment', 'project', 'task',
]);

const baseSchema = z.object({ tenantId: z.uuid() });

export const connectedLifecycleActionSchema = z.discriminatedUnion('action', [
  baseSchema.extend({
    action: z.literal('link'),
    sourceType: revenueEntityTypeSchema,
    sourceId: z.uuid(),
    targetType: revenueEntityTypeSchema,
    targetId: z.uuid(),
    relationship: z.string().trim().min(2).max(80),
    metadata: z.record(z.string(), z.unknown()).default({}),
  }),
  baseSchema.extend({
    action: z.literal('transition_contract'),
    contractId: z.uuid(),
    status: z.enum(CONTRACT_STATUSES),
    reason: z.string().trim().max(2000).optional(),
    evidence: z.record(z.string(), z.unknown()).default({}),
  }),
  baseSchema.extend({
    action: z.literal('transition_invoice'),
    invoiceId: z.uuid(),
    status: z.enum(INVOICE_LIFECYCLE_STATUSES),
    reason: z.string().trim().max(2000).optional(),
    evidence: z.record(z.string(), z.unknown()).default({}),
  }),
  baseSchema.extend({
    action: z.literal('schedule_contract_milestones'),
    contractId: z.uuid(),
    invoiceId: z.uuid(),
    currencyCode: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  }),
  baseSchema.extend({
    action: z.literal('provision_signed_contract'), contractId: z.uuid(),
    createInvoice: z.boolean().default(true), createProject: z.boolean().default(true),
    invoiceDueDays: z.number().int().min(1).max(365).default(14),
  }),
  baseSchema.extend({
    action: z.literal('queue_document_intelligence'),
    documentId: z.uuid(),
    jobs: z.array(z.enum(['ocr', 'extract', 'classify', 'summarize', 'compare', 'validate', 'obligations'])).min(1).max(7),
  }),
  baseSchema.extend({
    action: z.literal('suppress_outreach'),
    channel: z.enum(['email', 'linkedin', 'sms', 'whatsapp', 'call']),
    recipient: z.string().trim().min(3).max(320),
    reason: z.string().trim().min(2).max(500),
    expiresAt: z.iso.datetime({ offset: true }).optional(),
  }),
]);

export type ConnectedLifecycleAction = z.infer<typeof connectedLifecycleActionSchema>;

export function normalizeOutreachRecipient(channel: string, recipient: string): string {
  const value = recipient.trim().toLowerCase();
  return channel === 'email' ? value : value.replace(/[\s().-]/g, '');
}

export function assertContractTransition(from: string, to: string): void {
  if (!canTransitionContract(from, to)) {
    throw new Error(`Contract cannot move from ${from} to ${to}`);
  }
}

export function assertInvoiceTransition(from: string, to: string): void {
  if (!canTransitionInvoice(from, to)) {
    throw new Error(`Invoice cannot move from ${from} to ${to}`);
  }
}
