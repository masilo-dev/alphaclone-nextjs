#!/usr/bin/env node
/**
 * Comprehensive migration runner for all August 2026 migrations.
 * Applies all 16 migrations using 4 fallback methods:
 *   1. Supabase Management API (best, uses SUPABASE_ACCESS_TOKEN)
 *   2. /rest/v1/rpc/exec_sql  (sql_query param)
 *   3. /rest/v1/rpc/exec      (query param)
 *   4. /rest/v1/rpc/run_sql   (sql param)
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const PROJECT_REF = "ehekzoioqvtweugemktn";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

function getEnv(key) {
  const envFiles = [".env.local", ".env.production.local", ".env"];
  for (const file of envFiles) {
    try {
      const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      for (const line of content.split("\n")) {
        const [k, ...v] = line.split("=");
        if (k.trim() === key)
          return v.join("=").trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
      }
    } catch (e) {}
  }
  return process.env[key];
}

const SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const MANAGEMENT_KEY = getEnv("SUPABASE_ACCESS_TOKEN");

const MIGRATIONS = [
  "20260816110000_production_schema_drift_catchup.sql",
  "20260817_autonomous_os_schema.sql",
  "20260820150000_workflow_processing_queue.sql",
  "20260820183000_secure_cron_and_sync_email_template_variables.sql",
  "20260821110000_add_queued_lead_search_job_status.sql",
  "20260821140000_microsoft_connections_fallback_columns.sql",
  "20260821150000_add_retrying_lead_search_job_status.sql",
  "20260821170000_tenant_integrations_add_missing_columns.sql",
  "20260822100000_client_project_execution_engine.sql",
  "20260822120000_operations_operating_system.sql",
  "20260822140000_tenant_operational_events.sql",
  "20260823120000_super_admin_hardening.sql",
  "20260823140000_profiles_communication_consent_columns.sql",
  "20260823150000_premium_welcome_email_and_email_confirm.sql",
  "20260824000000_alphaclone_pricing_and_quotas.sql",
  "20260825000000_pricing_system_supplement.sql",
];

function post(hostname, reqPath, headers, body) {
  return new Promise((resolve) => {
    const data = typeof body === "string" ? body : JSON.stringify(body);
    const options = {
      hostname,
      port: 443,
      path: reqPath,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () =>
        resolve({ status: res.statusCode, body: buf, headers: res.headers }),
      );
    });
    req.on("error", (e) => resolve({ status: 500, body: e.message }));
    req.setTimeout(120000, () => {
      req.destroy(new Error("Request timed out after 120s"));
    });
    req.write(data);
    req.end();
  });
}

async function tryManagementApi(sql) {
  if (!MANAGEMENT_KEY) {
    console.log("   ⚠️  No SUPABASE_ACCESS_TOKEN — skipping Management API.");
    return false;
  }
  console.log("   ⚡ Method 1/4: Management API /database/query ...");
  const res = await post(
    "api.supabase.com",
    `/v1/projects/${PROJECT_REF}/database/query`,
    { Authorization: `Bearer ${MANAGEMENT_KEY}` },
    { query: sql },
  );
  const ok = res.status >= 200 && res.status < 300;
  if (ok) {
    console.log("   ✅ Management API OK");
  } else {
    const snippet = res.body.slice(0, 300);
    console.log(`   ❌ Management API HTTP ${res.status}: ${snippet}`);
  }
  return ok;
}

async function tryRpc(fn, paramName, sql) {
  if (!SERVICE_ROLE_KEY) {
    console.log(`   ⚠️  No SERVICE_ROLE_KEY — skipping RPC ${fn}.`);
    return false;
  }
  console.log(`   ⚡ Method: /rest/v1/rpc/${fn} ...`);
  const parsed = new URL(SUPABASE_URL);
  const res = await post(
    parsed.hostname,
    `/rest/v1/rpc/${fn}`,
    {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    { [paramName]: sql },
  );
  const ok = res.status >= 200 && res.status < 300;
  if (ok) {
    console.log(`   ✅ /rpc/${fn} OK`);
    return true;
  }
  const snippet = res.body.slice(0, 300);
  const already =
    snippet.includes("already exists") || snippet.includes("duplicate");
  if (already) {
    console.log(`   ⚠️  /rpc/${fn}: objects already exist (skip)`);
    return true;
  }
  console.log(`   ❌ /rpc/${fn} HTTP ${res.status}: ${snippet}`);
  return false;
}

function isProbablyAlreadyApplied(errorBody) {
  if (!errorBody) return false;
  const b = errorBody.toLowerCase();
  return (
    b.includes("already exists") ||
    b.includes("duplicate") ||
    b.includes("already a member") ||
    b.includes("relation .* already exists") ||
    b.includes("type .* already exists")
  );
}

async function applyMigration(filename) {
  console.log(`\n📄 ${filename}`);
  const filepath = path.join(process.cwd(), "supabase", "migrations", filename);
  if (!fs.existsSync(filepath)) {
    console.log("   ❌ File missing!");
    return { filename, ok: false, error: "file missing" };
  }
  const sql = fs.readFileSync(filepath, "utf8");
  const sizeKb = (sql.length / 1024).toFixed(1);
  console.log(`   📐 Size: ${sizeKb} KB  |  SQL length: ${sql.length}`);

  const t0 = Date.now();

  // 1. Management API
  let ok = await tryManagementApi(sql);
  if (ok) {
    return { filename, ok: true, via: "management_api", ms: Date.now() - t0 };
  }

  // 2. exec_sql
  ok = await tryRpc("exec_sql", "sql_query", sql);
  if (ok) return { filename, ok: true, via: "exec_sql", ms: Date.now() - t0 };

  // 3. exec
  ok = await tryRpc("exec", "query", sql);
  if (ok) return { filename, ok: true, via: "exec", ms: Date.now() - t0 };

  // 4. run_sql
  ok = await tryRpc("run_sql", "sql", sql);
  if (ok) return { filename, ok: true, via: "run_sql", ms: Date.now() - t0 };

  return { filename, ok: false, error: "all methods failed", ms: Date.now() - t0 };
}

async function verifyTables() {
  console.log("\n🔍 Verifying key tables exist...");
  const expectedTables = [
    "durable_jobs",
    "domain_events",
    "business_goals",
    "autonomy_policies",
    "human_approvals",
    "commercial_services",
    "lead_generation_targets",
    "activity_feed",
    "worker_heartbeats",
    "workflow_processing_queue",
    "project_execution_jobs",
    "operations_task_queue",
    "tenant_operational_events",
    "super_admin_assignments",
    "plan_subscriptions",
    "tenant_quotas",
    "quota_usage_events",
  ];

  const checkSql = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN (${expectedTables
    .map((t) => `'${t}'`)
    .join(", ")}) ORDER BY table_name;`;

  let found = [];
  if (MANAGEMENT_KEY) {
    const res = await post(
      "api.supabase.com",
      `/v1/projects/${PROJECT_REF}/database/query`,
      { Authorization: `Bearer ${MANAGEMENT_KEY}` },
      { query: checkSql },
    );
    if (res.status >= 200 && res.status < 300) {
      try {
        const parsed = JSON.parse(res.body);
        found = parsed.map((r) => r.table_name || Object.values(r)[0]);
      } catch (e) {
        console.log("   (could not parse verify result, but query ran)");
      }
    }
  }

  const missing = expectedTables.filter((t) => !found.includes(t));
  if (missing.length === 0) {
    console.log(`   ✅ All ${expectedTables.length} key tables present`);
  } else {
    console.log(
      `   ⚠️  Found ${found.length}/${expectedTables.length}. Missing: ${missing.join(", ")}`,
    );
  }
  return { found, missing, expected: expectedTables };
}

async function main() {
  console.log(
    "╔════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║   AlphaClone — August 2026 Consolidated DB Migration Runner    ║",
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝",
  );
  console.log(`\n📍 Project:   ${PROJECT_REF}`);
  console.log(`📝 Migrations to apply: ${MIGRATIONS.length}`);
  console.log(
    `🔑 Mgmt token: ${MANAGEMENT_KEY ? "✅ provided" : "❌ missing"}`,
  );
  console.log(
    `🔑 SRV  token: ${SERVICE_ROLE_KEY ? "✅ provided" : "⚠️  missing (RPC fallback disabled)"}`,
  );

  const results = [];
  for (let i = 0; i < MIGRATIONS.length; i++) {
    console.log(
      `\n────────── [${i + 1}/${MIGRATIONS.length}] ──────────`,
    );
    const r = await applyMigration(MIGRATIONS[i]);
    results.push(r);
    const emoji = r.ok ? "✅" : "❌";
    const via = r.via ? ` via ${r.via}` : "";
    const ms = r.ms ? ` (${(r.ms / 1000).toFixed(1)}s)` : "";
    console.log(`   ${emoji} Result: ${r.ok ? "APPLIED" : "FAILED"}${via}${ms}`);
    if (!r.ok && r.error) console.log(`      Error: ${r.error}`);
  }

  console.log(
    "\n╔════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║                       Migration Summary                        ║",
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝",
  );

  const applied = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  console.log(`\nApplied: ${applied.length}/${MIGRATIONS.length}`);
  console.log(`Failed:  ${failed.length}/${MIGRATIONS.length}`);

  if (failed.length > 0) {
    console.log("\n❌ Failed migrations:");
    for (const f of failed) console.log(`   - ${f.filename}  (${f.error})`);
  }

  if (applied.length > 0) {
    console.log("\n✅ Applied via:");
    const viaCount = {};
    applied.forEach((a) => (viaCount[a.via] = (viaCount[a.via] || 0) + 1));
    Object.entries(viaCount).forEach(([via, n]) =>
      console.log(`   - ${via}: ${n} migrations`),
    );
  }

  // Final verification
  console.log("\n────────── Final Verification ──────────");
  await verifyTables();

  if (!SERVICE_ROLE_KEY) {
    console.log(
      "\n💡 Tip: If Management API worked, you're all set. If some failed, paste your SUPABASE_SERVICE_ROLE_KEY into .env.local and rerun this script for RPC fallbacks.",
    );
  }

  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});
