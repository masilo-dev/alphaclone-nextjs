/**
 * AI image provider errors + Facebook text-only fallback detection.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const { parseImageProviderError } = await import('../../src/lib/ai/imageProviderErrors.ts');
const {
  isFacebookMediaAttachmentError,
  shouldFallbackFacebookPublishToTextOnly,
} = await import('../../src/lib/social/facebookTextOnlyFallback.ts');
const { parseFacebookGraphError } = await import('../../src/lib/facebook/parseFacebookGraphError.ts');

describe('parseImageProviderError', () => {
  it('detects inactive billing and enables text-only fallback', () => {
    const parsed = parseImageProviderError({
      httpStatus: 429,
      provider: 'openai',
      payload: {
        error: {
          code: 'billing_hard_limit_reached',
          message: 'Billing hard limit has been reached',
        },
      },
    });
    assert.equal(parsed.code, 'IMAGE_PROVIDER_BILLING_INACTIVE');
    assert.equal(parsed.fallbackToTextOnly, true);
    assert.match(parsed.message, /billing/i);
  });

  it('maps auth failures without blaming Facebook', () => {
    const parsed = parseImageProviderError({
      httpStatus: 401,
      provider: 'openai',
      payload: { error: { message: 'Incorrect API key provided' } },
    });
    assert.equal(parsed.code, 'IMAGE_PROVIDER_AUTH');
    assert.equal(parsed.fallbackToTextOnly, true);
  });
});

describe('Facebook media fallback detection', () => {
  it('flags media URL fetch failures for text-only retry', () => {
    const body = {
      error: {
        message: 'Failed to fetch the file from URL',
        code: 100,
        error_subcode: 1366046,
      },
    };
    assert.equal(isFacebookMediaAttachmentError(400, body), true);
  });

  it('does not fallback on permission errors', () => {
    const parsed = parseFacebookGraphError(403, {
      error: {
        message: '(#200) Requires pages_manage_posts permission',
        code: 200,
      },
    });
    assert.equal(shouldFallbackFacebookPublishToTextOnly(parsed), false);
  });
});
