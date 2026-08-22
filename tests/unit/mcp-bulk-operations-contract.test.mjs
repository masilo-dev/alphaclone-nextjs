import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const helperPath = path.join(root, 'src/lib/mcp/bulkOperations.ts');
const toolPath = path.join(root, 'src/lib/mcp/tools/bulk-operations.ts');
const manifestPath = path.join(root, 'src/services/mcp/toolManifest.ts');

describe('safe bulk MCP operations contract', () => {
  it('keeps bounded record, upload, and email batch sizes', () => {
    const source = readFileSync(helperPath, 'utf8');
    assert.match(source, /MAX_RECORDS_PER_BATCH = 250/);
    assert.match(source, /MAX_MEDIA_PER_BATCH = 50/);
    assert.match(source, /MAX_EMAIL_RECIPIENTS_PER_BATCH = 100/);
  });

  it('defaults record changes and email sends to dry-run with explicit execution confirmation', () => {
    const source = readFileSync(helperPath, 'utf8');
    assert.match(source, /const dryRun = args\.dry_run !== false/);
    assert.match(source, /args\.confirm_execute !== true/);
    assert.match(source, /args\.confirm_send !== true/);
    assert.match(source, /idempotency_key is required when dry_run is false/);
  });

  it('registers the three public bulk MCP tools in both connector and manifest surfaces', () => {
    const toolSource = readFileSync(toolPath, 'utf8');
    const manifestSource = readFileSync(manifestPath, 'utf8');
    for (const name of ['bulk_update_records', 'bulk_upload_media', 'send_bulk_email']) {
      assert.match(toolSource, new RegExp(`name: '${name}'`));
      assert.match(manifestSource, new RegExp(`name: '${name}'`));
    }
  });
});
