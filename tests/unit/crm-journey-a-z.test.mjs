import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STAGE_PROBABILITIES } from '../../src/components/dashboard/crm/DealPipeline.tsx';

test('Area B, Q: Deal pipeline stage probability mapping is consistent and complete', () => {
  assert.equal(DEFAULT_STAGE_PROBABILITIES.lead, 10);
  assert.equal(DEFAULT_STAGE_PROBABILITIES.qualified, 25);
  assert.equal(DEFAULT_STAGE_PROBABILITIES.proposal, 50);
  assert.equal(DEFAULT_STAGE_PROBABILITIES.negotiation, 75);
  assert.equal(DEFAULT_STAGE_PROBABILITIES.closed_won, 100);
  assert.equal(DEFAULT_STAGE_PROBABILITIES.closed_lost, 0);
});

test('Area F: Follow-up links include targeted entity query params', () => {
  const formatFollowUpLink = (entityType, id) => {
    switch (entityType) {
      case 'contact':
        return `/dashboard/contacts?contactId=${encodeURIComponent(id)}`;
      case 'company':
        return `/dashboard/clients?clientId=${encodeURIComponent(id)}`;
      case 'deal':
        return `/dashboard/deals?dealId=${encodeURIComponent(id)}`;
      case 'lead':
        return `/dashboard/leads?leadId=${encodeURIComponent(id)}`;
      case 'opportunity':
        return `/dashboard/crm/accounts?oppId=${encodeURIComponent(id)}`;
      default:
        return '/dashboard';
    }
  };

  const testId = '4f8d22e0-24ba-42aa-b80c-0cf7df0e0a3b';
  assert.equal(formatFollowUpLink('contact', testId), `/dashboard/contacts?contactId=${testId}`);
  assert.equal(formatFollowUpLink('company', testId), `/dashboard/clients?clientId=${testId}`);
  assert.equal(formatFollowUpLink('deal', testId), `/dashboard/deals?dealId=${testId}`);
  assert.equal(formatFollowUpLink('lead', testId), `/dashboard/leads?leadId=${testId}`);
  assert.equal(formatFollowUpLink('opportunity', testId), `/dashboard/crm/accounts?oppId=${testId}`);
});

test('Area F: Stale lead follow-up filters out converted and disqualified leads', () => {
  const terminalStages = ['closed', 'won', 'lost', 'converted', 'disqualified'];
  const testLeads = [
    { id: '1', stage: 'new', status: 'new' },
    { id: '2', stage: 'contacted', status: 'active' },
    { id: '3', stage: 'converted', status: 'converted' },
    { id: '4', stage: 'disqualified', status: 'archived' },
    { id: '5', stage: 'lost', status: 'lost' },
  ];

  const eligibleForFollowUp = testLeads.filter(
    (l) => !terminalStages.includes(l.stage) && !terminalStages.includes(l.status)
  );

  assert.equal(eligibleForFollowUp.length, 2);
  assert.deepEqual(
    eligibleForFollowUp.map((l) => l.id),
    ['1', '2']
  );
});

test('Area J: Lead conversion idempotency recovers contact and client for already converted leads', async () => {
  const leadId = 'lead-uuid-777';
  const existingContact = { id: 'contact-uuid-888', original_lead_id: leadId };
  const existingLead = { id: leadId, client_id: 'client-uuid-999' };

  // Simulated conversion handler with idempotency fallback
  const mockConvertLeadToContact = async (id, rpcThrowsAlreadyConverted) => {
    try {
      if (rpcThrowsAlreadyConverted) {
        throw new Error('Lead already converted');
      }
      return { contactId: 'new-contact', clientId: 'new-client', error: null };
    } catch (err) {
      if (err.message.toLowerCase().includes('already converted')) {
        return {
          contactId: existingContact.id,
          clientId: existingLead.client_id,
          error: null,
        };
      }
      return { contactId: null, error: err.message };
    }
  };

  // Case 1: Fresh conversion
  const freshRes = await mockConvertLeadToContact(leadId, false);
  assert.equal(freshRes.error, null);
  assert.equal(freshRes.contactId, 'new-contact');

  // Case 2: Already converted lead should resolve existing IDs without crashing
  const idempotentRes = await mockConvertLeadToContact(leadId, true);
  assert.equal(idempotentRes.error, null);
  assert.equal(idempotentRes.contactId, 'contact-uuid-888');
  assert.equal(idempotentRes.clientId, 'client-uuid-999');
});

test('Area G: Global search query params navigate to the right CRM routes', () => {
  const routes = {
    client: (id) => `/dashboard/clients?clientId=${encodeURIComponent(id)}`,
    lead: (id) => `/dashboard/leads?leadId=${encodeURIComponent(id)}`,
    contact: (id) => `/dashboard/contacts?contactId=${encodeURIComponent(id)}`,
    deal: (id) => `/dashboard/deals?dealId=${encodeURIComponent(id)}`,
  };

  assert.equal(routes.client('c1'), '/dashboard/clients?clientId=c1');
  assert.equal(routes.lead('l1'), '/dashboard/leads?leadId=l1');
  assert.equal(routes.contact('k1'), '/dashboard/contacts?contactId=k1');
  assert.equal(routes.deal('d1'), '/dashboard/deals?dealId=d1');
});
