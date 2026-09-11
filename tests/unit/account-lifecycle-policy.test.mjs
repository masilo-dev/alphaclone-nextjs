/**
 * Account lifecycle policy source checks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const {
  INACTIVE_ACCOUNT_DISABLE_DAYS,
  DISABLED_ACCOUNT_PURGE_DAYS,
} = await import('../../src/services/accountDeletionService.ts');

test('inactive account policy keeps company thresholds explicit', () => {
  assert.equal(INACTIVE_ACCOUNT_DISABLE_DAYS, 60);
  assert.equal(DISABLED_ACCOUNT_PURGE_DAYS, 6);
});

test('inactive account lifecycle has a cron entry point and blocks disabled logins', () => {
  const route = fs.readFileSync(
    new URL('../../src/app/api/cron/account-lifecycle/route.ts', import.meta.url),
    'utf8'
  );
  const auth = fs.readFileSync(
    new URL('../../src/lib/apiAuth.ts', import.meta.url),
    'utf8'
  );

  assert.match(route, /processInactiveAccounts/);
  assert.match(route, /processScheduledDeletions/);
  assert.match(auth, /status === 'disabled'/);
});

test('inactive account lifecycle migration adds disabled state and audit columns', () => {
  const sql = fs.readFileSync(
    new URL('../../supabase/migrations/20260808130000_inactive_account_lifecycle.sql', import.meta.url),
    'utf8'
  );

  assert.match(sql, /ADD VALUE 'disabled'/);
  assert.match(sql, /disabled_at/);
  assert.match(sql, /disabled_reason/);
});
