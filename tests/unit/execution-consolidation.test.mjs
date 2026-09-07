import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'path';
import { hasPhoneOrEmail, hasReachableContact } from '../../src/lib/scraper/contactGate.ts';
import { normalizeLegacyContractStatus } from '../../src/lib/contracts/contractManagerDomain.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.resolve(here, rel), 'utf8');

describe('Lead Finder truthfulness', () => {
  it('never treats a website as a phone or email', () => {
    assert.equal(hasPhoneOrEmail({ website: 'https://example.com' }), false);
    assert.equal(hasPhoneOrEmail({ email: 'a@b.com' }), true);
    assert.equal(hasPhoneOrEmail({ phone: '+1234567890' }), true);
    assert.equal(hasReachableContact({ website: 'https://example.com' }), true);
  });

  it('does not fall back to website-only rows when no contact exists', () => {
    const source = read('../../src/lib/scraper/leadFinderAutomation.ts');
    assert.equal(source.includes('withContact = finalResults'), false);
    assert.match(source, /has_contact: hasPhoneOrEmail\(lead\)/);
    assert.match(source, /from '@\/lib\/scraper\/contactGate'/);
  });

  it('retired the LLM lead fabricators', () => {
    const prospector = read('../../src/services/alpha/tools.ts');
    assert.match(prospector, /lead_prospector is retired/);
    assert.equal(prospector.includes('Prospect 5 high-value leads'), false);
    assert.equal(prospector.includes('@example.com'), false);
    const modal = read('../../src/components/dashboard/zoho/LeadOutreachModal.tsx');
    assert.equal(modal.includes('Generate 4 realistic'), false);
    assert.match(modal, /\/dashboard\/leads\/finder/);
  });

  it('MCP lead tools read scraper_leads, not fake scores from CRM', () => {
    const source = read('../../src/lib/mcp/tools/lead-scraping-ops.ts');
    assert.match(source, /bonnieFindAndQualifyLeads/);
    assert.match(source, /bonnieGetScraperLeads/);
    assert.equal(source.includes("from('free_places')"), false);
    assert.equal(source.includes('qualification_score: 85'), false);
  });
});

describe('CRM create_client schema', () => {
  it('stores source in custom_fields, never as business_clients.source', () => {
    const source = read('../../src/lib/mcp/tools/crm.ts');
    const createClient = source.slice(source.indexOf("name: 'create_client'"), source.indexOf("name: 'get_leads'"));
    assert.match(createClient, /lead_source: args.source/);
    assert.equal(createClient.includes('source: args.source || null'), false);
  });
});

describe('Contract lifecycle', () => {
  it('maps legacy statuses onto the canonical vocabulary', () => {
    assert.equal(normalizeLegacyContractStatus('fully_signed'), 'signed');
    assert.equal(normalizeLegacyContractStatus('client_signed'), 'partially_signed');
    assert.equal(normalizeLegacyContractStatus('rejected'), 'terminated');
    assert.equal(normalizeLegacyContractStatus('sent'), 'sent');
  });

  it('does not invent missing legal terms and persists versions', () => {
    const draft = read('../../src/services/contractService.ts');
    assert.equal(draft.includes('Populate with realistic, high-end defaults'), false);
    assert.match(draft, /UNRESOLVED:/);
    const versions = read('../../src/lib/mcp/tools/contracts-ops.ts');
    assert.match(versions, /from\('contract_versions'\)/);
    assert.match(versions, /\.insert\(/);
    const tasks = read('../../src/lib/contracts/contractSignedSteps.ts');
    assert.match(tasks, /toInsert/);
  });
});

describe('Bonnie user language', () => {
  it('does not tell users to run nexus_ tool names', () => {
    const source = read('../../src/components/dashboard/bonnie/BonnieFullView.tsx');
    assert.equal(source.includes('nexus_invoice_chasing'), false);
    assert.equal(source.includes('find_and_qualify_leads (or create_scraper_campaign'), false);
  });
});

describe('ToolPolicyGate control model', () => {
  it('auto-allows MCP only; Bonnie send/bulk/financial still hit the gate', () => {
    const source = read('../../src/lib/ai/ToolPolicyGate.ts');
    assert.match(source, /if \(source === 'mcp'\)/);
    assert.equal(source.includes("source === 'mcp' || source === 'bonnie'"), false);
    assert.match(source, /nexus_sales_campaign/);
  });
});

describe('Contract list buckets', () => {
  it('maps operational statuses onto All / Draft / Awaiting signature / Active', async () => {
    const {
      contractStatusBucket,
      contractMatchesListFilter,
      contractStatusLabel,
      isRenewalWatchStatus,
    } = await import('../../src/lib/contracts/contractManagerDomain.ts');
    assert.equal(contractStatusBucket('fully_signed'), 'active');
    assert.equal(contractStatusBucket('client_signed'), 'awaiting_signature');
    assert.equal(contractStatusBucket('sent'), 'awaiting_signature');
    assert.equal(contractStatusLabel('draft'), 'Draft');
    assert.equal(contractMatchesListFilter('fully_signed', 'active'), true);
    assert.equal(contractMatchesListFilter('sent', 'draft'), false);
    assert.equal(isRenewalWatchStatus('fully_signed'), true);
    assert.equal(isRenewalWatchStatus('rejected'), false);
  });
});

describe('LinkedIn verification', () => {
  it('does not mark LinkedIn published until a GET confirms the URN', () => {
    const source = read('../../src/lib/social/SocialPublishingService.ts');
    const publish = source.slice(
      source.indexOf('async publishToLinkedIn'),
      source.indexOf('async publishToProvider')
    );
    assert.match(publish, /verifyLinkedInUrn/);
    assert.equal(publish.includes('verified: true'), false);
    const helpers = read('../../src/lib/social/linkedinPublishHelpers.ts');
    assert.match(helpers, /export async function confirmLinkedInPublish/);
    assert.match(helpers, /ugcPosts/);
  });
});

describe('Lead Finder workspace', () => {
  it('exposes contactable/saved metrics and a map view on the canonical page', () => {
    const source = read('../../src/components/dashboard/leads/ScraperCampaignsPage.tsx');
    assert.match(source, /contactable:/);
    assert.match(source, /outreach_ready:/);
    assert.match(source, /LeadFinderMapPanel/);
    assert.equal(source.includes('OpenStreetMap: 2 requests/min'), false);
  });
});

describe('Signed contract workflow idempotency', () => {
  it('skips default tasks that already exist on the project', () => {
    const source = read('../../src/lib/contracts/contractSignedSteps.ts');
    assert.match(source, /toInsert/);
    assert.match(source, /!have.has\(task.title\)/);
    assert.match(source, /eq\('contract_id', contractId\)/);
  });
});

describe('create_project client link', () => {
  it('writes client_id on the canonical insert path', () => {
    const source = read('../../src/lib/mcp/tools/projects.ts');
    const create = source.slice(source.indexOf("name: 'create_project'"), source.indexOf("name: 'update_project'"));
    assert.match(create, /client_id: args.client_id \|\| null/);
  });
});
