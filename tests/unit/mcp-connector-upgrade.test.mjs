/**
 * MCP connector upgrade — media ingest + email tool registration contracts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

test('MediaInput types and ingestPublishMedia exist', async () => {
  const types = await import('../../src/lib/media/types.ts');
  assert.ok(types);
  const ingest = await import('../../src/lib/media/ingestMedia.ts');
  assert.equal(typeof ingest.ingestMediaInput, 'function');
  assert.equal(typeof ingest.ingestPublishMedia, 'function');
});

test('assertPublicMediaUrl blocks localhost/private SSRF targets', async () => {
  const { assertPublicMediaUrl } = await import('../../src/lib/social/mediaUpload.ts');
  assert.throws(() => assertPublicMediaUrl(new URL('http://127.0.0.1/x.png')));
  assert.throws(() => assertPublicMediaUrl(new URL('http://localhost/x.png')));
  assert.throws(() => assertPublicMediaUrl(new URL('http://192.168.1.10/x.png')));
  assert.throws(() => assertPublicMediaUrl(new URL('http://169.254.169.254/latest/meta-data')));
  assert.doesNotThrow(() => assertPublicMediaUrl(new URL('https://cdn.alphaclonesystems.com/a.png')));
});

test('email-ops and social-publishing source contracts', () => {
  const emailOps = fs.readFileSync(path.join(root, 'src/lib/mcp/tools/email-ops.ts'), 'utf8');
  assert.match(emailOps, /name: 'send_email'/);
  assert.match(emailOps, /name: 'create_email_draft'/);
  assert.match(emailOps, /name: 'reply_to_email'/);
  assert.match(emailOps, /RECIPIENT_AMBIGUOUS/);
  assert.match(emailOps, /sendEmailServer/);

  const social = fs.readFileSync(path.join(root, 'src/lib/mcp/tools/social-publishing.ts'), 'utf8');
  assert.match(social, /media:\s*z\.array/);
  assert.match(social, /ingestPublishMedia/);
  assert.match(social, /data_url/);

  const registry = fs.readFileSync(path.join(root, 'src/lib/mcp/tool-registry.ts'), 'utf8');
  assert.match(registry, /email-ops/);

  const annotations = fs.readFileSync(path.join(root, 'src/lib/mcp/toolAnnotations.ts'), 'utf8');
  assert.match(annotations, /'send_email'/);
  assert.match(annotations, /'list_media_assets'/);

  const tx = fs.readFileSync(path.join(root, 'src/lib/mcp/tools/autonomous-ops.ts'), 'utf8');
  assert.match(tx, /sendEmailServer/);
  assert.doesNotMatch(
    tx,
    /const provider = isDryRun\(\) \? 'dry_run' : args\.provider \|\| 'dry_run'/
  );
});

test('migration for external_actions and email_sender_addresses exists', () => {
  const mig = fs.readFileSync(
    path.join(root, 'supabase/migrations/20260724200000_mcp_connector_media_email_actions.sql'),
    'utf8'
  );
  assert.match(mig, /CREATE TABLE IF NOT EXISTS public\.external_actions/);
  assert.match(mig, /CREATE TABLE IF NOT EXISTS public\.email_sender_addresses/);
  assert.match(mig, /ENABLE ROW LEVEL SECURITY/);
});
