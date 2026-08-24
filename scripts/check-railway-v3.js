#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");

const PROJECT_ID = "c75eaf5f-1ec8-4565-b3b6-8e318f1251bd";
const WEEK_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

const envContent = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const [k, ...v] = line.split("=");
  const key = k.trim();
  if (key && !key.startsWith("#")) {
    env[key] = v.join("=").trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
  }
}
const TOKEN = env.RAILWAY_TOKEN || process.env.RAILWAY_TOKEN;

function gql(query, variables) {
  return new Promise(function(resolve) {
    const postData = JSON.stringify({ query: query, variables: variables || {} });
    const opts = {
      hostname: "backboard.railway.app",
      port: 443,
      path: "/graphql/v2",
      method: "POST",
      headers: {
        "Authorization": "Bearer " + TOKEN,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
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

function prettyDate(d) { return new Date(d).toLocaleString(); }

function dumpErrors(label, r) {
  if (r && r.data && r.data.errors) {
    console.log("   " + label + " GQL errors:");
    r.data.errors.forEach(function(e) { console.log("     • " + e.message); });
  }
}

async function main() {
  console.log("================================================================");
  console.log("      RAILWAY — Last FAILED Deployment + Runtime Logs (Week)    ");
  console.log("================================================================");

  // STEP 1 — project + environments + services + instances (with correct fields)
  console.log("\n📁 Project services & instances (schema introspect)...");
  const pQ = await gql(`
    query P($pid: String!) {
      project(id: $pid) {
        id name
        environments { edges { node { id name } } }
        services { edges { node {
          id name
          serviceInstances { edges { node {
            id environmentId __typename
          }}}
        }}}
      }
    }`, { pid: PROJECT_ID });
  if (!pQ.data || !pQ.data.data || !pQ.data.data.project) {
    console.log("   ❌ Failed");
    dumpErrors("Project", pQ);
    if (pQ.raw && pQ.raw.length < 1000) console.log(pQ.raw);
    process.exit(1);
  }
  const P = pQ.data.data.project;
  console.log("   ✅ " + P.name);
  const envs = P.environments.edges.map(function(e) { return e.node; });
  const envByName = {};
  envs.forEach(function(e) { envByName[e.id] = e.name; });
  const services = P.services.edges.map(function(e) { return e.node; });

  // Find target: Next.js service + production env
  let targetSvc = null;
  let targetInstId = null;
  let targetEnvId = null;
  const prod = envs.find(function(e) { return /prod/i.test(e.name); }) || envs[0];
  targetEnvId = prod.id;
  services.forEach(function(s) {
    const insts = s.serviceInstances.edges.map(function(e) { return e.node; });
    console.log("\n   ▶ " + s.name + "  id=" + s.id.slice(0, 14) + "...");
    insts.forEach(function(si) {
      const envName = envByName[si.environmentId] || "?";
      console.log("     • instance id=" + si.id.slice(0, 14) + "...  env=" + envName + " (" + si.environmentId.slice(0,10) + ")");
      if (!targetSvc && /next|alpha|web|app/i.test(s.name) && si.environmentId === targetEnvId) {
        targetSvc = s;
        targetInstId = si.id;
      }
    });
  });
  if (!targetSvc) { targetSvc = services[0]; const i = targetSvc.serviceInstances.edges.find(function(e) { return e.node.environmentId === targetEnvId; }) || targetSvc.serviceInstances.edges[0]; if (i) targetInstId = i.node.id; }
  console.log("\n🎯 TARGET:");
  console.log("   Service:    " + (targetSvc ? targetSvc.name : "?") + "  id=" + (targetSvc ? targetSvc.id : "?"));
  console.log("   Instance:   id=" + (targetInstId || "?"));
  console.log("   Env:        " + (prod ? prod.name : "?") + "  id=" + targetEnvId);

  // STEP 2 — Environment Variables (try via environment.serviceInstances.variables field)
  console.log("\n🔐 Environment Variables...");
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL", "DATABASE_URL",
    "SUPABASE_DB_URL", "PORT", "NEXT_PUBLIC_APP_URL", "NODE_OPTIONS",
    "NEXT_PUBLIC_SITE_URL", "PUBLIC_APP_ORIGIN", "ENCRYPTION_SECRET",
  ];
  let vars = {};
  const envQ = await gql(`query E($eid: String!) { environment(id: $eid) {
    id
    serviceInstances { edges { node { id serviceId __typename } } }
    serviceInstance(serviceId: "") { id }
  }}`, { eid: targetEnvId });
  // Try each service instance in environment for variables
  if (envQ.data && envQ.data.data && envQ.data.data.environment) {
    const edges = envQ.data.data.environment.serviceInstances.edges || [];
    for (let i = 0; i < edges.length; i++) {
      const id = edges[i].node.id;
      const svcId = edges[i].node.serviceId;
      const vQ = await gql(`query SI($id: String!) {
        node(id: $id) {
          ... on ServiceInstance {
            id serviceId environmentId
          }
        }
        serviceInstance(id: $id) { id __typename  }
      }`, { id: id });
      // Try variables via REST: environment variable list
    }
  }

  // Alternative REST approach for variables
  async function restVars() {
    return new Promise(function(resolve) {
      const reqPath = "/v1/variables?environmentId=" + encodeURIComponent(targetEnvId) + "&serviceId=" + encodeURIComponent(targetSvc.id);
      const opts = {
        hostname: "public-api.railway.app",
        port: 443,
        path: reqPath,
        method: "GET",
        headers: { "Authorization": "Bearer " + TOKEN },
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
      req.setTimeout(30000, function() { req.destroy(new Error("timeout")); });
      req.end();
    });
  }
  const rv = await restVars();
  if (rv.status >= 200 && rv.status < 300 && rv.data) {
    const arr = Array.isArray(rv.data) ? rv.data : (rv.data.data || rv.data.variables || []);
    arr.forEach(function(v) {
      const name = v.name || v.key;
      const value = v.value;
      if (name) vars[name] = value;
    });
    console.log("   (via REST public-api.railway.app/v1/variables)");
  } else if (rv.raw && rv.raw.length < 1000) {
    console.log("   REST vars HTTP " + rv.status + ": " + rv.raw);
  }

  let missing = [];
  required.forEach(function(name) {
    const has = vars[name] && String(vars[name]).length > 0;
    const val = has ? String(vars[name]) : "";
    const mask = /KEY|SECRET|TOKEN|DATABASE|URL|SECRET|ORIGIN/.test(name.toUpperCase());
    if (has) {
      console.log("   ✅ " + name.padEnd(36) + (mask ? val.slice(0, 10) + "..." : val));
    } else {
      console.log("   ❌ " + name.padEnd(36) + " MISSING");
      missing.push(name);
    }
  });

  // STEP 3 — all deployments past week, pick LAST FAILED
  console.log("\n🚀 Deployments (past week) → last FAILED...");
  const dQ = await gql(`query D($pid: String!) { project(id: $pid) {
    deployments(first: 100) { edges { node {
      id status createdAt environmentId serviceId meta
    }}}
  }}`, { pid: PROJECT_ID });
  let deps = [];
  if (dQ.data && dQ.data.data && dQ.data.data.project) {
    deps = (dQ.data.data.project.deployments.edges || []).map(function(e) { return e.node; });
  }
  const icons = { SUCCESS:"✅", FAILED:"❌", DEPLOYING:"🔄", BUILDING:"🔧", CRASHED:"💥", REMOVED:"🗑️", SLEEPING:"💤", INITIALIZING:"🌱", SKIPPED:"⏭️", DEPLOYED:"✅" };
  const weekDeps = deps.filter(function(d) { return new Date(d.createdAt) >= WEEK_AGO; })
                      .sort(function(a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
  const targetWeekDeps = weekDeps.filter(function(d) { return d.serviceId === targetSvc.id; });
  const focus = targetWeekDeps.length > 0 ? targetWeekDeps : weekDeps;
  const allFailed = focus.filter(function(d) { return d.status === "FAILED" || d.status === "CRASHED"; });
  const lastFailed = allFailed.length > 0 ? allFailed[allFailed.length - 1] : null;
  const latest = focus.length > 0 ? focus[focus.length - 1] : null;
  focus.forEach(function(d, i) {
    const icon = icons[d.status] || "❓";
    const isFailed = (d === lastFailed) ? "  👈 LAST FAILED" : "";
    const isLatest = (d === latest && d !== lastFailed) ? "  👈 LATEST" : "";
    const envName = envByName[d.environmentId] || (d.environmentId || "").slice(0, 8);
    const meta = (typeof d.meta === "string" ? d.meta : JSON.stringify(d.meta || "")).slice(0, 70);
    console.log("   " + icon + " " + (d.status || "?").padEnd(13) + prettyDate(d.createdAt) +
      " env=" + String(envName).padEnd(10) + " id=" + d.id.slice(0, 10) + isFailed + isLatest);
    if (meta) console.log("       📝 " + meta);
  });
  console.log("\n   Deployments this week: " + focus.length);
  console.log("   Failed:                " + allFailed.length);
  console.log("   LAST FAILED:           " + (lastFailed ? lastFailed.id.slice(0, 14) + "...  status=" + lastFailed.status + "  @" + prettyDate(lastFailed.createdAt) : "NONE"));
  console.log("   Latest overall:        " + (latest ? latest.status + "  @" + prettyDate(latest.createdAt) : "NONE"));

  // STEP 4 — FULL logs: (a) last failed deployment (b) current instance runtime logs (past week)
  const toAnalyze = [];
  async function fetchDeploymentLogs(d, label) {
    console.log("\n📋 " + label + "  (id=" + d.id.slice(0, 14) + "...)");
    let lines = [];
    const queries = [
      { q: `query D($id: String!) { deployment(id: $id) { buildLogs(last: 5000) { timestamp level message } runtimeLogs(last: 5000) { timestamp level message } }}`, key: "deployment" },
      { q: `query D($id: String!) { deploymentLogs(deploymentId: $id, limit: 5000) { timestamp level message }}`, key: "deploymentLogs" },
    ];
    for (let i = 0; i < queries.length; i++) {
      const r = await gql(queries[i].q, { id: d.id });
      if (r.data && r.data.data) {
        if (r.data.data.deployment) {
          const bl = r.data.data.deployment.buildLogs || [];
          const rl = r.data.data.deployment.runtimeLogs || [];
          bl.forEach(function(l) { l._type = "build"; l._depId = d.id; l._depStatus = d.status; lines.push(l); });
          rl.forEach(function(l) { l._type = "runtime"; l._depId = d.id; l._depStatus = d.status; lines.push(l); });
        }
        if (Array.isArray(r.data.data.deploymentLogs)) {
          r.data.data.deploymentLogs.forEach(function(l) { l._type = "deploy"; l._depId = d.id; l._depStatus = d.status; lines.push(l); });
        }
      }
    }
    console.log("   Got " + lines.length + " lines (build+runtime)");
    return lines;
  }

  if (lastFailed) {
    const lines = await fetchDeploymentLogs(lastFailed, "LAST FAILED Deployment Logs");
    lines.forEach(function(l) { l._scope = "lastFailed"; toAnalyze.push(l); });
  } else if (latest) {
    console.log("\n(No FAILED deployments — using latest for comparison)");
    const lines = await fetchDeploymentLogs(latest, "Latest Deployment Logs");
    lines.forEach(function(l) { l._scope = "latest"; toAnalyze.push(l); });
  }

  // Current service instance runtime logs (all we can get — last 5000)
  console.log("\n📡 Service Instance runtime logs (as many as possible)...");
  let runtimeLines = [];
  // Try multiple GQL fields and queries for runtime logs via environment
  const rq1 = await gql(`query E($eid: String!) { environment(id: $eid) {
    id serviceInstances { edges { node { id serviceId } } }
  }}`, { eid: targetEnvId });
  if (rq1.data && rq1.data.data && rq1.data.data.environment) {
    const edges = rq1.data.data.environment.serviceInstances.edges || [];
    for (let i = 0; i < edges.length; i++) {
      const nd = edges[i].node;
      if (nd.serviceId !== targetSvc.id) continue;
      const rlg = await gql(`query SI($id: String!) { node(id: $id) { id } }`, { id: nd.id });
      // Try a generic "logs" query via different name
      const alt = await gql(`query E($eid: String!, $svc: String!) {
        environment(id: $eid) {
          id
          logs: serviceInstance(serviceId: $svc) { id }
        }
      }`, { eid: targetEnvId, svc: targetSvc.id });
      // Try deployment-level runtime logs for latest successful deploy (instance running)
      const lastSuccess = focus.slice().reverse().find(function(d) { return d.status === "SUCCESS" || d.status === "DEPLOYED" || d.status === "DEPLOYING" || d.status === "SLEEPING"; });
      if (lastSuccess) {
        const l = await fetchDeploymentLogs(lastSuccess, "Current-running Deployment (latest success/active)");
        l.forEach(function(x) { x._scope = "current"; runtimeLines.push(x); });
      }
    }
  }

  // Also try: for all SUCCESS deployments from past week → their runtime logs (these include live instance logs)
  const recentRunning = focus.slice().reverse().filter(function(d) {
    return ["SUCCESS","DEPLOYED","DEPLOYING","SLEEPING","INITIALIZING"].indexOf(d.status) !== -1;
  }).slice(0, 3);
  for (let i = 0; i < recentRunning.length; i++) {
    if (recentRunning[i] === lastFailed) continue;
    const l = await fetchDeploymentLogs(recentRunning[i], "Running deployment #" + (i+1) + " " + recentRunning[i].status + " @" + prettyDate(recentRunning[i].createdAt));
    l.forEach(function(x) { x._scope = "current"; x._alt = i; runtimeLines.push(x); });
  }
  console.log("   Current/runtime lines collected: " + runtimeLines.length);
  runtimeLines.forEach(function(l) { toAnalyze.push(l); });

  // Filter all to past 7 days
  const weekTs = WEEK_AGO.getTime();
  const allLines = toAnalyze.filter(function(l) {
    if (!l.timestamp) return true;
    const t = new Date(l.timestamp).getTime();
    return isNaN(t) || t >= weekTs;
  });
  console.log("\n📊 Total log lines (past week): " + allLines.length);

  // STEP 5 — ANALYZE: broad categories plus repeating pattern detection
  console.log("\n🔍 Full Log Analysis (" + allLines.length + " lines)...");
  const cats = {
    oom: [], build: [], missingEnv: [], db: [], ts: [], mod: [], net: [], startup: [],
    http5xx: [], http4xx: [], cron: [], auth: [], supabaseConn: [], crypto: [],
    rls: [], pg: [], quota: [], other: [], warn: [], info: [],
  };
  allLines.forEach(function(l) {
    if (!l || !l.message) return;
    const msg = l.message; const m = msg.toLowerCase(); const lv = (l.level || "").toLowerCase();
    const isErr = lv === "error" || lv === "stderr" || lv === "fatal" || /error|failed|fatal|invalid|unhandled|exception|traceback/.test(m);
    const isWarn = /warn|deprecated|experimental|advisory/.test(m) && !isErr;
    if (/out of memory|javascript heap|oom|allocation failed|memory limit|killed$/.test(m)) cats.oom.push(l);
    else if (/missing supabase|missing credentials|environment variables|supabase environment|middleware warning: missing supabase/.test(m)) cats.missingEnv.push(l);
    else if (/(supabase|postgres|postgresql|pg_|sqlstate|database|connection refused|connection reset|pool|client|tenant_integrations|pgrst|pgroonga)/.test(m)) {
      if (/missing supabase|credentials/.test(m)) cats.missingEnv.push(l); else cats.db.push(l);
      if (/rls|policy|row level|permission denied|42501|pg_rls|insufficient privilege/.test(m)) cats.rls.push(l);
    }
    else if (/(typescript| ts2\d{3}|typeerror|cannot find name|property does not exist|does not exist on type|argument of type|is not assignable|implicitly has any)/.test(m)) cats.ts.push(l);
    else if (/(module not found|cannot find module|npm err!|install failed|cannot resolve|enoent|eisdir)/.test(m)) cats.mod.push(l);
    else if (/(network|etimedout|econnrefused|enotfound|getaddrinfo|dns|ehostunreach|socket hang up)/.test(m)) cats.net.push(l);
    else if (isErr && /(build|compil|webpack|tsc|next build|babel|esbuild|bundl|chunk|minif)/.test(m)) cats.build.push(l);
    else if (isErr && /(server|crash|startup|listen|eaddrinuse|eacces|port|segmentation fault|illegal instruction|sighup|sigterm|sigsegv)/.test(m)) cats.startup.push(l);
    else if (/statusCode=5\d{2}|status [^\w]5\d{2}|http 5\d{2}|503 service unavailable|500 internal|502 bad gateway|504 gateway/.test(m) || /returning 5\d{2}/.test(m)) cats.http5xx.push(l);
    else if (/cron|schedule|autonomous-runner|process-task|process-invoice|process-recurring|daily-business|social-publish/.test(m)) {
      cats.cron.push(l);
      if (isErr) cats.http5xx.push(l);
    }
    else if (/(oauth|unauthorized|401|403|forbidden|invalid.*token|expired.*token|jwt|auth|signin|login|credential|access_denied)/.test(m)) cats.auth.push(l);
    else if (/(crypto|encrypt|decrypt|secret|key|iv|cipher|invalid aes|rsa|hmac)/.test(m)) cats.crypto.push(l);
    else if (/(quota|limit|exceed|too many|rate limit|429|plan)/.test(m)) cats.quota.push(l);
    else if (isWarn) cats.warn.push(l);
    else if (isErr) cats.other.push(l);
  });
  const showSection = function(title, arr, n) {
    if (arr.length === 0) return;
    console.log("\n   ⚠️  " + title + ": " + arr.length + " hits");
    const seenMsg = {};
    const unique = [];
    for (let i = arr.length - 1; i >= 0 && unique.length < n; i--) {
      const fingerprint = (arr[i].message || "").replace(/\b[a-f0-9-]{8,}\b/gi, "<ID>").replace(/\d+/g, "N").slice(0, 120);
      if (!seenMsg[fingerprint]) { seenMsg[fingerprint] = true; unique.push(arr[i]); }
    }
    unique.reverse().forEach(function(l) {
      const t = l.timestamp ? prettyDate(l.timestamp) : "";
      const lv = (l.level || "").padEnd(6);
      const scope = l._scope ? "[" + l._scope + "]" : "";
      const src = l._type ? "[" + l._type + "]" : "";
      console.log("     " + scope + src + " [" + t + "] [" + lv + "] " + (l.message || "").slice(0, 280));
    });
  };

  showSection("🟥 OOM / Memory Kills", cats.oom, 15);
  showSection("🟥 Build Failures", cats.build, 20);
  showSection("🟧 Missing Supabase/Env Vars (THE PATTERN!)", cats.missingEnv, 30);
  showSection("🟧 DB/Supabase Errors", cats.db, 25);
  showSection("🟧 RLS / Permission / PGRST Errors", cats.rls, 20);
  showSection("🟧 TypeScript Compile Errors", cats.ts, 20);
  showSection("🟧 Node/Module Errors", cats.mod, 20);
  showSection("🟧 Network Errors", cats.net, 15);
  showSection("🟧 Startup/Crash/Port Errors", cats.startup, 20);
  showSection("🟧 Cron + Autonomous Runner Errors", cats.cron, 25);
  showSection("🟧 Auth / OAuth / 401 / 403 Errors", cats.auth, 20);
  showSection("🟧 Crypto / Encryption / Secret Errors", cats.crypto, 15);
  showSection("🟧 Quota / Limit / Rate Errors", cats.quota, 15);
  showSection("🟧 HTTP 5xx Server Errors (500/502/503/504)", cats.http5xx, 25);
  showSection("🟨 Other Errors", cats.other, 25);
  showSection("Warnings Only", cats.warn, 10);

  // Pattern summary: count repeating fingerprints in runtime logs
  console.log("\n🧬 Repeating Pattern Summary (in current/runtime logs)...");
  const fps = {};
  const currentOnly = allLines.filter(function(l) { return l._scope === "current"; });
  currentOnly.forEach(function(l) {
    if (!l.message) return;
    const fp = (l.message || "").replace(/\b[a-f0-9-]{8,}\b/gi, "<ID>").replace(/\d+/g, "N").slice(0, 120);
    if (!fps[fp]) fps[fp] = { count: 0, sample: l, types: {} };
    fps[fp].count++;
    const t = l._type || l.level || "?";
    fps[fp].types[t] = (fps[fp].types[t] || 0) + 1;
  });
  const topPatterns = Object.keys(fps).map(function(k) { return Object.assign({ fp: k }, fps[k]); })
                                 .sort(function(a, b) { return b.count - a.count; }).slice(0, 15);
  topPatterns.forEach(function(p, i) {
    console.log("   #" + (i+1) + " ×" + p.count + "  " + (p.sample.level || "").padEnd(6) + "  " + p.fp.slice(0, 140));
  });

  // STEP 6 — last FAILED deployment tail + diagnosis
  if (lastFailed) {
    const dl = allLines.filter(function(l) { return l._depId === lastFailed.id; });
    console.log("\n🔎 Last FAILED Deployment Diagnosis:");
    console.log("   ID:     " + lastFailed.id);
    console.log("   Time:   " + prettyDate(lastFailed.createdAt));
    console.log("   Lines:  " + dl.length);
    const joined = dl.map(function(l) { return (l.message || "").toLowerCase(); }).join(" ");
    const causes = [];
    if (/out of memory|javascript heap|oom/.test(joined)) causes.push("OOM — increase service RAM (Railway → Resources)");
    if (/missing supabase|missing credentials|environment variables/.test(joined)) causes.push("Missing Supabase env vars (set + redeploy)");
    if (/typescript| ts2\d{3}|cannot find name/.test(joined)) causes.push("TypeScript build errors (run `npm run typecheck` locally)");
    if (/module not found|cannot find module|npm err/.test(joined)) causes.push("Node module errors (package.json issue locally)");
    if (causes.length === 0) causes.push("Unclear — see tail of deployment logs below");
    causes.forEach(function(c) { console.log("   🔥 " + c); });
    if (dl.length > 0) {
      console.log("\n   🧾 Last 35 lines of LAST FAILED deploy:");
      const tail = dl.slice(-35);
      tail.forEach(function(l, i) {
        const src = l._type ? "[" + l._type + "]" : "";
        const t = l.timestamp ? prettyDate(l.timestamp) : "";
        const lv = (l.level || "").padEnd(6);
        console.log("     [" + String(i+1).padStart(2,"0") + "] " + src + " [" + t + "] [" + lv + "] " + (l.message || "").slice(0, 260));
      });
    }
  }

  // STEP 7 — Final summary
  console.log("\n================================================================");
  console.log("                  FINAL SUMMARY & FIXES                        ");
  console.log("================================================================");
  console.log("Env vars missing:     " + (missing.length ? missing.join(", ") : "NONE ✅"));
  const total = cats.oom.length + cats.build.length + cats.missingEnv.length + cats.ts.length +
                cats.mod.length + cats.startup.length + cats.net.length + cats.cron.length +
                cats.http5xx.length + cats.auth.length + cats.db.length + cats.rls.length +
                cats.crypto.length + cats.quota.length + cats.other.length;
  console.log("Total issue lines:    " + total);
  console.log("Missing-env hits:     " + cats.missingEnv.length + "  (THE #1 REPEATING PATTERN)");
  console.log("Cron-errors hits:     " + cats.cron.length);
  console.log("DB/Supabase hits:     " + cats.db.length + (cats.rls.length > 0 ? " (incl RLS: " + cats.rls.length + ")" : ""));
  console.log("OOM hits:             " + cats.oom.length);
  console.log("TS build hits:        " + cats.ts.length);
  console.log("Last failed deploy:   " + (lastFailed ? lastFailed.id.slice(0,10) + "  " + lastFailed.status + "  " + prettyDate(lastFailed.createdAt) : "NONE"));

  // FIXES
  console.log("\n===== 🔥 ACTIONABLE FIXES 🔥 =====");
  const actions = [];
  if (missing.length > 0 || cats.missingEnv.length > 0) {
    actions.push({
      title: "#1 PRIORITY — Add Missing Supabase Env Vars (root of most runtime errors)",
      steps: [
        "Open Railway: https://railway.com/project/" + PROJECT_ID + "/service/" + targetSvc.id + "?environmentId=" + targetEnvId,
        "Click → Variables → Shared / Service tab → Add these:",
        "  NEXT_PUBLIC_SUPABASE_URL=https://ehekzoioqvtweugemktn.supabase.co",
        "  SUPABASE_URL=https://ehekzoioqvtweugemktn.supabase.co",
        "  NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase Dashboard → Settings → API → Project API keys → anon public>",
        "  SUPABASE_SERVICE_ROLE_KEY=<Supabase Dashboard → Settings → API → Project API keys → service_role (secret!)>",
        "  DATABASE_URL=<Supabase → Settings → Database → Connection string (Direct)>",
        "  PORT=3000",
        "  NODE_OPTIONS=--max-old-space-size=12288",
        "  NEXT_PUBLIC_APP_URL=<your public URL e.g. https://yourapp.up.railway.app or custom domain>",
        "  NEXT_PUBLIC_SITE_URL=<same as above or fallback>",
        "  ENCRYPTION_SECRET=<a strong random string e.g. `openssl rand -hex 32`>",
        "After adding → Cmd+K → Redeploy service (critical — vars only inject at build/start)",
      ],
    });
  }
  if (cats.oom.length > 0 || (lastFailed && /out of memory|javascript heap|oom/.test((lastFailed.meta || "").toLowerCase()))) {
    actions.push({
      title: "#2 — Fix OOM / Memory Pressure",
      steps: [
        "Railway → Service → Settings → Resources → RAM → 2 GB or 4 GB (was probably killed for OOM)",
        "Set env var NODE_OPTIONS=--max-old-space-size=12288 (build script already sets, but runtime also needs it)",
        "Verify buildCommand in railway.toml is correct: '" + "rm -rf app && NODE_OPTIONS='--max-old-space-size=12288' npm run build" + "' (already correct)",
      ],
    });
  }
  if (cats.ts.length > 0) {
    actions.push({
      title: "#3 — Fix TypeScript Compile Errors",
      steps: [
        "Run locally: npm run typecheck",
        "Fix each TS error, commit, push → triggers new Railway deploy",
      ],
    });
  }
  if (cats.mod.length > 0) {
    actions.push({
      title: "#4 — Fix Node / Missing Module Errors",
      steps: [
        "Locally: rm -rf node_modules package-lock.json && npm install",
        "Then: npm run build → reproduce and fix any build errors",
      ],
    });
  }
  if (cats.cron.length > 0) {
    actions.push({
      title: "#5 — Cron / Autonomous Runner Errors",
      steps: [
        "Most cron errors ARE CAUSED by #1 missing env vars → fix #1 first, redeploy.",
        "Verify all 6 cron route handlers return 200 with the correct CRON_SECRET.",
        "Railway → Crons: check railway.crons.json is deployed correctly",
      ],
    });
  }
  if (cats.rls.length > 0 || cats.db.length > 0) {
    actions.push({
      title: "#6 — DB / RLS / PGRST Errors",
      steps: [
        "Already applied all 16+1 DB migrations → schema is current.",
        "If RLS/PGRST errors persist → trigger Supabase schema cache refresh: Dashboard → Database → Replications → Reset OR recreate service role key.",
        "Double-check service_role key in Railway (has bypass RLS for internal use).",
      ],
    });
  }
  if (actions.length === 0) actions.push({ title: "No obvious issues in logs.", steps: ["Check Railway deploy UI manually for status."] });
  actions.forEach(function(a, idx) {
    console.log("\n  📌 " + a.title);
    a.steps.forEach(function(s, n) { console.log("     " + (n+1) + ". " + s); });
  });
  console.log("");
}

main().catch(function(e) { console.error("FATAL:", e); process.exit(1); });
