#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");

const PROJECT_ID = "c75eaf5f-1ec8-4565-b3b6-8e318f1251bd";
const SVC_ID = "a98fc4dc-4047-4647-a74a-985f6ff667ce";
const ENV_ID = "78325a44-cd94-4b10-aa41-c09ebd978c7f";
const WEEK_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const NOW = new Date().toISOString();

const envContent = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const [k, ...v] = line.split("=");
  const key = k.trim();
  if (key && !key.startsWith("#")) env[key] = v.join("=").trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
}
const TOKEN = env.RAILWAY_TOKEN || process.env.RAILWAY_TOKEN;

function gql(query, variables) {
  return new Promise(function(resolve) {
    const postData = JSON.stringify({ query: query, variables: variables || {} });
    const opts = {
      hostname: "backboard.railway.app", port: 443, path: "/graphql/v2", method: "POST",
      headers: { "Authorization": "Bearer " + TOKEN, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) },
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
    req.setTimeout(120000, function() { req.destroy(new Error("HTTP timeout")); });
    req.write(postData);
    req.end();
  });
}

function prettyDate(d) { try { return new Date(d).toLocaleString(); } catch(e) { return String(d); } }

// extract lines from any GQL response (walk arrays with {message,timestamp,severity})
function extractLines(resp) {
  const out = [];
  if (!resp || !resp.data || !resp.data.data) return out;
  (function walk(o) {
    if (!o) return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (typeof o === "object") {
      if (typeof o.message === "string" && (typeof o.timestamp === "string" || typeof o.severity === "string")) {
        out.push({ timestamp: o.timestamp, severity: o.severity, message: o.message, tags: o.tags });
      } else { Object.keys(o).forEach(function(k) { walk(o[k]); }); }
    }
  })(resp.data.data);
  return out;
}

async function main() {
  console.log("================================================================");
  console.log("  RAILWAY — Full Log Pull (buildLogs×LastFailed + envLogs×Week) ");
  console.log("================================================================");

  // DEPLOYMENTS
  console.log("\n🚀 Deployments past week...");
  const dQ = await gql(`query D($pid: String!) { project(id: $pid) { deployments(first: 200) { edges { node {
    id status createdAt environmentId serviceId meta
  }}}}}`, { pid: PROJECT_ID });
  let deps = [];
  if (dQ.data && dQ.data.data && dQ.data.data.project) deps = dQ.data.data.project.deployments.edges.map(function(e) { return e.node; });
  const icons = { SUCCESS:"✅", FAILED:"❌", DEPLOYING:"🔄", BUILDING:"🔧", CRASHED:"💥", REMOVED:"🗑️", SLEEPING:"💤", INITIALIZING:"🌱", SKIPPED:"⏭️", DEPLOYED:"✅" };
  const weekDeps = deps.filter(function(d) { return d.createdAt >= WEEK_AGO; }).sort(function(a, b) { return a.createdAt.localeCompare(b.createdAt); });
  const finalDeps = weekDeps.filter(function(d) { return d.serviceId === SVC_ID; });
  const allFailed = finalDeps.filter(function(d) { return d.status === "FAILED" || d.status === "CRASHED"; });
  const lastFailed = allFailed.length ? allFailed[allFailed.length - 1] : null;
  const latest = finalDeps.length ? finalDeps[finalDeps.length - 1] : null;
  const lastSuccess = finalDeps.slice().reverse().find(function(d) { return d.status === "SUCCESS" || d.status === "DEPLOYED" || d.status === "DEPLOYING" || d.status === "SLEEPING"; });
  finalDeps.forEach(function(d) {
    const icon = icons[d.status] || "❓";
    const tags = [];
    if (d === lastFailed) tags.push("👈 LAST FAILED");
    if (d === latest && d !== lastFailed) tags.push("👈 LATEST");
    if (d === lastSuccess && d !== lastFailed) tags.push("👈 RUNNING");
    console.log("   " + icon + " " + (d.status || "?").padEnd(13) + prettyDate(d.createdAt) + " id=" + d.id.slice(0,10) + (tags.length ? " " + tags.join(" ") : ""));
  });
  console.log("   → Total week: " + finalDeps.length + "  | FAILED: " + allFailed.length);

  // VARIABLES (confirmed working endpoint)
  console.log("\n🔐 Environment Variables (via GQL variables()):");
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_URL", "DATABASE_URL", "PORT", "NODE_OPTIONS", "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SITE_URL", "ENCRYPTION_SECRET", "AUTH_SECRET", "CRON_SECRET",
    "STRIPE_SECRET_KEY", "RESEND_API_KEY", "SUPABASE_DB_URL", "PUBLIC_APP_ORIGIN",
  ];
  const vars = {};
  const vQ = await gql(`query V($pid: String, $eid: String!, $sid: String!, $u: Boolean) {
    variables(projectId: $pid, environmentId: $eid, serviceId: $sid, unrendered: $u) {
      name value source type
    }
  }`, { pid: PROJECT_ID, eid: ENV_ID, sid: SVC_ID, u: false });
  if (vQ.data && vQ.data.data && vQ.data.data.variables) {
    vQ.data.data.variables.forEach(function(v) { vars[v.name] = { value: v.value, source: v.source + "/" + v.type }; });
  }
  let missing = [];
  required.forEach(function(name) {
    const has = vars[name] && vars[name].value && String(vars[name].value).length > 0;
    const val = has ? String(vars[name].value) : "";
    const mask = /KEY|SECRET|TOKEN|DATABASE|URL|RESEND|STRIPE|CRON|AUTH/.test(name.toUpperCase());
    const info = has ? vars[name].source : "";
    if (has) console.log("   ✅ " + name.padEnd(36) + (mask ? val.slice(0, 10) + "..." : val) + (info ? "  (" + info + ")" : ""));
    else { console.log("   ❌ " + name.padEnd(36) + " MISSING"); missing.push(name); }
  });
  console.log("   → Missing count: " + missing.length + "/" + required.length);

  // LOGS
  console.log("\n📡 Pulling logs (correct endpoints found via probe)...");
  const all = [];
  const LOG_FIELDS = "{ timestamp severity message tags { deploymentId serviceId environmentId } }";

  // 1. LAST FAILED buildLogs (limit 10000)
  if (lastFailed) {
    console.log("   1. buildLogs LAST FAILED (limit 10000)...");
    const r = await gql(`query B($did: String!) { buildLogs(deploymentId: $did, limit: 10000) ` + LOG_FIELDS + ` }`, { did: lastFailed.id });
    const lines = extractLines(r);
    lines.forEach(function(l) { l._src = "LASTFAILED_build"; all.push(l); });
    console.log("      → " + lines.length + " lines");
  }
  // 2. LAST FAILED deploymentLogs
  if (lastFailed) {
    console.log("   2. deploymentLogs LAST FAILED (limit 10000)...");
    const r = await gql(`query D($did: String!) { deploymentLogs(deploymentId: $did, limit: 10000) ` + LOG_FIELDS + ` }`, { did: lastFailed.id });
    const lines = extractLines(r);
    lines.forEach(function(l) { l._src = "LASTFAILED_deploy"; all.push(l); });
    console.log("      → " + lines.length + " lines");
  }
  // 3. buildLogs for 2nd-last and 3rd-last FAILED (in case pattern repeats)
  const last3Failed = allFailed.slice(-3);
  for (let i = 0; i < last3Failed.length - 1; i++) {
    const d = last3Failed[i];
    console.log("   3" + String.fromCharCode(97 + i) + ". buildLogs FAILED#" + (i+1) + " " + d.id.slice(0,8) + " @" + prettyDate(d.createdAt) + "...");
    const r = await gql(`query B($did: String!) { buildLogs(deploymentId: $did, limit: 5000) ` + LOG_FIELDS + ` }`, { did: d.id });
    const lines = extractLines(r);
    lines.forEach(function(l) { l._src = "FAILED" + (i + 1) + "_build"; all.push(l); });
    console.log("      → " + lines.length + " lines");
  }
  // 4. RUNNING/LAST SUCCESS deploymentLogs (current runtime state)
  if (lastSuccess) {
    console.log("   4. deploymentLogs RUNNING/SUCCESS (" + lastSuccess.id.slice(0,8) + ")...");
    const r = await gql(`query D($did: String!) { deploymentLogs(deploymentId: $did, limit: 10000) ` + LOG_FIELDS + ` }`, { did: lastSuccess.id });
    const lines = extractLines(r);
    lines.forEach(function(l) { l._src = "RUNNING_deploy"; all.push(l); });
    console.log("      → " + lines.length + " lines");
  }
  if (lastSuccess) {
    console.log("   5. buildLogs RUNNING/SUCCESS (build env checks)...");
    const r = await gql(`query B($did: String!) { buildLogs(deploymentId: $did, limit: 5000) ` + LOG_FIELDS + ` }`, { did: lastSuccess.id });
    const lines = extractLines(r);
    lines.forEach(function(l) { l._src = "RUNNING_build"; all.push(l); });
    console.log("      → " + lines.length + " lines");
  }
  // 6. environmentLogs × 4 anchors (7 days span = 4 chunks × 2 days)
  const anchors = [
    new Date(Date.now() - 0 * 24 * 60 * 60 * 1000).toISOString(),
    new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  ];
  for (let i = 0; i < anchors.length; i++) {
    console.log("   6" + String.fromCharCode(97 + i) + ". environmentLogs anchor=" + anchors[i].slice(0,10) + " afterLimit=5000 beforeLimit=5000...");
    const r = await gql(`query E($eid: String!, $ad: String!, $bd: String!, $al: Int!, $bl: Int!) {
      environmentLogs(environmentId: $eid, anchorDate: $ad, afterDate: $bd, afterLimit: $al, beforeLimit: $bl) ` + LOG_FIELDS + `
    }`, { eid: ENV_ID, ad: anchors[i], bd: WEEK_AGO, al: 5000, bl: 5000 });
    const lines = extractLines(r);
    lines.forEach(function(l) { l._src = "ENVLOG" + i; all.push(l); });
    console.log("      → " + lines.length + " lines");
  }
  // 7. httpLogs (for runtime pattern)
  console.log("   7. httpLogs (past week) afterLimit=5000 beforeLimit=5000...");
  const hQ = await gql(`query H($eid: String!, $sid: String!, $ad: String!, $bd: String!, $al: Int!, $bl: Int!) {
    httpLogs(environmentId: $eid, serviceId: $sid, anchorDate: $ad, afterDate: $bd, afterLimit: $al, beforeLimit: $bl) {
      timestamp method path httpStatus upstreamErrors responseDetails srcIp clientUa totalDuration rxBytes txBytes
    }
  }`, { eid: ENV_ID, sid: SVC_ID, ad: NOW, bd: WEEK_AGO, al: 5000, bl: 5000 });
  const httpLines = [];
  (function walk(o) {
    if (!o) return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (typeof o === "object") {
      if (typeof o.path === "string" && typeof o.timestamp === "string") httpLines.push(o);
      else Object.keys(o).forEach(function(k) { walk(o[k]); });
    }
  })(hQ.data && hQ.data.data);
  console.log("      → " + httpLines.length + " lines");

  console.log("\n📊 Total log lines: " + all.length + " (HTTP: " + httpLines.length + ")");
  // dedupe by (timestamp + severity + message.slice(0,100))
  const seenDedup = {};
  const logs = [];
  all.forEach(function(l) {
    const k = (l.timestamp || "") + "|" + (l.severity || "") + "|" + (l.message || "").slice(0, 150);
    if (!seenDedup[k]) { seenDedup[k] = true; logs.push(l); }
  });
  logs.sort(function(a, b) { return (a.timestamp || "").localeCompare(b.timestamp || ""); });
  console.log("      After dedup: " + logs.length);

  // ======= ANALYSIS =======
  console.log("\n🔍 LOG ANALYSIS — " + logs.length + " lines past week...");
  const cats = {
    oom: [], buildFail: [], missingEnv: [], validation: [], validateCrit: [], validateWarn: [],
    dbSupabase: [], rls: [], ts: [], mod: [], net: [], startup: [], nextjs: [],
    http5xx: [], http4xx: [], cron: [], auth: [], crypto: [], quota: [], otherErr: [], warn: [],
  };
  logs.forEach(function(l) {
    if (!l.message) return;
    const m = l.message.toLowerCase(); const sv = (l.severity || "").toLowerCase();
    const isErr = sv === "error" || sv === "fatal" || sv === "err" || /error|failed|fatal|invalid|unhandled|exception|traceback|failure|denied|could not|cannot|unable/.test(m);
    const isWarn = /warn|deprecated|experimental|slow|advisory|missing \(but/.test(m) && !isErr;
    // Environment validation script matches (THE PATTERN!)
    if (/validate-production-env\.mjs|validate env|production environment|critical settings|env validation/.test(m)) {
      cats.validation.push(l);
      if (/critical|fail|missing \(required\)|required.*missing|must be set|exiting/.test(m)) cats.validateCrit.push(l);
      if (/warn|missing \(optional\)|optional|warn-only/.test(m)) cats.validateWarn.push(l);
    }
    if (/out of memory|javascript heap|oom|allocation failed|memory limit|killed$|memory exhausted|heap out/.test(m)) cats.oom.push(l);
    else if (/missing supabase|missing credentials|environment variable|credentials, returning unavailable client|cannot read.*supabase|middleware warning/.test(m)) cats.missingEnv.push(l);
    else if (/(supabase|postgres|postgresql|pg_|sqlstate|database|connection refused|connection reset|pool.*exhausted|tenant_integrations|pgrst2|row level security|rls|policy|42501|permission denied|pgroonga|schema does not exist|relation.*does not exist|client.*initialization)/.test(m)) {
      cats.dbSupabase.push(l);
      if (/rls|policy|row level|permission denied|42501|privilege/.test(m)) cats.rls.push(l);
    }
    else if (/(typescript| ts2\d{3}|typeerror|cannot find name|property does not exist|does not exist on type|argument of type|is not assignable|implicitly has any|tsconfig|\.ts\(\d+,\d+\): error|error TS)/.test(m)) cats.ts.push(l);
    else if (/(module not found|cannot find module|npm err!|install failed|cannot resolve|enoent|eisdir|unmet peer|peer dep|lockfile error)/.test(m)) cats.mod.push(l);
    else if (/(network|etimedout|econnrefused|enotfound|getaddrinfo|dns|ehostunreach|socket hang up|tls|handshake failed|certificate|ssl)/.test(m)) cats.net.push(l);
    else if (isErr && /(build|compil|webpack|tsc|next build|babel|esbuild|bundl|chunk|minif|export.*error|import.*error|module parse failed|compilation error|build failed|error command failed|exit status|non-zero)/.test(m)) cats.buildFail.push(l);
    else if (isErr && /(server|crash|startup|listen|eaddrinuse|eacces|port|segmentation fault|sigterm|sigsegv|process.*exit|start command failed|startup error|command failed|node server|next start)/.test(m)) cats.startup.push(l);
    else if (/next\.js|nextjs|\(next .*\)|ready in|started server on|warming up|compiling/.test(m)) cats.nextjs.push(l);
    else if (isErr) cats.otherErr.push(l);
    else if (isWarn) cats.warn.push(l);
  });

  function show(title, arr, n) {
    if (arr.length === 0) return;
    console.log("\n   " + title + ": " + arr.length + " hits");
    const seen = {};
    const uniq = [];
    for (let i = arr.length - 1; i >= 0 && uniq.length < n; i--) {
      const fp = (arr[i].message || "").replace(/\b[a-f0-9-]{8,}\b/gi, "<ID>").replace(/\d+/g, "N").slice(0, 150);
      if (!seen[fp]) { seen[fp] = true; uniq.push(arr[i]); }
    }
    uniq.reverse().forEach(function(l) {
      const t = l.timestamp ? prettyDate(l.timestamp) : "";
      const sv = (l.severity || "").padEnd(8);
      const src = l._src ? "[" + l._src + "]" : "";
      console.log("     " + src + " [" + t + "] [" + sv + "] " + (l.message || "").slice(0, 320));
    });
  }

  show("📋 Environment VALIDATION Script Runs (THE PATTERN!)", cats.validation, 15);
  show("🔴 validate-production-env — CRITICAL / FAIL / EXIT messages", cats.validateCrit, 20);
  show("🟠 validate-production-env — WARNING messages (warn-only)", cats.validateWarn, 20);
  show("🟧 Missing Supabase / Env Vars (Missing credentials pattern)", cats.missingEnv, 20);
  show("🟥 Build Failures — npm run build / next build failed", cats.buildFail, 30);
  show("🟥 OOM / Memory Kills", cats.oom, 15);
  show("🟧 TypeScript Compile Errors (tsc / TS2*)", cats.ts, 25);
  show("🟧 Node / npm / Module Errors (cannot find module etc.)", cats.mod, 20);
  show("🟧 DB / Supabase / RLS Errors", cats.dbSupabase, 25);
  show("🟧 RLS / Permission Denied / 42501", cats.rls, 15);
  show("🟧 Network / DNS / TLS Errors", cats.net, 15);
  show("🟧 Startup / Crash / Sigterm / Port", cats.startup, 25);
  show("🟢 Next.js startup/info (for context)", cats.nextjs, 10);
  show("🟨 Other Errors", cats.otherErr, 25);
  show("Warnings", cats.warn, 10);

  // ====== HTTP LOGS ANALYSIS ======
  console.log("\n🌐 HTTP LOGS analysis (" + httpLines.length + " lines)...");
  if (httpLines.length > 0) {
    httpLines.sort(function(a, b) { return (a.timestamp || "").localeCompare(b.timestamp || ""); });
    const byStatus = {}, byPath = {}, byErr = {}, byMethod = {};
    httpLines.forEach(function(h) {
      const s = String(h.httpStatus || 0);
      byStatus[s] = (byStatus[s] || 0) + 1;
      const p = String(h.path || "/").split("?")[0].replace(/\/[a-f0-9-]{8,}\/?$/gi, "/<ID>").replace(/\/\d+\/?$/g, "/N");
      byPath[p] = (byPath[p] || 0) + 1;
      byMethod[String(h.method || "?")] = (byMethod[String(h.method || "?")] || 0) + 1;
      if (h.httpStatus >= 400 || (h.upstreamErrors && String(h.upstreamErrors).length > 0)) {
        byErr[s + " " + p] = (byErr[s + " " + p] || 0) + 1;
      }
    });
    console.log("   Response codes:");
    Object.keys(byStatus).sort().forEach(function(k) { console.log("     " + (k === "0" ? "?" : k).padEnd(5) + " ×" + byStatus[k]); });
    console.log("   Methods: " + JSON.stringify(byMethod));
    const topPaths = Object.keys(byPath).map(function(k) { return { p: k, n: byPath[k] }; }).sort(function(a, b) { return b.n - a.n; }).slice(0, 15);
    console.log("   Top 15 paths:"); topPaths.forEach(function(t) { console.log("     ×" + String(t.n).padEnd(5) + " " + t.p); });
    const topErrs = Object.keys(byErr).map(function(k) { return { k: k, n: byErr[k] }; }).sort(function(a, b) { return b.n - a.n; }).slice(0, 15);
    if (topErrs.length > 0) {
      console.log("   Top HTTP errors (4xx/5xx + upstream err):");
      topErrs.forEach(function(t) {
        console.log("     ×" + String(t.n).padEnd(5) + " " + t.k);
        // Find 1 sample
        const sample = httpLines.find(function(h) {
          const s = String(h.httpStatus || 0);
          const p = String(h.path || "/").split("?")[0].replace(/\/[a-f0-9-]{8,}\/?$/gi, "/<ID>").replace(/\/\d+\/?$/g, "/N");
          return t.k === s + " " + p;
        });
        if (sample) {
          const extra = [sample.upstreamErrors, sample.responseDetails].filter(Boolean).slice(0, 2).join(" / ");
          if (extra) console.log("         (sample: " + (new Date(sample.timestamp).toLocaleString()) + "  src=" + (sample.srcIp || "?") + ")  " + extra.slice(0, 200));
        }
      });
    }
    // Cron route hits
    const cronHits = httpLines.filter(function(h) { return /\/api\/cron/.test(String(h.path || "")); });
    if (cronHits.length > 0) {
      console.log("   Cron route HTTP hits: " + cronHits.length);
      const cronStat = {};
      cronHits.forEach(function(h) { const s = String(h.httpStatus || "?"); cronStat[s] = (cronStat[s] || 0) + 1; });
      console.log("   Cron by status: " + JSON.stringify(cronStat));
    }
  }

  // ====== REPEATING PATTERN DETECTION ======
  console.log("\n🧬 Repeating Pattern TOP 20 FINGERPRINTS (this week)...");
  const fps = {};
  logs.forEach(function(l) {
    if (!l.message) return;
    const fp = (l.message || "").replace(/\b[a-f0-9-]{8,}\b/gi, "<ID>").replace(/\d+/g, "N").slice(0, 170);
    if (!fps[fp]) fps[fp] = { count: 0, sample: l, srcs: {}, sevs: {} };
    fps[fp].count++;
    fps[fp].srcs[l._src || "?"] = (fps[fp].srcs[l._src || "?"] || 0) + 1;
    fps[fp].sevs[l.severity || "?"] = (fps[fp].sevs[l.severity || "?"] || 0) + 1;
  });
  const topP = Object.keys(fps).map(function(k) { return Object.assign({ fp: k }, fps[k]); }).sort(function(a, b) { return b.count - a.count; }).slice(0, 20);
  topP.forEach(function(p, i) {
    const sev = Object.keys(p.sevs).sort(function(a, b) { return p.sevs[b] - p.sevs[a]; }).slice(0, 2).join("/");
    const srcs = Object.keys(p.srcs).slice(0, 3).join(",");
    console.log("   #" + String(i+1).padStart(2, "0") + "  ×" + String(p.count).padEnd(5) + sev.padEnd(10) + "[" + srcs + "] " + p.fp.slice(0, 170));
  });

  // ====== LAST FAILED DEPLOY — tail of build + full diagnosis ======
  if (lastFailed) {
    const lfLines = logs.filter(function(l) { return l._src && l._src.indexOf("LASTFAILED") !== -1; });
    console.log("\n🔎 DIAGNOSIS — LAST FAILED DEPLOYMENT: " + lastFailed.id.slice(0, 12) + "... status=" + lastFailed.status + " @" + prettyDate(lastFailed.createdAt));
    console.log("   Log lines for this deploy: " + lfLines.length);
    const joined = lfLines.map(function(l) { return (l.message || "").toLowerCase(); }).join(" ");
    const causes = [];
    if (/out of memory|javascript heap|oom|killed|memory/.test(joined)) causes.push("OOM / Memory killed build — bump Railway RAM to 2/4GB");
    if (/validate-production-env.*critical|validate-production-env.*fail|validate-production-env.*exiting|exiting because of missing critical env|missing.*required|required.*missing/.test(joined)) causes.push("ENV VALIDATION script failed (validate-production-env.mjs) — 16+ required vars missing");
    if (/typescript| ts2\d{3}|error ts\d{4}|typeerror|cannot find name|build failed|compilation error/.test(joined)) causes.push("TypeScript build failure — run `npm run typecheck` locally");
    if (/module not found|cannot find module|npm err|enoent|eisdir|cannot resolve/.test(joined)) causes.push("Module resolution error — verify package.json");
    if (/next build failed|error command failed|non-zero|exit status/.test(joined)) causes.push("Generic build failure — see tail of build logs below");
    if (causes.length === 0) causes.push("Unknown — see tail of build & deployment logs below");
    causes.forEach(function(c) { console.log("   🔥 ROOT CAUSE: " + c); });
    if (lfLines.length > 0) {
      console.log("\n   🧾 LAST 60 LINES of LAST FAILED deploy logs (buildLogs + deploymentLogs):");
      const tail = lfLines.slice(-60);
      tail.forEach(function(l, i) {
        const src = l._src ? "[" + l._src + "]" : "";
        const t = l.timestamp ? prettyDate(l.timestamp) : "";
        const sv = (l.severity || "").padEnd(8);
        console.log("     [" + String(i+1).padStart(2,"0") + "] " + src + " [" + t + "] [" + sv + "] " + (l.message || "").slice(0, 270));
      });
    }
  }

  // ====== SUMMARY ======
  console.log("\n================================================================");
  console.log("                 FINAL SUMMARY & ACTIONABLE FIXES               ");
  console.log("================================================================");
  console.log("Env vars missing: " + missing.length + "/" + required.length + (missing.length ? "  → " + missing.join(", ") : " NONE ✅"));
  console.log("Validate-env CRIT hits: " + cats.validateCrit.length);
  console.log("Validate-env WARN hits: " + cats.validateWarn.length);
  console.log("BuildFail hits:         " + cats.buildFail.length);
  console.log("MissingEnv hits:        " + cats.missingEnv.length);
  console.log("TS hits:                " + cats.ts.length);
  console.log("OOM hits:               " + cats.oom.length);
  console.log("Module hits:            " + cats.mod.length);
  console.log("Startup/Crash:          " + cats.startup.length);
  console.log("DB/Supabase:            " + cats.dbSupabase.length + (cats.rls.length ? "  (RLS=" + cats.rls.length + ")" : ""));
  console.log("HTTP log lines:         " + httpLines.length);
  console.log("Failed deploys week:    " + allFailed.length + "/" + finalDeps.length);
  console.log("Last FAILED:            " + (lastFailed ? lastFailed.id.slice(0,10) + "  " + prettyDate(lastFailed.createdAt) : "none"));

  console.log("\n===== 🔥 REQUIRED ACTIONS 🔥 =====");
  const actions = [];
  if (missing.length > 0 || cats.validateCrit.length > 0 || cats.missingEnv.length > 0) {
    actions.push({
      title: "#1 🔴 Set Missing Env Vars → stops validate-production-env from failing deploy",
      steps: [
        "OPEN Railway:  https://railway.com/project/" + PROJECT_ID + "/service/" + SVC_ID + "?environmentId=" + ENV_ID,
        "SERVICE: alphaclone-nextjs → Variables tab → Add ALL these (service scope):",
        "  NEXT_PUBLIC_SUPABASE_URL        = https://ehekzoioqvtweugemktn.supabase.co",
        "  SUPABASE_URL                    = https://ehekzoioqvtweugemktn.supabase.co",
        "  NEXT_PUBLIC_SUPABASE_ANON_KEY   = Supabase → Settings → API → 'anon' (PUBLIC, starts with 'eyJhbGciOi...')",
        "  SUPABASE_SERVICE_ROLE_KEY       = Supabase → Settings → API → 'service_role' (SECRET, bypasses RLS)",
        "  DATABASE_URL                    = Supabase → Settings → Database → Connection string → Direct (starts postgresql://postgres:...)",
        "  SUPABASE_DB_URL                 = same value as DATABASE_URL",
        "  PORT                            = 3000",
        "  NODE_OPTIONS                    = --max-old-space-size=12288",
        "  NEXT_PUBLIC_APP_URL             = https://<your-public-domain>  (e.g. https://<appname>.up.railway.app OR custom)",
        "  NEXT_PUBLIC_SITE_URL            = same as NEXT_PUBLIC_APP_URL",
        "  PUBLIC_APP_ORIGIN               = same as NEXT_PUBLIC_APP_URL",
        "  ENCRYPTION_SECRET               = `openssl rand -hex 32` (long random)",
        "  AUTH_SECRET                     = `openssl rand -base64 33`",
        "  CRON_SECRET                     = random long string (protects /api/cron/*)",
        "  STRIPE_SECRET_KEY               = <if you use Stripe>",
        "  RESEND_API_KEY                  = <if you use Resend>",
        "OTHERS if your validate-production-env.mjs says so (see list it prints).",
        "AFTER ADDING: Cmd+K → Redeploy. ENV VARS only apply at build/startup.",
      ],
    });
  }
  if (cats.oom.length > 0 || allFailed.length > 5) {
    actions.push({
      title: "#2 🟠 Fix Memory Pressure / OOM Kills",
      steps: [
        "Railway → alphaclone-nextjs → Settings → Resources",
        "  RAM → 2 GB minimum. Recommend 4 GB if budget allows (Next.js build + 200 migrations + cron + Supabase startup is heavy).",
        "  Disk → 5 GB or 10 GB (build cache can be large).",
        "This also sets NODE_OPTIONS env var (step #1) for runtime heap.",
        "Redeploy after resize.",
      ],
    });
  }
  if (cats.ts.length > 0 || cats.buildFail.length > 0) {
    actions.push({
      title: "#3 🟠 Fix TypeScript / Build Failures (cause of most FAILED deploys)",
      steps: [
        "Locally run:",
        "  npm run typecheck",
        "  npm run build",
        "Fix all errors, commit, push → triggers new Railway deploy.",
        "(Build script in railway.toml runs:  rm -rf app && NODE_OPTIONS='...' npm run build — so if it passes locally, it'll pass on Railway.)",
      ],
    });
  }
  if (cats.mod.length > 0) {
    actions.push({
      title: "#4 🟡 Fix Module Resolution Errors",
      steps: [
        "Locally:",
        "  rm -rf node_modules package-lock.json",
        "  npm install",
        "  npm run build",
        "If local build passes, push new commit.",
      ],
    });
  }
  if (cats.missingEnv.length > 0 || cats.validateWarn.length > 0) {
    actions.push({
      title: "#5 🟡 Repeating Runtime Pattern: Missing Supabase Env in EVERY log cycle",
      steps: [
        "Your middleware + cron code prints this EVERY request when env vars are missing:",
        "  'Middleware Warning: Missing Supabase Environment Variables'",
        "  'Missing credentials, returning unavailable client'",
        "Fix #1 (adding env vars) will make these disappear on next redeploy.",
        "All cron jobs (social-publish / autonomous-runner / daily / invoices / reminders / tasks) will start working again.",
      ],
    });
  }
  if (httpLines.some(function(h) { return h.httpStatus && h.httpStatus >= 400 && /\/api\/cron/.test(String(h.path || "")); })) {
    actions.push({
      title: "#6 🟡 Cron routes 401/403/503",
      steps: [
        "Requires step #1 (env vars) + CRON_SECRET env var to be set.",
        "Cron job triggers must send the same CRON_SECRET in Authorization header.",
      ],
    });
  }
  if (actions.length === 0) actions.push({ title: "No issues found", steps: ["Check Railway UI."] });
  actions.forEach(function(a, idx) {
    console.log("\n  📌 " + a.title);
    a.steps.forEach(function(s, n) { console.log("     " + (n+1) + ". " + s); });
  });

  // Save raw logs to disk
  try {
    const savedPath = path.join(process.cwd(), "railway_logs_week_of_" + new Date().toISOString().slice(0, 10) + ".json");
    fs.writeFileSync(savedPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      windowStart: WEEK_AGO,
      windowEnd: NOW,
      environmentId: ENV_ID, serviceId: SVC_ID, projectId: PROJECT_ID,
      deploymentsWeek: { total: finalDeps.length, failed: allFailed.length, lastFailed: lastFailed && lastFailed.id, lastSuccess: lastSuccess && lastSuccess.id },
      variables: { missing: missing, present: Object.keys(vars) },
      counts: Object.keys(cats).reduce(function(acc, k) { acc[k] = cats[k].length; return acc; }, {}),
      httpLogs: httpLines,
      topPatterns: topP.map(function(p) { return { count: p.count, severities: p.sevs, sources: p.srcs, sample: p.sample.message }; }),
      logs: logs.map(function(l) { return { src: l._src, ts: l.timestamp, sev: l.severity, msg: l.message }; }),
    }, null, 2));
    console.log("\n💾 Raw logs + analysis saved to: " + savedPath + "  (" + logs.length + " lines, " + httpLines.length + " HTTP)");
  } catch (e) { console.log("   (save failed: " + e.message + ")"); }
  console.log("");
}

main().catch(function(e) { console.error("FATAL:", e); process.exit(1); });
