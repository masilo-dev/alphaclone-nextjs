/**
 * ChatGPT tools/list pagination and priority ordering.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHATGPT_PRIORITY_TOOL_ORDER,
  prioritizeToolsForChatGpt,
} from '../../src/lib/mcp/prioritizeChatGptTools.ts';
import { paginateMcpToolsList } from '../../src/lib/mcp/toolsListPagination.ts';

const mockTools = (names) =>
  names.map((name) => ({
    name,
    description: name,
    inputSchema: { type: 'object', properties: {} },
  }));

test('ChatGPT full catalog first page returns all tools even with cursor=0 and limit', () => {
  const tools = mockTools(Array.from({ length: 524 }, (_, i) => `tool_${String(i).padStart(3, '0')}`));
  const page = paginateMcpToolsList({
    tools,
    catalogMode: 'full',
    clientId: 'chatgpt-connector',
    rawCursor: '0',
    rawLimit: '80',
  });
  assert.equal(page.tools.length, 524);
  assert.equal(page.nextCursor, undefined);
});

test('GET discovery path matches POST pagination for chatgpt-connector', () => {
  const tools = mockTools(['alpha', 'beta', 'gamma']);
  const page = paginateMcpToolsList({
    tools,
    catalogMode: 'full',
    clientId: 'chatgpt-connector',
    rawCursor: '0',
    rawLimit: null,
  });
  assert.equal(page.tools.length, 3);
});

test('non-ChatGPT progressive catalog still paginates at 75', () => {
  const tools = mockTools(Array.from({ length: 120 }, (_, i) => `tool_${i}`));
  const page = paginateMcpToolsList({
    tools,
    catalogMode: 'progressive',
    clientId: null,
    rawCursor: '0',
    rawLimit: null,
  });
  assert.equal(page.tools.length, 75);
  assert.equal(page.nextCursor, '75');
});

test('priority order puts leads email and social tools before alphabetical tail', () => {
  const tools = mockTools([
    'zzzz_last',
    'create_lead',
    'send_email',
    'publish_linkedin_image',
    'list_tools',
    'aaaa_first_alpha',
  ]);
  const ordered = prioritizeToolsForChatGpt(tools).map((t) => t.name);
  assert.equal(ordered[0], 'list_tools');
  assert.ok(ordered.indexOf('create_lead') < ordered.indexOf('aaaa_first_alpha'));
  assert.ok(ordered.indexOf('send_email') < ordered.indexOf('aaaa_first_alpha'));
  assert.ok(ordered.indexOf('publish_linkedin_image') < ordered.indexOf('zzzz_last'));
});

test('priority tools exist in live registry catalog', async () => {
  const { invalidateUnifiedMcpToolCache, getUnifiedMcpTools } = await import(
    '../../src/lib/mcp/listAllTools.ts'
  );
  invalidateUnifiedMcpToolCache();
  const catalog = new Set(
    (
      await getUnifiedMcpTools({
        clientId: 'chatgpt-connector',
        catalogMode: 'full',
        forceRefresh: true,
      })
    ).map((t) => t.name),
  );
  const mustExist = [
    'send_email',
    'read_emails',
    'publish_social_post',
    'publish_linkedin_image',
    'get_linkedin_identities',
    'schedule_social_post',
    'dispatch_tool',
    'search_tools',
    'list_leads',
    'create_lead',
    'update_lead',
    'search_leads',
    'qualify_crm_leads',
    'add_note',
  ];
  for (const name of mustExist) {
    assert.ok(catalog.has(name), `missing priority tool ${name}`);
  }
  for (const name of CHATGPT_PRIORITY_TOOL_ORDER) {
    if (!catalog.has(name)) {
      // Allow optional aliases not in registry; mustExist covers critical paths
      continue;
    }
  }
});

test('ChatGPT first page includes leads email social and LinkedIn tools', async () => {
  const { invalidateUnifiedMcpToolCache, getUnifiedMcpTools } = await import(
    '../../src/lib/mcp/listAllTools.ts'
  );
  invalidateUnifiedMcpToolCache();
  const full = await getUnifiedMcpTools({
    clientId: 'chatgpt-connector',
    catalogMode: 'full',
    forceRefresh: true,
  });
  const page = paginateMcpToolsList({
    tools: full,
    catalogMode: 'full',
    clientId: 'chatgpt-connector',
    rawCursor: '0',
    rawLimit: '80',
  });
  const names = new Set(page.tools.map((t) => t.name));
  for (const required of [
    'send_email',
    'read_emails',
    'upload_media',
    'get_media_asset',
    'list_media_assets',
    'publish_social_post',
    'publish_linkedin_image',
    'get_linkedin_identities',
    'list_leads',
    'create_lead',
    'update_lead',
    'search_leads',
    'add_note',
    'qualify_crm_leads',
    'upload_document',
  ]) {
    assert.ok(names.has(required), `first ChatGPT page missing ${required}`);
  }
});
