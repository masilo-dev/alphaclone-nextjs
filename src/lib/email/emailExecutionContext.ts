import { createHash } from 'node:crypto';

export type EmailExecutionContext = {
  tenantId: string;
  userId?: string | null;
  actorId?: string | null;
  role?: string | null;
  permissions?: string[];
};

export type EmailExecutionIdentity = {
  sourceModule: string;
  sourceAction: string;
  recipient: string | string[];
  campaignId?: string | null;
  sequenceId?: string | null;
  sequenceStepId?: string | null;
  outreachAttemptId?: string | null;
  relatedEntityId?: string | null;
  subject?: string | null;
  content?: string | null;
};

function nonEmpty(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
}

export function assertEmailExecutionContext(context: EmailExecutionContext): EmailExecutionContext {
  const tenantId = nonEmpty(context.tenantId);
  if (!tenantId) throw new Error('EMAIL_TENANT_CONTEXT_REQUIRED');
  return {
    ...context,
    tenantId,
    userId: nonEmpty(context.userId),
    actorId: nonEmpty(context.actorId) || nonEmpty(context.userId),
    role: nonEmpty(context.role),
    permissions: Array.isArray(context.permissions) ? context.permissions.filter(Boolean) : [],
  };
}

export function buildTenantEmailIdempotencyKey(
  context: EmailExecutionContext,
  identity: EmailExecutionIdentity,
): string {
  const ctx = assertEmailExecutionContext(context);
  const recipients = (Array.isArray(identity.recipient) ? identity.recipient : [identity.recipient])
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .sort();
  if (!recipients.length) throw new Error('EMAIL_RECIPIENT_REQUIRED');

  const contentHash = createHash('sha256')
    .update(`${identity.subject || ''}\n${identity.content || ''}`)
    .digest('hex');

  const material = [
    ctx.tenantId,
    identity.sourceModule,
    identity.sourceAction,
    recipients.join(','),
    identity.campaignId || '',
    identity.sequenceId || '',
    identity.sequenceStepId || '',
    identity.outreachAttemptId || '',
    identity.relatedEntityId || '',
    contentHash,
  ].join('|');

  return `email:${createHash('sha256').update(material).digest('hex')}`;
}
