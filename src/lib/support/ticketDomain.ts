export type TicketStatus =
  | 'new'
  | 'open'
  | 'in_progress'
  | 'waiting_on_customer'
  | 'waiting_on_business'
  | 'escalated'
  | 'resolved'
  | 'closed';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface InboundMessageIdentity {
  internetMessageId?: string | null;
  providerMessageId?: string | null;
  providerThreadId?: string | null;
  inReplyTo?: string | null;
  references?: string[] | null;
  subject?: string | null;
}

export interface ThreadCandidate {
  ticketId: string;
  internetMessageIds: string[];
  providerMessageIds: string[];
  providerThreadIds: string[];
  ticketNumber?: string | null;
}

export type ThreadMatch =
  | { kind: 'existing_message'; ticketId: string }
  | {
      kind: 'ticket';
      ticketId: string;
      reason: 'in_reply_to' | 'references' | 'provider_thread' | 'ticket_reference';
    }
  | { kind: 'new_ticket' };

const normaliseMessageId = (value?: string | null) =>
  value?.trim().replace(/^<|>$/g, '').toLowerCase() || null;

export function extractTicketReference(subject?: string | null): string | null {
  if (!subject) return null;
  const match = subject.match(/\[(?:ticket|case)\s*#?([a-z0-9-]+)\]/i);
  return match?.[1]?.toUpperCase() || null;
}

/**
 * Deterministic ticket threading. Subject text is only used for an explicit
 * Alphaclone ticket reference and is never treated as sufficient by itself.
 */
export function matchInboundTicket(
  message: InboundMessageIdentity,
  candidates: ThreadCandidate[]
): ThreadMatch {
  const incomingInternetId = normaliseMessageId(message.internetMessageId);
  const incomingProviderId = message.providerMessageId?.trim() || null;

  for (const candidate of candidates) {
    if (
      (incomingInternetId &&
        candidate.internetMessageIds.some((id) => normaliseMessageId(id) === incomingInternetId)) ||
      (incomingProviderId && candidate.providerMessageIds.includes(incomingProviderId))
    ) {
      return { kind: 'existing_message', ticketId: candidate.ticketId };
    }
  }

  const inReplyTo = normaliseMessageId(message.inReplyTo);
  if (inReplyTo) {
    const candidate = candidates.find((item) =>
      item.internetMessageIds.some((id) => normaliseMessageId(id) === inReplyTo)
    );
    if (candidate) return { kind: 'ticket', ticketId: candidate.ticketId, reason: 'in_reply_to' };
  }

  const references = new Set((message.references || []).map(normaliseMessageId).filter(Boolean));
  if (references.size) {
    const candidate = candidates.find((item) =>
      item.internetMessageIds.some((id) => references.has(normaliseMessageId(id)))
    );
    if (candidate) return { kind: 'ticket', ticketId: candidate.ticketId, reason: 'references' };
  }

  if (message.providerThreadId) {
    const candidate = candidates.find((item) =>
      item.providerThreadIds.includes(message.providerThreadId as string)
    );
    if (candidate) return { kind: 'ticket', ticketId: candidate.ticketId, reason: 'provider_thread' };
  }

  const ticketReference = extractTicketReference(message.subject);
  if (ticketReference) {
    const candidate = candidates.find(
      (item) => item.ticketNumber?.toUpperCase() === ticketReference
    );
    if (candidate) {
      return { kind: 'ticket', ticketId: candidate.ticketId, reason: 'ticket_reference' };
    }
  }

  return { kind: 'new_ticket' };
}

export function statusAfterCustomerReply(status: TicketStatus): TicketStatus {
  return status === 'resolved' || status === 'closed' || status === 'waiting_on_customer'
    ? 'open'
    : status;
}

export function waitingResponsibility(status: TicketStatus): 'customer' | 'business' | null {
  if (status === 'waiting_on_customer') return 'customer';
  if (status === 'waiting_on_business' || ['new', 'open', 'in_progress', 'escalated'].includes(status)) {
    return 'business';
  }
  return null;
}

export function publicDeliveryLabel(input: {
  applicationStatus?: string | null;
  deliveryStatus?: string | null;
}) {
  if (input.deliveryStatus === 'opened') return 'Opened (provider reported)';
  if (input.deliveryStatus === 'delivered') return 'Delivered';
  if (input.deliveryStatus === 'bounced') return 'Bounced';
  if (input.deliveryStatus === 'deferred') return 'Delivery delayed';
  if (input.applicationStatus === 'failed') return 'Failed';
  if (['sent', 'provider_accepted'].includes(input.applicationStatus || '')) return 'Sent';
  return 'Pending';
}
