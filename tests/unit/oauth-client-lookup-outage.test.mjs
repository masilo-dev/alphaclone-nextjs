import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadMcpOAuthClient } from '../../src/lib/mcp/ensureOAuthClient.ts';

function store(result) {
    const query = { select() { return this; }, eq() { return this; }, async maybeSingle() { return result; } };
    return { from() { return query; } };
}
test('database outage is retryable and must not seed a client', async () => {
    const result = await loadMcpOAuthClient(store({ data: null, error: { message: 'fetch failed', code: '' } }), 'chatgpt-connector');
    assert.deepEqual(result, { client: null, error: 'temporarily_unavailable' });
});
test('absent dynamic client remains invalid; a verified client remains valid', async () => {
    assert.deepEqual(await loadMcpOAuthClient(store({ data: null, error: null }), 'ac_test'), { client: null, error: 'invalid_client' });
    const client = { client_id: 'ac_test', is_public: true, client_secret: null };
    assert.deepEqual(await loadMcpOAuthClient(store({ data: client, error: null }), 'ac_test'), { client });
});
