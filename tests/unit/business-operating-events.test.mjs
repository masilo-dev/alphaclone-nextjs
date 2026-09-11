import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allowsClientEmail,
  CANONICAL_EVENTS,
  dispatcherEventKey,
  eventUrgency,
  humanEventLabel,
  normalizeEventType,
} from '../../src/lib/events/businessEventTaxonomy.ts';
import {
  defaultTenantNotificationPolicy,
  resolveNotificationChannels,
} from '../../src/lib/notifications/tenantNotificationPolicy.ts';
import { groupNotifications } from '../../src/lib/notifications/groupNotifications.ts';
import {
  canTransitionLeadStage,
  shouldStopLeadOutreach,
  normalizeLeadLifecycleStage,
} from '../../src/lib/leads/leadLifecycle.ts';
import { shouldStopAutomation } from '../../src/lib/automation/stopConditions.ts';
import { assertSameTenant, buildOperatingEventEnvelope } from '../../src/lib/events/operatingEventEnvelope.ts';
import { resolveVerifiedWebhookTenant } from '../../src/lib/events/webhookTenant.ts';
import {
  classifyEventPriority,
  shouldNotifyEveryBusinessWrite,
  shouldSendImmediateEmail,
} from '../../src/lib/notifications/eventCatalog.ts';

describe('business operating event taxonomy', () => {
  it('normalizes underscore and dotted aliases to one canonical type', () => {
    assert.equal(normalizeEventType('invoice_paid'), 'invoice.paid');
    assert.equal(normalizeEventType('contract.signed'), 'contract.signed');
    assert.equal(dispatcherEventKey('invoice.overdue'), 'invoice_overdue');
    assert.equal(humanEventLabel('lead.replied'), 'Lead replied');
  });

  it('does not allow client email for internal creates', () => {
    assert.equal(allowsClientEmail('invoice.created'), false);
    assert.equal(allowsClientEmail('contract.created'), false);
    assert.equal(allowsClientEmail('project.status_changed'), false);
    assert.equal(allowsClientEmail('invoice.sent'), true);
    assert.equal(allowsClientEmail('contract.sent'), true);
    assert.equal(allowsClientEmail('booking.created'), true);
  });

  it('covers the documented P0 event families', () => {
    const types = new Set(CANONICAL_EVENTS.map((e) => e.type));
    for (const required of [
      'lead.created',
      'contract.signed',
      'invoice.overdue',
      'invoice.paid',
      'campaign.failed',
      'social.post_failed',
      'booking.created',
      'integration.disconnected',
      'workflow.failed',
    ]) {
      assert.equal(types.has(required), true, required);
    }
  });
});

describe('tenant notification policy defaults', () => {
  it('avoids noisy owner email for routine CRM writes', () => {
    const policy = defaultTenantNotificationPolicy();
    const lead = resolveNotificationChannels({ eventType: 'lead.created', policy, communicationIntent: 'internal' });
    assert.equal(lead.emailOwner, false);
    assert.equal(lead.inApp, true);

    const overdue = resolveNotificationChannels({ eventType: 'invoice.overdue', policy });
    assert.equal(overdue.emailOwner, true);
    assert.equal(overdue.inApp, true);

    const clientOnCreate = resolveNotificationChannels({
      eventType: 'invoice.created',
      policy: { ...policy, invoices: { ...policy.invoices, email_client: true } },
      communicationIntent: 'internal',
    });
    assert.equal(clientOnCreate.emailClient, false);
  });

  it('does not email every write unless explicitly opted in', () => {
    assert.equal(shouldNotifyEveryBusinessWrite(), false);
    assert.equal(shouldSendImmediateEmail('lead.created', 'P2'), false);
    assert.equal(classifyEventPriority('invoice.overdue'), 'P1');
    assert.equal(eventUrgency('lead.created'), 'in_app');
  });
});

describe('notification grouping', () => {
  it('collapses a burst of qualified leads', () => {
    const groups = groupNotifications([
      { id: '1', title: 'Lead qualified', type: 'contact', event_type: 'lead.qualified', created_at: '2026-09-07T10:01:00Z' },
      { id: '2', title: 'Lead qualified', type: 'contact', event_type: 'lead.qualified', created_at: '2026-09-07T10:02:00Z' },
      { id: '3', title: 'Lead qualified', type: 'contact', event_type: 'lead.qualified', created_at: '2026-09-07T10:03:00Z' },
    ]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].count, 3);
    assert.match(groups[0].title, /3 leads were qualified/);
  });
});

describe('lead lifecycle and stop conditions', () => {
  it('stops outreach on reply, conversion, DNC, and bounce', () => {
    assert.equal(shouldStopLeadOutreach({ stage: 'REPLIED' }), true);
    assert.equal(shouldStopLeadOutreach({ stage: 'CLIENT' }), true);
    assert.equal(shouldStopLeadOutreach({ dnc: true }), true);
    assert.equal(shouldStopLeadOutreach({ bounced: true }), true);
    assert.equal(shouldStopLeadOutreach({ stage: 'CONTACTED' }), false);
    assert.equal(normalizeLeadLifecycleStage('meeting_booked'), 'MEETING');
    assert.equal(canTransitionLeadStage('CONTACTED', 'REPLIED'), true);
  });

  it('stops invoice, contract, and task chasing on terminal status', () => {
    assert.equal(shouldStopAutomation('invoice_chase', { status: 'paid' }), true);
    assert.equal(shouldStopAutomation('contract_chase', { status: 'signed' }), true);
    assert.equal(shouldStopAutomation('task_chase', { status: 'completed' }), true);
    assert.equal(shouldStopAutomation('invoice_chase', { status: 'sent' }), false);
  });
});

describe('tenant isolation and webhook mapping', () => {
  it('rejects cross-tenant envelope claims', () => {
    assert.throws(() => assertSameTenant('tenant-a', 'tenant-b', 'notification'));
    const envelope = buildOperatingEventEnvelope({
      tenantId: '11111111-1111-1111-1111-111111111111',
      eventType: 'invoice.paid',
      entityId: 'inv-1',
      entityType: 'invoice',
    });
    assert.equal(envelope.tenant_id, '11111111-1111-1111-1111-111111111111');
    assert.ok(envelope.correlation_id);
    assert.ok(envelope.idempotency_key);
    const again = buildOperatingEventEnvelope({
      tenantId: '11111111-1111-1111-1111-111111111111',
      eventType: 'invoice.paid',
      entityId: 'inv-1',
      entityType: 'invoice',
    });
    assert.equal(envelope.idempotency_key, again.idempotency_key);
  });

  it('never trusts an unverified webhook tenant_id', () => {
    assert.throws(() => resolveVerifiedWebhookTenant({ claimedTenantId: 'tenant-b', provider: 'stripe' }));
    assert.throws(() =>
      resolveVerifiedWebhookTenant({ mappedTenantId: 'tenant-a', claimedTenantId: 'tenant-b', provider: 'stripe' }),
    );
    assert.equal(
      resolveVerifiedWebhookTenant({ mappedTenantId: 'tenant-a', claimedTenantId: 'tenant-a', provider: 'stripe' }),
      'tenant-a',
    );
  });
});
