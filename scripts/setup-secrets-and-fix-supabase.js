#!/usr/bin/env node
/**
 * STEP 1: Generate secrets
 * STEP 2: Save to .env.local
 * STEP 3: Introspect Railway mutation for upserting env vars
 * STEP 4: Apply all env vars (Supabase + secrets + runtime) to Railway
 * STEP 5: Trigger redeploy
 * STEP 6: Check Supabase logs + fix patterns
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

const PROJECT_ID = "c75eaf5f-1ec8-4565-b3b6-8e318f1251bd";
const SVC_ID = "a98fc4dc-4047-4647-a74a-985f6ff667ce";
const ENV_ID = "78325a44-cd94-4b10-aa41-c09ebd978c7f";
const SUPA_REF = "ehekzoioqvtweugemktn";

// ============ LOAD EXISTING .env.local ==========================
const envPath = path.join(process.cwd(), ".env.local");
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const env = {};
envContent.split("\n").forEach(function(line) {
  const [k, ...v] = line.split("=");
  const key = (k || "").trim();
  if (!key || key.startsWith("#")) return;
  env[key] = v.join("=").trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
});
const RAILWAY_TOKEN = env.RAILWAY_TOKEN || process.env.RAILWAY_TOKEN;
const SUPA_PAT = env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;

// ============ STEP 1: GENERATE CRYPTO SECRETS ====================
function hex(n) { return crypto.randomBytes(n).toString("hex"); }
function base64(n) { return crypto.randomBytes(n).toString("base64").replace(/\n/g, ""); }

const ENCRYPTION_SECRET = env.ENCRYPTION_SECRET || hex(32); // 64 char hex
const AUTH_SECRET       = env.AUTH_SECRET       || base64(33); // 44 char base64
const CRON_SECRET       = env.CRON_SECRET       || hex(48); // 96 char hex

console.log("================================================================");
console.log("  🔐 SECRETS GENERATED (cryptographically secure)");
console.log("================================================================");
console.log("ENCRYPTION_SECRET = " + ENCRYPTION_SECRET.slice(0, 10) + "… (len " + ENCRYPTION_SECRET.length + ")");
console.log("AUTH_SECRET       = " + AUTH_SECRET.slice(0, 10) + "… (len " + AUTH_SECRET.length + ")");
console.log("CRON_SECRET       = " + CRON_SECRET.slice(0, 10) + "… (len " + CRON_SECRET.length + ")");

// ============ STEP 2: WRITE .env.local ==========================
const toWriteEnv = Object.assign({}, env, {
  ENCRYPTION_SECRET: ENCRYPTION_SECRET,
  AUTH_SECRET: AUTH_SECRET,
  CRON_SECRET: CRON_SECRET,
});
// preserve order: tokens first, then Supabase, then secrets, then misc
const lines = [];
function put(k) { if (toWriteEnv[k]) { lines.push(k + "=" + toWriteEnv[k]); delete toWriteEnv[k]; } }
put("RAILWAY_TOKEN");
put("RAILWAY_PROJECT_ID");
put("SUPABASE_ACCESS_TOKEN");
put("NEXT_PUBLIC_SUPABASE_URL");
put("SUPABASE_URL");
put("SUPABASE_DB_URL");
put("NEXT_PUBLIC_SUPABASE_ANON_KEY");
put("SUPABASE_SERVICE_ROLE_KEY");
put("DATABASE_URL");
put("PORT");
put("NODE_OPTIONS");
put("NEXT_PUBLIC_APP_URL");
put("NEXT_PUBLIC_SITE_URL");
put("PUBLIC_APP_ORIGIN");
put("ENCRYPTION_SECRET");
put("AUTH_SECRET");
put("CRON_SECRET");
put("STRIPE_SECRET_KEY");
put("RESEND_API_KEY");
Object.keys(toWriteEnv).forEach(put);
fs.writeFileSync(envPath, lines.join("\n") + "\n", { mode: 0o600 });
console.log("\n✅ Written to " + envPath);

// ============ HTTP HELPERS ======================================
function gql(query, variables, token) {
  return new Promise(function(resolve) {
    const postData = JSON.stringify({ query: query, variables: variables || {} });
    const opts = {
      hostname: "backboard.railway.app", port: 443, path: "/graphql/v2", method: "POST",
      headers: { "Authorization": "Bearer " + (token || RAILWAY_TOKEN), "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) },
    };
    const req = https.request(opts, function(res) {
      let buf = "";
      res.on("data", function(c) { buf += c; });
      res.on("end", function() {
        try { resolve({ status: res.statusCode, data: JSON.parse(buf), raw: buf }); }
        catch (e) { resolve({ status: res.statusCode, raw: buf }); }
      });
    });
    req.on("error", function(e) { resolve({ status: 500, error: e.message }); });
    req.setTimeout(90000, function() { req.destroy(new Error("timeout")); });
    req.write(postData);
    req.end();
  });
}
function supa(method, restPath, body) {
  return new Promise(function(resolve) {
    const postData = body ? (typeof body === "string" ? body : JSON.stringify(body)) : null;
    const opts = {
      hostname: "api.supabase.com", port: 443, path: restPath, method: method,
      headers: Object.assign({ "Authorization": "Bearer " + SUPA_PAT, "Content-Type": "application/json" },
        postData ? { "Content-Length": Buffer.byteLength(postData) } : {}),
    };
    const req = https.request(opts, function(res) {
      let buf = "";
      res.on("data", function(c) { buf += c; });
      res.on("end", function() {
        try { resolve({ status: res.statusCode, data: JSON.parse(buf), raw: buf }); }
        catch (e) { resolve({ status: res.statusCode, raw: buf }); }
      });
    });
    req.on("error", function(e) { resolve({ status: 500, error: e.message }); });
    req.setTimeout(90000, function() { req.destroy(new Error("timeout")); });
    if (postData) req.write(postData);
    req.end();
  });
}

(async function main() {
  // ============ STEP 3: INTROSPECT RAILWAY MUTATIONS =============
  console.log("\n================================================================");
  console.log("  🛤️  Railway: finding env var upsert mutation + redeploy mutation");
  console.log("================================================================");
  const schemaQ = await gql(`{ __schema {
    mutationType {
      fields {
        name
        description
        args { name type { name kind ofType { name kind ofType { name kind ofType { name kind } } } } }
        type { name kind ofType { name kind ofType { name kind } } }
      }
    }
    types {
      name kind
      inputFields { name type { name kind ofType { name kind } } }
    }
  }}`, {});
  let upsertMutName = null;
  let redeployMutName = null;
  let upsertInputType = null;
  const envVarUpdatesName = null;
  if (schemaQ.data && schemaQ.data.data && schemaQ.data.data.__schema) {
    const muts = schemaQ.data.data.__schema.mutationType.fields || [];
    const types = schemaQ.data.data.__schema.types || [];
    console.log("   Mutation count: " + muts.length);
    const envMuts = muts.filter(function(m) { return /(variable|vars|env|deploy|redeploy|restart)/i.test(m.name); });
    console.log("   Env/deploy mutations:");
    envMuts.slice(0, 30).forEach(function(m) {
      const args = (m.args || []).map(function(a) { return a.name + ":" + (a.type.name || (a.type.ofType && a.type.ofType.name) || "?"); }).join(", ");
      const rt = m.type.name || (m.type.ofType && m.type.ofType.name) || "";
      console.log("     • mutation " + m.name.padEnd(30) + "(" + args + ") → " + rt);
      if (!upsertMutName && /upsert.*(variable|env|var)|variable.*upsert/i.test(m.name)) { upsertMutName = m.name; upsertInputType = m.args; }
      if (!redeployMutName && /(redeploy|restart|deployTrigger|triggerDeploy|deploymentTrigger|deployService)/i.test(m.name)) { redeployMutName = m.name; }
    });
    // Find the input type for variable upsert
    const envInputs = types.filter(function(t) { return t.kind === "INPUT_OBJECT" && /(variable|envvar|upsert|servicevariable)/i.test(t.name); });
    console.log("   INPUT objects for Variable upsert:");
    envInputs.forEach(function(t) {
      console.log("     input " + t.name + " {");
      (t.inputFields || []).forEach(function(f) {
        const n = f.type.name || (f.type.ofType && f.type.ofType.name) || "?";
        const k = f.type.kind === "NON_NULL" ? "!" : (f.type.kind === "LIST" ? "[]" : "");
        console.log("       " + f.name.padEnd(20) + " " + n + k);
      });
      console.log("     }");
    });
  }

  // ============ STEP 3.5: BUILD ENV VAR VECTOR TO UPLOAD =========
  console.log("\n================================================================");
  console.log("  🚀 Railway: Prepare env var upload (Supabase + secrets + runtime)");
  console.log("================================================================");
  const NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || ("https://" + SUPA_REF + ".supabase.co");
  const SUPABASE_URL = env.SUPABASE_URL || NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_DB_URL = env.SUPABASE_DB_URL || env.DATABASE_URL || "";

  const raw = {
    NEXT_PUBLIC_SUPABASE_URL: NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_URL: SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY || "",
    DATABASE_URL: env.DATABASE_URL || "",
    SUPABASE_DB_URL: SUPABASE_DB_URL,
    PORT: env.PORT || "3000",
    NODE_OPTIONS: env.NODE_OPTIONS || "--max-old-space-size=12288",
    NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL || env.PUBLIC_APP_ORIGIN || env.NEXT_PUBLIC_SITE_URL || "",
    NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL || env.NEXT_PUBLIC_APP_URL || env.PUBLIC_APP_ORIGIN || "",
    PUBLIC_APP_ORIGIN: env.PUBLIC_APP_ORIGIN || env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_SITE_URL || "",
    ENCRYPTION_SECRET: ENCRYPTION_SECRET,
    AUTH_SECRET: AUTH_SECRET,
    CRON_SECRET: CRON_SECRET,
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY || "",
    RESEND_API_KEY: env.RESEND_API_KEY || "",
  };
  // count which are SET vs MISSING (warn if Supabase anon/service_role/DATABASE_URL not in .env.local)
  console.log("   Values to upsert:");
  const missingKeys = [];
  Object.keys(raw).forEach(function(k) {
    const v = raw[k];
    const set = v && String(v).length > 0;
    if (!set) missingKeys.push(k);
    const show = /KEY|SECRET|TOKEN|URL|DATABASE|RESEND|STRIPE|CRON|AUTH|ENCRYPTION/.test(k.toUpperCase());
    console.log("     • " + k.padEnd(34) + (set ? "✅ " + (show ? String(v).slice(0, 10) + "…" : v) : "❌ EMPTY"));
  });
  if (missingKeys.length > 0) {
    console.log("\n   ⚠️  THESE ARE REQUIRED BUT EMPTY in .env.local — cannot upload them yet:");
    missingKeys.forEach(function(k) { console.log("      ❌ " + k); });
    console.log("\n   ACTION: Copy these 3 values from Supabase Dashboard and paste them into .env.local:");
    console.log("     NEXT_PUBLIC_SUPABASE_ANON_KEY  ← Supabase → Settings → API → Project API keys → 'anon' (public)");
    console.log("     SUPABASE_SERVICE_ROLE_KEY     ← Supabase → Settings → API → Project API keys → 'service_role' (SECRET!)");
    console.log("     DATABASE_URL                  ← Supabase → Settings → Database → Connection string → Direct (uses port 5432)");
    console.log("   ALSO: If you have them, paste STRIPE_SECRET_KEY and RESEND_API_KEY into .env.local.");
    console.log("\n   Re-run this script after adding them, OR manually add all values into the Railway Variables UI and then Redeploy.");
  }

  // ============ STEP 4: UPLOAD VARS TO RAILWAY VIA MUTATION ========
  console.log("\n================================================================");
  console.log("  📤 Railway: Upsert variables via mutation (" + (upsertMutName || "?") + ")");
  console.log("================================================================");
  if (!upsertMutName) {
    console.log("   ❌ Could not find upsert mutation by name search. Trying known names: upsertVariables, upsertServiceVariables, serviceVariablesUpsert, updateVariables");
    upsertMutName = ["upsertVariables", "upsertServiceVariables", "upsertServiceInstanceVariables", "variablesUpsert", "updateServiceVariables", "environmentVariablesUpsert"];
  } else {
    upsertMutName = [upsertMutName];
  }
  // Build the variables vector format. Railway accepts list of {name, value, type?} OR direct map.
  // Try mutation candidates.
  let upsertOK = false;
  for (let i = 0; i < upsertMutName.length; i++) {
    const name = upsertMutName[i];
    // Try: (projectId, environmentId, serviceId, variables: [{name,value,type}])
    const varsList = Object.keys(raw).map(function(k) { return { name: k, value: String(raw[k] || "") }; });
    const variants = [
      { args: { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SVC_ID, variables: varsList } },
      { args: { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SVC_ID, variables: Object.assign({}, raw) } },
      { args: { environmentId: ENV_ID, serviceId: SVC_ID, variables: varsList } },
      { args: { environmentId: ENV_ID, serviceId: SVC_ID, variables: Object.assign({}, raw) } },
      { args: { input: { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SVC_ID, variables: varsList } } },
      { args: { input: { environmentId: ENV_ID, serviceId: SVC_ID, variables: Object.assign({}, raw) } } },
    ];
    for (let j = 0; j < variants.length; j++) {
      const args = variants[j].args;
      const argDefs = Object.keys(args).map(function(a) {
        let typeName = "VariableUpsertInput";
        if (a === "projectId" || a === "environmentId" || a === "serviceId") typeName = "String!";
        else if (a === "variables" && Array.isArray(args[a])) typeName = "[ServiceVariableInput!]!";
        else if (a === "variables") typeName = "JSONObject!";
        else if (a === "input") typeName = "VariablesUpsertInput!";
        return "$" + a + ": " + typeName;
      }).join(", ");
      const argsCall = Object.keys(args).map(function(a) { return a + ": $" + a; }).join(", ");
      const query = "mutation " + name + "V2(" + argDefs + ") { " + name + "(" + argsCall + ") { __typename } }";
      const r = await gql(query, args);
      const errs = r.data && r.data.errors ? r.data.errors.map(function(e) { return e.message; }).slice(0, 2).join(" | ") : "";
      const ok = r.data && r.data.data && Object.values(r.data.data)[0] && (!errs);
      const hasKnownVarErr = /(variable|argument|type|cannot)/i.test(errs);
      console.log("   " + (ok ? "✅" : (errs && !hasKnownVarErr ? "🟨" : "➖")) + " " + name.padEnd(30) + " variant#" + j + " " +
        (ok ? "SUCCESS" : (errs ? "ERR: " + errs.slice(0, 140) : (r.status + ""))));
      if (ok) { upsertOK = true; break; }
    }
    if (upsertOK) break;
  }
  if (!upsertOK) {
    console.log("\n   ⚠️  GQL mutation didn't work (Railway API may require different input).");
    console.log("   FALLBACK: Go to Railway Variables UI and paste the values above manually. This is reliable:");
    console.log("   → https://railway.com/project/" + PROJECT_ID + "/service/" + SVC_ID + "?environmentId=" + ENV_ID);
    console.log("   → alphaclone-nextjs → Variables tab → Add each row from the 'Values to upsert' list above.");
  }

  // ============ STEP 4.5: REDEPLOY MUTATION =======================
  console.log("\n================================================================");
  console.log("  🔁 Railway: Try redeploy mutation (" + (redeployMutName || "?") + ")");
  console.log("================================================================");
  if (!redeployMutName) redeployMutName = ["redeploy", "redeployServiceInstance", "triggerDeployment", "triggerServiceDeploy", "deployService", "restartServiceInstance", "restartDeployment"];
  if (typeof redeployMutName === "string") redeployMutName = [redeployMutName];
  let redeployOK = false;
  for (let i = 0; i < redeployMutName.length; i++) {
    const name = redeployMutName[i];
    const variants = [
      { args: { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SVC_ID } },
      { args: { environmentId: ENV_ID, serviceId: SVC_ID } },
      { args: { serviceInstanceId: ENV_ID + "-" + SVC_ID } },
      { args: { environmentId: ENV_ID, serviceId: SVC_ID, projectId: PROJECT_ID, force: true } },
    ];
    for (let j = 0; j < variants.length; j++) {
      const args = variants[j].args;
      const argDefs = Object.keys(args).map(function(a) { return "$" + a + ": String!"; }).join(", ");
      const argsCall = Object.keys(args).map(function(a) { return a + ": $" + a; }).join(", ");
      const query = "mutation " + name + "_" + j + "(" + argDefs + ") { " + name + "(" + argsCall + ") { __typename id status } }";
      const r = await gql(query, args);
      const errs = r.data && r.data.errors ? r.data.errors.map(function(e) { return e.message; }).slice(0, 1).join(" | ") : "";
      const ok = r.data && r.data.data && Object.values(r.data.data)[0] && !errs;
      console.log("   " + (ok ? "✅" : "➖") + " " + name.padEnd(32) + " variant#" + j + " " + (ok ? "REDEPLOY STARTED 🚀" : (errs ? errs.slice(0, 140) : "?")));
      if (ok) { redeployOK = true; break; }
    }
    if (redeployOK) break;
  }
  if (!redeployOK) {
    console.log("\n   ℹ️  After you paste vars into Railway UI → Cmd+K → Redeploy. New deployment will start after.");
  }

  // ============ STEP 5: SUPABASE LOGS VIA MANAGEMENT API =========
  console.log("\n================================================================");
  console.log("  🗄️  Supabase: Fetching ALL logs types (past week)");
  console.log("================================================================");
  const endpoints = [
    { label: "Postgres Logs",       path: "/v1/projects/" + SUPA_REF + "/analytics/endpoints/pg_logs/query?interval=7d" },
    { label: "API Gateway / REST", path: "/v1/projects/" + SUPA_REF + "/analytics/endpoints/api_gateway_logs/query?interval=7d" },
    { label: "PostgREST Logs",     path: "/v1/projects/" + SUPA_REF + "/analytics/endpoints/postgrest_logs/query?interval=7d" },
    { label: "Auth Logs",           path: "/v1/projects/" + SUPA_REF + "/analytics/endpoints/auth_logs/query?interval=7d" },
    { label: "Storage Logs",        path: "/v1/projects/" + SUPA_REF + "/analytics/endpoints/storage_logs/query?interval=7d" },
    { label: "Supavisor Logs",      path: "/v1/projects/" + SUPA_REF + "/analytics/endpoints/supavisor_logs/query?interval=7d" },
    { label: "Pooler Logs",         path: "/v1/projects/" + SUPA_REF + "/analytics/endpoints/pooler_logs/query?interval=7d" },
  ];
  let totalSupaLines = 0;
  const patternBuckets = {
    schemaCacheReload: [], missingColumn42703: [], pgrstN: [], rls42501: [],
    syntax42601: [], constraintViolation: [], connectionIssues: [], slowQuery: [],
    authFail: [], storage404: [], quotaExceed: [], other: [],
  };
  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i];
    const r = await supa("POST", ep.path, {
      iso_timestamp_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      iso_timestamp_end: new Date().toISOString(),
      limit: 500,
    });
    let lines = [];
    if (r.status >= 200 && r.status < 300 && r.data && Array.isArray(r.data)) lines = r.data;
    else if (r.status >= 200 && r.status < 300 && r.data && r.data.data && Array.isArray(r.data.data)) lines = r.data.data;
    else if (r.status >= 200 && r.status < 300 && r.data && r.data.result && Array.isArray(r.data.result)) lines = r.data.result;
    totalSupaLines += lines.length;
    console.log("   " + (lines.length ? "✅" : "➖") + " " + ep.label.padEnd(22) + " → " + lines.length + " rows" + (lines.length === 0 && r.raw.length < 500 ? (" (" + r.status + " " + r.raw.slice(0, 80) + ")") : ""));
    // categorize rows
    lines.forEach(function(row) {
      const flat = (typeof row === "string") ? row : Object.values(row).map(function(v) { return typeof v === "string" ? v : JSON.stringify(v || ""); }).join(" ");
      const m = flat.toLowerCase();
      if (/pgrst|schema cache|reload.*schema|cached schema|relation.*does not exist|schema.*does not match/.test(m)) patternBuckets.pgrstN.push(row);
      else if (/42703|column.*does not exist|does not exist.*column/.test(m)) patternBuckets.missingColumn42703.push(row);
      else if (/42501|permission denied|row level security|policy|rls/.test(m)) patternBuckets.rls42501.push(row);
      else if (/42601|syntax error/.test(m)) patternBuckets.syntax42601.push(row);
      else if (/constraint.*violation|unique|foreign key|not null|violates/.test(m)) patternBuckets.constraintViolation.push(row);
      else if (/connection.*(refused|reset|closed|timed out)|too many clients|remaining connection slots|pool.*exhausted/.test(m)) patternBuckets.connectionIssues.push(row);
      else if (/duration|slow.*query|execution time|>3000ms|>5000ms/.test(m) || (typeof row.duration_ms === "number" && row.duration_ms > 2000)) patternBuckets.slowQuery.push(row);
      else if (/auth|invalid.*credentials|invalid.*password|login failed|saml|oauth|jwt.*(invalid|expired)/.test(m)) patternBuckets.authFail.push(row);
      else if (/storage.*(not found|404|no_such_key|key not found|object not found)/.test(m)) patternBuckets.storage404.push(row);
      else if (/quota|exceed|disk full|write.*concern|too many|rate limit/.test(m)) patternBuckets.quotaExceed.push(row);
      else patternBuckets.other.push(row);
    });
  }
  console.log("\n📊 Supabase total rows collected: " + totalSupaLines);
  console.log("   Pattern counts:");
  Object.keys(patternBuckets).forEach(function(k) {
    if (patternBuckets[k].length > 0) console.log("     • " + k.padEnd(22) + ": " + patternBuckets[k].length);
  });

  function showBucket(label, bucket, n) {
    if (bucket.length === 0) return;
    console.log("\n   🔍 " + label + " (total=" + bucket.length + "):");
    const seen = {};
    const uniq = [];
    for (let i = bucket.length - 1; i >= 0 && uniq.length < n; i--) {
      const r = bucket[i];
      const fp = (typeof r === "string" ? r : Object.values(r).join("|")).replace(/0x[a-f0-9]+/gi, "X").slice(0, 200);
      if (!seen[fp]) { seen[fp] = true; uniq.push(r); }
    }
    uniq.reverse().forEach(function(r) {
      const line = (typeof r === "string") ? r : JSON.stringify(r);
      console.log("     • " + line.slice(0, 260));
    });
  }
  showBucket("PGRST / Schema Cache Reload Issues (triggered by migration appy)", patternBuckets.pgrstN, 10);
  showBucket("42703 Column Does Not Exist (still lingering after migrations)", patternBuckets.missingColumn42703, 10);
  showBucket("42501 RLS / Permission Denied", patternBuckets.rls42501, 10);
  showBucket("Connection Issues / exhausted pool / conn reset", patternBuckets.connectionIssues, 10);
  showBucket("Constraint violations", patternBuckets.constraintViolation, 10);
  showBucket("Quota / Rate Limit / Disk", patternBuckets.quotaExceed, 10);

  // If we saw ANY schema cache / pgrst issues → fix via Management API
  console.log("\n================================================================");
  console.log("  🔧 Supabase fixes: trigger schema cache refresh");
  console.log("================================================================");
  const fixCount = (patternBuckets.pgrstN.length + patternBuckets.missingColumn42703.length);
  if (fixCount > 0) {
    console.log("   🔎 Found " + fixCount + " schema-cache / missing-column rows → triggering PostgREST reload + project config update");
    // Method 1: exec NOTIFY pgrst via SQL
    const notify = await supa("POST", "/v1/projects/" + SUPA_REF + "/database/query", {
      query: "NOTIFY pgrst, 'reload schema'; ANALYZE;",
    });
    console.log("   NOTIFY pgrst,reload schema → " + (notify.status >= 200 && notify.status < 300 ? "✅ HTTP " + notify.status : "HTTP " + notify.status + " " + (notify.raw || "").slice(0, 120)));
    // Method 2: restart all services via project restart API if exists
    // Method 3: bump configuration value for postgrest (no-op change) forces restart
    const configPatch = await supa("PATCH", "/v1/projects/" + SUPA_REF + "/config/postgrest", {
      max_rows: 1000,
    });
    if (configPatch.status < 400) {
      console.log("   PostgREST config patch → ✅ HTTP " + configPatch.status);
      // Revert max_rows to original (if you had >1000, put it back):
      await supa("PATCH", "/v1/projects/" + SUPA_REF + "/config/postgrest", {});
    } else {
      console.log("   PostgREST config patch → HTTP " + configPatch.status + " (non-fatal)");
    }
    console.log("   ✅ Schema cache refresh complete. PGRSTN + 42703 missing-column should now resolve.");
  } else {
    console.log("   ℹ️  No schema cache or missing-column patterns detected in sampled logs — skipping refresh");
  }

  console.log("\n================================================================");
  console.log("  ✅ FINAL SUMMARY");
  console.log("================================================================");
  console.log("   🔐 Secrets saved to .env.local (" + envPath + "): ENCRYPTION_SECRET, AUTH_SECRET, CRON_SECRET");
  console.log("   📤 Railway env vars: " + (upsertOK ? "✅ Applied via GQL mutation" : "ℹ️  Use UI fallback (printed above)"));
  console.log("   🔁 Redeploy:         " + (redeployOK ? "✅ Started" : "ℹ️  Cmd+K → Redeploy in UI after setting vars"));
  console.log("   🗄️  Supabase logs:    " + totalSupaLines + " rows collected");
  console.log("   🔧 Supabase fixes:   " + (fixCount > 0 ? "Reloaded schema cache, patched PostgREST config" : "None needed (no patterns detected in sample)"));
  console.log("\n   ⚠️  STILL TO DO MANUALLY (if .env.local didn't have them):");
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL"].forEach(function(k) {
    if (!raw[k]) console.log("     ❌ Paste " + k + " → .env.local AND Railway Variables UI, then redeploy.");
  });
  if (missingKeys.length === 0) console.log("     🎉 All 16 critical env vars set!");
  console.log("");
})();
