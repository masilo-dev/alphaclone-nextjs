#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const json = args.has('--json');
const ci = args.has('--ci');
const linked = args.has('--linked');
const checks = [];

function run(name, command, commandArgs, required = true) {
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  checks.push({
    name,
    status: result.status === 0 ? 'pass' : (required ? 'fail' : 'blocked'),
    exitCode: result.status,
    output: `${result.stdout || ''}${result.stderr || ''}`.trim().slice(0, 12000),
  });
}

run('machine-readable inventory', process.execPath, ['scripts/generate-repository-inventory.mjs']);
run('production audit artifacts', process.execPath, ['scripts/generate-production-audit-artifacts.mjs']);
run('MCP/OAuth audit', process.execPath, ['scripts/audit-mcp.mjs']);
run('route audit', process.execPath, ['--import', 'tsx', 'scripts/audit-routes.ts']);
run('environment validation', process.execPath, ['scripts/validate-production-env.mjs', '--warn-only'], false);
run('data integrity audit', process.execPath, ['--import', 'tsx', 'scripts/audit-data-integrity.ts', '--json'], false);
if (linked) {
  run('linked migration parity', 'npx', ['supabase', 'migration', 'list'], false);
  run('linked database lint', 'npx', ['supabase', 'db', 'lint', '--linked'], false);
  run('linked Edge Functions', 'npx', ['supabase', 'functions', 'list'], false);
}

const failures = checks.filter((check) => check.status === 'fail');
const report = {
  mode: linked ? 'linked-read-only' : 'repository-read-only',
  mutationPerformed: false,
  passed: checks.filter((x) => x.status === 'pass').length,
  failed: failures.length,
  blocked: checks.filter((x) => x.status === 'blocked').length,
  checks,
};
if (json) console.log(JSON.stringify(report, null, 2));
else {
  for (const check of checks) console.log(`${check.status.toUpperCase()} ${check.name}`);
  console.log(`Passed ${report.passed}; failed ${report.failed}; blocked ${report.blocked}. No production mutation performed.`);
}
if (ci && (failures.length || report.blocked)) process.exitCode = 1;
else if (failures.length) process.exitCode = 1;
