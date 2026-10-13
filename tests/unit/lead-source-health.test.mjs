import test from 'node:test';
import assert from 'node:assert/strict';
import { LeadSourceRouter } from '../../src/lib/lead-finder/sourceRouter.ts';

test('provider receipts preserve failures and correct provider identity', async () => {
  const router = new LeadSourceRouter([
    { id: 'receipt-failure', enabled: () => true, search: async () => ({ businesses: [], metadata: { status: 'failed', error: 'Provider unavailable' } }) },
    { id: 'throw-failure', enabled: () => true, search: async () => { throw new Error('Timed out'); } },
    { id: 'working', enabled: () => true, search: async () => ({ businesses: [{ source: 'working', businessName: 'Acme' }] }) },
  ]);
  const result = await router.search({ query: 'builders', resultLimit: 10 });
  assert.equal(result.businesses.length, 1);
  assert.equal(result.health[0].status, 'failed'); assert.equal(result.health[0].error, 'Provider unavailable');
  assert.equal(result.health[1].provider, 'throw-failure'); assert.equal(result.health[1].status, 'failed');
  assert.equal(result.health[2].status, 'success');
});
