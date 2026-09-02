/**
 * Regression tests for the eight known MCP audit failures.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { buildIlikeOrFilter, escapeIlikePattern, quotePostgrestFilterValue } = await import(
  '../../src/lib/db/postgrestFilters.ts'
);
const {
  parseFacebookGraphError,
  formatFacebookGraphErrorMessage,
  sanitizeFacebookPayload,
} = await import('../../src/lib/facebook/parseFacebookGraphError.ts');
const { normalizeAgentRunExecutionMode } = await import(
  '../../src/lib/bonnie/runtime/goalRunService.ts'
);

test('postgrest ilike filter quotes commas and preserves search terms', () => {
  const filter = buildIlikeOrFilter(['name', 'email'], 'Acme, Inc.');
  assert.match(filter, /name\.ilike\."%Acme, Inc\.%"/);
  assert.match(filter, /email\.ilike\."%Acme, Inc\.%"/);
});

test('postgrest ilike filter escapes wildcard characters in user input', () => {
  assert.equal(escapeIlikePattern('100%_done'), '100\\%\\_done');
  const quoted = quotePostgrestFilterValue('%wild%');
  assert.equal(quoted, '"%wild%"');
});

test('facebook graph error parser captures code, subcode and fbtrace_id', () => {
  const details = parseFacebookGraphError(400, {
    error: {
      message: 'An unknown error has occurred.',
      type: 'OAuthException',
      code: 190,
      error_subcode: 460,
      fbtrace_id: 'ABC123',
      error_user_msg: 'Page token expired',
    },
  });
  assert.equal(details.error_code, 190);
  assert.equal(details.error_subcode, 460);
  assert.equal(details.fbtrace_id, 'ABC123');
  assert.match(formatFacebookGraphErrorMessage(details), /code=190/);
  assert.match(formatFacebookGraphErrorMessage(details), /fbtrace_id=ABC123/);
  assert.doesNotMatch(formatFacebookGraphErrorMessage(details), /access_token/i);
});

test('facebook payload sanitizer removes access tokens', () => {
  const cleaned = sanitizeFacebookPayload({
    id: 'post-1',
    access_token: 'secret-token',
    nested: { page_access_token: 'also-secret' },
  });
  assert.equal(cleaned.access_token, '[REDACTED]');
  assert.equal(cleaned.nested.page_access_token, '[REDACTED]');
  assert.equal(cleaned.id, 'post-1');
});

test('agent run execution mode normalizes autonomous alias', () => {
  assert.equal(normalizeAgentRunExecutionMode('autonomous'), 'fully_autonomous');
  assert.equal(normalizeAgentRunExecutionMode('auto'), 'fully_autonomous');
  assert.equal(normalizeAgentRunExecutionMode('approval'), 'approval_required');
});

test('search_clients is registered in tool registry', async () => {
  const { initializeRegistry, hasTool } = await import('../../src/lib/mcp/tool-registry.ts');
  initializeRegistry();
  assert.equal(hasTool('search_clients'), true);
});

test('upload_social_media schema accepts base64, data_url and source_url aliases', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/social-publishing.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /base64:/);
  assert.match(src, /data_url:/);
  assert.match(src, /source_url:/);
  assert.match(src, /type: 'base64'/);
  assert.match(src, /type: 'data_url'/);
  assert.match(src, /type: 'url'/);
});

test('add_note writes CRM activity for contact notes', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/autonomous-ops.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /logCrmActivityAdmin/);
  assert.match(src, /type: 'note'/);
});

test('list_pending_approvals merges agent_approvals and runner approvals', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/bonnie-approvals.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /autonomous_runner_approvals/);
  assert.match(src, /agent_approvals/);
});

test('send_email durable path falls back to direct send on enqueue failure', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/email-ops.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /Durable enqueue failed; falling back to direct send/);
});

test('get_calendly_status uses authoritative integration snapshot', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/services/mcp/MCPServer.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /getTenantIntegrationSnapshot/);
  assert.match(src, /booking_ready/);
});

test('integrations_status delegates to integrationStatusService', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/integrations-health.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /getTenantIntegrationSnapshot/);
});
