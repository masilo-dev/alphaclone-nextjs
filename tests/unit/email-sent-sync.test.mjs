import test from 'node:test';
import assert from 'node:assert/strict';
import { syncExternalMessageAdmin } from '../../src/services/unified/unifiedMessageAdmin.ts';

test('syncExternalMessageAdmin defaults outbound messages to sent folder, read=true, needs_response=false', async () => {
  let capturedInsert = null;
  const mockSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null }),
            }),
          }),
        }),
      }),
      insert: (payload) => ({
        select: () => ({
          single: async () => {
            capturedInsert = payload;
            return { data: { id: 'mock-id', ...payload }, error: null };
          },
        }),
      }),
    }),
  };

  await syncExternalMessageAdmin(mockSupabase, {
    tenant_id: 'test-tenant',
    source: 'zoho',
    external_id: 'ext-123',
    direction: 'outbound',
    channel: 'email',
    subject: 'Outbound Subject',
    body: 'Hello',
    html_body: '<p>Hello</p>',
    from_address: 'sender@example.com',
    to_address: 'recipient@example.com',
  });

  assert.ok(capturedInsert, 'Insert payload should be captured');
  assert.equal(capturedInsert.folder, 'sent');
  assert.equal(capturedInsert.read, true);
  assert.equal(capturedInsert.needs_response, false);
  assert.equal(capturedInsert.html_body, '<p>Hello</p>');
  assert.equal(capturedInsert.direction, 'outbound');
});

test('syncExternalMessageAdmin defaults inbound messages to inbox folder, read=false, needs_response=true', async () => {
  let capturedInsert = null;
  const mockSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null }),
            }),
          }),
        }),
      }),
      insert: (payload) => ({
        select: () => ({
          single: async () => {
            capturedInsert = payload;
            return { data: { id: 'mock-id', ...payload }, error: null };
          },
        }),
      }),
    }),
  };

  await syncExternalMessageAdmin(mockSupabase, {
    tenant_id: 'test-tenant',
    source: 'zoho',
    external_id: 'ext-456',
    direction: 'inbound',
    channel: 'email',
    subject: 'Inbound Subject',
    body: 'Hello inbound',
    from_address: 'client@example.com',
    to_address: 'sender@example.com',
  });

  assert.ok(capturedInsert, 'Insert payload should be captured');
  assert.equal(capturedInsert.folder, 'inbox');
  assert.equal(capturedInsert.read, false);
  assert.equal(capturedInsert.needs_response, true);
  assert.equal(capturedInsert.direction, 'inbound');
});

test('mailbox ingest passes resolved folder_id to ingest_mailbox_message RPC', async () => {
  const { MailboxService } = await import('../../src/lib/email/mailboxService.ts');
  let capturedRpcArgs = null;
  const createChain = () => {
    const chain = {
      eq: () => chain,
      single: async () => ({ data: { id: 'account-1' }, error: null }),
      maybeSingle: async () => ({ data: { id: 'account-1' }, error: null }),
    };
    return chain;
  };

  const mockDb = {
    from: () => ({
      select: () => createChain(),
      update: () => ({ eq: () => ({ eq: () => ({ error: null }) }) }),
    }),
    rpc: async (fnName, args) => {
      capturedRpcArgs = { fnName, args };
      return { data: 'mock-rpc-result', error: null };
    },
  };

  const service = new MailboxService('tenant-1', 'user-1');
  service.db = mockDb;

  const mockAccount = {
    id: 'account-1',
    tenant_id: 'tenant-1',
    provider: 'zoho',
    email_address: 'test@example.com',
  };

  const mockMessage = {
    id: 'msg-1',
    subject: 'Test Subject',
    from: 'test@example.com',
    to: ['recipient@example.com'],
    date: new Date().toISOString(),
    is_read: true,
  };

  await service.ingest(mockAccount, mockMessage, 'sent', 'folder-sent-888');

  assert.ok(capturedRpcArgs, 'RPC should be called');
  assert.equal(capturedRpcArgs.fnName, 'ingest_mailbox_message');
  assert.equal(capturedRpcArgs.args.p_message.folder_id, 'folder-sent-888');
  assert.equal(capturedRpcArgs.args.p_message.folder_name, 'sent');
});
