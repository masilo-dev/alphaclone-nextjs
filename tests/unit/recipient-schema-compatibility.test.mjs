import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateRecipient } from '../../src/lib/email/validateRecipient.ts';

function client(records) {
  return { from(table) {
    const filters = {};
    const query = {
      select() { return query; },
      eq(key, value) { filters[key] = value; return query; },
      ilike(key, value) { filters[key] = value; return query; },
      filter(key, op, value) { filters[key] = value; return query; },
      is(key, value) { filters[key] = value; return query; },
      limit() { return query; },
      maybeSingle() {
        const data = (records[table] || []).find(row => Object.entries(filters).every(([key, value]) => row[key] === value));
        return Promise.resolve({ data: data || null, error: null });
      },
    };
    return query;
  } };
}
test('canonical quote email qualifies without non-existent CRM columns', async () => {
  const db = client({ quotes: [{ id: 'q', tenant_id: 'ours', client_email: 'client@example.com' }] });
  assert.equal((await validateRecipient(db, 'ours', 'client@example.com')).allowed, true);
  assert.equal((await validateRecipient(db, 'other', 'client@example.com')).allowed, false);
});
test('deleted contacts and unknown recipients do not authorize outreach', async () => {
  const db = client({ contacts: [{ id: 'c', tenant_id: 'ours', email: 'client@example.com', deleted_at: '2026-10-01' }] });
  assert.equal((await validateRecipient(db, 'ours', 'client@example.com')).allowed, false);
});
