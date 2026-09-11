import test from 'node:test';
import assert from 'node:assert/strict';

const {
  resolveLinkedInOrganizationId,
  fetchFacebookPostMetrics,
} = await import('../../src/lib/social/syncSocialPostAnalytics.ts');

test('resolveLinkedInOrganizationId prefers explicit organization id', () => {
  const orgId = resolveLinkedInOrganizationId({
    id: 'post-1',
    tenant_id: 'tenant-1',
    platforms: ['linkedin'],
    facebook_post_id: null,
    facebook_page_id: null,
    linkedin_post_urn: 'urn:li:share:1',
    linkedin_organization_id: '12345',
    linkedin_author_urn: null,
    metadata: null,
    published_at: null,
  });
  assert.equal(orgId, '12345');
});

test('resolveLinkedInOrganizationId extracts org from author URN', () => {
  const orgId = resolveLinkedInOrganizationId({
    id: 'post-2',
    tenant_id: 'tenant-1',
    platforms: ['linkedin'],
    facebook_post_id: null,
    facebook_page_id: null,
    linkedin_post_urn: 'urn:li:share:2',
    linkedin_organization_id: null,
    linkedin_author_urn: 'urn:li:organization:98765',
    metadata: null,
    published_at: null,
  });
  assert.equal(orgId, '98765');
});

test('fetchFacebookPostMetrics parses insights and summary payloads', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('/insights?')) {
      return new Response(
        JSON.stringify({
          data: [
            { name: 'post_impressions', values: [{ value: 120 }] },
            { name: 'post_engaged_users', values: [{ value: 15 }] },
            { name: 'post_clicks', values: [{ value: 4 }] },
            { name: 'post_reactions_by_type_total', values: [{ value: 9 }] },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({
        comments: { summary: { total_count: 3 } },
        reactions: { summary: { total_count: 11 } },
        shares: { count: 2 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const metrics = await fetchFacebookPostMetrics('token', 'fb-post-1');
    assert.equal(metrics.impressions, 120);
    assert.equal(metrics.clicks, 4);
    assert.equal(metrics.comments, 3);
    assert.equal(metrics.shares, 2);
    assert.equal(metrics.reactions, 11);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
