import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

test('Bonnie workspace shell components exist', () => {
  for (const rel of [
    'src/components/dashboard/bonnie/workspace/BonnieSidebar.tsx',
    'src/components/dashboard/bonnie/workspace/BonnieWelcome.tsx',
    'src/components/dashboard/bonnie/workspace/BonnieContextPanel.tsx',
    'src/components/dashboard/bonnie/workspace/BonnieToolActivityCard.tsx',
    'src/hooks/useBonnieConversations.ts',
    'src/app/api/bonnie/conversations/[id]/route.ts',
    'docs/BONNIE_WORKSPACE_REDESIGN.md',
  ]) {
    assert.equal(fs.existsSync(path.join(root, rel)), true, rel);
  }
});

test('conversations API supports list + create actions', () => {
  const src = fs.readFileSync(path.join(root, 'src/app/api/bonnie/conversations/route.ts'), 'utf8');
  assert.match(src, /list\s*=/);
  assert.match(src, /action === 'create'/);
  assert.match(src, /requireTenantAccess/);
});

test('conversation patch supports pin/archive/rename', () => {
  const src = fs.readFileSync(path.join(root, 'src/app/api/bonnie/conversations/[id]/route.ts'), 'utf8');
  assert.match(src, /pinned/);
  assert.match(src, /archive/);
  assert.match(src, /title/);
  assert.match(src, /DELETE/);
});

test('BonnieFullView mounts workspace shell pieces', () => {
  const src = fs.readFileSync(path.join(root, 'src/components/dashboard/bonnie/BonnieFullView.tsx'), 'utf8');
  assert.match(src, /BonnieSidebar/);
  assert.match(src, /BonnieWelcome/);
  assert.match(src, /BonnieContextPanel/);
  assert.match(src, /workspaceMode/);
  assert.match(src, /useBonnieConversations/);
});

test('Bonnie welcome headline exists', () => {
  const src = fs.readFileSync(
    path.join(root, 'src/components/dashboard/bonnie/workspace/BonnieWelcome.tsx'),
    'utf8',
  );
  assert.match(src, /What would you like Bonnie to handle today\?/);
});

test('Chat panel supports stop generation and activity cards', () => {
  const src = fs.readFileSync(path.join(root, 'src/components/dashboard/bonnie/BonnieChatPanel.tsx'), 'utf8');
  assert.match(src, /AbortController/);
  assert.match(src, /stopGeneration/);
  assert.match(src, /BonnieToolActivityCard/);
  assert.match(src, /workspaceMode/);
});

test('migration adds pinned/archived columns', () => {
  const src = fs.readFileSync(
    path.join(root, 'supabase/migrations/20260724153000_bonnie_conversation_workspace.sql'),
    'utf8',
  );
  assert.match(src, /ADD COLUMN IF NOT EXISTS pinned/);
  assert.match(src, /archived_at/);
});
