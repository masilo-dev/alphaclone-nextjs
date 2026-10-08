import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
function load(path, dependencies = {}) {
  const source = fs.readFileSync(
    new URL(`../../${path}`, import.meta.url),
    'utf8',
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(
    code,
    {
      exports,
      require: (name) =>
        dependencies[name] ??
        (name.startsWith('.') || name.startsWith('@/') ? {} : require(name)),
      crypto,
      Buffer,
      AbortSignal,
      Uint8Array,
      console,
      process,
      setTimeout,
      clearTimeout,
      Date,
      Error,
    },
    { filename: path },
  );
  return exports;
}
const normalization = load('src/lib/email/mailboxNormalization.ts');
const { explicitRecipients, mailboxDate, replyRecipients } = normalization;
test('direct recipients are validated without CRM; header injection and malformed lists rejected', () => {
  assert.equal(
    explicitRecipients('person@example.com')[0],
    'person@example.com',
  );
  assert.equal(
    explicitRecipients(['One@example.com', 'two@example.com']).length,
    2,
  );
  for (const value of [
    'invalid@',
    'person@example.com\r\nBcc: victim@example.com',
    'one@example.com,two@example.com',
    [],
  ])
    assert.throws(() => explicitRecipients(value));
});
test('Zoho millisecond dates normalize; reply-all excludes own aliases and duplicates', () => {
  assert.equal(mailboxDate('1791409299508'), '2026-10-07T21:41:39.508Z');
  const r = replyRecipients(
    {
      from: 'Sender <sender@example.com>',
      reply_to: 'reply@example.com',
      to: ['owner@example.com', 'other@example.com'],
      cc: ['OTHER@example.com', 'cc@example.com'],
    },
    ['owner@example.com'],
    true,
  );
  assert.equal(r.to.join(','), 'reply@example.com,other@example.com');
  assert.equal(r.cc.join(','), 'cc@example.com');
});
function memoryDb() {
  const tables = {
    email_provider_accounts: [
      {
        id: 'account',
        tenant_id: 'tenant',
        owner_user_id: 'owner',
        provider: 'zoho',
        account_type: 'user',
        email_address: null,
        provider_account_id: null,
        capabilities: {},
        settings: {},
        sync_status: 'not_started',
        last_successful_sync_at: null,
        deleted_at: null,
      },
      {
        id: 'foreign',
        tenant_id: 'foreign-tenant',
        owner_user_id: 'owner',
        provider: 'zoho',
        account_type: 'user',
        deleted_at: null,
      },
      {
        id: 'platform',
        tenant_id: 'tenant',
        owner_user_id: 'owner',
        provider: 'brevo',
        account_type: 'platform',
        deleted_at: null,
      },
    ],
    email_messages: [],
    email_mailbox_sync_jobs: [],
  };
  const calls = [];
  return {
    tables,
    calls,
    from(table) {
      let filters = [],
        patch,
        insert,
        single = false,
        ordering,
        range;
      const query = {
        select() {
          return query;
        },
        eq(k, v) {
          filters.push((r) => r[k] === v);
          return query;
        },
        is(k, v) {
          filters.push((r) => (r[k] ?? null) === v);
          return query;
        },
        in(k, v) {
          filters.push((r) => v.includes(r[k]));
          return query;
        },
        order(k, opts) {
          ordering = [k, opts];
          return query;
        },
        range(a, b) {
          range = [a, b];
          return query;
        },
        limit() {
          return query;
        },
        maybeSingle() {
          single = true;
          return query;
        },
        single() {
          single = true;
          return query;
        },
        update(v) {
          patch = v;
          return query;
        },
        insert(v) {
          insert = v;
          return query;
        },
        then(resolve) {
          calls.push(table);
          let rows = (tables[table] || []).filter((r) =>
            filters.every((f) => f(r)),
          );
          if (insert) {
            if (
              table === 'email_mailbox_sync_jobs' &&
              tables[table].some(
                (r) =>
                  r.provider_account_id === insert.provider_account_id &&
                  ['pending', 'running'].includes(r.status),
              )
            )
              return Promise.resolve({ error: { code: '23505' } }).then(
                resolve,
              );
            const row = {
              id: crypto.randomUUID(),
              cursor: {},
              message_count: 0,
              updated_at: new Date().toISOString(),
              ...insert,
            };
            (tables[table] ||= []).push(row);
            rows = [row];
          }
          if (patch) rows.forEach((r) => Object.assign(r, patch));
          if (ordering)
            rows.sort(
              (a, b) =>
                String(a[ordering[0]]).localeCompare(String(b[ordering[0]])) *
                (ordering[1].ascending ? 1 : -1),
            );
          if (range) rows = rows.slice(range[0], range[1] + 1);
          return Promise.resolve({
            data: single ? rows[0] || null : rows,
            error: null,
          }).then(resolve);
        },
      };
      return query;
    },
    async rpc(name, args) {
      assert.equal(name, 'ingest_mailbox_message');
      assert.equal(args.p_tenant, 'tenant');
      const m = args.p_message;
      const old = tables.email_messages.find(
        (r) =>
          r.provider_message_id === m.id &&
          r.provider_account_id === args.p_account,
      );
      if (old) {
        old.metadata = m;
        return { data: old.id, error: null };
      }
      const row = {
        id: crypto.randomUUID(),
        tenant_id: args.p_tenant,
        provider_account_id: args.p_account,
        provider_message_id: m.id,
        provider_thread_id: m.thread_id,
        folder_id: m.folder_id,
        folder_name: m.folder_name,
        metadata: m,
        mailbox_sort_at: m.date,
        received_at: m.date,
      };
      tables.email_messages.push(row);
      return { data: row.id, error: null };
    },
  };
}
function mailboxFixture({ empty = false, failure = null } = {}) {
  const db = memoryDb();
  let reads = 0;
  const raw = {
    messageId: 'native-message',
    folderId: 'inbox-id',
    receivedTime: '1791409299508',
  };
  const full = {
    id: 'native-message',
    thread_id: 'thread',
    from: 'sender@example.com',
    to: ['owner@example.com'],
    cc: [],
    subject: 'Owner test',
    date: '1791409299508',
    is_read: false,
    folder_id: 'inbox-id',
    body_text: 'Full body',
    body_html: '<p>Full body</p>',
    attachments: [],
  };
  const provider = {
    async verifyMailboxAccess() {
      if (failure) throw failure;
      return {
        account_id: 'native-account',
        address: 'owner@example.com',
        verified_at: new Date().toISOString(),
        send_scope_granted: null,
      };
    },
    async getFolders() {
      return [{ folderId: 'inbox-id', folderName: 'Inbox' }];
    },
    async getMessages() {
      reads++;
      if (failure) throw failure;
      return empty ? [] : [raw];
    },
    async getFullMessagePayload() {
      return full;
    },
    async searchMessages() {
      if (failure) throw failure;
      return empty ? [] : [raw];
    },
  };
  const { MailboxService, mailboxError } = load(
    'src/lib/email/mailboxService.ts',
    {
      '@/lib/supabase-admin': { createSupabaseAdminClient: () => db },
      './mailboxNormalization': normalization,
    },
  );
  const service = new MailboxService('tenant', 'owner', db);
  service.provider = () => provider;
  return {
    db,
    service,
    provider,
    full,
    get reads() {
      return reads;
    },
    mailboxError,
  };
}
test('real mailbox list/content/search share provider IDs and canonical persisted records', async () => {
  const f = mailboxFixture();
  const list = await f.service.list({ limit: 1 });
  assert.equal(list.messages[0].provider_message_id, 'native-message');
  assert.equal(list.messages[0].unread, true);
  assert.equal(list.freshness.source, 'provider_live');
  const body = await f.service.content(list.messages[0].message_id);
  assert.equal(body.body_text, 'Full body');
  const found = await f.service.list({ query: 'subject:Owner test', limit: 1 });
  assert.equal(found.messages[0].message_id, list.messages[0].message_id);
  assert.equal(f.db.tables.email_messages.length, 1);
  assert.equal(f.db.calls.includes('project_email_dispatches'), false);
});
test('verified empty inbox is separate from auth, permission and provider failures', async () => {
  const empty = await mailboxFixture({ empty: true }).service.list({});
  assert.equal(empty.empty, true);
  assert.equal(empty.freshness.source, 'provider_live');
  for (const error of [
    Object.assign(new Error('Missing scope'), { status: 403 }),
    new Error('auth expired'),
    new Error('provider HTTP 500'),
  ]) {
    const f = mailboxFixture({ failure: error });
    await assert.rejects(() => f.service.list({}));
    const results = await f.service.discover();
    assert.equal(results[0].read_access, 'failed');
    assert.ok(results[0].error.code);
  }
});
test('sync completion follows persistence and repeated sync deduplicates canonical messages', async () => {
  const f = mailboxFixture();
  const job = await f.service.sync();
  assert.equal(job.status, 'completed');
  assert.equal(job.message_count, 1);
  assert.equal(f.db.tables.email_messages.length, 1);
  assert.equal(f.db.tables.email_provider_accounts[0].sync_status, 'healthy');
  await f.service.sync();
  assert.equal(f.db.tables.email_messages.length, 1);
  assert.equal((await f.service.syncStatus(job.id)).status, 'completed');
});
test('bounded sync exposes pending job and resumes without fake completion', async () => {
  const f = mailboxFixture();
  let page = 0;
  f.provider.getMessages = async () => {
    page++;
    return page <= 2
      ? Array.from({ length: 10 }, (_, i) => ({
          messageId: `${page}-${i}`,
          receivedTime: '1791409299508',
        }))
      : [];
  };
  f.provider.getFullMessagePayload = async (m) => ({
    ...f.full,
    id: m.messageId,
  });
  const first = await f.service.sync();
  assert.equal(first.status, 'pending');
  assert.equal(first.message_count, 20);
  assert.ok(first.next_action);
  const resumed = await f.service.sync('account', first.id);
  assert.equal(resumed.status, 'completed');
  assert.equal(f.db.tables.email_messages.length, 20);
});
test('message, job and account lookup cannot escape tenant; platform cannot be ordinary mailbox', async () => {
  const f = mailboxFixture();
  await assert.rejects(() => f.service.account('foreign'));
  await assert.rejects(() => f.service.account('platform'));
  f.db.tables.email_messages.push({
    id: 'foreign-message',
    tenant_id: 'foreign-tenant',
    provider_account_id: 'account',
  });
  await assert.rejects(() => f.service.content('foreign-message'));
  assert.equal(
    (await f.service.accounts()).some((r) => r.id === 'foreign'),
    false,
  );
});
test('conversation is ordered by mail time with explicit cache completeness and pagination', async () => {
  const f = mailboxFixture();
  await f.service.list({});
  const r = await f.service.conversation('thread');
  assert.equal(r.messages.length, 1);
  assert.equal(r.freshness.source, 'cached');
  assert.ok(r.completeness);
});
class BaseZoho {
  constructor() {}
  async getConfig() {
    return { mailApiHost: 'mail.zoho.eu', accountId: 'native-account' };
  }
  async getValidAccessToken() {
    return 'test';
  }
}
const { ZohoMailService } = load('src/services/zoho/ZohoMailService.ts', {
  './ZohoService': { ZohoService: BaseZoho },
  '@/lib/email/mailboxNormalization': normalization,
  '@/lib/email/emailComposition': {
    normalizeEmailSubject: (s) => s,
    ensureFooter: (s) => s,
  },
  '@/lib/email/parseEmailHeader': { formatMailFrom: (p) => p.address || p.raw },
});
test('native reply posts to source-message endpoint; reply-all preserves correct recipients', async () => {
  const zoho = new ZohoMailService();
  const calls = [];
  zoho.getSenderAddresses = async () => ['owner@example.com'];
  zoho.callZohoAPI = async (url, opts) => {
    calls.push({ url, body: opts?.body && JSON.parse(opts.body) });
    return { data: { messageId: 'real-reference' } };
  };
  const original = {
    id: 'source',
    thread_id: 'thread',
    subject: 'Owner test',
    from: 'sender@example.com',
    to: ['owner@example.com', 'other@example.com'],
    cc: ['cc@example.com'],
  };
  const result = await zoho.replyToMessage({
    messageId: 'source',
    bodyHtml: '<p>Reply</p>',
    original,
    replyAll: true,
  });
  assert.equal(result.data.messageId, 'real-reference');
  const call = calls[0];
  assert.ok(call.url.endsWith('/messages/source'));
  assert.equal(call.body.action, 'reply');
  assert.equal(call.body.toAddress, 'sender@example.com,other@example.com');
  assert.equal(call.body.ccAddress, 'cc@example.com');
});
test('native reply never invents a provider reference; invalid provider payload is not empty success', async () => {
  const zoho = new ZohoMailService();
  zoho.getSenderAddresses = async () => ['owner@example.com'];
  zoho.callZohoAPI = async () => ({ data: {} });
  await assert.rejects(
    () =>
      zoho.replyToMessage({
        messageId: 'source',
        bodyHtml: 'Reply',
        original: {
          from: 'sender@example.com',
          to: [],
          cc: [],
          subject: 'Test',
        },
      }),
    (e) => e.code === 'OUTCOME_UNKNOWN',
  );
  await assert.rejects(
    () => zoho.getMessages('folder'),
    /INVALID_MESSAGE_RESPONSE/,
  );
  await assert.rejects(
    () => zoho.searchMessages('test'),
    /INVALID_SEARCH_RESPONSE/,
  );
});
test('actual send gateway facade carries cc/bcc and exact HTML content', async () => {
  let delivered;
  const { EmailExecutionService } = load(
    'src/lib/email/emailExecutionService.ts',
    {
      '@/lib/email/emailExecutionContext': {
        assertEmailExecutionContext: (x) => x,
        buildTenantEmailIdempotencyKey: () => 'stable',
      },
      '@/lib/email/emailGateway': {
        sendViaEmailGateway: async (x) => {
          delivered = x;
          return { success: true };
        },
      },
    },
  );
  await EmailExecutionService.execute({
    context: { tenantId: 'tenant', userId: 'owner' },
    sourceModule: 'mcp',
    sourceAction: 'send_email',
    to: ['Person@example.com'],
    cc: ['cc@example.com'],
    bcc: ['bcc@example.com'],
    subject: 'Test',
    html: '<p>Exact body</p>',
    category: 'transactional',
    preserveContent: true,
    skipRecipientGate: true,
  });
  assert.equal(delivered.to[0], 'Person@example.com');
  assert.equal(delivered.cc[0], 'cc@example.com');
  assert.equal(delivered.bcc[0], 'bcc@example.com');
  assert.equal(delivered.html, '<p>Exact body</p>');
  assert.equal(delivered.skipRecipientGate, true);
});
function handlerFixture() {
  const f = mailboxFixture(),
    handlers = {},
    sent = [],
    receipts = new Map();
  const okResult = (tool, data, opts = {}) => ({
    ok: true,
    tool,
    data,
    error: null,
    ...opts,
  });
  const db = f.db;
  const originalFrom = db.from.bind(db);
  db.from = (table) => {
    if (['contacts', 'leads', 'business_clients'].includes(table))
      throw new Error('Direct send touched CRM');
    if (table === 'external_actions')
      return { upsert: async () => ({ error: null }) };
    return originalFrom(table);
  };
  class Mailbox {
    constructor(tenant, user) {
      assert.equal(tenant, 'tenant');
      assert.equal(user, 'owner');
      return f.service;
    }
  }
  load('src/lib/mcp/tools/email-ops.ts', {
    '@/lib/email/mailboxService': { MailboxService: Mailbox },
    '@/lib/email/mailboxNormalization': normalization,
    '@/lib/mcp/connector': {
      defineConnectorTool: (o) => {
        handlers[o.name] = o;
      },
      tenantIdField: require('zod').z.string(),
    },
    '@/lib/mcp/connector/response': {
      okResult,
      throwConnectorError: (code, message) => {
        throw Object.assign(new Error(message), { code });
      },
    },
    '@/lib/supabase-admin': { createSupabaseAdminClient: () => db },
    '@/lib/mcp/actionReadiness': {
      resolveMcpActionReadiness: async () => ({
        email_send: { executable: true },
      }),
    },
    '@/lib/mcp/actionReceipts': {
      findReceiptByIdempotency: async ({ idempotencyKey }) =>
        receipts.get(idempotencyKey),
      persistActionReceipt: async () => {},
    },
    '@/lib/email/emailReceiptEvidence': {
      emailReceiptEvidence: async () => ({}),
    },
    '@/lib/email/sendEmailServer': {
      sendEmailServer: async (input) => {
        sent.push(input);
        return {
          success: true,
          emailId: 'accepted-id',
          provider: 'zoho',
          canonicalMessageId: 'canonical',
          providerAccountId: 'account',
        };
      },
    },
    '@/lib/mcp/executionGateway': {
      executeMcpWrite: async (p) => {
        const result = await p.execute({ actionId: 'action' });
        const receipt = p.buildReceipt(result);
        receipts.set(p.idempotencyKey, {
          success: true,
          action_id: 'action',
          final_status: 'provider_accepted',
          sanitized_output: result,
          provider: 'zoho',
          provider_reference: result.emailId,
        });
        return { ok: true, result, receipt, actionId: 'action' };
      },
    },
  });
  const invoke = (name, args) =>
    handlers[name].handler(handlers[name].inputSchema.parse(args), {
      tenantId: 'tenant',
      userId: 'owner',
    });
  return { ...f, invoke, sent, handlers };
}
test('production MCP handlers list/read/search/conversation/sync route to canonical mailbox', async () => {
  const f = handlerFixture();
  const list = await f.invoke('read_emails', { limit: 1 });
  assert.equal(list.receipt.status, 'completed');
  const id = list.data.messages[0].message_id;
  const body = await f.invoke('read_email_content', { message_id: id });
  assert.equal(body.data.body_text, 'Full body');
  assert.equal(
    (await f.invoke('search_emails', { query: 'Owner' })).data.messages[0]
      .message_id,
    id,
  );
  assert.equal(
    (await f.invoke('read_email_conversation', { thread_id: 'thread' })).data
      .messages.length,
    1,
  );
  const job = await f.invoke('sync_all_inboxes', {});
  assert.equal(job.data.status, 'completed');
  assert.equal(job.receipt.status, 'completed');
});
test('production send_email handler sends to non-CRM recipients with all fields and duplicate-safe replay', async () => {
  const f = handlerFixture();
  const args = {
    to: ['new@example.com', 'second@example.com'],
    cc: ['cc@example.com'],
    bcc: ['bcc@example.com'],
    subject: 'Owner test',
    html: '<p>Exact HTML</p>',
    attachments: [{ filename: 'test.txt', content: 'aGk=' }],
    idempotency_key: 'test-only',
  };
  const first = await f.invoke('send_email', args);
  await f.invoke('send_email', args);
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].to.join(','), 'new@example.com,second@example.com');
  assert.equal(f.sent[0].cc[0], 'cc@example.com');
  assert.equal(f.sent[0].bcc[0], 'bcc@example.com');
  assert.equal(f.sent[0].html, args.html);
  assert.equal(f.sent[0].skipRecipientGate, true);
  assert.equal(f.sent[0].providerAccountId, 'account');
  assert.equal(f.sent[0].attachments[0].content, 'aGk=');
  assert.equal(first.data.delivery_status, 'provider_accepted');
  assert.equal(first.receipt.status, 'provider_accepted');
  assert.equal(f.db.calls.includes('contacts'), false);
});
test('invalid direct recipient cannot reach provider send or CRM lookup', async () => {
  const f = handlerFixture();
  await assert.rejects(() =>
    f.invoke('send_email', { to: 'wrong@', subject: 'Test', text: 'Test' }),
  );
  assert.equal(f.sent.length, 0);
});
test('production argument normalization preserves recipients, HTML and stable retry keys', async () => {
  const tiers = load('src/lib/mcp/toolRiskTiers.ts');
  const { normalizeToolArguments } = load(
    'src/lib/mcp/normalizeToolArguments.ts',
    {
      '@/lib/mcp/toolRiskTiers': tiers,
      '@/lib/mcp/integrationDefaults': {
        resolveEmailIntegrationDefaults: () => {
          throw new Error('Unexpected provider substitution');
        },
      },
    },
  );
  const args = {
    to: ['first@example.com', 'second@example.com'],
    subject: 'Test',
    html: '<p>Exact HTML</p>',
  };
  const a = await normalizeToolArguments('send_email', args, {
    tenantId: 'tenant',
    userId: 'owner',
  });
  const b = await normalizeToolArguments('send_email', args, {
    tenantId: 'tenant',
    userId: 'owner',
  });
  assert.equal(a.to.join(','), args.to.join(','));
  assert.equal(a.html, args.html);
  assert.equal(a.text, undefined);
  assert.equal(a.provider, undefined);
  assert.equal(a.idempotency_key, b.idempotency_key);
});
test('provider long IDs survive JSON parsing without precision loss', () => {
  const { parseZohoPayload } = load('src/services/zoho/ZohoService.ts');
  const result = parseZohoPayload(
    '{"data":{"messageId":1791409299569005601,"folderId":8563655000000002014}}',
  );
  assert.equal(result.data.messageId, '1791409299569005601');
  assert.equal(result.data.folderId, '8563655000000002014');
});

test('multi-provider adapter dispatch supports Zoho, Microsoft Graph and Gmail; sending-only providers rejected', async () => {
  const db = memoryDb();
  db.tables.email_provider_accounts.push(
    {
      id: 'ms-account',
      tenant_id: 'tenant',
      owner_user_id: 'owner',
      provider: 'microsoft_graph',
      account_type: 'user',
      email_address: 'owner@outlook.com',
      deleted_at: null,
      capabilities: {},
      sync_status: 'not_started',
    },
    {
      id: 'gmail-account',
      tenant_id: 'tenant',
      owner_user_id: 'owner',
      provider: 'gmail',
      account_type: 'user',
      email_address: 'owner@gmail.com',
      deleted_at: null,
      capabilities: {},
      sync_status: 'not_started',
    },
    {
      id: 'brevo-account',
      tenant_id: 'tenant',
      owner_user_id: 'owner',
      provider: 'brevo',
      account_type: 'user',
      email_address: 'notifications@alphaclonesystems.com',
      deleted_at: null,
      capabilities: {},
      sync_status: 'not_started',
    },
    {
      id: 'unknown-account',
      tenant_id: 'tenant',
      owner_user_id: 'owner',
      provider: 'some_smtp_only',
      account_type: 'user',
      email_address: 'other@example.com',
      deleted_at: null,
      capabilities: {},
      sync_status: 'not_started',
    },
  );

  const {
    MailboxService,
    MicrosoftGraphMailboxAdapter,
    GmailMailboxAdapter,
    mailboxError,
  } = load('src/lib/email/mailboxService.ts', {
    '@/lib/supabase-admin': { createSupabaseAdminClient: () => db },
    './mailboxNormalization': normalization,
  });

  const service = new MailboxService('tenant', 'owner', db);

  // 1. Microsoft Graph account resolves correctly
  const msAccount = await service.account('ms-account');
  assert.equal(msAccount.provider, 'microsoft_graph');
  const msAdapter = service.provider(msAccount);
  assert.ok(msAdapter instanceof MicrosoftGraphMailboxAdapter);

  // 2. Gmail account resolves correctly
  const gmAccount = await service.account('gmail-account');
  assert.equal(gmAccount.provider, 'gmail');
  const gmAdapter = service.provider(gmAccount);
  assert.ok(gmAdapter instanceof GmailMailboxAdapter);

  // 3. Sending-only provider (Brevo) rejected with EMAIL_MAILBOX_NOT_SUPPORTED
  await assert.rejects(
    () => service.account('brevo-account'),
    (err) => {
      assert.match(err.message, /^EMAIL_MAILBOX_NOT_SUPPORTED:/);
      assert.match(err.message, /sending-only/);
      return true;
    },
  );

  // 4. Unknown provider rejected with EMAIL_READ_ADAPTER_UNAVAILABLE
  await assert.rejects(
    () => service.account('unknown-account'),
    (err) => {
      assert.match(err.message, /^EMAIL_READ_ADAPTER_UNAVAILABLE:/);
      return true;
    },
  );

  // 5. Error mapping translates Microsoft reconnect and secret mismatch errors
  const errReconnect = mailboxError(
    new Error('MICROSOFT_RECONNECT_REQUIRED: Token invalid'),
  );
  assert.equal(errReconnect.code, 'EMAIL_RECONNECT_REQUIRED');

  const errSecretMismatch = mailboxError(
    new Error(
      'Stored token could not be decrypted with any configured secret',
    ),
  );
  assert.equal(errSecretMismatch.code, 'EMAIL_AUTH_EXPIRED');

  // 6. Discover reports sending-only as unsupported
  const discovered = await service.discover();
  const brevoDiscovered = discovered.find((d) => d.account_id === 'brevo-account');
  assert.equal(brevoDiscovered?.read_access, 'unsupported');
});

