import test from 'node:test';
import assert from 'node:assert/strict';

import { insertTenantNotification } from '../../src/lib/notifications/insertTenantNotification.ts';

test('insertTenantNotification updates existing notification in place when correlationId matches', async () => {
  const store = [];
  const mockAdmin = {
    from: (table) => {
      assert.equal(table, 'notifications');
      return {
        select: (cols) => ({
          eq: (col1, val1) => ({
            eq: (col2, val2) => ({
              limit: (lim) => {
                const found = store.filter(
                  (r) => r[col1] === val1 && r[col2] === val2
                );
                return Promise.resolve({ data: found });
              },
            }),
            limit: (lim) => {
              const found = store.filter((r) => r[col1] === val1);
              return Promise.resolve({ data: found });
            },
          }),
        }),
        insert: (row) => {
          const inserted = { id: `notif-${store.length + 1}`, ...row };
          store.push(inserted);
          return {
            select: () => ({
              maybeSingle: () => Promise.resolve({ data: inserted, error: null }),
            }),
            maybeSingle: () => Promise.resolve({ data: inserted, error: null }),
            error: null,
          };
        },
        update: (patch) => ({
          eq: (col, val) => {
            const idx = store.findIndex((r) => r[col] === val);
            if (idx >= 0) {
              store[idx] = { ...store[idx], ...patch };
              return Promise.resolve({ error: null });
            }
            return Promise.resolve({ error: { message: 'not found' } });
          },
        }),
      };
    },
  };

  const correlationId = 'exec-test-12345';
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const recipientUserId = 'user-test-1';

  // Step 1: Initial Executing Notification
  const first = await insertTenantNotification(mockAdmin, {
    tenantId,
    recipientUserId,
    eventType: 'email.sending',
    title: 'Sending email...',
    message: 'Outbound email is being processed.',
    severity: 'medium',
    correlationId,
    dedupeKey: `exec:${correlationId}`,
  });

  assert.equal(first.created, true);
  assert.equal(store.length, 1);
  assert.equal(store[0].title, 'Sending email...');
  const originalId = store[0].id;

  // Step 2: Transition to Verifying (due to provider timeout)
  const second = await insertTenantNotification(mockAdmin, {
    tenantId,
    recipientUserId,
    eventType: 'email.verifying',
    title: 'Verifying email delivery...',
    message: 'Email submitted; awaiting provider delivery confirmation.',
    severity: 'medium',
    correlationId,
    dedupeKey: `exec:${correlationId}`,
  });

  assert.equal(second.created, false);
  assert.equal(second.updated, true);
  // Crucial: exactly ONE logical notification row exists in the store!
  assert.equal(store.length, 1);
  assert.equal(store[0].id, originalId);
  assert.equal(store[0].title, 'Verifying email delivery...');

  // Step 3: Transition to Successfully Sent
  const third = await insertTenantNotification(mockAdmin, {
    tenantId,
    recipientUserId,
    eventType: 'email.sent',
    title: 'Email Sent',
    message: 'Email delivered successfully.',
    severity: 'medium',
    correlationId,
    dedupeKey: `exec:${correlationId}`,
  });

  assert.equal(third.created, false);
  assert.equal(third.updated, true);
  // Still exactly ONE logical notification row!
  assert.equal(store.length, 1);
  assert.equal(store[0].id, originalId);
  assert.equal(store[0].title, 'Email Sent');
  assert.equal(store[0].message, 'Email delivered successfully.');
});
