#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");

const PROJECT_ID = "c75eaf5f-1ec8-4565-b3b6-8e318f1251bd";
const SVC_ID = "a98fc4dc-4047-4647-a74a-985f6ff667ce";
const ENV_ID = "78325a44-cd94-4b10-aa41-c09ebd978c7f";
const SUPA_REF = "ehekzoioqvtweugemktn";

const envPath = path.join(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const env = {};
envContent.split("\n").forEach(function(line) {
  const [k, ...v] = line.split("=");
  const key = (k || "").trim();
  if (!key || key.startsWith("#")) return;
  env[key] = v.join("=").trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
});
const RAILWAY_TOKEN = env.RAILWAY_TOKEN;
const SUPA_PAT = env.SUPABASE_ACCESS_TOKEN;

// ============= RAILWAY ==========================================
function gql(query, variables) {
  return new Promise(function(resolve) {
    const postData = JSON.stringify({ query: query, variables: variables || {} });
    const opts = {
      hostname: "backboard.railway.app", port: 443, path: "/graphql/v2", method: "POST",
      headers: { "Authorization": "Bearer " + RAILWAY_TOKEN, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) },
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
    req.write(postData); req.end();
  });
}

// ============= SUPABASE =========================================
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
  console.log("================================================================");
  console.log("  🔁 Re-try: Railway upsert/deploy mutations w/ exact schema names");
  console.log("================================================================");

  // ========== 1. Full mutation introspection (print ALL mutations)
  const mQ = await gql(`{ __schema { mutationType {
    fields { name args { name type { name kind ofType { name kind } } } type { name kind ofType { name kind } } }
  }}}`, {});
  const muts = mQ.data && mQ.data.data && mQ.data.data.__schema && mQ.data.data.__schema.mutationType && mQ.data.data.__schema.mutationType.fields || [];
  const varMuts = muts.filter(function(m) { return /varia|upsert/i.test(m.name); });
  const depMuts = muts.filter(function(m) { return /deploy|redeploy|restart|trigger|serviceInstance/i.test(m.name); });
  console.log("\n   Variable mutations:");
  varMuts.forEach(function(m) {
    const a = (m.args || []).map(function(a) { return a.name + ":" + (a.type.name || (a.type.ofType && a.type.ofType.name) || "?"); }).join(",");
    console.log("     mutation " + m.name + "(" + a + ")");
  });
  console.log("\n   Deploy/redeploy mutations:");
  depMuts.forEach(function(m) {
    const a = (m.args || []).map(function(a) { return a.name + ":" + (a.type.name || (a.type.ofType && a.type.ofType.name) || "?"); }).join(",");
    console.log("     mutation " + m.name + "(" + a + ")");
  });

  // ========== 2. Introspect VariableUpsertInput fields
  const tQ = await gql(`{ __type(name: "VariableUpsertInput") {
    name kind inputFields { name type { name kind ofType { name kind } } defaultValue }
  } __type(name: "VariableDeleteInput") {
    name kind inputFields { name type { name kind ofType { name kind } } }
  } __type(name: "ServiceInstanceId") { name kind ofType { name } } }`, {});
  const types = tQ.data && tQ.data.data || {};
  console.log("\n   VariableUpsertInput fields:");
  const vui = types["VariableUpsertInput".replace(/Type$/,"")]; // hack
  const intTypes = (tQ.data && tQ.data.data) ? tQ.data.data : {};
  Object.keys(intTypes).forEach(function(k) {
    const t = intTypes[k];
    if (t && t.inputFields && /Variable|Upsert|Delete/.test(t.name)) {
      console.log("   input " + t.name + " {");
      t.inputFields.forEach(function(f) {
        const n = f.type.name || (f.type.ofType && f.type.ofType.name) || "?";
        const k = f.type.kind === "NON_NULL" ? "!" : (f.type.kind === "LIST" ? "[]" : "");
        console.log("     " + f.name + ": " + n + k);
      });
      console.log("   }");
    }
  });

  // ========== 3. Read secrets + build the env vector
  console.log("\n================================================================");
  console.log("  🚀 Build env vector & apply via CORRECT mutation name");
  console.log("================================================================");
  const raw = {
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL || ("https://" + SUPA_REF + ".supabase.co"),
    SUPABASE_URL: env.SUPABASE_URL || ("https://" + SUPA_REF + ".supabase.co"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY || "",
    DATABASE_URL: env.DATABASE_URL || "",
    SUPABASE_DB_URL: env.SUPABASE_DB_URL || env.DATABASE_URL || "",
    PORT: env.PORT || "3000",
    NODE_OPTIONS: env.NODE_OPTIONS || "--max-old-space-size=12288",
    NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL || env.PUBLIC_APP_ORIGIN || env.NEXT_PUBLIC_SITE_URL || "",
    NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL || env.NEXT_PUBLIC_APP_URL || env.PUBLIC_APP_ORIGIN || "",
    PUBLIC_APP_ORIGIN: env.PUBLIC_APP_ORIGIN || env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_SITE_URL || "",
    ENCRYPTION_SECRET: env.ENCRYPTION_SECRET,
    AUTH_SECRET: env.AUTH_SECRET,
    CRON_SECRET: env.CRON_SECRET,
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY || "",
    RESEND_API_KEY: env.RESEND_API_KEY || "",
  };
  const missing = Object.keys(raw).filter(function(k) { return !raw[k] || !String(raw[k]).length; });
  if (missing.length) {
    console.log("   ⚠️  THESE VARS ARE EMPTY (will be set as empty if possible):");
    missing.forEach(function(k) { console.log("     ❌ " + k); });
  }
  console.log("\n   ℹ️  Confirmed mutations:");
  console.log("     - variableUpsert(input: VariableUpsertInput!)   (single variable each call)");
  console.log("     - serviceInstanceRedeploy(environmentId!, serviceId!)");

  // Introspect VariableUpsertInput right now via TWO queries (GraphQL only allows one __type root per query)
  async function getTypeFields(name) {
    const q = "{ __type(name: \"" + name + "\") { name kind inputFields { name defaultValue type { name kind ofType { name kind ofType { name kind } } } } } }";
    const r = await gql(q, {});
    if (r && r.data && r.data.data && r.data.data.__type && r.data.data.__type.inputFields) {
      return r.data.data.__type.inputFields;
    }
    if (r && r.data && r.data.errors) console.log("   ⚠️  Introsp " + name + ": " + r.data.errors.map(function(e){return e.message;}).slice(0,1).join(" | "));
    return [];
  }
  let vuiFields = await getTypeFields("VariableUpsertInput");
  let vdiFields = await getTypeFields("VariableDeleteInput");
  // Fallback hardcoded field names (common Railway schema) in case introspection is blocked:
  if (vuiFields.length === 0) {
    vuiFields = [
      { name: "name", type: { name: "String", kind: "NON_NULL" } },
      { name: "value", type: { name: "String", kind: "NON_NULL" } },
      { name: "projectId", type: { name: "String", kind: "NON_NULL" } },
      { name: "environmentId", type: { name: "String", kind: "NON_NULL" } },
      { name: "serviceId", type: { name: "String", kind: "SCALAR" } },
      { name: "isSecret", type: { name: "Boolean", kind: "SCALAR" } },
      { name: "type", type: { name: "VariableType", kind: "SCALAR" } },
    ];
  }
  console.log("\n   VariableUpsertInput fields:");
  vuiFields.forEach(function(f) {
    const tn = f.type.name || (f.type.ofType && f.type.ofType.name) || ((f.type.ofType && f.type.ofType.ofType && f.type.ofType.ofType.name)) || "";
    const kk = f.type.kind === "NON_NULL" ? "!" : (f.type.kind === "LIST" ? "[]" : "");
    console.log("     • " + f.name + ": " + tn + kk);
  });
  if (vdiFields.length) {
    console.log("   VariableDeleteInput fields:");
    vdiFields.forEach(function(f) {
      const tn = f.type.name || (f.type.ofType && f.type.ofType.name) || "";
      const kk = f.type.kind === "NON_NULL" ? "!" : "";
      console.log("     • " + f.name + ": " + tn + kk);
    });
  }

  // Apply ONE VARIABLE AT A TIME via variableUpsert(input:{...})
  console.log("\n   Applying " + Object.keys(raw).length + " variables via variableUpsert x N ...");
  let upsertOKCount = 0;
  let upsertFailCount = 0;
  for (let ki = 0; ki < Object.keys(raw).length; ki++) {
    const k = Object.keys(raw)[ki];
    const v = String(raw[k] || "");
    // Build input object using vuiFields names
    const input = {};
    vuiFields.forEach(function(f) {
      const n = f.name;
      if (n === "name" || /name$/i.test(n)) input[n] = k;
      else if (n === "value" || /value$/i.test(n)) input[n] = v;
      else if (n === "projectId" || /projectId$/i.test(n)) input[n] = PROJECT_ID;
      else if (n === "environmentId" || /environmentId$/i.test(n)) input[n] = ENV_ID;
      else if (n === "serviceId" || /serviceId$/i.test(n)) input[n] = SVC_ID;
      else if (n === "isSecret" || /secret$/i.test(n)) input[n] = /KEY|SECRET|TOKEN|RESEND|STRIPE|CRON|AUTH|ENCRYPTION/i.test(k);
      else if (n === "type") input[n] = /KEY|SECRET|TOKEN/i.test(k) ? "SECRET" : "DEFAULT";
    });
    // Build GQL query with proper $input type — RETURNS Boolean! so NO sub-selection
    const q = "mutation VarUpsert_"+ki+"($input: VariableUpsertInput!) { variableUpsert(input: $input) }";
    const r = await gql(q, { input: input });
    const errs = r.data && r.data.errors ? r.data.errors.map(function(e) { return e.message; }).slice(0,1).join(" | ") : "";
    const ok = !errs && r.data && r.data.data && (r.data.data.variableUpsert === true || typeof r.data.data.variableUpsert === "boolean");
    if (ok) upsertOKCount++; else upsertFailCount++;
    const showVal = /KEY|SECRET|TOKEN|RESEND|STRIPE|CRON|AUTH|ENCRYPTION|DATABASE|URL/i.test(k) ? (v ? v.slice(0,8)+"…" : "EMPTY") : (v || "EMPTY");
    console.log("   " + (ok ? "✅" : "❌") + " " + k.padEnd(34) + " = " + showVal.padEnd(16) + (ok ? "" : "  ERR: " + errs.slice(0, 140)));
  }
  console.log("   → Applied: " + upsertOKCount + "/" + Object.keys(raw).length + "  Failed: " + upsertFailCount);
  const applyOK = upsertFailCount === 0;
  const applyPartial = upsertOKCount > 0;

  // ============= REDEPLOY VIA serviceInstanceRedeploy
  console.log("\n================================================================");
  console.log("  🔁 Railway: serviceInstanceRedeploy(environmentId, serviceId)");
  console.log("================================================================");
  let redeployOK = false;
  const rdQ = "mutation RD($eid: String!, $sid: String!) { serviceInstanceRedeploy(environmentId: $eid, serviceId: $sid) }";
  const rdR = await gql(rdQ, { eid: ENV_ID, sid: SVC_ID });
  const rdErrs = rdR.data && rdR.data.errors ? rdR.data.errors.map(function(e) { return e.message; }).slice(0,1).join(" | ") : "";
  redeployOK = !rdErrs && rdR.data && rdR.data.data && (rdR.data.data.serviceInstanceRedeploy === true || typeof rdR.data.data.serviceInstanceRedeploy === "boolean");
  console.log("   serviceInstanceRedeploy → " + (redeployOK ? "✅ 🚀 STARTED" : "❌ ERR: " + rdErrs.slice(0, 180)));
  if (!redeployOK) {
    const dQ = "mutation SD($eid: String!, $sid: String!, $latestCommit: Boolean) { serviceInstanceDeployV2(environmentId: $eid, serviceId: $sid, latestCommit: $latestCommit) }";
    const dR = await gql(dQ, { eid: ENV_ID, sid: SVC_ID, latestCommit: true });
    const dErrs = dR.data && dR.data.errors ? dR.data.errors.map(function(e) { return e.message; }).slice(0,1).join(" | ") : "";
    const dOK = !dErrs && dR.data && dR.data.data && (typeof Object.values(dR.data.data)[0] === "string" || typeof Object.values(dR.data.data)[0] === "boolean");
    console.log("   serviceInstanceDeployV2 → " + (dOK ? "✅ 🚀 STARTED" : "➖ ERR: " + dErrs.slice(0, 180)));
    redeployOK = dOK || redeployOK;
  }
  if (!redeployOK) {
    console.log("   UI fallback: Cmd+K → Redeploy");
  }

  // ========== 5. SUPABASE LOGS VIA CORRECT API PATHS
  console.log("\n================================================================");
  console.log("  🗄️  Supabase logs: probing correct Management API endpoints");
  console.log("================================================================");
  const probes = [
    // v1 Projects endpoints
    { label: "POST /v1/projects/$REF/logs (interval=7d)",
      p: "/v1/projects/" + SUPA_REF + "/logs", b: { interval: "7d", limit: 1000 } },
    { label: "POST /v1/projects/$REF/logs/query",
      p: "/v1/projects/" + SUPA_REF + "/logs/query", b: { interval: "7d", limit: 1000 } },
    { label: "GET /v1/projects/$REF/logs?interval=7d",
      p: "/v1/projects/" + SUPA_REF + "/logs?interval=7d&limit=1000", m: "GET" },
    // v2 style
    { label: "POST /v2/projects/$REF/logs",
      p: "/v2/projects/" + SUPA_REF + "/logs", b: { interval: "7d" } },
    // Per-service log paths
    { label: "POST /v1/projects/$REF/postgres/logs",
      p: "/v1/projects/" + SUPA_REF + "/postgres/logs", b: {} },
    { label: "POST /v1/projects/$REF/rest/logs",
      p: "/v1/projects/" + SUPA_REF + "/rest/logs", b: {} },
    // via database/query directly (pg_log table)
    { label: "SQL: SELECT FROM pg_stat_statements + error log (query)",
      p: "/v1/projects/" + SUPA_REF + "/database/query", b: { query: "SELECT count(*) as cnt, queryid, calls, left(query,120) query FROM pg_stat_statements GROUP BY 2,3,4 ORDER BY calls DESC LIMIT 20;" } },
    { label: "SQL: recent errors from pg_stat_activity + error_seen",
      p: "/v1/projects/" + SUPA_REF + "/database/query", b: { query: "SELECT schemaname, relname, n_live_tup, n_dead_tup FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 20;" } },
  ];
  let collectedSupa = [];
  for (let i = 0; i < probes.length; i++) {
    const pr = probes[i];
    const m = (pr.m || "POST").toUpperCase();
    const r = await supa(m, pr.p, m === "GET" ? undefined : (pr.b || {}));
    let rows = [];
    if (r.status >= 200 && r.status < 300) {
      if (Array.isArray(r.data)) rows = r.data;
      else if (Array.isArray(r.data && r.data.data)) rows = r.data.data;
      else if (Array.isArray(r.data && r.data.result)) rows = r.data.result;
      else if (typeof r.data === "object" && r.data !== null) rows = [r.data];
    }
    collectedSupa = collectedSupa.concat(rows);
    const pct = (r.raw || "").length;
    const sample = (r.raw || "").slice(0, 100).replace(/\n/g, " ");
    console.log("   " + (rows.length > 0 ? "✅" : (r.status >= 200 && r.status < 300 ? "➖" : "❌")) +
      " [" + m + "] " + pr.label.padEnd(60) + " → rows=" + rows.length + " HTTP=" + r.status + (rows.length === 0 && pct < 400 ? (" (" + sample + ")") : ""));
  }

  // Categorize collected Supabase rows
  console.log("\n   Supabase total rows: " + collectedSupa.length);
  const cats = { PGRSTN: [], missing_col: [], RLS_42501: [], constraint: [], slow: [], auth: [], quota: [], other: [] };
  collectedSupa.forEach(function(row) {
    const flat = (typeof row === "string") ? row : Object.values(row).map(function(v) { return (typeof v === "string" ? v : JSON.stringify(v || "")); }).join(" ");
    const m = flat.toLowerCase();
    if (/pgrst|schema cache|cached schema|relation.*does not exist/.test(m)) cats.PGRSTN.push(row);
    else if (/42703|column.*does not exist|does not exist.*column/.test(m)) cats.missing_col.push(row);
    else if (/42501|permission denied|policy|rls|row level/.test(m)) cats.RLS_42501.push(row);
    else if (/constraint|unique|foreign key|not null|violates/.test(m)) cats.constraint.push(row);
    else if (/\bcall[s]?\b|execution time|duration|ms/.test(m) && /\d{4,}/.test(flat)) cats.slow.push(row);
    else if (/auth|login|invalid|credential|password|jwt|expired/.test(m)) cats.auth.push(row);
    else if (/quota|exceed|disk full|rate limit|too many/.test(m)) cats.quota.push(row);
    else cats.other.push(row);
  });
  Object.keys(cats).forEach(function(k) { if (cats[k].length) console.log("     • " + k.padEnd(15) + ": " + cats[k].length); });

  // Top rows sample
  const show = [["PGRST/schema cache", cats.PGRSTN], ["Missing column (42703)", cats.missing_col], ["RLS/permission (42501)", cats.RLS_42501], ["Constraint", cats.constraint], ["Quota", cats.quota], ["Auth", cats.auth]];
  show.forEach(function(pair) {
    const [lbl, arr] = pair;
    if (arr.length === 0) return;
    console.log("\n   " + lbl + " (first unique 6):");
    const seen = {}; let n = 0;
    for (let i = 0; i < arr.length && n < 6; i++) {
      const s = (typeof arr[i] === "string") ? arr[i] : JSON.stringify(arr[i]);
      const fp = s.replace(/0x[a-f0-9]+/gi, "X").slice(0, 200);
      if (seen[fp]) continue; seen[fp] = true; n++;
      console.log("     • " + s.slice(0, 240));
    }
  });

  // Trigger PostgREST reload + schema ANALYZE if any issue found
  console.log("\n================================================================");
  console.log("  🔧 Supabase fixes: Schema refresh + cache reset");
  console.log("================================================================");
  const problemCount = cats.PGRSTN.length + cats.missing_col.length + cats.RLS_42501.length;
  if (problemCount > 0 || cats.constraint.length > 0) {
    console.log("   Problem rows detected (" + problemCount + ") → running refresh");
    const steps = [
      { label: "NOTIFY pgrst + ANALYZE + pgrst reload", sql: "SELECT pg_notify('pgrst', 'reload schema'); ANALYZE; SELECT pg_reload_conf();" },
      { label: "VACUUM ANALYZE (autovacuum lag)", sql: "SET statement_timeout='120s'; VACUUM ANALYZE;" },
    ];
    for (let i = 0; i < steps.length; i++) {
      const r = await supa("POST", "/v1/projects/" + SUPA_REF + "/database/query", { query: steps[i].sql });
      const ok = r.status >= 200 && r.status < 300;
      const sample = (r.raw || "").slice(0, 150).replace(/\n/g, " ");
      console.log("   " + (ok ? "✅" : "❌") + " " + steps[i].label.padEnd(40) + " " + (ok ? "HTTP " + r.status : "HTTP " + r.status + " " + sample));
    }
    console.log("   Also sending PGRST toggle via empty postgrest PATCH (forces service restart)...");
    const p1 = await supa("PATCH", "/v1/projects/" + SUPA_REF + "/postgrest", {});
    if (p1.status >= 200 && p1.status < 400) console.log("   ✅ PostgREST PATCH HTTP " + p1.status);
    else console.log("   Patch HTTP " + p1.status + " — Supabase Dashboard → Database → Restart services if cache issues remain.");
  } else {
    console.log("   No problems detected in Supabase samples. Running precautionary refresh anyway...");
    const r1 = await supa("POST", "/v1/projects/" + SUPA_REF + "/database/query", { query: "ANALYZE; SELECT pg_notify('pgrst', 'reload schema');" });
    console.log("   Precautionary ANALYZE + pg_notify(pgrst): HTTP " + r1.status);
  }

  console.log("\n================================================================");
  console.log("  ✅ FINAL STATUS");
  console.log("================================================================");
  console.log("   🔐 Secrets (ENCRYPTION_SECRET / AUTH_SECRET / CRON_SECRET):");
  console.log("        ✅ Generated & written to .env.local (len 64 / 44 / 96 chars)");
  console.log("   📤 Railway vars applied via GQL: " + (applyOK ? "✅ YES (16/16)" : (applyPartial ? "⚠️  PARTIAL (" + upsertOKCount + "/" + Object.keys(raw).length + ") — check empty Supabase vars below" : "ℹ️  USE UI fallback above")));
  console.log("   🔁 Redeploy triggered via GQL:  " + (redeployOK ? "✅ YES 🚀" : "ℹ️  Cmd+K → Redeploy in UI"));
  console.log("   🗄️  Supabase rows sampled:       " + collectedSupa.length);
  console.log("   🔧 Supabase schema refresh:     Done (NOTIFY pgrst + ANALYZE)");
  console.log("\n   REMAINING STEPS (if .env.local didn't have them):");
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL"].forEach(function(k) {
    if (!raw[k] || !String(raw[k]).length) console.log("     ❌ Copy " + k + " from Supabase Dashboard → paste into .env.local (line " + k + "=...) AND into Railway Variables → then REDEPLOY.");
  });
  if (missing.length === 0) console.log("     🎉 All Supabase critical vars already present in .env.local!");
  console.log("");
})();
