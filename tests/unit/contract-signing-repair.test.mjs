import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Substitute only database clients; exercise the actual signing service and failure paths.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/lib/supabase-admin') return { url: 'repair-test:admin', shortCircuit: true };
    if (specifier === '@/lib/supabase-server') return { url: 'repair-test:server', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'repair-test:admin') return { format: 'module', source: 'export const createSupabaseAdminClient = () => globalThis.__contractRepairDb;', shortCircuit: true };
    if (url === 'repair-test:server') return { format: 'module', source: 'export const createSupabaseServerClient = async () => globalThis.__contractRepairDb;', shortCircuit: true };
    return next(url, context);
  },
});
const { contractServerService: service } = await import('../../src/services/server/contractServerService.ts');
const request = { contractId: 'contract-1', role: 'client', signerEmail: 'client@example.test', signatureDataUrl: 'typed:Client', signerName: 'Client', consentGiven: true };

test('authenticated and token signing use exactly one atomic database operation', async () => {
  const calls = [];
  globalThis.__contractRepairDb = { rpc: async (name, args) => {
    calls.push({ name, args }); return { data: { contract: { id: 'contract-1', status: 'client_signed' }, replayed: false }, error: null };
  } };
  await service.signContract({ ...request, userId: 'user-1', signerEmail: 'CLIENT@EXAMPLE.TEST ' });
  await service.signContractWithToken({ ...request, signingToken: 'test-token' });
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.name === 'record_contract_signature_atomic'));
  assert.equal(calls[0].args.p_request.signerEmail, 'client@example.test');
  assert.equal(calls[1].args.p_request.signingToken, 'test-token');
});

test('database replay is exposed so routes can suppress duplicate side effects', async () => {
  globalThis.__contractRepairDb = { rpc: async () => ({ data: { contract: { id: 'contract-1' }, replayed: true }, error: null }) };
  assert.equal((await service.signContract(request)).signature_replayed, true);
});

test('atomic database failure fails closed without a sequential-write fallback', async () => {
  globalThis.__contractRepairDb = { rpc: async () => ({ data: null, error: { message: 'audit write failed' } }) };
  await assert.rejects(service.signContract(request), /audit write failed/);
});

test('missing transaction result cannot be reported as a successful signature', async () => {
  globalThis.__contractRepairDb = { rpc: async () => ({ data: {}, error: null }) };
  await assert.rejects(service.signContract(request), /no contract/);
});

test.after(() => { hooks.deregister(); delete globalThis.__contractRepairDb; });
