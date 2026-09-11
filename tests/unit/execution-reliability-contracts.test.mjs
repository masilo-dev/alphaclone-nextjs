import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('one-shot social publishing is not swallowed by the global durable switch', () => {
  const source = read('src/lib/mcp/mcpDirectExecution.ts');
  assert.match(source, /ONE_SHOT_SOCIAL_TOOLS/);
  assert.match(source, /MCP_SOCIAL_DURABLE/);
  const socialCheck = source.indexOf("if (ONE_SHOT_SOCIAL_TOOLS.has(tool))");
  const globalCheck = source.indexOf("if (envTrue('MCP_FORCE_DURABLE'))");
  assert.ok(socialCheck >= 0 && globalCheck >= 0 && socialCheck < globalCheck);
});

test('normal MCP writes do not create agent runs implicitly', () => {
  const source = read('src/lib/mcp/executionGateway.ts');
  assert.match(source, /mirrorToDurableRuntime\?: boolean/);
  assert.match(source, /params\.mirrorToDurableRuntime === true/);
  assert.doesNotMatch(source, /import \{ processNormalizedTrigger \} from/);
  const optIn = source.indexOf('params.mirrorToDurableRuntime === true');
  const dynamicImport = source.indexOf("import('@/lib/bonnie/runtime/triggerGateway')");
  assert.ok(optIn >= 0 && dynamicImport >= 0);
});

test('social publish contract exposes human destinations', () => {
  const contract = read('src/lib/mcp/tools/socialPublishContract.ts');
  const handler = read('src/lib/mcp/tools/socialPublishTool.ts');
  assert.match(contract, /\['personal', 'organization', 'page'\]/);
  assert.match(contract, /destinationToIdentityType/);
  assert.match(handler, /requested_destination/);
  assert.match(handler, /TARGET_CONFLICT/);
});

test('lead finder has a canonical outreach-ready gate', () => {
  const core = read('src/lib/lead-finder/core.ts');
  const contactability = read('src/lib/lead-finder/contactability.ts');
  const crawler = read('src/lib/lead-finder/websiteCrawler.ts');
  assert.match(core, /if \(!requirements\.email && !requirements\.phone && !email && !phone\) return false/);
  assert.match(contactability, /outreach_ready/);
  assert.match(contactability, /needs_enrichment/);
  assert.match(crawler, /extractPublicPhones/);
  assert.match(crawler, /a\[href\^="tel:"\]/);
});

test('Hermes local delegation kicks the canonical durable runtime', () => {
  const hermes = read('src/lib/hermes/client.ts');
  assert.match(hermes, /scheduleReadyTasks/);
  assert.match(hermes, /publishOutboxBatch/);
  assert.match(hermes, /processClaimableTasks/);
  assert.match(hermes, /durable worker will continue it/);
});
