import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('Hermes is integrated behind AlphaClone auth and tenant boundaries', () => {
  const route = read('src/app/api/agents/tasks/route.ts');
  assert.match(route, /requireTenantAccess/);
  assert.match(route, /agent_runs/);
  assert.match(route, /dispatchHermesTask/);
  assert.match(route, /evaluateHermesPolicy/);
  assert.match(route, /execution_mode/);
  assert.match(route, /status: decision\.allowed \? 'pending' : 'waiting'/);
});

test('Hermes adapter is server-side and disabled when not configured', () => {
  const client = read('src/lib/hermes/client.ts');
  assert.match(client, /HERMES_INTERNAL_URL/);
  assert.match(client, /HERMES_INTERNAL_API_KEY/);
  assert.match(client, /HERMES_LOCAL_MODE/);
  assert.match(client, /createInitialGraphForObjective/);
  assert.match(client, /Hermes internal service is not configured/);
  assert.doesNotMatch(client, /NEXT_PUBLIC_HERMES/);
});

test('Hermes plan explicitly preserves Bonnie and MCP', () => {
  const doc = read('docs/HERMES_AGENT_INTEGRATION_PLAN.md');
  assert.match(doc, /Bonnie remains/);
  assert.match(doc, /MCP routes/);
  assert.match(doc, /must never call Hermes directly/i);
});

test('Bonnie chat can delegate durable background work to Hermes', () => {
  const catalog = read('src/lib/bonnie/bonnieToolCatalog.ts');
  const customTools = read('src/lib/bonnie/bonnieCustomTools.ts');
  const prompt = read('src/lib/bonnie/bonnieSystemPrompt.ts');

  assert.match(catalog, /'delegate_to_hermes'/);
  assert.match(customTools, /tool === 'delegate_to_hermes'/);
  assert.match(customTools, /source: 'bonnie_chat'/);
  assert.match(customTools, /dispatchHermesTask/);
  assert.match(prompt, /delegate_to_hermes starts durable background AlphaClone agent tasks from Bonnie chat/);
});
