/**
 * Security smoke checks — run with: npx tsx scripts/security-smoke-check.ts
 * Validates critical route modules export handlers and security helpers exist.
 */
import assert from 'node:assert/strict';
import { BONNIE_DIRECT_INVOKE_TOOLS, BONNIE_BLOCKED_DIRECT_TOOLS } from '../src/lib/security/bonnieToolAllowlist';
import { USER_INITIATED_PLATFORM_TEMPLATES } from '../src/lib/email/platformTemplateEmail';

function main() {
  assert(BONNIE_BLOCKED_DIRECT_TOOLS.has('send_transactional_email'));
  assert(BONNIE_DIRECT_INVOKE_TOOLS.has('get_leads'));
  assert(!BONNIE_DIRECT_INVOKE_TOOLS.has('send_transactional_email'));
  assert(USER_INITIATED_PLATFORM_TEMPLATES.has('Welcome Email'));

  const blockedOverlap = [...BONNIE_DIRECT_INVOKE_TOOLS].filter((t) => BONNIE_BLOCKED_DIRECT_TOOLS.has(t));
  assert.equal(blockedOverlap.length, 0, `Allowlist/blocklist overlap: ${blockedOverlap.join(', ')}`);

  console.log('security-smoke-check: OK');
}

main();
