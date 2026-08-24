#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");

const URL_SERVICE_ID = "a98fc4dc-4047-4647-a74a-985f6ff667ce";
const URL_ENV_ID = "78325a44-cd94-4b10-aa41-c09ebd978c7f";
const PROJECT_ID = "c75eaf5f-1ec8-4565-b3b6-8e318f1251bd";
const WEEK_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

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
    req.setTimeout(60000, function() { req.destroy(new Error("HTTP timeout")); });
    req.write(postData);
    req.end();
  });
}

function prettyDate(d) { return new Date(d).toLocaleString(); }

async function main() {
  console.log("================================================================");
  console.log("              RAILWAY DEEP DIAGNOSTICS — PAST WEEK");
  console.log("================================================================");

  // Step 1: Project + all services + instances
  console.log("\n📁 Project services and instances...");
  const pQ = await gql(`
    query P($pid: String!) {
      project(id: $pid) {
        id name
        services { edges { node {
          id name
          serviceInstances { edges { node {
            id name status
            environment { id name }
          }}}
        }}}
        environments { edges { node { id name } } }
      }
    }`, { pid: PROJECT_ID });

  if (!pQ.data || !pQ.data.data || !pQ.data.data.project) {
    console.log("   ❌ Failed to get project");
    if (pQ.data && pQ.data.errors) pQ.data.errors.forEach(function(e) { console.log("   - " + e.message); });
    if (pQ.raw && pQ.raw.length < 1000) console.log(pQ.raw);
    process.exit(1);
  }
  const P = pQ.data.data.project;
  console.log("   ✅ " + P.name);
  const services = P.services.edges.map(function(e) { return e.node; });
  let targetService = null;
  let targetInstance = null;
  services.forEach(function(s) {
    console.log("\n   ▶ Service: " + s.name + "  (id=" + s.id.slice(0,14) + "...)");
    const insts = s.serviceInstances.edges.map(function(e) { return e.node; });
    insts.forEach(function(si) {
      const envName = si.environment ? si.environment.name : "?";
      const envId = si.environment ? si.environment.id : "";
      const matchId = (si.id === URL_SERVICE_ID) || (s.id === URL_SERVICE_ID);
      const matchEnv = envId === URL_ENV_ID;
      const tag = (matchId || matchEnv) ? " ⭐" : "";
      console.log("     • Instance: " + si.name.padEnd(20) + " env=" + envName.padEnd(10) + " status=" + (si.status || "?").padEnd(12) + " id=" + si.id.slice(0,14) + "..." + tag);
      if (matchId || (matchEnv && !targetInstance)) {
        targetService = s;
        targetInstance = Object.assign({}, si, { envId: envId });
      }
    });
  });

  if (!targetInstance && services.length > 0) {
    // Pick first
    const s0 = services[0];
    const insts = s0.serviceInstances.edges.map(function(e) { return e.node; });
    if (insts.length > 0) { targetService = s0; targetInstance = Object.assign({}, insts[0], { envId: insts[0].environment ? insts[0].environment.id : "" }); }
  }
  const tSvcId = targetService ? targetService.id : URL_SERVICE_ID;
  const tInstId = targetInstance ? targetInstance.id : URL_SERVICE_ID;
  const tEnvId = targetInstance ? (targetInstance.envId || URL_ENV_ID) : URL_ENV_ID;
  console.log("\n🎯 TARGET:");
  console.log("   Service:    " + (targetService ? targetService.name : "?") + "  id=" + tSvcId);
  console.log("   Instance:   " + (targetInstance ? targetInstance.name : "?") + "  id=" + tInstId + "  status=" + (targetInstance ? targetInstance.status : "?"));
  console.log("   Environment: " + (targetInstance && targetInstance.environment ? targetInstance.environment.name : "") + "  id=" + tEnvId);

  // Step 2: Variables
  console.log("\n🔐 Environment Variables (via serviceInstance variables)...");
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL", "DATABASE_URL",
    "SUPABASE_DB_URL", "PORT", "NEXT_PUBLIC_APP_URL", "NODE_OPTIONS",
  ];
  let vars = {};
  const vQ = await gql(`query SI($id: String!) { serviceInstance(id: $id) { id name variables }}`, { id: tInstId });
  if (vQ.data && vQ.data.data && vQ.data.data.serviceInstance && typeof vQ.data.data.serviceInstance.variables === "object") {
    vars = vQ.data.data.serviceInstance.variables || {};
    console.log("   (via serviceInstance " + tInstId.slice(0,10) + "...)");
  }
  // Fallback: query environment-wide serviceInstances
  if (Object.keys(vars).length === 0) {
    const eVQ = await gql(`query E($eid: String!) { environment(id: $eid) { id serviceInstances { edges { node { id serviceId variables } } } }`, { eid: tEnvId });
    if (eVQ.data && eVQ.data.data && eVQ.data.data.environment) {
      const edges = eVQ.data.data.environment.serviceInstances.edges || [];
      for (let i = 0; i < edges.length; i++) {
        const nd = edges[i].node;
        if (nd.id === tInstId || nd.serviceId === tSvcId) {
          if (nd.variables && typeof nd.variables === "object") { vars = nd.variables; break; }
        }
      }
    }
  }
  let missing = [];
  required.forEach(function(name) {
    const has = vars[name] && String(vars[name]).length > 0;
    const val = has ? String(vars[name]) : "";
    const mask = /KEY|SECRET|TOKEN|DATABASE|URL/.test(name.toUpperCase());
    if (has) {
      console.log("   ✅ " + name.padEnd(36) + (mask ? val.slice(0, 8) + "..." : val));
    } else {
      console.log("   ❌ " + name.padEnd(36) + " MISSING");
      missing.push(name);
    }
  });

  // Step 3: Deployments (50 latest, filter to week + target service)
  console.log("\n🚀 Deployments (past week)...");
  const dQ = await gql(`query D($pid: String!) { project(id: $pid) { deployments(first: 50) { edges { node {
    id status createdAt updatedAt environmentId serviceId meta
  }}}}}`, { pid: PROJECT_ID });
  let deps = [];
  if (dQ.data && dQ.data.data && dQ.data.data.project) {
    deps = (dQ.data.data.project.deployments.edges || []).map(function(e) { return e.node; });
  }
  const icons = { SUCCESS:"✅", FAILED:"❌", DEPLOYING:"🔄", BUILDING:"🔧", CRASHED:"💥", REMOVED:"🗑️", SLEEPING:"💤", INITIALIZING:"🌱", SKIPPED:"⏭️", DEPLOYED:"✅" };
  const weekDeps = deps.filter(function(d) { return new Date(d.createdAt) >= WEEK_AGO; })
                      .sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  const targetDeps = weekDeps.filter(function(d) { return d.serviceId === tSvcId; });
  const finalDeps = targetDeps.length > 0 ? targetDeps : weekDeps;
  let failed = null;
  let latest = finalDeps[0] || null;
  finalDeps.forEach(function(d, i) {
    const isTarget = d.serviceId === tSvcId;
    const icon = icons[d.status] || "❓";
    const meta = (typeof d.meta === "string" ? d.meta : JSON.stringify(d.meta || "")).slice(0, 80);
    console.log("   [" + (i+1) + "] " + icon + " " + (d.status || "?").padEnd(13) + prettyDate(d.createdAt) + " env=" + (d.environmentId || "").slice(0,10) + " svc=" + (d.serviceId || "").slice(0,10) + (isTarget ? " 👉" : "") + " id=" + d.id.slice(0,10));
    if (meta) console.log("       📝 " + meta);
    if (!failed && (d.status === "FAILED" || d.status === "CRASHED")) failed = d;
  });
  if (finalDeps.length === 0) console.log("   (none found this week)");
  console.log("\n   Latest: " + (latest ? latest.status + " @ " + prettyDate(latest.createdAt) : "none"));

  // Step 4: Collect all logs
  console.log("\n📋 Collecting deployment build + runtime logs...");
  let allLogs = [];
  for (let i = 0; i < Math.min(8, finalDeps.length); i++) {
    const d = finalDeps[i];
    const lg = await gql(`query D($id: String!) { deployment(id: $id) {
      buildLogs(last: 500) { timestamp level message }
      runtimeLogs(last: 800) { timestamp level message }
    }}`, { id: d.id });
    if (lg.data && lg.data.data && lg.data.data.deployment) {
      const node = lg.data.data.deployment;
      (node.buildLogs || []).forEach(function(l) { l._type="build"; l._depStatus=d.status; l._depId=d.id; allLogs.push(l); });
      (node.runtimeLogs || []).forEach(function(l) { l._type="runtime"; l._depStatus=d.status; l._depId=d.id; allLogs.push(l); });
    }
    // deploymentLogs alt
    const alt = await gql(`query D($id: String!) { deploymentLogs(deploymentId: $id, limit: 500) { timestamp level message }}`, { id: d.id });
    if (alt.data && alt.data.data && Array.isArray(alt.data.data.deploymentLogs)) {
      alt.data.data.deploymentLogs.forEach(function(l) { l._type="deploy"; l._depStatus=d.status; l._depId=d.id; allLogs.push(l); });
    }
  }
  // Current service instance runtime logs
  const siLg = await gql(`query S($id: String!) { serviceInstance(id: $id) { id runtimeLogs(last: 500) { timestamp level message } } }`, { id: tInstId });
  if (siLg.data && siLg.data.data && siLg.data.data.serviceInstance && Array.isArray(siLg.data.data.serviceInstance.runtimeLogs)) {
    siLg.data.data.serviceInstance.runtimeLogs.forEach(function(l) { l._type="instance"; allLogs.push(l); });
  }
  const weekTs = WEEK_AGO.getTime();
  const weekLogs = allLogs.filter(function(l) {
    if (!l.timestamp) return true;
    const t = new Date(l.timestamp).getTime();
    return isNaN(t) || t >= weekTs;
  });
  console.log("   Lines total: " + allLogs.length + "  past-week: " + weekLogs.length);

  // Step 5: Categorize
  console.log("\n🔍 Analysis (" + weekLogs.length + " lines)...");
  const cats = { oom: [], build: [], missingEnv: [], db: [], ts: [], mod: [], net: [], startup: [], other: [], warn: [] };
  weekLogs.forEach(function(l) {
    if (!l || !l.message) return;
    const msg = l.message, m = msg.toLowerCase();
    const lv = (l.level || "").toLowerCase();
    const isErr = lv === "error" || lv === "stderr" || lv === "fatal" || m.indexOf("error") !== -1 || m.indexOf("failed") !== -1;
    if (/out of memory|javascript heap|oom|memory limit/.test(m)) cats.oom.push(l);
    else if (/missing supabase|missing credentials|supabase environment variables/.test(m)) cats.missingEnv.push(l);
    else if (/(supabase|postgres|pg_|database|connection string|pool|sqlstate)/.test(m)) cats.db.push(l);
    else if (/(typescript| ts2\d{3}|typeerror|cannot find name|property does not exist|does not exist on type)/.test(m)) cats.ts.push(l);
    else if (/(module not found|cannot find module|npm err!|install failed)/.test(m)) cats.mod.push(l);
    else if (/(network|etimedout|econnrefused|enotfound|getaddrinfo|dns)/.test(m)) cats.net.push(l);
    else if (isErr && /(build|compil|webpack|tsc|next build)/.test(m)) cats.build.push(l);
    else if (isErr && /(server|crash|startup|listen|eaddrinuse|port)/.test(m)) cats.startup.push(l);
    else if (lv === "warning" || lv === "warn" || m.indexOf("warn") !== -1) cats.warn.push(l);
    else if (isErr) cats.other.push(l);
  });
  const showCat = function(title, arr, n) {
    if (arr.length === 0) return;
    console.log("\n   " + title + ": " + arr.length + " hits");
    arr.slice(-n).forEach(function(l) {
      const t = l.timestamp ? prettyDate(l.timestamp) : "";
      const lv = (l.level || "").padEnd(6);
      const src = l._type ? "[" + l._type + "]" : "";
      console.log("     " + src + " [" + t + "] [" + lv + "] " + l.message.slice(0, 280));
    });
  };
  showCat("🟥 OOM", cats.oom, 20);
  showCat("🟥 Build Errors", cats.build, 25);
  showCat("🟧 Missing Env/Supabase", cats.missingEnv, 25);
  showCat("🟧 DB/Supabase Errors", cats.db, 25);
  showCat("🟧 TypeScript Errors", cats.ts, 25);
  showCat("🟧 Node/Module Errors", cats.mod, 20);
  showCat("🟧 Network Errors", cats.net, 15);
  showCat("🟧 Startup/Crash", cats.startup, 25);
  showCat("🟨 Other Errors", cats.other, 25);
  showCat("Warnings", cats.warn, 10);

  // Deployment failure diagnosis
  const diagDep = failed || (latest && latest.status !== "SUCCESS" && latest.status !== "DEPLOYING" ? latest : null);
  if (diagDep) {
    console.log("\n🔎 Deployment diagnosis: " + diagDep.status + "  id=" + diagDep.id.slice(0,12) + "...");
    const dl = weekLogs.filter(function(l) { return l._depId === diagDep.id; });
    const joined = dl.map(function(l) { return (l.message || "").toLowerCase(); }).join(" ");
    if (/out of memory|javascript heap/.test(joined)) console.log("   🔥 ROOT CAUSE: OOM — increase service RAM (Railway → Service → Settings → Resources) to 2GB or 4GB");
    if (/typescript| ts2\d{3}|cannot find name/.test(joined)) console.log("   🔥 ROOT CAUSE: TypeScript build errors — run `npm run typecheck` locally to reproduce");
    if (/missing supabase|missing credentials/.test(joined)) console.log("   🔥 ROOT CAUSE: Missing Supabase env vars — set them (see below) + redeploy");
    if (/module not found|cannot find module/.test(joined)) console.log("   🔥 ROOT CAUSE: Missing node modules — verify package.json locally then re-push");
    if (diagDep.status === "FAILED") {
      console.log("\n   🧾 Last 30 lines of FAILED deployment:");
      const tail = dl.slice(-30);
      tail.forEach(function(l, i) {
        const src = l._type ? "[" + l._type + "]" : "";
        const t = l.timestamp ? prettyDate(l.timestamp) : "";
        const lv = (l.level || "").padEnd(6);
        console.log("     [" + String(i+1).padStart(2,"0") + "] " + src + " [" + t + "] [" + lv + "] " + (l.message || "").slice(0, 260));
      });
    }
  }

  // Final summary
  console.log("\n================================================================");
  console.log("              FINAL SUMMARY & FIXES");
  console.log("================================================================");
  console.log("Missing env vars:  " + (missing.length ? missing.join(", ") : "NONE ✅"));
  const totalIssues = cats.oom.length + cats.build.length + cats.missingEnv.length + cats.ts.length + cats.mod.length + cats.startup.length + cats.net.length + cats.other.length;
  console.log("Log issues found:   " + totalIssues);
  console.log("Deployments (week): " + finalDeps.length + (latest ? "  |  latest: " + latest.status : ""));
  if (failed) console.log("FAILED DEPLOY:      " + failed.id.slice(0,10) + "...");
  if (missing.length > 0) {
    console.log("\n❌ REQUIRED FIX — Set env vars in Railway:");
    console.log("   Open https://railway.com/project/" + PROJECT_ID + "/service/" + tSvcId + "?environmentId=" + tEnvId);
    console.log("   → Variables → Add:");
    console.log("   NEXT_PUBLIC_SUPABASE_URL=https://ehekzoioqvtweugemktn.supabase.co");
    console.log("   SUPABASE_URL=https://ehekzoioqvtweugemktn.supabase.co");
    console.log("   NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase Dashboard → Settings → API → Project API keys → anon (public)>");
    console.log("   SUPABASE_SERVICE_ROLE_KEY=<Supabase → Settings → API → Project API keys → service_role (secret)>");
    console.log("   DATABASE_URL=<Supabase → Settings → Database → Connection string (Direct)>");
    console.log("   PORT=3000");
    console.log("   NEXT_PUBLIC_APP_URL=https://<your railway domain or your own domain>");
    console.log("   NODE_OPTIONS=--max-old-space-size=12288");
    console.log("\n   ⚠️  After setting → Redeploy service (Cmd+K on Railway → 'Redeploy')");
  }
  if (cats.oom.length > 0) {
    console.log("\n💥 OOM KILLS DETECTED:");
    console.log("   → Railway → Service → Settings → Resources → RAM → 2 GB or 4 GB");
    console.log("   → Set NODE_OPTIONS=--max-old-space-size=12288 env var (build script also sets this)");
  }
  if (cats.ts.length > 0) {
    console.log("\n🧩 TYPESCRIPT BUILD FAILURES:");
    console.log("   Run locally first:  npm run typecheck");
    console.log("   Fix errors, commit and push to redeploy.");
  }
  if (cats.mod.length > 0) {
    console.log("\n📦 MODULE ERRORS:");
    console.log("   Run: rm -rf node_modules package-lock.json && npm install && npm run build locally to reproduce");
  }
  console.log("");
}

main().catch(function(e) { console.error("FATAL:", e); process.exit(1); });
