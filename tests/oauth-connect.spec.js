const { test, expect } = require('@playwright/test');

test.describe('OAuth connect routes (smoke)', () => {
  test('Zoho connect initiates redirect or auth gate', async ({ request }) => {
    const res = await request.get('/api/auth/zoho/connect', { maxRedirects: 0 });
    expect([302, 307, 401, 403]).toContain(res.status());
  });

  test('Microsoft connect route responds', async ({ request }) => {
    const res = await request.get('/api/auth/microsoft/connect', { maxRedirects: 0 });
    expect([302, 307, 401, 403]).toContain(res.status());
  });

  test('Email provider settings API requires tenantId', async ({ request }) => {
    const res = await request.get('/api/settings/email-provider');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/tenantId/i);
  });
});
