import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeEmailAttachment,
  normalizeEmailAttachments,
} from '../../src/lib/email/emailAttachment.ts';
import {
  mapEventTypeToNotificationType,
  NOTIFICATION_TYPES,
} from '../../src/lib/notifications/notificationType.ts';
import {
  normalizePlanTier,
  getDailyLimitForResource,
} from '../../src/lib/entitlements/planEntitlements.ts';
import {
  normalizeTaskStatus,
  taskStatusForStorage,
  TASK_STATUSES,
} from '../../src/lib/projects/projectTaskDomain.ts';

describe('production contract: email attachments', () => {
  it('normalizes legacy content_type to canonical contentType', () => {
    const attachment = normalizeEmailAttachment({
      filename: 'Invoice_1001.pdf',
      content: 'base64pdf',
      content_type: 'application/pdf',
    });
    assert.equal(attachment.contentType, 'application/pdf');
    assert.equal(attachment.filename, 'Invoice_1001.pdf');
    assert.equal('content_type' in attachment, false);
  });

  it('invoice PDF attachment passes through gateway shape', () => {
    const attachments = normalizeEmailAttachments([
      {
        filename: 'Invoice_1001.pdf',
        content: 'base64pdf',
        contentType: 'application/pdf',
      },
    ]);
    assert.equal(attachments.length, 1);
    assert.deepEqual(attachments[0], {
      filename: 'Invoice_1001.pdf',
      content: 'base64pdf',
      contentType: 'application/pdf',
    });
  });
});

describe('production contract: notification types', () => {
  it('maps MCP failure events to valid notification_type values', () => {
    const mapped = mapEventTypeToNotificationType('mcp.action_failed');
    assert.ok((NOTIFICATION_TYPES as readonly string[]).includes(mapped));
  });

  it('maps social publish events to valid notification_type values', () => {
    const mapped = mapEventTypeToNotificationType('social.post_published');
    assert.ok((NOTIFICATION_TYPES as readonly string[]).includes(mapped));
  });

  it('preserves canonical enum members', () => {
    for (const type of NOTIFICATION_TYPES) {
      assert.equal(mapEventTypeToNotificationType(type), type);
    }
  });
});

describe('production contract: task status', () => {
  it('maps blocked domain status to storage enum value after migration', () => {
    assert.equal(normalizeTaskStatus('blocked'), 'blocked');
    assert.equal(taskStatusForStorage('blocked'), 'blocked');
  });

  it('maps legacy todo/completed to canonical domain', () => {
    assert.equal(normalizeTaskStatus('todo'), 'to_do');
    assert.equal(taskStatusForStorage('to_do'), 'todo');
    assert.equal(normalizeTaskStatus('completed'), 'done');
    assert.equal(taskStatusForStorage('done'), 'completed');
  });

  it('includes blocked in canonical task lifecycle', () => {
    assert.ok(TASK_STATUSES.includes('blocked'));
  });
});

describe('production contract: quota entitlements', () => {
  it('FREE = 50/day for applicable categories', () => {
    assert.equal(getDailyLimitForResource('free', 'leads'), 50);
    assert.equal(getDailyLimitForResource('free', 'mcp_executions'), 50);
  });

  it('PRO = 300/day for applicable categories', () => {
    assert.equal(getDailyLimitForResource('pro', 'leads'), 300);
    assert.equal(getDailyLimitForResource('pro', 'email_actions'), 300);
  });

  it('PREMIUM/ENTERPRISE/CUSTOM = unlimited', () => {
    for (const tier of ['premium', 'enterprise', 'custom'] as const) {
      assert.equal(normalizePlanTier(tier), 'premium');
      assert.equal(getDailyLimitForResource(tier, 'mcp_executions'), null);
    }
  });
});
