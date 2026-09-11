#!/usr/bin/env node
/**
 * Railway Log Field PROBE v2
 * - Introspect return types of buildLogs/deploymentLogs/environmentLogs
 * - Try with different argument combos + pagination
 * - Try environmentLogs with correct parameters: afterLimit/beforeLimit, anchorDate + afterDate/beforeDate pairs
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const PROJECT_ID = "c75eaf5f-1ec8-4565-b3b6-8e318f1251bd";
const SVC_ID = "a98fc4dc-4047-4647-a74a-985f6ff667ce";
const ENV_ID = "78325a44-cd94-4b10-aa41-c09ebd978c7f";

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
    req.setTimeout(60000, function() { req.destroy(new Error("HTTP timeout")); });
    req.write(postData);
    req.end();
  });
}

(async function main() {
  // ============== 1: INTROSPECT RETURN TYPES OF LOG ENDPOINTS ==============
  console.log("Step 1: Introspect return types of log endpoints...");
  const schemaQ = await gql(`{ __schema {
    queryType {
      fields {
        name
        type { name kind ofType { name kind ofType { name kind } } }
        args { name type { name kind ofType { name kind ofType { name kind } } } defaultValue }
      }
    }
    types {
      name
      kind
      fields {
        name
        type { name kind ofType { name kind } }
      }
    }
  }}`);
  let logReturnTypes = {};
  if (schemaQ.data && schemaQ.data.data && schemaQ.data.data.__schema) {
    const qfs = schemaQ.data.data.__schema.queryType.fields || [];
    const types = schemaQ.data.data.__schema.types || [];
    qfs.filter(function(f) { return /(logs|events)$/.test(f.name); }).forEach(function(f) {
      const rtn = f.type.name || (f.type.ofType && (f.type.ofType.name || (f.type.ofType.ofType && f.type.ofType.ofType.name))) || "?";
      console.log("   Query." + f.name.padEnd(28) + " returns: " + rtn + "  args=" + f.args.map(function(a) { return a.name + ":" + (a.type.name || (a.type.ofType ? a.type.ofType.name : "?")); }).join(", "));
      logReturnTypes[f.name] = rtn;
    });
    // Find types with "Log" or "Edge" in name
    console.log("\nStep 2: Types with Log in name:");
    types.filter(function(t) { return /log/i.test(t.name); }).forEach(function(t) {
      console.log("   type " + t.name + " (" + t.kind + "):");
      (t.fields || []).forEach(function(f) {
        const tn = f.type.name || (f.type.ofType && f.type.ofType.name) || "";
        console.log("     • " + f.name.padEnd(22) + " " + tn);
      });
    });
  }

  // ============== 2: GET A DEPLOYMENT ID ==============
  const dQ = await gql(`query D($pid: String!) { project(id: $pid) {
    deployments(first: 10) { edges { node { id status createdAt serviceId }}}
  }}`, { pid: PROJECT_ID });
  let anyDep = null; let lastSuccess = null; let lastFailed = null;
  if (dQ.data && dQ.data.data && dQ.data.data.project) {
    const deps = dQ.data.data.project.deployments.edges.map(function(e) { return e.node; });
    anyDep = deps[0];
    deps.slice().reverse().forEach(function(d) {
      if ((d.status === "SUCCESS" || d.status === "DEPLOYED") && !lastSuccess) lastSuccess = d;
      if ((d.status === "FAILED" || d.status === "CRASHED") && !lastFailed) lastFailed = d;
    });
    console.log("\nStep 3: Sample deployments");
    deps.forEach(function(d) { console.log("   " + d.status + "  " + d.createdAt + "  " + d.id.slice(0,10)); });
    console.log("   lastSuccess: " + (lastSuccess ? lastSuccess.id.slice(0,10) : "none"));
    console.log("   lastFailed:  " + (lastFailed ? lastFailed.id.slice(0,10) : "none"));
  }

  // ============== 3: TRY buildLogs / deploymentLogs with NO filters, just limit + deploymentId ==============
  const LOG_FIELDS = "{ timestamp severity message }";
  let dids = [lastFailed && lastFailed.id, lastSuccess && lastSuccess.id, anyDep && anyDep.id].filter(Boolean);
  dids = dids.filter(function(v, i, self) { return self.indexOf(v) === i; }).slice(0, 2);

  console.log("\nStep 4: Try deploymentLogs + buildLogs with NO date args (just deploymentId + limit)...");
  for (let i = 0; i < dids.length; i++) {
    const id = dids[i];
    const queries = [
      { label: "deploymentLogs(id="+id.slice(0,8)+", limit: 1000) no dates", q: `query D($id: String!) { deploymentLogs(deploymentId: $id, limit: 1000) ` + LOG_FIELDS + ` }`, v: { id: id } },
      { label: "buildLogs(id="+id.slice(0,8)+", limit: 1000) no dates", q: `query D($id: String!) { buildLogs(deploymentId: $id, limit: 1000) ` + LOG_FIELDS + ` }`, v: { id: id } },
    ];
    for (let j = 0; j < queries.length; j++) {
      const q = queries[j];
      const r = await gql(q.q, q.v);
      let count = -1;
      let errs = "";
      let data = null;
      if (r.data && r.data.errors) errs = r.data.errors.map(function(e) { return e.message; }).join(" | ");
      else if (r.data && r.data.data) {
        const first = Object.values(r.data.data)[0];
        if (Array.isArray(first)) { count = first.length; data = first; }
        else { count = 0; }
      }
      console.log("   " + (count > 0 ? "✅" : errs ? "❌" : "➖") + "  " + q.label.padEnd(60) + " lines=" + count + (errs ? "  ERR: " + errs.slice(0, 120) : ""));
      if (count > 0 && data && data.length) {
        console.log("\n   SAMPLE (" + data[0].timestamp + "  sev=" + data[0].severity + "): " + data[0].message.slice(0, 180));
        if (data.length > 1) console.log("           (" + data[1].timestamp + "  sev=" + data[1].severity + "): " + data[1].message.slice(0, 180));
        if (data.length > 2) console.log("           (" + data[2].timestamp + "  sev=" + data[2].severity + "): " + data[2].message.slice(0, 180));
        break;
      }
    }
  }

  // ============== 4: environmentLogs with ALL parameter combos ==============
  console.log("\nStep 5: environmentLogs — try many parameter combinations (envId=" + ENV_ID.slice(0,10) + ")...");
  const anchorCandidates = [
    null,
    new Date().toISOString(),
    new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  ];
  let envLogHits = 0;
  for (let a = 0; a < anchorCandidates.length; a++) {
    const anchor = anchorCandidates[a];
    const afterDate = anchor || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const beforeDate = new Date().toISOString();
    const runs = [
      { name: "envLogs anchor=" + (anchor ? anchor.slice(0,10) : "null") + " after=auto before=now  afterLimit=5000 beforeLimit=5000",
        vars: Object.assign({ environmentId: ENV_ID, afterLimit: 5000, beforeLimit: 5000 },
          anchor ? { anchorDate: anchor } : { afterDate: afterDate, beforeDate: beforeDate }) },
      { name: "envLogs environmentId + afterDate + beforeDate + filter=ERROR no anchor",
        vars: { environmentId: ENV_ID, afterDate: afterDate, beforeDate: beforeDate, afterLimit: 5000, beforeLimit: 5000, filter: "error OR Error OR ERROR OR Failed OR failed OR fatal OR invalid OR exception" } },
      { name: "envLogs environmentId + afterLimit only",
        vars: { environmentId: ENV_ID, afterLimit: 10000 } },
      { name: "envLogs environmentId + beforeLimit only",
        vars: { environmentId: ENV_ID, beforeLimit: 10000 } },
    ];
    for (let r = 0; r < runs.length; r++) {
      const run = runs[r];
      // Build a valid GQL query string from vars
      const argStr = Object.keys(run.vars).map(function(k) {
        const v = run.vars[k];
        if (typeof v === "number") return k + ": " + v;
        return k + ": \"" + v + "\"";
      }).join(", ");
      const qStr = `{ environmentLogs(` + argStr + `) ` + LOG_FIELDS + ` }`;
      const r1 = await gql(qStr, {});
      let count = -1;
      let errs = "";
      let data = null;
      if (r1.data && r1.data.errors) errs = r1.data.errors.map(function(e) { return e.message; }).slice(0, 1).join(" | ");
      else if (r1.data && r1.data.data) {
        const first = Object.values(r1.data.data)[0];
        if (Array.isArray(first)) { count = first.length; data = first; }
      }
      const prefix = count > 0 ? "✅" : errs ? "❌" : "➖";
      console.log("   " + prefix + "  " + run.name.padEnd(85) + " lines=" + count + (errs ? "  ERR: " + errs.slice(0, 100) : ""));
      if (count > 0 && data && data.length) {
        console.log("\n   🔥 SAMPLE 1: " + data[0].message.slice(0, 220));
        if (data.length > 3) console.log("   🔥 SAMPLE 2: " + data[3].message.slice(0, 220));
        if (data.length > 6) console.log("   🔥 SAMPLE 3: " + data[6].message.slice(0, 220));
        envLogHits++;
        if (envLogHits >= 2) { console.log("\n🎉 Success! Exiting probe early."); return; }
      }
    }
    if (envLogHits >= 2) break;
  }

  // ============== 5: Try httpLogs, networkFlowLogs, dnsQueryLogs, pluginLogs ==============
  console.log("\nStep 6: Try other log endpoints...");
  const otherLogs = [
    { name: "httpLogs envId svcId afterLimit beforeLimit",
      q: `{ httpLogs(environmentId: "${ENV_ID}", serviceId: "${SVC_ID}", afterLimit: 5000, beforeLimit: 5000) ` + LOG_FIELDS + ` }` },
    { name: "networkFlowLogs envId svcId",
      q: `{ networkFlowLogs(environmentId: "${ENV_ID}", serviceId: "${SVC_ID}", afterLimit: 5000, beforeLimit: 5000) ` + LOG_FIELDS + ` }` },
    { name: "dnsQueryLogs envId svcId",
      q: `{ dnsQueryLogs(environmentId: "${ENV_ID}", serviceId: "${SVC_ID}", afterLimit: 5000, beforeLimit: 5000) ` + LOG_FIELDS + ` }` },
  ];
  for (let i = 0; i < otherLogs.length; i++) {
    const q = otherLogs[i];
    const r = await gql(q.q, {});
    let count = -1, errs = "", data = null;
    if (r.data && r.data.errors) errs = r.data.errors.map(function(e) { return e.message; }).slice(0, 1).join(" | ");
    else if (r.data && r.data.data) { const f = Object.values(r.data.data)[0]; if (Array.isArray(f)) { count = f.length; data = f; } }
    const prefix = count > 0 ? "✅" : errs ? "❌" : "➖";
    console.log("   " + prefix + "  " + q.name.padEnd(50) + " lines=" + count + (errs ? " ERR: " + errs.slice(0, 100) : ""));
    if (count > 0 && data && data.length) {
      console.log("\n   🔥 SAMPLE: " + data[0].message.slice(0, 220));
      if (data[1]) console.log("   🔥 SAMPLE: " + data[1].message.slice(0, 220));
    }
  }
  console.log("\n(If still 0 lines: Railway log retention is very short for Hobby plan, or logs are only visible in UI session.)");
})();
