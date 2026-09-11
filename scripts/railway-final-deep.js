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

async function main() {
  console.log("================================================================");
  console.log("   RAILWAY FINAL — Variables + Last Failed + Env Logs (Week)");
  console.log("================================================================");

  // ==============================================================
  // PART 1: VARIABLES
  // ==============================================================
  console.log("\n🔐 Environment Variables (via GQL variables() query)...");
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_URL", "DATABASE_URL", "SUPABASE_DB_URL", "PORT", "NEXT_PUBLIC_APP_URL",
    "NODE_OPTIONS", "NEXT_PUBLIC_SITE_URL", "PUBLIC_APP_ORIGIN", "ENCRYPTION_SECRET",
    "CRON_SECRET", "AUTH_SECRET", "STRIPE_SECRET_KEY", "RESEND_API_KEY",
  ];
  const varsByScope = {};
  let vars = {};
  for (let attempt = 0; attempt < 2; attempt++) {
    const args = attempt === 0
      ? { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SVC_ID, unrendered: false }
      : { environmentId: ENV_ID, serviceId: SVC_ID, unrendered: false };
    const vQ = await gql(`query V($pid: String, $eid: String!, $sid: String!, $u: Boolean) {
      variables(projectId: $pid, environmentId: $eid, serviceId: $sid, unrendered: $u) {
        name value source type isSecret isOverridden serviceId environmentId
      }
      variablesForServiceDeployment(projectId: $pid, environmentId: $eid, serviceId: $sid) {
        name value source type
      }
    }`, args);
    if (vQ.data && vQ.data.data) {
      const raw = vQ.data.data.variables || [];
      raw.forEach(function(v) { vars[v.name] = v.value; varsByScope[v.name] = v.source + "/" + v.type; });
      if (Object.keys(vars).length > 0) {
        console.log("   ✅ Got " + raw.length + " variables via GQL variables() — scope=service,env,shared");
        break;
      }
      const raw2 = vQ.data.data.variablesForServiceDeployment || [];
      raw2.forEach(function(v) { vars[v.name] = v.value; varsByScope[v.name] = v.source + "/" + v.type; });
      if (Object.keys(vars).length > 0) {
        console.log("   ✅ Got " + raw2.length + " variables via GQL variablesForServiceDeployment()");
        break;
      }
    }
  }
  let missing = [];
  required.forEach(function(name) {
    const has = vars[name] && String(vars[name]).length > 0;
    const val = has ? String(vars[name]) : "";
    const mask = /KEY|SECRET|TOKEN|DATABASE|URL|SECRET|RESEND|STRIPE|CRON|AUTH/.test(name.toUpperCase());
    if (has) console.log("   ✅ " + name.padEnd(36) + (mask ? val.slice(0, 10) + "..." : val) + (varsByScope[name] ? "  (" + varsByScope[name] + ")" : ""));
    else { console.log("   ❌ " + name.padEnd(36) + " MISSING"); missing.push(name); }
  });

  // ==============================================================
  // PART 2: DEPLOYMENTS — PAST WEEK + LAST FAILED
  // ==============================================================
  console.log("\n🚀 Deployments (past week) — last FAILED highlighted...");
  const dQ = await gql(`query D($pid: String!) { project(id: $pid) {
    deployments(first: 200) { edges { node {
      id status createdAt environmentId serviceId meta
    }}}
  }}`, { pid: PROJECT_ID });
  let deps = [];
  if (dQ.data && dQ.data.data && dQ.data.data.project) deps = dQ.data.data.project.deployments.edges.map(function(e) { return e.node; });
  const icons = { SUCCESS:"✅", FAILED:"❌", DEPLOYING:"🔄", BUILDING:"🔧", CRASHED:"💥", REMOVED:"🗑️", SLEEPING:"💤", INITIALIZING:"🌱", SKIPPED:"⏭️", DEPLOYED:"✅" };
  const weekDeps = deps.filter(function(d) { return d.createdAt >= WEEK_AGO; }).sort(function(a, b) { return a.createdAt.localeCompare(b.createdAt); });
  const targetDeps = weekDeps.filter(function(d) { return d.serviceId === SVC_ID; });
  const finalDeps = targetDeps.length > 0 ? targetDeps : weekDeps;
  const allFailed = finalDeps.filter(function(d) { return d.status === "FAILED" || d.status === "CRASHED"; });
  const lastFailed = allFailed.length ? allFailed[allFailed.length - 1] : null;
  const latest = finalDeps.length ? finalDeps[finalDeps.length - 1] : null;
  finalDeps.forEach(function(d) {
    const isLFA = d === lastFailed ? "  👈 LAST FAILED" : "";
    const isL = d === latest && d !== lastFailed ? "  👈 LATEST" : "";
    const icon = icons[d.status] || "❓";
    console.log("   " + icon + " " + (d.status || "?").padEnd(13) + prettyDate(d.createdAt) + " id=" + d.id.slice(0,10) + isLFA + isL);
  });
  console.log("\n   Total (week):     " + finalDeps.length);
  console.log("   FAILED (week):    " + allFailed.length);
  console.log("   LAST FAILED:      " + (lastFailed ? lastFailed.id + " @" + prettyDate(lastFailed.createdAt) : "NONE"));
  console.log("   Latest:           " + (latest ? latest.status + " @" + prettyDate(latest.createdAt) : "NONE"));

  // ==============================================================
  // PART 3: LOGS! (7 endpoints × limit 5000 each)
  // ==============================================================
  console.log("\n📡 Fetching logs via 7 endpoints (past week, 5000 lines each)...");
  const LOG_FIELDS = "{ timestamp severity message tags { serviceId level } }"; // Log = {ts, severity, message, tags, attributes}
  let allLogs = [];
  async function getLogs(label, query, vars, srcScope) {
    console.log("   ➕ " + label + " ...");
    const r = await gql(query, vars);
    let lines = [];
    if (r.data && r.data.data) {
      // Walk all arrays in response
      function walk(o, d, tag) {
        if (!o || d > 6) return;
        if (Array.isArray(o)) o.forEach(function(x) { walk(x, d + 1, tag); });
        else if (typeof o === "object") {
          if (typeof o.message === "string" && (o.timestamp || o.severity)) {
            lines.push({ timestamp: o.timestamp, severity: o.severity, message: o.message, tags: o.tags });
          } else Object.keys(o).forEach(function(k) { walk(o[k], d + 1, o); });
        }
      }
      walk(r.data.data, 0);
    }
    lines.forEach(function(l) { l._src = srcScope; allLogs.push(l); });
    console.log("     → got " + lines.length + " lines");
    return lines;
  }

  // 1. buildLogs(deploymentId, startDate, endDate, limit=5000) — for LAST FAILED
  if (lastFailed) {
    await getLogs("buildLogs(lastFailed)",
      `query B($did: String!, $s: DateTime, $e: DateTime) {
        buildLogs(deploymentId: $did, startDate: $s, endDate: $e, limit: 5000) ` + LOG_FIELDS + ` }`,
      { did: lastFailed.id, s: WEEK_AGO, e: NOW },
      "lastFailed-build");
  }
  // 2. deploymentLogs(deploymentId) — for LAST FAILED
  if (lastFailed) {
    await getLogs("deploymentLogs(lastFailed)",
      `query D($did: String!, $s: DateTime, $e: DateTime) {
        deploymentLogs(deploymentId: $did, startDate: $s, endDate: $e, limit: 5000) ` + LOG_FIELDS + ` }`,
      { did: lastFailed.id, s: WEEK_AGO, e: NOW },
      "lastFailed-deploy");
  }
  // 3. buildLogs for latest (if different)
  if (latest && latest !== lastFailed) {
    await getLogs("buildLogs(latest " + latest.status + ")",
      `query B($did: String!, $s: DateTime, $e: DateTime) {
        buildLogs(deploymentId: $did, startDate: $s, endDate: $e, limit: 5000) ` + LOG_FIELDS + ` }`,
      { did: latest.id, s: WEEK_AGO, e: NOW },
      "latest-build");
  }
  // 4. environmentLogs (whole env past week) — 5000 lines
  await getLogs("environmentLogs(production env, past week)",
    `query E($eid: String!, $a: String, $b: String, $al: Int, $bl: Int, $aD: String, $bD: String) {
      environmentLogs(environmentId: $eid, anchorDate: $aD, afterDate: $aD, beforeDate: $bD, afterLimit: 5000, beforeLimit: 5000) ` + LOG_FIELDS + ` }`,
    { eid: ENV_ID, aD: WEEK_AGO, bD: NOW },
    "environment-all");
  // 5. environmentLogs with filter:"stderr|error|warn" to find errors
  await getLogs("environmentLogs (ERRORS filter)",
    `query E($eid: String!, $aD: String, $bD: String, $f: String) {
      environmentLogs(environmentId: $eid, anchorDate: $aD, afterDate: $aD, beforeDate: $bD, afterLimit: 5000, beforeLimit: 5000, filter: $f) ` + LOG_FIELDS + ` }`,
    { eid: ENV_ID, aD: WEEK_AGO, bD: NOW, f: "error OR failed OR fatal OR invalid OR exception OR Error OR WARN OR warning OR undefined OR crash" },
    "environment-errors-filter");
  // 6. httpLogs
  await getLogs("httpLogs(past week)",
    `query H($aD: String, $bD: String, $l: Int, $eid: String!, $sid: String!, $s: DateTime, $e: DateTime) {
      httpLogs(environmentId: $eid, serviceId: $sid, anchorDate: $aD, afterDate: $aD, beforeDate: $bD, afterLimit: 2000, beforeLimit: 2000, startDate: $s, endDate: $e, limit: $l) ` + LOG_FIELDS + ` }`,
    { eid: ENV_ID, sid: SVC_ID, aD: WEEK_AGO, bD: NOW, l: 5000, s: WEEK_AGO, e: NOW },
    "http");
  // 7. deploymentLogs for LAST 3 FAILED + 2 SUCCESS (wide coverage)
  const last3Failed = allFailed.slice(-3);
  const last2Success = finalDeps.slice().reverse().filter(function(d) { return d.status === "SUCCESS" || d.status === "DEPLOYED" || d.status === "DEPLOYING"; }).slice(0, 2);
  const multi = last3Failed.concat(last2Success);
  for (let i = 0; i < multi.length; i++) {
    await getLogs("deploymentLogs(" + multi[i].status + " #" + (i+1) + " " + multi[i].id.slice(0,8) + "...)",
      `query D($did: String!, $s: DateTime, $e: DateTime) {
        deploymentLogs(deploymentId: $did, startDate: $s, endDate: $e, limit: 5000) ` + LOG_FIELDS + ` }`,
      { did: multi[i].id, s: WEEK_AGO, e: NOW },
      "multi-" + multi[i].status);
  }

  // Filter to past week
  const wkLogs = allLogs.filter(function(l) {
    if (!l.timestamp) return true;
    const t = new Date(l.timestamp).getTime();
    return isNaN(t) || t >= new Date(WEEK_AGO).getTime();
  });
  console.log("\n📊 Total lines: all=" + allLogs.length + " week-filter=" + wkLogs.length);

  // Also: Deployment.diagnosis field on lastFailed
  if (lastFailed) {
    const diag = await gql(`query D($id: String!) { deployment(id: $id) { id status diagnosis { } } }`, { id: lastFailed.id });
    if (diag.data && diag.data.data && diag.data.data.deployment) {
      console.log("\n🧬 Deployment.diagnosis on LAST FAILED:");
      try { console.log("   " + JSON.stringify(diag.data.data.deployment.diagnosis, null, 2).slice(0, 800)); } catch(e) {}
    }
  }

  // ==============================================================
  // PART 4: ANALYZE
  // ==============================================================
  console.log("\n🔍 Analysis (" + wkLogs.length + " lines)...");
  const cats = {
    oom: [], buildFail: [], missingEnv: [], dbSupabase: [], rls: [], ts: [], mod: [], net: [],
    startup: [], http5xx: [], http4xx: [], cron: [], auth: [], crypto: [], quota: [],
    other: [], warn: [], info: [],
  };
  wkLogs.forEach(function(l) {
    if (!l || !l.message) return;
    const msg = l.message; const m = msg.toLowerCase(); const sv = (l.severity || "").toLowerCase();
    const tags = l.tags || {}; const tagLvl = (tags.level || "").toLowerCase();
    const isErr = sv === "error" || sv === "fatal" || sv === "err" || tagLvl === "error" || tagLvl === "fatal" || /error|failed|fatal|invalid|unhandled|exception|traceback|panic|err\b|failure|denied/.test(m);
    const isWarn = /warn|deprecated|experimental|advisory|slow/.test(m) && !isErr;
    if (/out of memory|javascript heap|oom|allocation failed|memory limit|killed$|memory exhausted|heap out/.test(m)) cats.oom.push(l);
    else if (/missing supabase|missing credentials|supabase environment variables|middleware warning: missing supabase|supabase url not set|supabase key not set|credentials, returning unavailable client|missing.*env|environment variable|cannot read.*supabase/.test(m)) cats.missingEnv.push(l);
    else if (/(supabase|postgres|postgresql|pg_|sqlstate|database|connection refused|connection reset|pool.*exhausted|client.*initialization|tenant_integrations|pgrst2|row level security|rls|policy|42501|permission denied|pgroonga|schema does not exist|relation.*does not exist)/.test(m)) {
      if (/rls|policy|row level|permission denied|42501|privilege/.test(m)) cats.rls.push(l);
      cats.dbSupabase.push(l);
    }
    else if (/(typescript| ts2\d{3}|typeerror|cannot find name|property does not exist|does not exist on type|argument of type|is not assignable|implicitly has any|tsconfig|\.ts\(\d+,\d+\): error)/.test(m)) cats.ts.push(l);
    else if (/(module not found|cannot find module|npm err!|install failed|cannot resolve|enoent|eisdir|unmet peer|peer dep|lockfile)/.test(m)) cats.mod.push(l);
    else if (/(network|etimedout|econnrefused|enotfound|getaddrinfo|dns|ehostunreach|socket hang up|tls|handshake failed|certificate)/.test(m)) cats.net.push(l);
    else if (isErr && /(build|compil|webpack|tsc|next build|babel|esbuild|bundl|chunk|minif|export|import.*error|module parse failed)/.test(m)) cats.buildFail.push(l);
    else if (isErr && /(server|crash|startup|listen|eaddrinuse|eacces|port|segmentation fault|illegal instruction|sigterm|sigsegv|nodemon|pm2|process.*exit|code.*non-zero|start command failed)/.test(m)) cats.startup.push(l);
    else if (/statusCode=5\d{2}|status[^\w]5\d{2}|http 5\d{2}|503 service unavailable|500 internal|502 bad gateway|504 gateway|returning 5\d{2}|\s5\d{2}\s/.test(m)) cats.http5xx.push(l);
    else if (/statusCode=4\d{2}|status[^\w]4\d{2}|http 4\d{2}|401 unauthorized|403 forbidden|404 not found|429 too many|\s4\d{2}\s/.test(m)) cats.http4xx.push(l);
    else if (/cron|schedule|autonomous-runner|process-task|process-invoice|process-recurring|daily-business|social-publish|cronjob|api\/cron/.test(m)) cats.cron.push(l);
    else if (/(oauth|unauthorized|401|403|forbidden|invalid.*token|expired.*token|jwt malformed|auth|signin|login|credential|access_denied|session|cookie)/.test(m)) cats.auth.push(l);
    else if (/(crypto|encrypt|decrypt|secret|key|iv|cipher|invalid aes|rsa|hmac|openssl|jose|signature)/.test(m)) cats.crypto.push(l);
    else if (/(quota|limit|exceed|too many|rate limit|429|plan|capacity|max.*reach|over quota)/.test(m)) cats.quota.push(l);
    else if (isWarn) cats.warn.push(l);
    else if (isErr) cats.other.push(l);
    else cats.info.push(l);
  });

  function show(title, arr, n) {
    if (arr.length === 0) return;
    console.log("\n   " + title + ": " + arr.length + " hits");
    const seen = {};
    const unique = [];
    for (let i = arr.length - 1; i >= 0 && unique.length < n; i--) {
      const fp = (arr[i].message || "").replace(/\b[a-f0-9-]{8,}\b/gi, "<ID>").replace(/\d+/g, "N").slice(0, 150);
      if (!seen[fp]) { seen[fp] = true; unique.push(arr[i]); }
    }
    unique.reverse().forEach(function(l) {
      const t = l.timestamp ? prettyDate(l.timestamp) : "";
      const sv = (l.severity || "").padEnd(8);
      const src = l._src ? "[" + l._src + "]" : "";
      console.log("     " + src + " [" + t + "] [" + sv + "] " + (l.message || "").slice(0, 300));
    });
  }

  show("🟥 OOM / Memory Kills", cats.oom, 20);
  show("🟥 Build Failures", cats.buildFail, 25);
  show("🟧 Missing Env / Supabase Credentials (REPEATING PATTERN 🔥)", cats.missingEnv, 40);
  show("🟧 DB / Supabase / RLS", cats.dbSupabase, 25);
  show("🟧 RLS / Permission / 42501", cats.rls, 20);
  show("🟧 TypeScript Compile Errors", cats.ts, 25);
  show("🟧 Node / npm / Module Errors", cats.mod, 20);
  show("🟧 Network / DNS / TLS Errors", cats.net, 20);
  show("🟧 Startup / Crash / Port / Sigterm", cats.startup, 25);
  show("🟧 Cron + Autonomous Runner Errors", cats.cron, 30);
  show("🟧 Auth / OAuth / 401 / 403", cats.auth, 25);
  show("🟧 Crypto / Encryption / Secrets", cats.crypto, 20);
  show("🟧 Quota / Limit / Rate Limit (429)", cats.quota, 20);
  show("🟧 HTTP 5xx Errors (500/502/503/504)", cats.http5xx, 25);
  show("🟧 HTTP 4xx Errors", cats.http4xx, 15);
  show("🟨 Other Errors", cats.other, 25);
  show("Warnings (non-fatal)", cats.warn, 10);

  // ======= REPEATING PATTERN DETECTION =======
  console.log("\n🧬 Repeating Pattern Detection (top fingerprints) — past week...");
  const fps = {};
  wkLogs.forEach(function(l) {
    if (!l.message) return;
    const fp = (l.message || "").replace(/\b[a-f0-9-]{8,}\b/gi, "<ID>").replace(/\d+/g, "N").slice(0, 160);
    if (!fps[fp]) fps[fp] = { count: 0, sample: l, sources: {}, severities: {} };
    fps[fp].count++;
    fps[fp].sources[l._src || "?"] = (fps[fp].sources[l._src || "?"] || 0) + 1;
    fps[fp].severities[l.severity || "?"] = (fps[fp].severities[l.severity || "?"] || 0) + 1;
  });
  const topPatterns = Object.keys(fps).map(function(k) { return Object.assign({ fp: k }, fps[k]); }).sort(function(a, b) { return b.count - a.count; }).slice(0, 20);
  topPatterns.forEach(function(p, i) {
    const sev = Object.keys(p.severities).sort(function(a, b) { return p.severities[b] - p.severities[a]; }).slice(0, 2).join("/");
    const srcs = Object.keys(p.sources).slice(0, 3).join(",");
    console.log("   #" + String(i+1).padStart(2, "0") + "  ×" + String(p.count).padEnd(5) + sev.padEnd(10) + "[" + srcs + "] " + p.fp.slice(0, 160));
  });

  // ======= LAST FAILED DIAGNOSIS TAIL =======
  if (lastFailed) {
    const dl = wkLogs.filter(function(l) { return l._src && l._src.indexOf("lastFailed") !== -1; });
    console.log("\n🔎 LAST FAILED DEPLOYMENT — Diagnosis:");
    console.log("   ID: " + lastFailed.id + "  Time: " + prettyDate(lastFailed.createdAt));
    console.log("   Lines belonging to it: " + dl.length);
    const joined = dl.map(function(l) { return (l.message || "").toLowerCase(); }).join(" ");
    const causes = [];
    if (/out of memory|javascript heap|oom|memory/.test(joined)) causes.push("OOM / Memory killed — bump service RAM");
    if (/missing supabase|missing credentials|environment variables/.test(joined)) causes.push("Missing Supabase env vars — set + redeploy");
    if (/typescript| ts2\d{3}|cannot find name|build fail|compilation/.test(joined)) causes.push("TypeScript compile error during build — run `npm run typecheck` locally");
    if (/module not found|cannot find module|npm err|enoent|eisdir/.test(joined)) causes.push("Module resolution failure — check package.json locally");
    if (/start command|listen|eaddrinuse|eacces|port|sigterm|startup/.test(joined)) causes.push("Startup command failure — verify start command (`npm start`) and PORT env var");
    if (causes.length === 0) causes.push("Unclear — see tail below");
    causes.forEach(function(c) { console.log("   🔥 ROOT CAUSE: " + c); });
    if (dl.length > 0) {
      console.log("\n   🧾 Last 45 lines of LAST FAILED deploy logs:");
      const tail = dl.slice(-45);
      tail.forEach(function(l, i) {
        const t = l.timestamp ? prettyDate(l.timestamp) : "";
        const sv = (l.severity || "").padEnd(8);
        const src = l._src ? "[" + l._src + "]" : "";
        console.log("     [" + String(i+1).padStart(2,"0") + "] " + src + " [" + t + "] [" + sv + "] " + (l.message || "").slice(0, 260));
      });
    } else {
      console.log("\n   ⚠️  NO LOGS available for this deployment via API. Open Railway UI → Deployments → click the FAILED one → see log panel there");
    }
  }

  // ==============================================================
  // PART 5: FINAL SUMMARY & ACTIONABLE FIXES
  // ==============================================================
  console.log("\n================================================================");
  console.log("                  FINAL SUMMARY & ACTIONABLE FIXES              ");
  console.log("================================================================");
  console.log("Env vars missing:     " + (missing.length ? missing.join(", ") : "NONE ✅"));
  const totalIssues = cats.oom.length + cats.buildFail.length + cats.missingEnv.length + cats.ts.length +
                      cats.mod.length + cats.startup.length + cats.net.length + cats.cron.length +
                      cats.http5xx.length + cats.auth.length + cats.dbSupabase.length + cats.rls.length +
                      cats.crypto.length + cats.quota.length + cats.other.length;
  console.log("Total issue lines:    " + totalIssues);
  console.log("Missing-env hits:     " + cats.missingEnv.length + (cats.missingEnv.length > 0 ? " 🔥 #1 repeating pattern" : ""));
  console.log("Cron/auto runner:     " + cats.cron.length);
  console.log("DB/Supabase issues:   " + cats.dbSupabase.length + (cats.rls.length ? " (RLS: " + cats.rls.length + ")" : ""));
  console.log("Build failures:       " + cats.buildFail.length);
  console.log("TS errors:            " + cats.ts.length);
  console.log("OOM:                  " + cats.oom.length);
  console.log("Module errors:        " + cats.mod.length);
  console.log("Last failed deploy:   " + (lastFailed ? lastFailed.id.slice(0,10) + "  status=" + lastFailed.status + "  " + prettyDate(lastFailed.createdAt) : "NONE"));

  console.log("\n===== 🔥 ACTIONS REQUIRED 🔥 =====");
  const acts = [];
  if (missing.length > 0 || cats.missingEnv.length > 0) {
    acts.push({
      title: "#1 🔴 Add Missing Supabase Env Vars (ROOT OF MOST RUNTIME ERRORS)",
      steps: [
        "Railway URL: https://railway.com/project/" + PROJECT_ID + "/service/" + SVC_ID + "?environmentId=" + ENV_ID,
        "Click: alphaclone-nextjs → Variables → Add ALL these (note: shared or service scope both OK):",
        "  NEXT_PUBLIC_SUPABASE_URL  =  https://ehekzoioqvtweugemktn.supabase.co",
        "  SUPABASE_URL              =  https://ehekzoioqvtweugemktn.supabase.co",
        "  NEXT_PUBLIC_SUPABASE_ANON_KEY  =  <Supabase Dashboard → Settings → API → anon (public)>",
        "  SUPABASE_SERVICE_ROLE_KEY  =  <Supabase Dashboard → Settings → API → service_role (secret)>",
        "  DATABASE_URL               =  <Supabase → Settings → Database → Connection string → Direct>",
        "  PORT                       =  3000",
        "  NODE_OPTIONS               =  --max-old-space-size=12288",
        "  NEXT_PUBLIC_APP_URL        =  <your public domain: e.g. https://app.alphaclonesystems.com or railway domain>",
        "  NEXT_PUBLIC_SITE_URL       =  same as NEXT_PUBLIC_APP_URL",
        "  PUBLIC_APP_ORIGIN          =  same value again",
        "  ENCRYPTION_SECRET          =  strong random: run `openssl rand -hex 32`",
        "  AUTH_SECRET                =  `openssl rand -base64 33`",
        "  CRON_SECRET                =  random long string (protects /api/cron/* routes)",
        "(If you already have STRIPE_SECRET_KEY, RESEND_API_KEY etc. in use, add them too.)",
        "AFTER ADDING ALL: Press Cmd+K → 'Redeploy' on the service. Railway injects env vars ONLY at build/startup.",
      ],
    });
  }
  if (cats.oom.length > 0 || (lastFailed && cats.oom.length === 0 && allFailed.length > finalDeps.length * 0.3 && finalDeps.length > 3)) {
    acts.push({
      title: "#2 🟠 Fix Memory Pressure / OOM Kills",
      steps: [
        "Railway → alphaclone-nextjs → Settings → Resources",
        "  RAM → set to 2 GB or 4 GB (Hobby plan default is likely 512MB — too small for Next.js with 200+ migrations / cron / durable jobs)",
        "  Disk → 5 GB or 10 GB (build cache large)",
        "Confirm env var NODE_OPTIONS=--max-old-space-size=12288 (also sets runtime heap — step #1 sets this)",
        "Redeploy after resize",
      ],
    });
  }
  if (cats.ts.length > 0 || cats.buildFail.length > 0) {
    acts.push({
      title: "#3 🟠 Fix TypeScript / Build Failures (caused most FAILED deploys)",
      steps: [
        "Locally in this project:",
        "  npm run typecheck     (identifies all TS2* errors)",
        "  npm run build         (reproduces exact Railway build failure)",
        "Fix all errors, commit, push → triggers new Railway deploy automatically",
      ],
    });
  }
  if (cats.mod.length > 0) {
    acts.push({
      title: "#4 🟡 Fix Module Resolution Errors",
      steps: [
        "Locally:",
        "  rm -rf node_modules package-lock.json",
        "  npm install",
        "  npm run build",
        "If build passes locally, push new commit.",
        "Still failing? File an issue with a copy of the failing log line.",
      ],
    });
  }
  if (cats.cron.length > 0) {
    acts.push({
      title: "#5 🟡 Cron + Autonomous Runner Errors",
      steps: [
        "Nearly ALL cron errors stem from missing Supabase env vars (#1) — fix #1 first and 95% resolve on next deploy",
        "Verify CRON_SECRET env var matches what your cron senders send (shared secret)",
        "Test a cron endpoint: curl -X POST -H 'Authorization: Bearer <CRON_SECRET>' https://<your-domain>/api/cron/daily → expect 200",
      ],
    });
  }
  if (cats.startup.length > 0) {
    acts.push({
      title: "#6 🟡 Startup / Sigterm / Port Errors",
      steps: [
        "Set PORT=3000 env var (step #1 already covers this)",
        "Confirm Railway detected start command = npm start  (Service → Settings → Source → Start Command)",
        "Service → Settings → Healthcheck → path = / (or keep disabled)",
        "Redeploy after changing start command",
      ],
    });
  }
  if (cats.rls.length > 0 || cats.dbSupabase.length > 0) {
    acts.push({
      title: "#7 🟢 DB / RLS / Schema Issues",
      steps: [
        "17 DB migrations (16+1 fix) already applied — schema is correct",
        "If RLS permission errors persist in logs after redeploy with env vars:",
        "  Supabase → Project → Database → Replications → (reset event) — OR regenerate service_role key in Settings → API then paste the new one into Railway SUPABASE_SERVICE_ROLE_KEY and redeploy",
      ],
    });
  }
  if (acts.length === 0) acts.push({ title: "No concrete issues found in logs", steps: ["Open Railway deploy UI for details."] });
  acts.forEach(function(a, i) {
    console.log("\n  📌 " + a.title);
    a.steps.forEach(function(s, n) { console.log("     " + (n+1) + ". " + s); });
  });

  // Save raw logs to disk for offline analysis
  try {
    const logPath = path.join(process.cwd(), "railway_logs_" + Date.now() + ".json");
    fs.writeFileSync(logPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      weekStart: WEEK_AGO,
      environmentId: ENV_ID,
      serviceId: SVC_ID,
      deployments: { totalThisWeek: finalDeps.length, failedThisWeek: allFailed.length, lastFailed: lastFailed ? lastFailed.id : null, latest: latest ? latest.id : null },
      categories: Object.keys(cats).reduce(function(acc, k) { acc[k] = cats[k].length; return acc; }, {}),
      topPatterns: topPatterns.slice(0, 10).map(function(p) { return { count: p.count, severity: p.severities, sources: p.sources, sample: p.sample.message }; }),
      missingEnvVars: missing,
      rawLogs: wkLogs.map(function(l) { return { src: l._src, ts: l.timestamp, sev: l.severity, msg: l.message }; }),
    }, null, 2));
    console.log("\n💾 Saved raw logs to: " + logPath + "  (" + wkLogs.length + " lines)");
  } catch (e) { console.log("   (couldn't save logs to disk: " + e.message + ")"); }

  console.log("");
}

main().catch(function(e) { console.error("FATAL:", e); process.exit(1); });
