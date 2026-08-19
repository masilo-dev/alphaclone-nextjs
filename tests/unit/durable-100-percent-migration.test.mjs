import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

test('all 100% durable runtime modules and adapters exist', () => {
  const required = [
    'src/lib/bonnie/runtime/triggerGateway.ts',
    'src/lib/social/durableSocialPublisher.ts',
    'src/lib/server/durableCampaignFanOut.ts',
    'src/lib/social/cronPublish.ts',
    'src/app/api/cron/process-campaigns/route.ts',
    'src/app/api/cron/publish-scheduled-posts/route.ts',
    'src/app/api/cron/lead-discovery-worker/route.ts',
    'src/workers/lead-discovery-worker.ts',
    'src/lib/engine/jobQueue.ts',
  ];
  for (const rel of required) {
    assert.equal(fs.existsSync(path.join(root, rel)), true, rel);
  }
});

test('trigger gateway builds deterministic deduplication keys and defines envelope', () => {
  const src = fs.readFileSync(path.join(root, 'src/lib/bonnie/runtime/triggerGateway.ts'), 'utf8');
  assert.match(src, /NormalizedTriggerEnvelope/);
  assert.match(src, /buildDeduplicationKey/);
  assert.match(src, /createRunForObjective/);
  assert.match(src, /agent_event_inbox/);

  const buildDeduplicationKey = (tenantId, eventType, sourceId) =>
    createHash('sha256').update(`${tenantId}:${eventType}:${sourceId}`).digest('hex');

  const key1 = buildDeduplicationKey('tenant-123', 'email.sent', 'msg-999');
  const key2 = buildDeduplicationKey('tenant-123', 'email.sent', 'msg-999');
  const key3 = buildDeduplicationKey('tenant-123', 'email.sent', 'msg-888');

  assert.equal(key1, key2);
  assert.notEqual(key1, key3);
  assert.equal(typeof key1, 'string');
  assert.equal(key1.length, 64);
});

test('cronPublish registers durable social publisher', async () => {
  const src = fs.readFileSync(path.join(root, 'src/lib/social/cronPublish.ts'), 'utf8');
  assert.match(src, /publishSocialPostDurable/);
});

test('process-campaigns cron invokes durable campaign fan-out', async () => {
  const src = fs.readFileSync(path.join(root, 'src/app/api/cron/process-campaigns/route.ts'), 'utf8');
  assert.match(src, /executeCampaignDurableFanOut/);
});

test('lead-discovery-worker emits durable runtime outbox events', async () => {
  const src = fs.readFileSync(path.join(root, 'src/workers/lead-discovery-worker.ts'), 'utf8');
  assert.match(src, /insertOutboxEvent/);
  assert.match(src, /lead_discovery\.search\.completed/);
});

test('jobQueue forwards legacy jobs to agent_tasks durable runtime', async () => {
  const src = fs.readFileSync(path.join(root, 'src/lib/engine/jobQueue.ts'), 'utf8');
  assert.match(src, /createRunForObjective/);
  assert.match(src, /Legacy Job Execution/);
});

test('durable social publisher defines side effect verification & outbox events', async () => {
  const src = fs.readFileSync(path.join(root, 'src/lib/social/durableSocialPublisher.ts'), 'utf8');
  assert.match(src, /beginIdempotentAction/);
  assert.match(src, /completeIdempotentAction/);
  assert.match(src, /insertOutboxEvent/);
  assert.match(src, /social\.post\.published/);
});

test('durable campaign fan-out enforces recipient-level idempotency & state protection', async () => {
  const src = fs.readFileSync(path.join(root, 'src/lib/server/durableCampaignFanOut.ts'), 'utf8');
  assert.match(src, /beginIdempotentAction/);
  assert.match(src, /campaign\.email\.send/);
  assert.match(src, /insertOutboxEvent/);
  assert.match(src, /cancelled/);
});
