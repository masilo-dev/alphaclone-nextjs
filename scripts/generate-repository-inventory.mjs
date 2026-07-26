#!/usr/bin/env node

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ignored = new Set([
  ".git",
  ".next",
  "node_modules",
  "coverage",
  "playwright-report",
  "test-results",
]);
const sourceExtensions = /\.(?:[cm]?[jt]sx?|sql|json|toml|ya?ml|md)$/i;

function walk(directory) {
  const results = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) results.push(...walk(absolute));
    else if (entry.isFile())
      results.push(relative(root, absolute).replaceAll("\\", "/"));
  }
  return results;
}

const inventoryRoots = [
  "src",
  "app",
  "supabase",
  "tests",
  "scripts",
  ".github",
];
const rootFiles = [
  "package.json",
  "next.config.ts",
  "proxy.ts",
  "railway.toml",
  "railway.nextjs.json",
  "railway.crons.json",
  "nixpacks.toml",
  "playwright.config.js",
  "eslint.config.mjs",
].filter((file) => {
  try {
    return statSync(resolve(root, file)).isFile();
  } catch {
    return false;
  }
});
const files = [
  ...inventoryRoots.flatMap((directory) => {
    try {
      return statSync(resolve(root, directory)).isDirectory()
        ? walk(resolve(root, directory))
        : [];
    } catch {
      return [];
    }
  }),
  ...rootFiles,
].sort();
const textFiles = files.filter((file) => sourceExtensions.test(file));
const contents = new Map();

function read(file) {
  if (!contents.has(file)) {
    try {
      contents.set(file, readFileSync(resolve(root, file), "utf8"));
    } catch {
      contents.set(file, "");
    }
  }
  return contents.get(file);
}

function matchingFiles(pattern) {
  return textFiles.filter((file) => pattern.test(read(file)));
}

function uniqueMatches(pattern) {
  const values = new Set();
  for (const file of textFiles) {
    const content = read(file);
    for (const match of content.matchAll(pattern)) values.add(match[1]);
  }
  return [...values].sort();
}

const pages = files.filter(
  (file) =>
    /^src\/app\/.+\/page\.[^.]+$/.test(file) ||
    /^src\/app\/page\.[^.]+$/.test(file),
);
const routeHandlers = files.filter((file) =>
  /^src\/app\/.+\/route\.[^.]+$/.test(file),
);
const apiRoutes = routeHandlers.filter((file) =>
  file.startsWith("src/app/api/"),
);
const serverActions = matchingFiles(/^\s*['"]use server['"];?/m);
const clientServices = files.filter((file) =>
  /^src\/services\/.+\.[cm]?[jt]sx?$/.test(file),
);
const migrations = files.filter((file) =>
  /^(?:src\/)?supabase\/migrations\/.+\.sql$/.test(file),
);
const canonicalMigrations = migrations.filter((file) =>
  file.startsWith("supabase/migrations/"),
);
const legacyMigrations = migrations.filter((file) =>
  file.startsWith("src/supabase/migrations/"),
);
const tests = files.filter((file) =>
  /(?:^|\/)(?:__tests__\/.*|[^/]+\.(?:test|spec)\.[^.]+)$/.test(file),
);
const cronRoutes = apiRoutes.filter((file) =>
  /\/(?:cron|scheduled|scheduler|worker|queue)\//i.test(file),
);
const workers = files.filter((file) =>
  /(?:^|\/)(?:worker|workers|jobs|queue)(?:\/|\.)/i.test(file),
);
const services = files.filter((file) =>
  /^src\/services\/.+\.[cm]?[jt]sx?$/.test(file),
);
const modals = files.filter((file) =>
  /(?:Modal|Dialog|Drawer)\.(?:tsx|jsx)$/.test(file),
);
const navigation = matchingFiles(
  /(?:navigation|sidebar|menuItems|navItems|href\s*:)/i,
);
const destructiveActions = matchingFiles(
  /(?:\.delete\s*\(|window\.confirm|\bdelete[A-Z_]|\barchive[A-Z_]|hard.?delete|permanent.?delete)/i,
);
const publicUrls = uniqueMatches(/\b(https?:\/\/[^\s'"`)<>,]+)/g);
const environmentVariables = uniqueMatches(
  /(?:process\.env\.|process\.env\[['"])([A-Z][A-Z0-9_]*)/g,
);
const featureFlags = environmentVariables.filter((name) =>
  /(?:ENABLE|DISABLE|FEATURE|FLAG|EXPERIMENT)/.test(name),
);
const tables = uniqueMatches(
  /\b(?:create\s+table(?:\s+if\s+not\s+exists)?|alter\s+table(?:\s+if\s+exists)?)\s+(?:public\.)?["']?([a-zA-Z_][\w]*)/gi,
);
const storageBuckets = uniqueMatches(
  /(?:storage\.buckets[\s\S]{0,240}?values\s*\(\s*['"]|bucket\s*[:=]\s*['"])([a-zA-Z0-9_-]+)/gi,
);
const externalIntegrations = matchingFiles(
  /(?:stripe|zoho|calendly|google|microsoft|linkedin|twilio|whatsapp|sendgrid|resend|brevo|slack|zoom|hubspot|deepseek|openai|anthropic)/i,
);
const mcpFiles = files.filter((file) =>
  /(?:^|\/)(?:mcp|bonnie|nexus)(?:\/|[A-Z_.-])/i.test(file),
);
const mcpTools = uniqueMatches(/\bname\s*:\s*['"]([a-z][a-z0-9_]{2,})['"]/g);

const findings = Object.fromEntries(
  [
    ["TODO", /\bTODO\b/i],
    ["FIXME", /\bFIXME\b/i],
    ["HACK", /\bHACK\b/i],
    ["temporary", /\btemporary\b/i],
    ["placeholder", /\bplaceholder\b/i],
    ["coming soon", /coming soon/i],
    ["mock/fake/demo", /\b(?:mock|fake|demo)\b/i],
    ["hardcoded", /\bhardcoded\b/i],
    ["not implemented", /not implemented/i],
    ["console.log", /console\.log\s*\(/],
    ["alert", /(?:window\.)?alert\s*\(/],
    ["window.confirm", /window\.confirm\s*\(/],
    ["as any", /\bas any\b/],
    ["@ts-ignore", /@ts-ignore/],
    ["eslint-disable", /eslint-disable/],
    ["localhost", /localhost(?::\d+)?/i],
    ["vercel.app", /vercel\.app/i],
    ["service-role use", /(?:service.?role|createSupabaseAdminClient)/i],
    [
      "raw SQL",
      /(?:\.rpc\s*\(\s*['"]exec|\bexecute\s+immediate\b|\braw\s*sql\b)/i,
    ],
    [
      "direct browser writes",
      /createBrowserClient[\s\S]{0,1200}?\.(?:insert|update|delete)\s*\(/i,
    ],
    ["unrestricted delete", /\.delete\s*\(\s*\)(?![\s\S]{0,160}\.eq\s*\()/i],
  ].map(([label, pattern]) => [label, matchingFiles(pattern)]),
);

const moduleDefinitions = {
  Authentication: ["auth", "login", "register", "password"],
  "Tenant and workspace": ["tenant", "workspace", "team", "permission"],
  CRM: ["lead", "contact", "client", "company", "deal", "pipeline", "crm"],
  "Lead Finder": ["lead-finder", "scraper", "enrichment"],
  Projects: ["project", "task", "milestone", "time-track"],
  Contracts: ["contract", "signature"],
  Quotes: ["quote", "estimate"],
  "Invoices and payments": ["invoice", "payment", "stripe"],
  Accounting: ["accounting", "journal", "ledger", "expense", "finance"],
  Documents: ["document", "file", "storage", "drive"],
  "Email and campaigns": ["email", "campaign", "outreach"],
  "SMS and WhatsApp": ["sms", "whatsapp", "twilio"],
  Integrations: ["integration", "oauth", "zoho", "calendly"],
  "Bonnie, Nexus and MCP": ["bonnie", "nexus", "mcp", "autonomous"],
  Notifications: ["notification", "realtime"],
  Search: ["search"],
  Settings: ["setting", "admin", "profile"],
};

function includesKeyword(file, keywords) {
  const lower = file.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

const matrix = Object.entries(moduleDefinitions).map(([module, keywords]) => {
  const ui = pages.filter((file) => includesKeyword(file, keywords));
  const api = apiRoutes.filter((file) => includesKeyword(file, keywords));
  const database = migrations.filter((file) => includesKeyword(file, keywords));
  const permissionFiles = textFiles.filter(
    (file) =>
      includesKeyword(file, keywords) &&
      /(?:permission|authorize|membership|tenant)/i.test(read(file)),
  );
  const moduleTests = tests.filter((file) => includesKeyword(file, keywords));
  let status = "Broken";
  if (
    ui.length &&
    api.length &&
    database.length &&
    permissionFiles.length &&
    moduleTests.length
  )
    status = "Partially complete";
  else if (ui.length && !api.length && !database.length) status = "UI only";
  else if (!ui.length && (api.length || database.length))
    status = "Backend only";
  else if (ui.length || api.length || database.length)
    status = "Partially complete";
  return {
    module,
    ui,
    api,
    database,
    permissions: permissionFiles,
    tests: moduleTests,
    status,
  };
});

const inventory = {
  generatedAt: new Date().toISOString(),
  gitCommit: process.env.GIT_COMMIT || null,
  counts: {
    files: files.length,
    pages: pages.length,
    routeHandlers: routeHandlers.length,
    apiRoutes: apiRoutes.length,
    serverActions: serverActions.length,
    clientServices: clientServices.length,
    migrations: migrations.length,
    canonicalMigrations: canonicalMigrations.length,
    legacyMigrations: legacyMigrations.length,
    tables: tables.length,
    storageBuckets: storageBuckets.length,
    cronRoutes: cronRoutes.length,
    workers: workers.length,
    externalIntegrationFiles: externalIntegrations.length,
    mcpFiles: mcpFiles.length,
    mcpTools: mcpTools.length,
    navigationFiles: navigation.length,
    modals: modals.length,
    destructiveActionFiles: destructiveActions.length,
    publicUrls: publicUrls.length,
    environmentVariables: environmentVariables.length,
    featureFlags: featureFlags.length,
    tests: tests.length,
  },
  pages,
  routeHandlers,
  apiRoutes,
  serverActions,
  clientServices,
  migrations,
  canonicalMigrations,
  legacyMigrations,
  tables,
  storageBuckets,
  cronRoutes,
  workers,
  externalIntegrations,
  mcpFiles,
  mcpTools,
  navigation,
  modals,
  destructiveActions,
  publicUrls,
  environmentVariables,
  featureFlags,
  tests,
  findings,
  matrix,
};

const jsonPath = resolve(root, "docs/AUDIT_REPOSITORY_INVENTORY.json");
writeFileSync(jsonPath, `${JSON.stringify(inventory, null, 2)}\n`);

const lines = [
  "# AlphaClone machine-generated repository inventory",
  "",
  `Generated: ${inventory.generatedAt}`,
  "",
  "> This is a static source inventory, not evidence that a feature works. Status is conservative: no module is marked Complete without end-to-end test evidence.",
  "",
  "## Summary",
  "",
  "| Artifact | Count |",
  "| --- | ---: |",
  ...Object.entries(inventory.counts).map(
    ([name, count]) => `| ${name} | ${count} |`,
  ),
  "",
  "## Module matrix",
  "",
  "| Module | UI | API | Database | Permissions | Tests | Status |",
  "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ...matrix.map(
    (entry) =>
      `| ${entry.module} | ${entry.ui.length} | ${entry.api.length} | ${entry.database.length} | ${entry.permissions.length} | ${entry.tests.length} | ${entry.status} |`,
  ),
  "",
  "## Risk-marker scan",
  "",
  "| Marker | Files |",
  "| --- | ---: |",
  ...Object.entries(findings).map(
    ([name, matches]) => `| ${name} | ${matches.length} |`,
  ),
  "",
  "## Detailed artifacts",
  "",
];

for (const [heading, values] of [
  ["Pages", pages],
  ["API routes", apiRoutes],
  ["Server actions", serverActions],
  ["Client-side services", clientServices],
  ["Canonical migrations", canonicalMigrations],
  ["Legacy migrations", legacyMigrations],
  ["Tables", tables],
  ["Storage buckets", storageBuckets],
  ["Cron routes", cronRoutes],
  ["Workers", workers],
  ["MCP/Bonnie/Nexus files", mcpFiles],
  ["MCP tool-like names", mcpTools],
  ["Navigation files", navigation],
  ["Modals and dialogs", modals],
  ["Destructive-action files", destructiveActions],
  ["Environment variables", environmentVariables],
  ["Feature flags", featureFlags],
  ["Tests", tests],
]) {
  lines.push(
    `### ${heading}`,
    "",
    ...(values.length
      ? values.map((value) => `- \`${value}\``)
      : ["- None found"]),
    "",
  );
}

lines.push(
  "## Reproduction",
  "",
  "```bash",
  "node scripts/generate-repository-inventory.mjs",
  "```",
);
writeFileSync(
  resolve(root, "docs/AUDIT_REPOSITORY_INVENTORY.md"),
  `${lines.join("\n")}\n`,
);

console.log(
  `Inventory written to ${relative(root, jsonPath)} (${files.length} files scanned).`,
);
