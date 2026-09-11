import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignHealth, classifyOutreachReply } from '../../src/lib/outreach/outreachIntelligence.ts';

test('reply classification covers operational reply routes', () => {
  assert.equal(classifyOutreachReply('Yes, please send me a proposal.'), 'positive');
  assert.equal(classifyOutreachReply('This is too expensive for our budget.'), 'objection');
  assert.equal(classifyOutreachReply('Not right now, circle back next quarter.'), 'not_now');
  assert.equal(classifyOutreachReply('You have the wrong person.'), 'wrong_person');
  assert.equal(classifyOutreachReply('Please unsubscribe me.'), 'unsubscribe');
});

test('campaign health pauses unsafe delivery', () => {
  const result = campaignHealth({ sent: 100, bounced: 7, complained: 0, unsubscribed: 0 });
  assert.equal(result.shouldPause, true);
  assert.match(result.reasons[0], /Bounce rate/);
  assert.equal(campaignHealth({ sent: 100, bounced: 1, complained: 0, unsubscribed: 0 }).safe, true);
});
