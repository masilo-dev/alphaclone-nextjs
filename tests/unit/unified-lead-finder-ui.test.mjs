import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

test('legacy growth-agent and lead-finder routes render the same canonical surface', async () => {
  const dashboard = await fs.readFile('src/components/dashboard/business/BusinessDashboard.tsx', 'utf8');
  assert.match(
    dashboard,
    /case '\/dashboard\/sales-agent':\s*case '\/dashboard\/leads\/campaigns':\s*case '\/dashboard\/leads\/finder':[\s\S]*?<ScraperCampaignsPage/,
  );
  assert.doesNotMatch(dashboard, /import SalesAgent from/);
});

test('canonical Lead Finder includes the agent chat as a first-class workspace tab', async () => {
  const finder = await fs.readFile('src/components/dashboard/leads/ScraperCampaignsPage.tsx', 'utf8');
  assert.match(finder, /'Discover', 'Assistant', 'Results'/);
  assert.match(finder, /active === 'Assistant'/);
  assert.match(finder, /<LeadFinderChat onActivity=/);
});

test('sales navigation exposes one Lead Finder destination, not a duplicate Growth Agent', async () => {
  const hub = await fs.readFile('src/components/dashboard/hubs/SalesHub.tsx', 'utf8');
  assert.match(hub, /label: 'Lead Finder'/);
  assert.doesNotMatch(hub, /label: 'Growth Agent'/);
});

test('chat assistant queues canonical searches instead of running a second scraper pipeline', async () => {
  const chat = await fs.readFile('src/app/api/scraper-campaigns/chat/route.ts', 'utf8');
  assert.match(chat, /from\('lead_searches'\)\.insert/);
  assert.match(chat, /from\('lead_search_jobs'\)\.insert/);
  assert.match(chat, /canonical_search_id/);
  assert.doesNotMatch(chat, /runCampaignOnPlatform/);
});
