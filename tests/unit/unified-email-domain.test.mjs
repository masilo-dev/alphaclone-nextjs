import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROVIDER_CAPABILITIES,
  assertRecipientsAllowed,
  resolveSendRoute,
} from '../../src/lib/email/unifiedEmailDomain.ts';

const account = {
  id: 'account-1',
  provider: 'brevo',
  connectionStatus: 'connected',
  allowedPurposes: ['transactional', 'invoice'],
};
const identity = {
  id: 'identity-1',
  providerAccountId: account.id,
  emailAddress: 'billing@example.com',
  verificationStatus: 'verified',
  canSendAs: true,
  allowedPurposes: ['transactional', 'invoice'],
};

test('outbound providers never advertise a fake inbox', () => {
  assert.equal(PROVIDER_CAPABILITIES.brevo.canReceive, false);
  assert.equal(PROVIDER_CAPABILITIES.sendgrid.canSyncFolders, false);
  assert.equal(PROVIDER_CAPABILITIES.smtp.canReceive, false);
  assert.equal(PROVIDER_CAPABILITIES.microsoft_graph.canReceive, true);
});

test('an explicit authorised provider and identity override defaults', () => {
  const result = resolveSendRoute({
    purpose: 'invoice',
    accounts: [account],
    identities: [identity],
    defaults: [],
    explicitAccountId: account.id,
    explicitIdentityId: identity.id,
  });
  assert.equal(result.account.id, account.id);
  assert.equal(result.identity.id, identity.id);
});

test('choosing another account does not reuse an incompatible default identity', () => {
  const oldAccount = { ...account, id: 'old-account' };
  const oldIdentity = { ...identity, id: 'old-identity', providerAccountId: oldAccount.id };
  const result = resolveSendRoute({
    purpose: 'invoice',
    accounts: [oldAccount, account],
    identities: [oldIdentity, identity],
    defaults: [{
      purpose: 'invoice',
      providerAccountId: oldAccount.id,
      senderIdentityId: oldIdentity.id,
      priority: 1,
    }],
    explicitAccountId: account.id,
  });
  assert.equal(result.account.id, account.id);
  assert.equal(result.identity.id, identity.id);
});

test('unverified From identities cannot send', () => {
  assert.throws(() => resolveSendRoute({
    purpose: 'invoice',
    accounts: [account],
    identities: [{ ...identity, verificationStatus: 'pending' }],
    defaults: [{ purpose: 'invoice', providerAccountId: account.id, senderIdentityId: identity.id, priority: 1 }],
  }), /not verified/);
});

test('suppression is provider independent and case insensitive', () => {
  assert.throws(
    () => assertRecipientsAllowed(
      ['Customer@Example.com'],
      [{ emailAddress: 'customer@example.com', active: true }],
    ),
    /suppressed across all providers/,
  );
});

test('connection migration preserves lineage without copying secret config', async () => {
  const migration = await readFile(
    'supabase/migrations/20260726230000_unified_email_foundation.sql',
    'utf8',
  );
  const backfill = migration.slice(migration.indexOf('INSERT INTO public.email_provider_accounts'));
  assert.match(backfill, /legacy_integration_id/);
  assert.doesNotMatch(backfill, /i\.config/);
  assert.match(migration, /UNIQUE \(tenant_id, idempotency_key\)/);
});
