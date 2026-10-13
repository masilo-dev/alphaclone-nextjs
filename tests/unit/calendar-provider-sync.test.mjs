import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCalendlyScheduledEvents } from '../../src/lib/calendly/scheduledEventFeed.ts';

test('reconciliation reads all pages including canceled meetings', async () => {
 const calls = [];
 const result = await fetchCalendlyScheduledEvents('fake', 'https://api.calendly.com/users/test', '2026-10-01T00:00:00Z', async (url) => {
  calls.push(url);
  return Response.json({collection: [{uri: String(calls.length), status: calls.length === 1 ? 'active' : 'canceled'}],pagination: calls.length === 1 ? {next_page:'https://api.calendly.com/scheduled_events?page_token=next'} : {}});
 });
 assert.equal(result.length, 2);
 assert.equal(result[1].status, 'canceled');
 assert.equal(new URL(calls[0]).searchParams.has('status'),false);
});
test('expired OAuth and provider errors cannot report successful zero-event sync', async () => {
 await assert.rejects(fetchCalendlyScheduledEvents('fake','user','date',async () => new Response('',{status:401})), /reconnect Calendly/);
 await assert.rejects(fetchCalendlyScheduledEvents('fake','user','date',async () => new Response('',{status:503})), /503/);
});
test('partial pagination failures and credential-bearing off-provider URLs fail closed', async () => {
 let calls=0;
 await assert.rejects(fetchCalendlyScheduledEvents('fake','user','date',async () => {
  calls++;
  return Response.json({collection:[],pagination:{next_page:'https://example.com/steal'}});
 }),/Invalid Calendly pagination URL/);
 assert.equal(calls,1);
});
