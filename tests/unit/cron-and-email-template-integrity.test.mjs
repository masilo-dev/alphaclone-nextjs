import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

test('every canonical background worker has exactly one Railway schedule', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'railway.crons.json'), 'utf8'));
  const paths = config.crons.map((cron) => cron.path);
  const required = [
    '/api/cron/account-lifecycle',
    '/api/cron/autonomous-runner',
    '/api/cron/bonnie-morning-brief',
    '/api/cron/booking-automations',
    '/api/cron/integration-token-health',
    '/api/cron/lead-discovery-worker',
    '/api/cron/social-publish',
    '/api/cron/workflows',
  ];

  for (const route of required) {
    assert.equal(paths.filter((pathName) => pathName === route).length, 1, route);
  }

  assert.equal(paths.includes('/api/cron/autonomous'), false, 'do not schedule the autonomous alias');
  assert.equal(paths.includes('/api/cron/publish-scheduled-posts'), false, 'do not schedule the legacy social publisher');
});

test('cron/template repair migration removes credential-bearing jobs and derives variables', () => {
  const sql = fs.readFileSync(
    path.join(root, 'supabase/migrations/20260820183000_secure_cron_and_sync_email_template_variables.sql'),
    'utf8',
  );

  assert.match(sql, /cron\.unschedule/);
  assert.match(sql, /DELETE FROM cron\.job_run_details/);
  assert.match(sql, /regexp_matches/);
  assert.match(sql, /template\.variables IS DISTINCT FROM extracted\.actual_variables/);
  assert.doesNotMatch(sql, /Bearer\s+[A-Za-z0-9_-]{20,}/);
});
