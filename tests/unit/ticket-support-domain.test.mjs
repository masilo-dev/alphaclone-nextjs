import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  extractTicketReference,
  matchInboundTicket,
  publicDeliveryLabel,
  statusAfterCustomerReply,
  waitingResponsibility,
} from '../../src/lib/support/ticketDomain.ts';

const candidates = [{
  ticketId: 'ticket-1',
  ticketNumber: 'TKT-0042',
  internetMessageIds: ['<root@example.test>'],
  providerMessageIds: ['provider-root'],
  providerThreadIds: ['provider-thread'],
}];

test('deduplicates a provider delivery before threading', () => {
  assert.deepEqual(
    matchInboundTicket({ providerMessageId: 'provider-root' }, candidates),
    { kind: 'existing_message', ticketId: 'ticket-1' }
  );
});

test('threads using RFC headers and never a similar subject', () => {
  assert.equal(matchInboundTicket({ inReplyTo: '<ROOT@example.test>' }, candidates).kind, 'ticket');
  assert.deepEqual(matchInboundTicket({ subject: 'Re: ordinary matching title' }, candidates), {
    kind: 'new_ticket',
  });
  assert.equal(extractTicketReference('Re: [Ticket #TKT-0042] Login'), 'TKT-0042');
});

test('customer replies reopen completed and customer-waiting tickets', () => {
  assert.equal(statusAfterCustomerReply('resolved'), 'open');
  assert.equal(statusAfterCustomerReply('waiting_on_customer'), 'open');
  assert.equal(waitingResponsibility('waiting_on_business'), 'business');
  assert.equal(waitingResponsibility('waiting_on_customer'), 'customer');
});

test('open tracking is qualified and not inferred from sending', () => {
  assert.equal(publicDeliveryLabel({ applicationStatus: 'sent' }), 'Sent');
  assert.equal(
    publicDeliveryLabel({ applicationStatus: 'sent', deliveryStatus: 'opened' }),
    'Opened (provider reported)'
  );
});

test('live support producers use the canonical tickets table', async () => {
  const files = [
    'src/app/api/tickets/route.ts',
    'src/app/api/mcp/route.ts',
    'src/app/api/webhooks/whatsapp/route.ts',
    'src/lib/bonnie/bonnieWorkspaceSnapshot.ts',
  ];
  for (const file of files) {
    const source = await readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\.from\(['"]support_tickets['"]\)/, file);
  }
});
