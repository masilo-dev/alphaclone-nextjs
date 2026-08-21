#!/usr/bin/env node
/**
 * Apply migration via Supabase Management API (pg endpoint).
 * This uses the service role key + direct /rest/v1/ table upserts
 * to run arbitrary DDL via the management API's database endpoint.
 */

const fs   = require("fs");
const path = require("path");
const https = require("https");

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

const SUPABASE_URL     = getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("SUPABASE_URL");
const SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const MANAGEMENT_KEY   = getEnv("SUPABASE_ACCESS_TOKEN");   // Personal access token

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Extract project ref from URL: https://<ref>.supabase.co
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
console.log("📍 Project ref:", projectRef);

const SQL = fs.readFileSync(
  path.join(__dirname, "..", "supabase", "migrations",
    "20260821170000_tenant_integrations_add_missing_columns.sql"),
  "utf8"
);

function post(hostname, reqPath, headers, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
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
      res.on("end", () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on("error", (e) => resolve({ status: 500, body: e.message }));
    req.write(data);
    req.end();
  });
}

async function tryManagementApi() {
  if (!MANAGEMENT_KEY) {
    console.log("⚠️  No SUPABASE_ACCESS_TOKEN — skipping management API attempt.");
    return false;
  }
  console.log("\n⚡ Trying Supabase Management API /v1/projects/{ref}/database/query ...");
  const res = await post(
    "api.supabase.com",
    `/v1/projects/${projectRef}/database/query`,
    {
      Authorization: `Bearer ${MANAGEMENT_KEY}`,
    },
    { query: SQL }
  );
  console.log(`   HTTP ${res.status}: ${res.body.slice(0, 300)}`);
  return res.status >= 200 && res.status < 300;
}

async function tryAlternativeRpc(fn, paramName) {
  console.log(`\n⚡ Trying /rest/v1/rpc/${fn} ...`);
  const parsed = new URL(SUPABASE_URL);
  const res = await post(
    parsed.hostname,
    `/rest/v1/rpc/${fn}`,
    {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    { [paramName]: SQL }
  );
  console.log(`   HTTP ${res.status}: ${res.body.slice(0, 300)}`);
  return res.status >= 200 && res.status < 300;
}

async function main() {
  console.log("📄 SQL to apply:");
  console.log(SQL);
  console.log("\n─────────────────────────────────────────────");

  // 1. Management API
  if (await tryManagementApi()) {
    console.log("\n✅ Applied via Management API.");
    return;
  }

  // 2. exec_sql RPC
  if (await tryAlternativeRpc("exec_sql", "sql_query")) {
    console.log("\n✅ Applied via exec_sql.");
    return;
  }

  // 3. exec RPC
  if (await tryAlternativeRpc("exec", "query")) {
    console.log("\n✅ Applied via exec.");
    return;
  }

  // 4. run_sql RPC
  if (await tryAlternativeRpc("run_sql", "sql")) {
    console.log("\n✅ Applied via run_sql.");
    return;
  }

  console.log("\n──────────────────────────────────────────────────────────────");
  console.log("⚠️  All automated methods failed.");
  console.log("Please apply the following SQL manually in the Supabase SQL Editor:");
  console.log("https://supabase.com/dashboard → Project → SQL Editor");
  console.log("──────────────────────────────────────────────────────────────\n");
  console.log(SQL);
  process.exit(2);
}

main().catch((e) => {
  console.error("❌ Fatal:", e.message);
  process.exit(1);
});
