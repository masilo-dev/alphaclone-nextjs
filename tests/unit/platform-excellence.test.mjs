/**
 * Platform excellence — regression tests for audit remediation items.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

test("scraper campaign poll route exists with cron auth", async () => {
  const routePath = new URL(
    "../../src/app/api/scraper/campaign/poll/route.ts",
    import.meta.url,
  );
  assert.ok(fs.existsSync(routePath), "missing scraper poll route");
  const src = fs.readFileSync(routePath, "utf8");
  assert.match(src, /denyIfCronUnauthorized/);
  assert.match(src, /callScraperService/);
});

test("cron tenant guard module exports partition helper", async () => {
  const { guardCronTenantRow, partitionCronRowsByTenant } =
    await import("../../src/lib/tenant/cronTenantGuard.ts");
  assert.equal(typeof guardCronTenantRow, "function");
  assert.equal(typeof partitionCronRowsByTenant, "function");
});

test("marketing consent helper blocks explicit opt-out", async () => {
  const { hasRecipientMarketingConsent } =
    await import("../../src/lib/email/marketingConsent.ts");

  const admin = {
    from(table) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        ilike() {
          return this;
        },
        limit() {
          return this;
        },
        maybeSingle: async () => {
          if (table === "contacts") {
            return { data: { email_opt_in: false }, error: null };
          }
          return { data: null, error: null };
        },
      };
    },
  };

  const allowed = await hasRecipientMarketingConsent(
    admin,
    "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    {
      email: "user@example.com",
      contactId: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
    },
  );
  assert.equal(allowed, false);
});

test("all cron routes use denyIfCronUnauthorized", () => {
  const cronDir = new URL("../../src/app/api/cron", import.meta.url);
  const entries = fs.readdirSync(cronDir, { withFileTypes: true });
  const missing = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const routeFile = path.join(cronDir.pathname, entry.name, "route.ts");
    if (!fs.existsSync(routeFile)) continue;
    const src = fs.readFileSync(routeFile, "utf8");
    if (!src.includes("denyIfCronUnauthorized")) {
      missing.push(entry.name);
    }
  }

  assert.deepEqual(
    missing,
    [],
    `Cron routes missing denyIfCronUnauthorized: ${missing.join(", ")}`,
  );
});

test("DR restore runbook documents RPO/RTO", () => {
  const doc = fs.readFileSync(
    new URL("../../docs/DR_RESTORE_RUNBOOK.md", import.meta.url),
    "utf8",
  );
  assert.match(doc, /RPO/);
  assert.match(doc, /RTO/);
  assert.match(doc, /verify-backup\.sh/);
});

test("package.json aligns React 19 with Next 16", () => {
  const pkg = JSON.parse(
    fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  );
  assert.match(pkg.dependencies.next, /^16\./);
  assert.match(pkg.dependencies.react, /\^19\./);
  assert.match(pkg.dependencies["react-dom"], /\^19\./);
});

test("scraper poll route rejects unauthenticated cron in production", async () => {
  const prevEnv = process.env.NODE_ENV;
  const prevSecret = process.env.CRON_SECRET;
  process.env.NODE_ENV = "production";
  process.env.CRON_SECRET = "platform-excellence-secret";

  try {
    const { GET } =
      await import("../../src/app/api/scraper/campaign/poll/route.ts");
    const denied = await GET(
      new NextRequest("https://example.com/api/scraper/campaign/poll"),
    );
    assert.equal(denied.status, 401);
  } finally {
    process.env.NODE_ENV = prevEnv;
    if (prevSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevSecret;
  }
});
