/**
 * Opening "New chat" in the Bonnie console showed a 9-day-old message from a
 * different thread and used it as the new conversation's title.
 *
 * `useBonniePersistence` keyed localStorage per conversation but its DB sync
 * was tenant-wide (the API then returns the *latest* conversation), so every
 * conversation-scoped panel pulled in another thread's history. The hook must
 * pass `conversationId` on both the GET hydrate and the POST batch save, and
 * the console's chat panel must hand the id to the hook.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.resolve(here, rel), 'utf8');

describe('Bonnie persistence is scoped to the active conversation', () => {
  const hook = read('../../src/hooks/useBonniePersistence.ts');

  it('accepts a conversationId option', () => {
    assert.match(hook, /conversationId\?: string \| null;/);
    assert.match(hook, /conversationId = null,/);
  });

  it('hydrates from the DB with the conversation id (not the tenant\'s latest thread)', () => {
    assert.match(hook, /params\.set\('conversationId', conversationId\)/);
    assert.match(hook, /await loadFromDB\(tenantId, conversationId\)/);
  });

  it('saves the batch against the same conversation', () => {
    assert.match(hook, /saveToDBBatch\(tenantId, messages\.filter\(\(m\) => m\.id !== 'intro'\), conversationId\)/);
    assert.match(hook, /conversationId \? \{ tenantId, conversationId, messages \} : \{ tenantId, messages \}/);
  });

  it('re-syncs when the conversation changes', () => {
    assert.match(hook, /\[hydrated, tenantId, conversationId, storageKey, buildIntro\]/);
  });

  it('BonnieChatPanel passes its conversationId into the hook', () => {
    const panel = read('../../src/components/dashboard/bonnie/BonnieChatPanel.tsx');
    const block = panel.slice(panel.indexOf('useBonniePersistence({'), panel.indexOf('introMessage,', panel.indexOf('useBonniePersistence({')));
    assert.match(block, /\n\s+conversationId,\n/);
  });

  it('renders "Unlimited" instead of "-1 / -1 left" for unlimited AI plans', () => {
    const panel = read('../../src/components/dashboard/bonnie/BonnieChatPanel.tsx');
    assert.match(panel, /aiQuota\.limit < 0 \?/);
    assert.match(panel, />Unlimited</);
  });
});
