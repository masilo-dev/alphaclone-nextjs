#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");

const envContent = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const [k, ...v] = line.split("=");
  const key = k.trim();
  if (key && !key.startsWith("#")) {
    env[key] = v.join("=").trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
  }
}

const RAILWAY_TOKEN = env.RAILWAY_TOKEN || process.env.RAILWAY_TOKEN;
const RAILWAY_PROJECT_ID = env.RAILWAY_PROJECT_ID || process.env.RAILWAY_PROJECT_ID;

function request(method, pathName, body) {
  return new Promise(function(resolve) {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "backboard.railway.app",
      port: 443,
      path: pathName,
      method: method,
      headers: {
        "Authorization": "Bearer " + RAILWAY_TOKEN,
        "Content-Type": "application/json",
      },
    };
    if (postData) options.headers["Content-Length"] = Buffer.byteLength(postData);
    const req = https.request(options, function(res) {
      let buf = "";
      res.on("data", function(c) { buf += c; });
      res.on("end", function() {
        try { resolve({ status: res.statusCode, data: JSON.parse(buf) }); }
        catch (e) { resolve({ status: res.statusCode, raw: buf }); }
      });
    });
    req.on("error", function(e) { resolve({ status: 500, error: e.message }); });
    req.setTimeout(30000, function() { req.destroy(new Error("timeout")); });
    if (postData) req.write(postData);
    req.end();
  });
}

function gql(query, variables) {
  return request("POST", "/graphql/v2", { query: query, variables: variables });
}

function showErrors(res) {
  if (res.data && res.data.errors) {
    res.data.errors.forEach(function(e) { console.log("      GQL Err: " + e.message); });
  }
  if (res.raw && res.raw.length < 1000) console.log("      Raw: " + res.raw);
}

async function main() {
  console.log("================================================================");
  console.log("                Railway Project Diagnostics                     ");
  console.log("================================================================");

  // 1. Project info (simple)
  console.log("\n📁 Project (" + RAILWAY_PROJECT_ID + ")...");
  const pRes = await gql(`
    query P($id: String!) {
      project(id: $id) {
        id name createdAt updatedAt
        environments { edges { node { id name } } }
        services { edges { node { id name } } }
      }
    }`, { id: RAILWAY_PROJECT_ID });
  if (!pRes.data || !pRes.data.data) {
    console.log("   ❌ HTTP " + pRes.status); showErrors(pRes); process.exit(1);
  }
  const P = pRes.data.data.project;
  console.log("   ✅ " + P.name);
  const envs = P.environments.edges.map(function(e) { return e.node; });
  const services = P.services.edges.map(function(e) { return e.node; });
  console.log("   Envs: " + envs.map(function(e) { return e.name; }).join(", "));
  console.log("   Services: " + services.map(function(s) { return s.name; }).join(", "));

  const prod = envs.find(function(e) { return e.name.toLowerCase().indexOf("prod") === 0 || e.name.toLowerCase() === "production"; });
  const envId = prod ? prod.id : envs[0].id;
  console.log("   Using env: " + (prod ? prod.name : envs[0].name));

  // 2. Check service env vars (list services first, then try variables endpoint)
  console.log("\n🔐 Environment Variables...");
  const requiredVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_URL",
    "DATABASE_URL",
  ];
  let foundMissing = [];

  for (let i = 0; i < services.length; i++) {
    const svc = services[i];
    console.log("\n   Service: " + svc.name);
    try {
      const vRes = await gql(`
        query V($sid: String!, $eid: String!) {
          service(id: $sid, environmentId: $eid) {
            id
            serviceVariables {
              edges { node { name value source } }
            }
          }
        }`, { sid: svc.id, eid: envId });

      let vars = {};
      if (vRes.data && vRes.data.data && vRes.data.data.service) {
        vRes.data.data.service.serviceVariables.edges.forEach(function(ed) {
          vars[ed.node.name] = ed.node;
        });
      } else {
        // Try serviceInstance
        const iRes = await gql(`
          query VI($sid: String!, $eid: String!) {
            serviceInstance(serviceId: $sid, environmentId: $eid) {
              id
              serviceVariables {
                edges { node { name value source } }
              }
            }
          }`, { sid: svc.id, eid: envId });
        if (iRes.data && iRes.data.data && iRes.data.data.serviceInstance) {
          iRes.data.data.serviceInstance.serviceVariables.edges.forEach(function(ed) {
            vars[ed.node.name] = ed.node;
          });
        } else {
          console.log("      ⚠️  Cannot fetch vars for this service");
          showErrors(vRes); showErrors(iRes);
          continue;
        }
      }

      requiredVars.forEach(function(name) {
        const has = vars[name] && vars[name].value && String(vars[name].value).length > 0;
        const src = has ? vars[name].source : "";
        const val = has ? String(vars[name].value) : "";
        if (has) {
          console.log("      ✅ " + name.padEnd(35) + " (" + src + ") " + val.slice(0, 6) + "...");
        } else {
          console.log("      ❌ " + name.padEnd(35) + " MISSING");
          foundMissing.push({ service: svc.name, name: name });
        }
      });
    } catch (e) {
      console.log("      Err: " + e.message);
    }
  }

  // 3. Recent deployments
  console.log("\n🚀 Recent Deployments...");
  const dRes = await gql(`
    query D($pid: String!) {
      project(id: $pid) {
        deployments(first: 5) {
          edges { node {
            id status createdAt startedAt endedAt
            environmentId
            meta { message branch }
          }}
        }
      }
    }`, { pid: RAILWAY_PROJECT_ID });
  let latestDepId = null;
  if (dRes.data && dRes.data.data && dRes.data.data.project) {
    const deps = dRes.data.data.project.deployments.edges.map(function(d) { return d.node; });
    if (deps.length > 0) latestDepId = deps[0].id;
    deps.forEach(function(d, i) {
      const m = ((d.meta || {}).message || "(no msg)").slice(0, 70);
      const br = (d.meta || {}).branch || "";
      const time = new Date(d.startedAt || d.createdAt).toLocaleString();
      console.log("   [" + (i + 1) + "] " + (d.status || "?").padEnd(13) + " " + time);
      console.log("      📝 " + m + (br ? "  (🌿" + br + ")" : ""));
    });
  } else {
    showErrors(dRes);
  }

  // 4. Deployment logs
  if (latestDepId) {
    console.log("\n📋 Deployment logs (latest deployment) — errors & warnings...");
    // Try multiple queries: deploymentLogs vs build logs vs runtime logs
    let logLines = [];
    const logQ = await gql(`
      query L($did: String!, $limit: Int!) {
        deploymentLogs(deploymentId: $did, limit: $limit) {
          timestamp level message
        }
      }`, { did: latestDepId, limit: 300 });
    if (logQ.data && logQ.data.data && logQ.data.data.deploymentLogs) {
      logLines = logQ.data.data.deploymentLogs;
    }
    if (logLines.length === 0) {
      // Try buildLogs + runtimeLogs combined
      const bQ = await gql(`
        query B($did: String!) {
          deployment(id: $did) {
            buildLogs(last: 200) { timestamp level message }
            runtimeLogs(last: 200) { timestamp level message }
          }
        }`, { did: latestDepId });
      if (bQ.data && bQ.data.data && bQ.data.data.deployment) {
        const bl = (bQ.data.data.deployment.buildLogs || []).map(function(l) { l._src = "build"; return l; });
        const rl = (bQ.data.data.deployment.runtimeLogs || []).map(function(l) { l._src = "run"; return l; });
        logLines = bl.concat(rl).sort(function(a, b) { return (a.timestamp || "").localeCompare(b.timestamp || ""); });
      }
    }

    if (logLines.length > 0) {
      const issues = logLines.filter(function(l) {
        if (!l.message) return false;
        const m = l.message.toLowerCase();
        const badLevel = ["error", "stderr", "fatal", "crit"].indexOf((l.level || "").toLowerCase()) !== -1;
        const badContent = m.indexOf("error") !== -1 || m.indexOf("fail") !== -1 ||
                           m.indexOf("missing") !== -1 || m.indexOf("warn") !== -1 ||
                           m.indexOf("denied") !== -1 || m.indexOf("supabase") !== -1 ||
                           m.indexOf("cannot") !== -1 || m.indexOf("env") !== -1;
        return badLevel || badContent;
      });
      if (issues.length === 0) {
        console.log("   ✅ No error/warning lines in deployment logs (" + logLines.length + " total lines)");
      } else {
        const recent = issues.slice(-30);
        recent.forEach(function(l) {
          const t = l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : "";
          const src = l._src ? "[" + l._src + "]" : "";
          const lv = (l.level || "info").padEnd(7);
          console.log("   " + src + "[" + t + "][" + lv + "] " + l.message.slice(0, 240));
        });
        console.log("\n   ↑ " + issues.length + " issue lines shown of " + logLines.length + " total (showing last " + recent.length + ")");
      }
    } else {
      console.log("   ⚠️  Could not fetch deployment logs");
      showErrors(logQ);
    }
  }

  // 5. Summary
  console.log("\n================================================================");
  console.log("                    Railway Summary & Fixes                      ");
  console.log("================================================================");
  if (foundMissing.length === 0) {
    console.log("✅ All critical Supabase env vars are set for all Railway services!");
  } else {
    console.log("❌ MISSING Supabase env vars — THIS causes the 'Missing Supabase creds'");
    console.log("   errors you saw in production logs! FIX THEM NOW:");
    console.log("");
    console.log("   👉 Go to: https://railway.com/project/" + RAILWAY_PROJECT_ID);
    console.log("      → Click each service → Variables → Add the following:");
    console.log("");
    const svcs = {};
    foundMissing.forEach(function(x) { (svcs[x.service] = svcs[x.service] || []).push(x.name); });
    Object.keys(svcs).forEach(function(sname) {
      console.log("   Service: " + sname);
      svcs[sname].forEach(function(n) { console.log("      + " + n); });
    });
    console.log("");
    console.log("   Values to set:");
    console.log("   NEXT_PUBLIC_SUPABASE_URL = https://ehekzoioqvtweugemktn.supabase.co");
    console.log("   SUPABASE_URL             = https://ehekzoioqvtweugemktn.supabase.co");
    console.log("   NEXT_PUBLIC_SUPABASE_ANON_KEY = <Supabase Dashboard → Settings → API → Project API keys → anon public>");
    console.log("   SUPABASE_SERVICE_ROLE_KEY    = <Supabase Dashboard → Settings → API → Project API keys → service_role>");
    console.log("   DATABASE_URL            = <Supabase Dashboard → Settings → Database → Connection string / Direct>");
    console.log("");
    console.log("   ⚠️  After setting vars, you MUST REDEPLOY each service!");
    console.log("      (Railway only injects env at build + startup time)");
    console.log("");
    console.log("   Bonus: Also check in Vercel! The original error logs were from Vercel deployments:");
    console.log("   → Vercel → Project → Settings → Environment Variables");
    console.log("     (alphaclone-nextjs-*.vercel.app domains were in error logs)");
  }
  console.log("");
}

main().catch(function(e) { console.error("FATAL:", e); process.exit(1); });
