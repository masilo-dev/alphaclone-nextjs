/**
 * Tests for AppOperationalError taxonomy and email error classification.
 * Ensures permanent config errors are correctly identified to prevent
 * infinite task-reminder re-queuing.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyEmailError,
  isPermanentEmailConfigError,
  AppOperationalError,
} from '../../src/lib/errors/AppOperationalError.ts';

describe('AppOperationalError', () => {
  it('is constructable with all required fields', () => {
    const err = new AppOperationalError('test failure', {
      code: 'CONFIG_MISSING',
      category: 'PERMANENT_CONFIGURATION_ERROR',
      retryable: false,
      provider: 'brevo',
      tenantId: 'tenant-123',
    });
    assert.equal(err.name, 'AppOperationalError');
    assert.equal(err.code, 'CONFIG_MISSING');
    assert.equal(err.category, 'PERMANENT_CONFIGURATION_ERROR');
    assert.equal(err.retryable, false);
    assert.equal(err.provider, 'brevo');
    assert.equal(err.tenantId, 'tenant-123');
    assert.equal(err.message, 'test failure');
    assert.ok(err instanceof Error, 'extends Error');
  });
});

describe('classifyEmailError', () => {
  it('classifies CONFIG_MISSING as permanent, non-retryable', () => {
    const r = classifyEmailError('CONFIG_MISSING', undefined);
    assert.equal(r.category, 'PERMANENT_CONFIGURATION_ERROR');
    assert.equal(r.retryable, false);
  });

  it('classifies EMAIL_PROVIDER_UNAVAILABLE as permanent, non-retryable', () => {
    const r = classifyEmailError('EMAIL_PROVIDER_UNAVAILABLE', undefined);
    assert.equal(r.category, 'PERMANENT_CONFIGURATION_ERROR');
    assert.equal(r.retryable, false);
  });

  it('classifies EMAIL_PROVIDER_ACCOUNT_TENANT_MISMATCH as permanent', () => {
    const r = classifyEmailError('EMAIL_PROVIDER_ACCOUNT_TENANT_MISMATCH', undefined);
    assert.equal(r.category, 'PERMANENT_CONFIGURATION_ERROR');
    assert.equal(r.retryable, false);
  });

  it('classifies ALL_PROVIDERS_FAILED with sender-email error as permanent', () => {
    const r = classifyEmailError(
      'ALL_PROVIDERS_FAILED',
      'All configured email providers failed: brevo: Tenant provider sender email is missing',
    );
    assert.equal(r.category, 'PERMANENT_CONFIGURATION_ERROR');
    assert.equal(r.retryable, false);
  });

  it('classifies ALL_PROVIDERS_FAILED with network error as transient', () => {
    const r = classifyEmailError(
      'ALL_PROVIDERS_FAILED',
      'All configured email providers failed: brevo: connect ETIMEDOUT',
    );
    assert.equal(r.category, 'TRANSIENT_PROVIDER_ERROR');
    assert.equal(r.retryable, true);
  });

  it('classifies ALL_PROVIDERS_FAILED with no connected provider as permanent', () => {
    const r = classifyEmailError(
      'ALL_PROVIDERS_FAILED',
      'No connected email provider is configured for this tenant',
    );
    assert.equal(r.category, 'PERMANENT_CONFIGURATION_ERROR');
    assert.equal(r.retryable, false);
  });

  it('classifies LOCAL_EMAIL_PERSISTENCE_FAILED as transient', () => {
    const r = classifyEmailError('LOCAL_EMAIL_PERSISTENCE_FAILED', undefined);
    assert.equal(r.category, 'TRANSIENT_PROVIDER_ERROR');
    assert.equal(r.retryable, true);
  });

  it('classifies INTERNAL_ERROR as non-retryable', () => {
    const r = classifyEmailError('INTERNAL_ERROR', 'something broke');
    assert.equal(r.category, 'INTERNAL_ERROR');
    assert.equal(r.retryable, false);
  });

  it('returns INTERNAL_ERROR for no code and no error', () => {
    const r = classifyEmailError(undefined, undefined);
    assert.equal(r.category, 'INTERNAL_ERROR');
    assert.equal(r.retryable, false);
  });
});

describe('isPermanentEmailConfigError', () => {
  it('returns true for CONFIG_MISSING', () => {
    assert.equal(isPermanentEmailConfigError('CONFIG_MISSING', undefined), true);
  });

  it('returns true for brevo sender email missing error', () => {
    assert.equal(
      isPermanentEmailConfigError(
        'ALL_PROVIDERS_FAILED',
        'All configured email providers failed: brevo: Tenant provider sender email is missing',
      ),
      true,
    );
  });

  it('returns false for transient network failure', () => {
    assert.equal(
      isPermanentEmailConfigError('ALL_PROVIDERS_FAILED', 'brevo: connect ETIMEDOUT'),
      false,
    );
  });

  it('returns false for persistence failure', () => {
    assert.equal(isPermanentEmailConfigError('LOCAL_EMAIL_PERSISTENCE_FAILED', undefined), false);
  });

  it('returns false for undefined code and error', () => {
    assert.equal(isPermanentEmailConfigError(undefined, undefined), false);
  });
});
