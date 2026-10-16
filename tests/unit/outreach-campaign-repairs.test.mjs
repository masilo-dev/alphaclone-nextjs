import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCrmDuplicate } from '../../src/lib/research/deduplication.ts';
import { recordInboundOutreachReply } from '../../src/lib/outreach/recordInboundOutreachReply.ts';

function createMockQuery(defaultData = null) {
  const query = {
    select: () => query,
    eq: () => query,
    neq: () => query,
    in: () => query,
    is: () => query,
    ilike: () => query,
    or: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({ data: defaultData, error: null }),
    single: async () => ({ data: defaultData, error: null }),
  };
  return query;
}

test('Zoho Mail binary attachment fallback sets strictly application/octet-stream', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../../src/services/zoho/ZohoMailService.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("'Content-Type': 'application/octet-stream'"), 'Must specify application/octet-stream for raw binary endpoint');
  assert.ok(!source.includes("fallbackHeaders['Content-Type'] = contentType;"), 'Must NOT override Content-Type with contentType in fallback');
});

test('checkCrmDuplicate detects existing leads by website/domain', async () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  let queryExecuted = false;

  const mockSupabase = {
    from(table) {
      if (table === 'leads') {
        const query = createMockQuery();
        query.ilike = (col, pattern) => {
          if (col === 'website' && pattern.includes('acme.com')) {
            queryExecuted = true;
            return createMockQuery({ id: 'lead-999', business_name: 'Acme Corp', website: 'https://acme.com' });
          }
          return createMockQuery(null);
        };
        return query;
      }
      return createMockQuery(null);
    },
  };

  const result = await checkCrmDuplicate(mockSupabase, tenantId, {
    business_name: 'Acme Corporation',
    website: 'https://acme.com/contact',
  });

  assert.equal(queryExecuted, true, 'Must execute domain query against leads table');
  assert.equal(result.isDuplicate, true);
  assert.equal(result.matchType, 'crm_lead');
  assert.equal(result.matchedEntityId, 'lead-999');
});

test('recordInboundOutreachReply matches campaign_recipients when sequence enrollment is missing', async () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  let campaignRecipientUpdated = false;
  let leadUpdated = false;
  let outreachEventInserted = false;
  let dealCreated = false;

  const mockAdmin = {
    from(table) {
      if (table === 'outreach_sequence_enrollments') {
        return createMockQuery(null);
      }
      if (table === 'campaign_recipients') {
        const query = createMockQuery({
          id: 'cr-456',
          campaign_id: 'camp-123',
          email: 'prospect@business.com',
          contact_id: 'contact-789',
          status: 'sent',
        });
        query.update = (patch) => {
          if (patch.status === 'replied') campaignRecipientUpdated = true;
          return createMockQuery(null);
        };
        return query;
      }
      if (table === 'lead_outreach_log') {
        return createMockQuery(null);
      }
      if (table === 'leads') {
        const query = createMockQuery({
          id: 'lead-111',
          business_name: 'Prospect Biz',
          contact_name: 'Jane Doe',
          email: 'prospect@business.com',
          assigned_to: 'user-sales-1',
        });
        query.update = (patch) => {
          if (patch.outreach_status === 'replied') leadUpdated = true;
          return createMockQuery(null);
        };
        return query;
      }
      if (table === 'outreach_events') {
        return {
          upsert: (row) => {
            outreachEventInserted = true;
            return {
              select: () => ({
                maybeSingle: async () => ({ data: { id: 'event-1' }, error: null }),
              }),
            };
          },
        };
      }
      if (table === 'tenant_users') {
        return createMockQuery({ user_id: 'user-sales-1' });
      }
      if (table === 'revenue_lifecycle_links') {
        const query = createMockQuery(null);
        query.insert = async () => ({ data: null, error: null });
        return query;
      }
      if (table === 'deals') {
        return {
          insert: (dealData) => {
            dealCreated = true;
            return {
              select: () => ({
                single: async () => ({ data: { id: 'deal-new-1', ...dealData }, error: null }),
              }),
            };
          },
        };
      }
      return createMockQuery(null);
    },
  };

  const outcome = await recordInboundOutreachReply({
    admin: mockAdmin,
    tenantId,
    channel: 'email',
    sender: 'prospect@business.com',
    text: 'Yes, this looks great! Let us schedule a call next Tuesday.',
    provider: 'resend',
  });

  assert.equal(outcome.matched, true);
  assert.equal(outcome.classification, 'positive');
  assert.equal(campaignRecipientUpdated, true, 'Campaign recipient status must be updated to replied');
  assert.equal(leadUpdated, true, 'Lead outreach_status must be updated to replied');
  assert.equal(outreachEventInserted, true, 'Outreach event must be recorded');
  assert.equal(dealCreated, true, 'Positive reply must generate an opportunity deal');
});

test('MCP campaign tools parity: create_campaign, preview_campaign_audience, request_campaign_approval, and get_campaign_analytics are registered', async () => {
  const fs = await import('node:fs');
  const campaignsSrc = fs.readFileSync(new URL('../../src/lib/mcp/tools/campaigns.ts', import.meta.url), 'utf8');

  assert.match(campaignsSrc, /name:\s*['"]create_campaign['"]/);
  assert.match(campaignsSrc, /name:\s*['"]preview_campaign_audience['"]/);
  assert.match(campaignsSrc, /name:\s*['"]request_campaign_approval['"]/);
  assert.match(campaignsSrc, /name:\s*['"]get_campaign_analytics['"]/);
  assert.match(campaignsSrc, /name:\s*['"]campaign_brief['"]/);
  assert.match(campaignsSrc, /name:\s*['"]campaign_diagnose['"]/);
});
