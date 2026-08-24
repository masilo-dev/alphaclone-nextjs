#!/usr/bin/env node
/**
 * Targeted Railway Diagnostics
 * Service: a98fc4dc-4047-4647-a74a-985f6ff667ce
 * Env:     78325a44-cd94-4b10-aa41-c09ebd978c7f
 * Project: c75eaf5f-1ec8-4565-b3b6-8e318f1251bd
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const SERVICE_ID = "a98fc4dc-4047-4647-a74a-985f6ff667ce";
const ENV_ID = "78325a44-cd94-4b10-aa41-c09ebd978c7f";
const PROJECT_ID = "c75eaf5f-1ec8-4565-b3b6-8e318f1251bd";

// 7 days ago (past week)
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
if (!TOKEN) { console.error("❌ RAILWAY_TOKEN missing"); process.exit(1); }

function httpsRequest(method, hostname, pathName, headers, body) {
  return new Promise(function(resolve) {
    const postData = body ? (typeof body === "string" ? body : JSON.stringify(body)) : null;
    const opts = {
      hostname: hostname,
      port: 443,
      path: pathName,
      method: method,
      headers: Object.assign({ "Content-Type": "application/json" }, headers || {}),
    };
    if (postData) opts.headers["Content-Length"] = Buffer.byteLength(postData);
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
    if (postData) req.write(postData);
    req.end();
  });
}

function gql(query, variables) {
  return httpsRequest(
    "POST", "backboard.railway.app", "/graphql/v2",
    { Authorization: "Bearer " + TOKEN },
    { query: query, variables: variables || {} }
  );
}

function restGET(restPath) {
  return httpsRequest(
    "GET", "public-api.railway.app", "/v1" + restPath,
    { Authorization: "Bearer " + TOKEN }
  );
}

function prettyDate(d) {
  return new Date(d).toLocaleString();
}

async function fetchEnvVars() {
  console.log("\n🔐 Service Environment Variables (REST)...");
  const r = await restGET(
    "/services/" + SERVICE_ID + "/environments/" + ENV_ID + "/variables"
  );
  const vars = {};
  if (r.status >= 200 && r.status < 300 && r.data) {
    const list = Array.isArray(r.data) ? r.data : (r.data.data || r.data.variables || []);
    list.forEach(function(v) {
      const name = v.name || v.key;
      const value = v.value;
      const source = v.source || v.scope || "service";
      if (name) vars[name] = { value: value, source: source };
    });
  } else {
    // Try GraphQL fallback
    const g = await gql(`
      query SI($sid: String!, $eid: String!) {
        serviceInstance(serviceId: $sid, environmentId: $eid) {
          id
          variables
        }
      }`, { sid: SERVICE_ID, eid: ENV_ID });
    if (g.data && g.data.data && g.data.data.serviceInstance) {
      const s = g.data.data.serviceInstance;
      if (s && s.variables && typeof s.variables === "object") {
        Object.keys(s.variables).forEach(function(k) {
          vars[k] = { value: s.variables[k], source: "gql" };
        });
      }
    }
    if (Object.keys(vars).length === 0) {
      console.log("   ⚠️  Could not fetch variables via REST or GQL");
      if (r.raw && r.raw.length < 1000) console.log("   REST: " + r.status + " " + r.raw);
    }
  }

  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_URL",
    "DATABASE_URL",
    "SUPABASE_DB_URL",
    "PORT",
    "NEXT_PUBLIC_APP_URL",
  ];
  let missing = [];
  required.forEach(function(name) {
    const has = vars[name] && String(vars[name].value || "").length > 0;
    const val = has ? String(vars[name].value) : "";
    const src = has ? vars[name].source : "";
    if (has) {
      console.log("   ✅ " + name.padEnd(36) + " (" + src + ") " +
        (name.indexOf("KEY") !== -1 || name.indexOf("URL") !== -1 || name.indexOf("DATABASE") !== -1
          ? val.slice(0, 8) + "..."
          : val));
    } else {
      console.log("   ❌ " + name.padEnd(36) + " MISSING");
      missing.push(name);
    }
  });
  return { vars: vars, missing: missing };
}

async function fetchDeployments() {
  console.log("\n🚀 Deployments (past week)...");
  const q = await gql(`
    query D($pid: String!, $sid: String!, $eid: String!) {
      project(id: $pid) {
        deployments(first: 50) {
          edges { node {
            id status createdAt updatedAt environmentId serviceId
            meta
          }}
        }
      }
    }`, { pid: PROJECT_ID, sid: SERVICE_ID, eid: ENV_ID });
  let deps = [];
  if (q.data && q.data.data && q.data.data.project) {
    const edges = q.data.data.project.deployments.edges || [];
    deps = edges
      .map(function(e) { return e.node; })
      .filter(function(d) {
        // Match our service + env
        return d.serviceId === SERVICE_ID && d.environmentId === ENV_ID
          && new Date(d.createdAt) >= WEEK_AGO;
      })
      .sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  }
  if (deps.length === 0) {
    console.log("   ⚠️  No deployments found for this service/env in past week via GQL filter. Falling back to all.");
    if (q.data && q.data.data && q.data.data.project) {
      deps = (q.data.data.project.deployments.edges || [])
        .map(function(e) { return e.node; })
        .filter(function(d) { return new Date(d.createdAt) >= WEEK_AGO; })
        .sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    }
  }

  const statusIcons = {
    SUCCESS: "✅", FAILED: "❌", DEPLOYING: "🔄", BUILDING: "🔧",
    REMOVED: "🗑️", CRASHED: "💥", SLEEPING: "💤", INITIALIZING: "🌱",
    SKIPPED: "⏭️",
  };
  deps.forEach(function(d, i) {
    const icon = statusIcons[d.status] || "❓";
    const metaStr = (typeof d.meta === "string" ? d.meta : (JSON.stringify(d.meta || ""))).slice(0, 70);
    console.log("   [" + (i + 1) + "] " + icon + " " + (d.status || "?").padEnd(13) +
      " " + prettyDate(d.createdAt) + "  id=" + d.id.slice(0, 8) + "...");
    if (metaStr) console.log("       📝 " + metaStr);
  });
  return deps;
}

async function fetchDeploymentLogs(deploymentId, label) {
  console.log("\n📋 Logs: " + label + " (deployment " + deploymentId.slice(0, 10) + "...)");
  let allLines = [];
  // Try deploymentLogs
  const dQ = await gql(`
    query L($did: String!, $limit: Int!) {
      deploymentLogs(deploymentId: $did, limit: $limit) {
        timestamp level message
      }
    }`, { did: deploymentId, limit: 800 });
  if (dQ.data && dQ.data.data && Array.isArray(dQ.data.data.deploymentLogs) && dQ.data.data.deploymentLogs.length > 0) {
    allLines = dQ.data.data.deploymentLogs;
  } else {
    // Try build + runtime logs on deployment
    const bQ = await gql(`
      query B($did: String!) {
        deployment(id: $did) {
          buildLogs(last: 500) { timestamp level message }
          runtimeLogs(last: 500) { timestamp level message }
        }
      }`, { did: deploymentId });
    if (bQ.data && bQ.data.data && bQ.data.data.deployment) {
      const bl = (bQ.data.data.deployment.buildLogs || []).map(function(l) { l._type = "build"; return l; });
      const rl = (bQ.data.data.deployment.runtimeLogs || []).map(function(l) { l._type = "runtime"; return l; });
      allLines = bl.concat(rl).sort(function(a, b) {
        return (a.timestamp || "").localeCompare(b.timestamp || "");
      });
    }
  }
  return allLines;
}

async function fetchCurrentInstanceLogs() {
  console.log("\n📡 Current Instance Logs (past 7 days)...");
  // Try service instance runtime logs via environment + service
  const lines = [];
  const tries = [
    {
      name: "serviceInstance.runtimeLogs",
      q: `query S($sid: String!, $eid: String!) {
        serviceInstance(serviceId: $sid, environmentId: $eid) {
          id
          runtimeLogs(last: 500) { timestamp level message }
        }
      }`,
      v: { sid: SERVICE_ID, eid: ENV_ID },
      path: ["serviceInstance", "runtimeLogs"],
    },
  ];
  for (let i = 0; i < tries.length; i++) {
    const t = tries[i];
    const r = await gql(t.q, t.v);
    if (r.data && r.data.data) {
      let nested = r.data.data;
      for (let k = 0; k < t.path.length; k++) nested = nested ? nested[t.path[k]] : null;
      if (Array.isArray(nested) && nested.length > 0) {
        nested.forEach(function(l) { l._type = "instance"; lines.push(l); });
        console.log("   Got " + nested.length + " lines via " + t.name);
        break;
      }
    }
  }
  return lines;
}

function analyzeLogs(allLines) {
  console.log("\n🔍 Log Analysis (" + allLines.length + " total lines)...");
  const categories = {
    buildErrors: [],
    missingEnv: [],
    dbErrors: [],
    typeErrors: [],
    oom: [],
    networkErrors: [],
    nodeModuleErrors: [],
    startupErrors: [],
    warnings: [],
    supabase: [],
    otherErrors: [],
  };
  allLines.forEach(function(l) {
    if (!l || !l.message) return;
    const msg = l.message;
    const m = msg.toLowerCase();
    const src = l._type ? "[" + l._type + "]" : "";
    const lv = (l.level || "").toLowerCase();
    const isError = lv === "error" || lv === "stderr" || lv === "fatal" ||
      m.indexOf("error") !== -1 || m.indexOf("failed") !== -1;
    const isWarn = lv === "warning" || lv === "warn" || m.indexOf("warning") !== -1;

    if (m.indexOf("out of memory") !== -1 || m.indexOf("heap out of memory") !== -1 ||
        m.indexOf("javascript heap out of memory") !== -1 || m.indexOf("oom") !== -1) {
      categories.oom.push({ line: l, src: src });
    } else if (m.indexOf("missing supabase") !== -1 || m.indexOf("supabase creds") !== -1 ||
               m.indexOf("missing credentials") !== -1 || m.indexOf("supabase environment variables") !== -1) {
      categories.missingEnv.push({ line: l, src: src });
    } else if (m.indexOf("supabase") !== -1 || m.indexOf("postgres") !== -1 ||
               m.indexOf("pg_") !== -1 || m.indexOf("connection refused") !== -1 ||
               m.indexOf("database") !== -1) {
      categories.dbErrors.push({ line: l, src: src });
    } else if (m.indexOf("typescript") !== -1 || m.indexOf("ts23") !== -1 ||
               m.indexOf("typeerror") !== -1 || m.indexOf("cannot find name") !== -1 ||
               m.indexOf("property does not exist") !== -1) {
      categories.typeErrors.push({ line: l, src: src });
    } else if (m.indexOf("module not found") !== -1 || m.indexOf("cannot find module") !== -1 ||
               m.indexOf("node_modules") !== -1 || m.indexOf("npm err") !== -1) {
      categories.nodeModuleErrors.push({ line: l, src: src });
    } else if (m.indexOf("network") !== -1 || m.indexOf("etimedout") !== -1 ||
               m.indexOf("econnrefused") !== -1 || m.indexOf("enotfound") !== -1 ||
               m.indexOf("getaddrinfo") !== -1) {
      categories.networkErrors.push({ line: l, src: src });
    } else if (m.indexOf("build failed") !== -1 || m.indexOf("next build") !== -1 ||
               m.indexOf("compilation") !== -1 || m.indexOf("webpack") !== -1) {
      categories.buildErrors.push({ line: l, src: src });
    } else if (m.indexOf("server") !== -1 && (m.indexOf("error") !== -1 || m.indexOf("crash") !== -1)) {
      categories.startupErrors.push({ line: l, src: src });
    } else if (isWarn) {
      categories.warnings.push({ line: l, src: src });
    } else if (isError) {
      categories.otherErrors.push({ line: l, src: src });
    }
  });

  const reportSummary = function(name, arr, maxShow) {
    if (arr.length === 0) return;
    console.log("\n   ⚠️  " + name + ": " + arr.length + " hits");
    arr.slice(-maxShow).forEach(function(entry) {
      const l = entry.line;
      const t = l.timestamp ? prettyDate(l.timestamp) : "";
      const lv = (l.level || "").padEnd(6);
      const src = entry.src || "";
      console.log("      " + src + " [" + t + "] [" + lv + "] " + l.message.slice(0, 280));
    });
  };

  reportSummary("🟥 OOM (Out of Memory)", categories.oom, 15);
  reportSummary("🟥 Build Errors", categories.buildErrors, 20);
  reportSummary("🟧 Missing Supabase / Env Vars", categories.missingEnv, 20);
  reportSummary("🟧 DB / Postgres / Supabase Errors", categories.dbErrors, 20);
  reportSummary("🟧 TypeScript / Type Errors", categories.typeErrors, 20);
  reportSummary("🟧 Node Module / Install Errors", categories.nodeModuleErrors, 20);
  reportSummary("🟧 Network Errors", categories.networkErrors, 15);
  reportSummary("🟧 Startup / Server Crash", categories.startupErrors, 20);
  reportSummary("🟨 Other Errors", categories.otherErrors, 25);
  reportSummary("W-only Warnings", categories.warnings, 10);

  return categories;
}

function diagnoseDeploymentFailure(deployment, logs) {
  console.log("\n🔎 Deployment Failure Diagnosis for: " + deployment.id.slice(0, 10) +
    "... (status " + deployment.status + ")");
  const msgs = logs.map(function(l) { return (l.message || "").toLowerCase(); }).join(" ");

  if (msgs.indexOf("out of memory") !== -1 || msgs.indexOf("oom") !== -1 ||
      msgs.indexOf("heap out of memory") !== -1) {
    console.log("   🔥 ROOT CAUSE: Out of Memory (OOM) during build or runtime");
    console.log("      Fix: Increase NODE_OPTIONS='--max-old-space-size=12288' in Railway vars (already in build script)");
    console.log("      Or increase Railway service RAM (Deploy → Service → Settings → Resources)");
  }
  if (msgs.indexOf("missing supabase") !== -1 || msgs.indexOf("supabase creds") !== -1) {
    console.log("   🔥 ROOT CAUSE: Missing Supabase env vars at runtime");
    console.log("      Fix: Set NEXT_PUBLIC_SUPABASE_URL / SERVICE_ROLE_KEY / DATABASE_URL (see earlier)");
  }
  if (msgs.indexOf("typescript") !== -1 || msgs.indexOf("ts2") !== -1 || msgs.indexOf("cannot find name") !== -1) {
    console.log("   🔥 ROOT CAUSE: TypeScript compile errors during build");
    console.log("      Fix: Run `npm run typecheck` locally, fix errors, push new commit");
  }
  if (msgs.indexOf("module not found") !== -1 || msgs.indexOf("cannot find module") !== -1) {
    console.log("   🔥 ROOT CAUSE: Missing npm dependencies or broken node_modules");
    console.log("      Fix: Verify package.json, push new commit to rebuild");
  }
  if (msgs.indexOf("next build") !== -1 && (msgs.indexOf("error") !== -1 || msgs.indexOf("failed") !== -1)) {
    console.log("   🔥 ROOT CAUSE: `next build` failed (see build errors above)");
    console.log("      Fix: Run `npm run build` locally to reproduce");
  }
  if (msgs.indexOf("build failed") !== -1) {
    console.log("   🔥 Build explicitly reported failure");
  }
  if (deployment.status === "FAILED") {
    // Look for the last 20 messages before failure
    const tail = logs.slice(-30);
    console.log("\n   🧾 Last 30 log lines before end:");
    tail.forEach(function(l, i) {
      const src = l._type ? "[" + l._type + "]" : "";
      const t = l.timestamp ? prettyDate(l.timestamp) : "";
      const lv = (l.level || "").padEnd(6);
      console.log("      [" + (i + 1).toString().padStart(2, "0") + "] " +
        src + " [" + t + "] [" + lv + "] " + (l.message || "").slice(0, 260));
    });
  }
}

async function main() {
  console.log("================================================================");
  console.log("   RAILWAY DEEP DIAGNOSTICS — Past Week + Deployment Failure    ");
  console.log("================================================================");
  console.log("Project:   " + PROJECT_ID);
  console.log("Service:   " + SERVICE_ID);
  console.log("Env:       " + ENV_ID);
  console.log("Window:    " + prettyDate(WEEK_AGO) + " → NOW");

  // 1. Env vars
  const { vars, missing } = await fetchEnvVars();

  // 2. Deployments (past week)
  const deps = await fetchDeployments();
  if (deps.length === 0) {
    console.log("   ⚠️  No deployments found this week — checking for service status directly.");
  }

  // 3. Collect logs from ALL deployments this week + current instance
  let allLogs = [];
  let failedDep = null;
  let latestDep = null;
  if (deps.length > 0) {
    latestDep = deps[0];
    failedDep = deps.find(function(d) { return d.status === "FAILED" || d.status === "CRASHED"; }) || null;
    for (let i = 0; i < deps.length; i++) {
      const d = deps[i];
      const logs = await fetchDeploymentLogs(d.id,
        "#" + (i + 1) + " " + (d.status || "?") + " (" + prettyDate(d.createdAt) + ")");
      logs.forEach(function(l) { l._depId = d.id; l._depStatus = d.status; });
      allLogs = allLogs.concat(logs);
    }
  }

  // 4. Current instance runtime logs
  const inst = await fetchCurrentInstanceLogs();
  allLogs = allLogs.concat(inst);

  // 5. Filter to past 7 days
  const weekAgoTs = WEEK_AGO.getTime();
  const weekLogs = allLogs.filter(function(l) {
    if (!l.timestamp) return true; // keep if no timestamp
    const ts = new Date(l.timestamp).getTime();
    return isNaN(ts) || ts >= weekAgoTs;
  });
  console.log("\n📊 Log count this week: " + weekLogs.length);

  // 6. Analyze
  const cat = analyzeLogs(weekLogs);

  // 7. Diagnose specific failure
  if (failedDep) {
    diagnoseDeploymentFailure(failedDep, weekLogs.filter(function(l) {
      return l._depId === failedDep.id;
    }));
  } else if (latestDep && latestDep.status !== "SUCCESS" && latestDep.status !== "DEPLOYING") {
    console.log("\n⚠️  No FAILED/CRASHED deployments — but latest is status=" + latestDep.status);
    diagnoseDeploymentFailure(latestDep, weekLogs.filter(function(l) {
      return l._depId === latestDep.id;
    }));
  }

  // 8. Final summary
  console.log("\n================================================================");
  console.log("                      FINAL SUMMARY & FIXES                     ");
  console.log("================================================================");
  console.log("Service vars missing: " + (missing.length ? missing.join(", ") : "✅ NONE"));
  const totalIssues =
    cat.oom.length + cat.buildErrors.length + cat.missingEnv.length +
    cat.dbErrors.length + cat.typeErrors.length + cat.nodeModuleErrors.length +
    cat.startupErrors.length + cat.networkErrors.length + cat.otherErrors.length;
  console.log("Log issues found:   " + totalIssues);

  if (missing.length > 0) {
    console.log("\n❌ ACTION REQUIRED: Add missing env vars to Railway → Service → Variables");
    console.log("   Values:");
    console.log("   NEXT_PUBLIC_SUPABASE_URL = https://ehekzoioqvtweugemktn.supabase.co");
    console.log("   SUPABASE_URL             = https://ehekzoioqvtweugemktn.supabase.co");
    console.log("   NEXT_PUBLIC_SUPABASE_ANON_KEY = <Supabase Dashboard → Settings → API → anon>");
    console.log("   SUPABASE_SERVICE_ROLE_KEY    = <Supabase Dashboard → Settings → API → service_role>");
    console.log("   DATABASE_URL            = <Supabase → Settings → Database → Direct conn string>");
  }
  if (cat.oom.length > 0) {
    console.log("\n💥 OOM KILLS DETECTED (" + cat.oom.length + "):");
    console.log("   Fix 1: Railway → Service → Resources → increase RAM (e.g., from 512MB to 2GB/4GB)");
    console.log("   Fix 2: Ensure NODE_OPTIONS env var is set to --max-old-space-size=12288");
    console.log("   Fix 3: Build script already sets this, but confirm start command is `npm start`");
  }
  if (cat.typeErrors.length > 0) {
    console.log("\n🧩 TYPESCRIPT BUILD ERRORS (" + cat.typeErrors.length + "):");
    console.log("   Run locally: `npm run typecheck` — fix errors, push");
  }
  if (cat.nodeModuleErrors.length > 0) {
    console.log("\n📦 MODULE RESOLUTION ERRORS (" + cat.nodeModuleErrors.length + "):");
    console.log("   Likely: missing deps in package.json, or bad postinstall. Locally: `npm install` then `npm run build`");
  }
  if (failedDep) {
    console.log("\n🆘 Deploy " + failedDep.id.slice(0,10) + "... STATUS=" + failedDep.status +
      " — check Railway deploy UI for status details, then redeploy after fixes.");
  }
  console.log("");
}

main().catch(function(e) { console.error("FATAL:", e); process.exit(1); });
