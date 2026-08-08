import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../..', import.meta.url);
const source = readFileSync(new URL('src/lib/bonnie/bonnieToolCatalog.ts', root), 'utf8');

function quotedValues(text) {
  return [...text.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

function constArray(name) {
  const match = source.match(new RegExp(`export const ${name} = \\[(.*?)\\] as const;`, 's'));
  assert.ok(match, `${name} was not found`);
  return quotedValues(match[1]);
}

test('Bonnie module hints only reference advertised tools', () => {
  const advertised = new Set([
    ...constArray('BONNIE_REGISTRY_TOOLS'),
    ...constArray('BONNIE_MCP_SERVER_TOOLS'),
    ...constArray('BONNIE_CUSTOM_TOOLS'),
  ]);

  const moduleSection = source.split('export const BONNIE_MODULE_HINTS')[1]?.split('export function resolveBonnieModuleFromPath')[0] || '';
  const hintedTools = quotedValues(moduleSection).filter((value) => /^[a-z][a-z0-9_]+$/.test(value));
  const missing = [...new Set(hintedTools.filter((tool) => !advertised.has(tool)))];

  assert.deepEqual(missing, []);
});
