#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");

const PROJECT_REF = "ehekzoioqvtweugemktn";
const envContent = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
let MANAGEMENT_KEY = "";
for (const line of envContent.split("\n")) {
  const parts = line.split("=");
  if (parts[0].trim() === "SUPABASE_ACCESS_TOKEN") {
    MANAGEMENT_KEY = parts.slice(1).join("=").trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
    break;
  }
}

function post(hostname, reqPath, headers, body) {
  return new Promise(function(resolve) {
    const data = JSON.stringify(body);
    const options = {
      hostname: hostname,
      port: 443,
      path: reqPath,
      method: "POST",
      headers: Object.assign(
        { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
        headers
      ),
    };
    const req = https.request(options, function(res) {
      let buf = "";
      res.on("data", function(c) { buf += c; });
      res.on("end", function() { resolve({ status: res.statusCode, body: buf }); });
    });
    req.on("error", function(e) { resolve({ status: 500, body: e.message }); });
    req.setTimeout(60000, function() { req.destroy(new Error("timeout")); });
    req.write(data);
    req.end();
  });
}

async function query(sql) {
  const res = await post(
    "api.supabase.com",
    "/v1/projects/" + PROJECT_REF + "/database/query",
    { Authorization: "Bearer " + MANAGEMENT_KEY },
    { query: sql }
  );
  if (res.status >= 200 && res.status < 300) {
    try {
      return { ok: true, data: JSON.parse(res.body) };
    } catch (e) {
      return { ok: true, raw: res.body };
    }
  }
  return { ok: false, error: res.body };
}

function extractValues(data, field) {
  if (!data || !Array.isArray(data)) return [];
  return data.map(function(r) {
    if (typeof r === "object" && r !== null) {
      return r[field] !== undefined ? r[field] : Object.values(r)[0];
    }
    return r;
  });
}

async function main() {
  console.log("================================================================");
  console.log("              AlphaClone DB Verification Report                 ");
  console.log("================================================================");

  const tablesToCheck = [
    // Aug 16: drift catchup
    "oauth_states", "tenant_integrations",
    // Aug 17: Autonomous OS
    "durable_jobs", "domain_events", "business_goals", "autonomy_policies",
    "human_approvals", "commercial_services", "lead_generation_targets",
    "activity_feed", "worker_heartbeats",
    // Aug 20: workflow + cron
    "workflow_processing_queue",
    // Aug 21: lead jobs + MSFT columns + tenant_integrations columns
    "lead_search_jobs", "microsoft_connections",
    // Aug 22: project execution, operations OS, tenant events
    "project_execution_tasks", "operations_task_queue",
    "tenant_operational_events",
    // Aug 23: super admin, consent columns, welcome email
    "password_change_requests", "profiles", "email_confirmation_tokens",
    // Aug 24/25: pricing + quotas
    "plan_subscriptions", "tenant_quotas", "quota_usage",
    "quota_usage_events", "pricing_analytics_events",
  ];

  console.log("\n📋 Checking Tables...");
  const tablesSql =
    "SELECT table_name FROM information_schema.tables " +
    "WHERE table_schema = 'public' AND table_name IN (" +
    tablesToCheck.map(function(t) { return "'" + t + "'"; }).join(",") +
    ") ORDER BY table_name;";
  const tablesRes = await query(tablesSql);
  let foundTables = [];
  if (tablesRes.ok) {
    foundTables = extractValues(tablesRes.data, "table_name");
  }
  const missingTables = tablesToCheck.filter(function(t) {
    return foundTables.indexOf(t) === -1;
  });
  console.log("   Found " + foundTables.length + "/" + tablesToCheck.length + " expected tables");
  if (missingTables.length) {
    console.log("   ⚠️  Missing (or named differently): " + missingTables.join(", "));
  } else {
    console.log("   ✅ All expected tables present!");
  }

  console.log("\n🔍 Checking Key Columns...");
  const columnChecks = [
    { table: "profiles", column: "is_super_admin", type: "boolean" },
    { table: "profiles", column: "password_change_required", type: "boolean" },
    { table: "profiles", column: "consent_email_marketing", type: "*" },
    { table: "profiles", column: "consent_product_updates", type: "*" },
    { table: "profiles", column: "consent_timestamp", type: "*" },
    { table: "tenant_integrations", column: "configured_by", type: "uuid" },
    { table: "tenant_integrations", column: "integration_id", type: "*" },
    { table: "tenant_integrations", column: "connected_at", type: "timestamptz" },
    { table: "tenant_integrations", column: "metadata", type: "jsonb" },
    { table: "microsoft_connections", column: "refresh_token_encrypted", type: "*" },
    { table: "microsoft_connections", column: "access_token_expires_at", type: "*" },
    { table: "durable_jobs", column: "status", type: "text" },
    { table: "durable_jobs", column: "payload", type: "jsonb" },
    { table: "human_approvals", column: "status", type: "text" },
    { table: "human_approvals", column: "payload", type: "jsonb" },
    { table: "tenants", column: "subscription_plan", type: "*" },
    { table: "tenants", column: "subscription_status", type: "*" },
    { table: "tenants", column: "stripe_customer_id", type: "*" },
    { table: "tenants", column: "cancel_at_period_end", type: "boolean" },
    { table: "plan_subscriptions", column: "plan_code", type: "*" },
    { table: "tenant_quotas", column: "plan_code", type: "*" },
    { table: "pricing_analytics_events", column: "event_name", type: "text" },
  ];
  const colSqlParts = columnChecks.map(function(c) {
    return "SELECT '" + c.table + "." + c.column + "' AS check_name, " +
      "EXISTS (SELECT 1 FROM information_schema.columns " +
      "WHERE table_schema='public' AND table_name='" + c.table +
      "' AND column_name='" + c.column + "') AS exists_col";
  });
  const colsRes = await query(colSqlParts.join(" UNION ALL "));
  let passedCols = 0;
  let failedCols = [];
  if (colsRes.ok && Array.isArray(colsRes.data)) {
    for (let i = 0; i < colsRes.data.length; i++) {
      const row = colsRes.data[i];
      const name = row.check_name || Object.values(row)[0];
      const exists = row.exists_col !== undefined ? row.exists_col : Object.values(row)[1];
      if (exists || exists === "t" || exists === true || exists === 1) {
        passedCols++;
      } else {
        failedCols.push(name);
      }
    }
  }
  console.log("   Passed: " + passedCols + "/" + columnChecks.length);
  if (failedCols.length) {
    console.log("   ⚠️  Missing columns: " + failedCols.join(", "));
  } else {
    console.log("   ✅ All expected columns present!");
  }

  console.log("\n⚙️  Checking Key Functions & Triggers...");
  const functions = [
    "claim_next_durable_job",
    "is_super_admin",
    "guard_profile_self_promotion",
    "auto_assign_super_admin_on_insert",
    "sync_is_super_admin_column",
    "get_tenant_billing_summary",
    "consume_daily_resource_quota",
    "release_daily_resource_quota",
  ];
  const fnSql =
    "SELECT routine_name FROM information_schema.routines " +
    "WHERE routine_schema='public' AND routine_name IN (" +
    functions.map(function(f) { return "'" + f + "'"; }).join(",") +
    ") ORDER BY routine_name;";
  const fnRes = await query(fnSql);
  let foundFns = [];
  if (fnRes.ok) foundFns = extractValues(fnRes.data, "routine_name");
  const missingFns = functions.filter(function(f) { return foundFns.indexOf(f) === -1; });
  console.log("   Functions found: " + foundFns.length + "/" + functions.length);
  if (missingFns.length) {
    console.log("   ⚠️  Missing functions: " + missingFns.join(", "));
  } else {
    console.log("   ✅ All expected functions present!");
  }

  // Check enum values
  console.log("\n🔢 Checking Enum Values...");
  const enumChecks = [
    { name: "lead_search_job_status", value: "queued" },
    { name: "lead_search_job_status", value: "retrying" },
    { name: "user_role", value: "super_admin" },
  ];
  let enumPassed = 0;
  let enumFailed = [];
  for (let i = 0; i < enumChecks.length; i++) {
    const ec = enumChecks[i];
    const er = await query(
      "SELECT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid " +
      "WHERE t.typname='" + ec.name + "' AND e.enumlabel='" + ec.value + "') AS has_val;"
    );
    let exists = false;
    if (er.ok && Array.isArray(er.data) && er.data[0]) {
      const v = er.data[0].has_val !== undefined ? er.data[0].has_val : Object.values(er.data[0])[0];
      exists = v === true || v === "t" || v === 1;
    }
    if (exists) enumPassed++;
    else enumFailed.push(ec.name + "." + ec.value);
  }
  console.log("   Enum values OK: " + enumPassed + "/" + enumChecks.length);
  if (enumFailed.length) {
    console.log("   ⚠️  Missing: " + enumFailed.join(", "));
  } else {
    console.log("   ✅ All enum values present!");
  }

  // Sample: check is_super_admin actually set on bonnie rows
  console.log("\n👤 Checking super_admin backfill (bonnie accounts)...");
  const saRes = await query(
    "SELECT email, role::text AS role_text, is_super_admin FROM public.profiles " +
    "WHERE lower(email) LIKE '%bonnie%' ORDER BY email;"
  );
  if (saRes.ok && Array.isArray(saRes.data)) {
    if (saRes.data.length === 0) {
      console.log("   ⚠️  No bonnie accounts found (profiles table empty yet - OK if no signup yet)");
    } else {
      saRes.data.forEach(function(row) {
        const email = row.email || Object.values(row)[0];
        const role = row.role_text || (row.role !== undefined ? row.role : "?");
        const sa = row.is_super_admin !== undefined ? row.is_super_admin : "?";
        console.log("   - " + email + " | role=" + role + " | is_super_admin=" + sa);
      });
    }
  }

  // Verify backfill on tenants (subscription_plan/state)
  console.log("\n💸 Checking tenants backfill...");
  const tRes = await query(
    "SELECT COUNT(*) AS total_tenants, " +
    "COUNT(*) FILTER (WHERE subscription_plan IS NOT NULL) AS has_plan, " +
    "COUNT(*) FILTER (WHERE subscription_status IS NOT NULL) AS has_status, " +
    "COUNT(*) FILTER (WHERE cancel_at_period_end IS NOT NULL) AS has_cancel " +
    "FROM public.tenants;"
  );
  if (tRes.ok && Array.isArray(tRes.data) && tRes.data[0]) {
    const r = tRes.data[0];
    console.log("   Total tenants: " + (r.total_tenants || Object.values(r)[0]));
    console.log("   Has subscription_plan: " + (r.has_plan !== undefined ? r.has_plan : Object.values(r)[1]));
    console.log("   Has subscription_status: " + (r.has_status !== undefined ? r.has_status : Object.values(r)[2]));
    console.log("   Has cancel_at_period_end: " + (r.has_cancel !== undefined ? r.has_cancel : Object.values(r)[3]));
  }

  console.log("\n================================================================");
  console.log("                       VERIFICATION COMPLETE                     ");
  console.log("================================================================");
  const totalIssues = missingTables.length + failedCols.length + missingFns.length + enumFailed.length;
  if (totalIssues === 0) {
    console.log("🎉 ALL CHECKS PASSED. Database is fully up to date!");
  } else {
    console.log("⚠️  " + totalIssues + " issue(s) found.");
  }
  console.log("");
}

main().catch(function(e) { console.error("FATAL:", e); process.exit(1); });
