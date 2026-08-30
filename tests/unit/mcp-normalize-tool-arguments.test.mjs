import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeToolArguments } from '../../src/lib/mcp/normalizeToolArguments.ts';
import { resolveMcpToolName } from '../../src/lib/mcp/canonicalToolRegistry.ts';

test('resolveMcpToolName maps common chat-agent aliases', () => {
  assert.equal(resolveMcpToolName('send_mail'), 'send_email');
  assert.equal(resolveMcpToolName('post_to_social'), 'publish_social_post');
  assert.equal(resolveMcpToolName('publish_post'), 'publish_social_post');
});

test('normalizeToolArguments coalesces email fields and auto idempotency', async () => {
  const args = await normalizeToolArguments(
    'send_email',
    {
      to: 'client@example.com',
      subject: 'Hello',
      body: 'Quick update from AlphaClone.',
    },
    { tenantId: '00000000-0000-4000-8000-000000000001', userId: '00000000-0000-4000-8000-000000000002' }
  );

  assert.equal(args.to, 'client@example.com');
  assert.equal(args.text, 'Quick update from AlphaClone.');
  assert.match(String(args.idempotency_key), /^mcp-send_email-/);
});

test('normalizeToolArguments maps social post id aliases', async () => {
  const { normalizeToolArguments } = await import('../../src/lib/mcp/normalizeToolArguments.ts');
  const args = await normalizeToolArguments(
    'get_social_post',
    { post_id: '00000000-0000-4000-8000-000000000099' },
    { tenantId: '00000000-0000-4000-8000-000000000001', userId: '00000000-0000-4000-8000-000000000002' }
  );
  assert.equal(args.social_post_id, '00000000-0000-4000-8000-000000000099');
});

test('normalizeToolArguments coerces read_emails limit strings', async () => {
  const { normalizeToolArguments } = await import('../../src/lib/mcp/normalizeToolArguments.ts');
  const args = await normalizeToolArguments(
    'read_emails',
    { limit: '15' },
    { tenantId: '00000000-0000-4000-8000-000000000001', userId: '00000000-0000-4000-8000-000000000002' }
  );
  assert.equal(args.limit, 15);
});

test('normalizeToolArguments maps caption aliases for social publish', async () => {
  const args = await normalizeToolArguments(
    'publish_social_post',
    {
      content: 'Launch day post',
      image_url: 'https://cdn.example.com/photo.jpg',
    },
    { tenantId: '00000000-0000-4000-8000-000000000001', userId: '00000000-0000-4000-8000-000000000002' }
  );

  assert.equal(args.caption, 'Launch day post');
  assert.deepEqual(args.media_urls, ['https://cdn.example.com/photo.jpg']);
  assert.match(String(args.idempotency_key), /^mcp-publish_social_post-/);
});
