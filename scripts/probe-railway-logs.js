#!/usr/bin/env node
/**
 * Railway log field name PROBER
 * Try every possible field/combination to extract logs for deployment(s)
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const PROJECT_ID = "c75eaf5f-1ec8-4565-b3b6-8e318f1251bd";

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

async function tryQuery(label, query, variables, fieldToCheck) {
  const r = await gql(query, variables);
  let ok = false;
  let errMsgs = "";
  let count = 0;
  if (r.data && r.data.errors) {
    errMsgs = r.data.errors.map(function(e) { return e.message; }).join(" | ");
  } else if (r.data && r.data.data) {
    const firstKey = fieldToCheck;
    // Walk to field
    let val = r.data.data;
    const keys = firstKey.split(".");
    for (let i = 0; i < keys.length; i++) {
      if (!val) break;
      val = val[keys[i]];
      if (Array.isArray(val) && val[i]) val = val[i].node ? (function walk(arr) {
        return arr.map(function(e) { return e.node || e; });
      })(val) : val;
    }
    if (Array.isArray(val) && val.length > 0) { count = val.length; ok = true; }
    else if (val && typeof val === "object" && Object.keys(val).length > 0 && !Array.isArray(val)) {
      // Might be an object with edges
      if (val.edges && Array.isArray(val.edges) && val.edges.length > 0) { count = val.edges.length; ok = true; }
      else if (val.nodes && Array.isArray(val.nodes) && val.nodes.length > 0) { count = val.nodes.length; ok = true; }
      else {
        ok = true;
        count = -1;
      }
    }
  }
  return { label: label, ok: ok, err: errMsgs, count: count, response: r };
}

(async function main() {
  console.log("================================================================");
  console.log("  Railway LOG Probe — Finding correct GQL fields & endpoints    ");
  console.log("================================================================");

  // Get first 2 deployments: last FAILED (9394d013) and the SUCCESS (cc58dfc4)
  const dQ = await gql(`query D($pid: String!) { project(id: $pid) { deployments(first: 40) { edges { node { id status createdAt serviceId }}}}}`, { pid: PROJECT_ID });
  let deps = [];
  if (dQ.data && dQ.data.data && dQ.data.data.project) deps = dQ.data.data.project.deployments.edges.map(function(e) { return e.node; });
  const lastFailed = deps.slice().reverse().find(function(d) { return d.status === "FAILED" || d.status === "CRASHED"; });
  const lastSuccess = deps.slice().reverse().find(function(d) { return d.status === "SUCCESS" || d.status === "DEPLOYED" || d.status === "DEPLOYING"; });
  const anyDep = lastFailed || lastSuccess || deps[0];
  console.log("Using deployment: " + (anyDep ? anyDep.id.slice(0,12) + "  status=" + anyDep.status : "none"));

  // Try every possible log query
  const probes = [];

  // ---- 1: deployment.buildLogs / runtimeLogs (with many variants of log fields)
  const logFieldVariants = [
    "{ timestamp level message }",
    "{ timestamp level message source }",
    "{ timestamp severity message }",
    "{ time level msg }",
    "{ at level message }",
    "{ createdAt level message }",
    "{ timestamp level content }",
    "{ timestamp level text }",
    "{ timestamp log level message }",
  ];
  if (anyDep) {
    logFieldVariants.forEach(function(fields, i) {
      probes.push({
        label: "deployment(id).buildLogs(last:100) " + i,
        query: `query D($id: String!) { deployment(id: $id) { buildLogs(last: 100) { edges { node ` + fields + ` } } }}`,
        variables: { id: anyDep.id },
        check: "deployment.buildLogs",
      });
      probes.push({
        label: "deployment(id).buildLogs as list " + i,
        query: `query D($id: String!) { deployment(id: $id) { buildLogs(last: 100) ` + fields + ` }}`,
        variables: { id: anyDep.id },
        check: "deployment.buildLogs",
      });
      probes.push({
        label: "deployment(id).runtimeLogs " + i,
        query: `query D($id: String!) { deployment(id: $id) { runtimeLogs(last: 100) ` + fields + ` }}`,
        variables: { id: anyDep.id },
        check: "deployment.runtimeLogs",
      });
    });

    // ---- 2: deploymentLogs query (root)
    logFieldVariants.forEach(function(fields, i) {
      probes.push({
        label: "deploymentLogs(deploymentId) " + i,
        query: `query D($id: String!) { deploymentLogs(deploymentId: $id, limit: 100) ` + fields + ` }`,
        variables: { id: anyDep.id },
        check: "deploymentLogs",
      });
    });

    // ---- 3: environment.logs, serviceInstance.logs, serviceInstance.runtimeLogs etc.
    const envId = "78325a44-cd94-4b10-aa41-c09ebd978c7f";
    const svcId = "a98fc4dc-4047-4647-a74a-985f6ff667ce";
    const instanceId = "109e5423-81ce-4cd4-9068-c83ecf3e241e";

    [
      { field: "environment(id).logs(last:100)", q: `query E($eid: String!) { environment(id: $eid) { logs(last: 100) `, v: { eid: envId }, check: "environment.logs" },
      { field: "environment(id).deploymentLogs(last:100)", q: `query E($eid: String!) { environment(id: $eid) { deploymentLogs(last: 100) `, v: { eid: envId }, check: "environment.deploymentLogs" },
      { field: "environment(id).serviceInstance.logs(last:100)", q: `query E($eid: String!, $sid: String!) { environment(id: $eid) { serviceInstance(serviceId: $sid) { logs(last: 100) `, v: { eid: envId, sid: svcId }, check: "environment.serviceInstance.logs" },
      { field: "serviceInstance(id).logs(last:100)", q: `query S($id: String!) { serviceInstance(id: $id) { logs(last: 100) `, v: { id: instanceId }, check: "serviceInstance.logs" },
      { field: "serviceInstance(id).runtimeLogs(last:100)", q: `query S($id: String!) { serviceInstance(id: $id) { runtimeLogs(last: 100) `, v: { id: instanceId }, check: "serviceInstance.runtimeLogs" },
      { field: "service(id).logs(last:100)", q: `query S($id: String!) { service(id: $id) { logs(last: 100) `, v: { id: svcId }, check: "service.logs" },
      { field: "project(id).logs(last:100)", q: `query P($pid: String!) { project(id: $pid) { logs(last: 100) `, v: { pid: PROJECT_ID }, check: "project.logs" },
    ].forEach(function(p, idx) {
      logFieldVariants.slice(0, 2).forEach(function(fields, j) {
        probes.push({
          label: p.field + " #" + idx + "." + j,
          query: p.q + fields + " }}}".split("}").slice(0, (p.field.match(/\./g) || []).length + 1).join("}"),
          variables: p.v,
          check: p.check,
        });
      });
    });

    // ---- 4: logs via 'node(id: <deployment-id>)' interface
    logFieldVariants.slice(0, 2).forEach(function(fields, i) {
      probes.push({
        label: "node(id=DEP).buildLogs#" + i,
        query: `query N($id: String!) { node(id: $id) { ... on Deployment { buildLogs(last: 100) ` + fields + ` } }}`,
        variables: { id: anyDep.id },
        check: "node",
      });
      probes.push({
        label: "node(id=DEP).runtimeLogs#" + i,
        query: `query N($id: String!) { node(id: $id) { ... on Deployment { runtimeLogs(last: 100) ` + fields + ` } }}`,
        variables: { id: anyDep.id },
        check: "node",
      });
    });
  }

  // ---- 5: REST API alternative paths
  console.log("\n🧪 Trying REST API log endpoints...");
  if (anyDep) {
    const restPaths = [
      "/v1/deployments/" + anyDep.id + "/logs",
      "/v1/deployments/" + anyDep.id + "/build",
      "/v1/deployments/" + anyDep.id,
    ];
    for (let i = 0; i < restPaths.length; i++) {
      await new Promise(function(resolve) {
        const opts = { hostname: "public-api.railway.app", port: 443, path: restPaths[i], method: "GET",
          headers: { "Authorization": "Bearer " + TOKEN } };
        const req = https.request(opts, function(res) {
          let buf = "";
          res.on("data", function(c) { buf += c; });
          res.on("end", function() {
            console.log("  REST " + res.statusCode + " " + restPaths[i].slice(0, 80));
            if (res.statusCode === 200 && buf.length > 0 && buf.length < 3000) {
              console.log("    " + buf.slice(0, 400).replace(/\n/g, " "));
            }
            resolve();
          });
        });
        req.on("error", function(e) { console.log("  REST ERR " + restPaths[i] + " " + e.message); resolve(); });
        req.setTimeout(15000, function() { req.destroy(); resolve(); });
        req.end();
      });
    }
  }

  // Run 30 probes max (skip duplicates)
  console.log("\n🧪 GQL probing (" + probes.length + " queries)...");
  let runs = 0;
  let successes = [];
  const seenQ = {};
  for (let i = 0; i < probes.length && runs < 80; i++) {
    const p = probes[i];
    if (seenQ[p.query]) continue;
    seenQ[p.query] = true;
    runs++;
    const res = await tryQuery(p.label, p.query, p.variables, p.check);
    if (res.ok) {
      console.log("  ✅ " + p.label.padEnd(60) + "  COUNT=" + res.count + (res.err ? "   " + res.err.slice(0, 80) : ""));
      successes.push({ label: p.label, query: p.query, vars: p.variables, count: res.count, response: res.response });
    } else if (res.err) {
      // Only print first 8 distinct errors to avoid noise
    }
  }

  console.log("\nProbes that returned non-empty data: " + successes.length);
  if (successes.length === 0) {
    // Show all first errors for diagnosis
    const seen = {};
    console.log("\n❌ No log fields returned data. First distinct errors:");
    probes.slice(0, 30).forEach(function(p) {
      const qStr = p.query + JSON.stringify(p.variables);
      if (seen[qStr]) return; seen[qStr] = true;
      gql(p.query, p.variables).then(function(r) {
        if (r.data && r.data.errors) r.data.errors.forEach(function(e) {
          if (!seen.err) seen.err = {};
          if (seen.err[e.message]) return;
          seen.err[e.message] = true;
          console.log("   GQL-ERR: " + e.message + "   (in " + p.label + ")");
        });
      });
    });
    // wait a tiny bit then exit
    setTimeout(function() { process.exit(0); }, 3000);
    return;
  }

  // For each successful probe that has logs, print sample 15 lines
  for (let i = 0; i < successes.length; i++) {
    const s = successes[i];
    console.log("\n===== Sample from: " + s.label + "  (count=" + s.count + ") =====");
    const r = s.response;
    // Try to extract lines generically
    function walkExtract(obj, depth, lines) {
      if (!obj || depth > 10) return;
      if (Array.isArray(obj)) obj.forEach(function(item) { walkExtract(item, depth + 1, lines); });
      else if (typeof obj === "object") {
        if (typeof obj.message === "string" && obj.message.length > 0) lines.push({ ts: obj.timestamp || obj.time || obj.createdAt || obj.at || "", lv: obj.level || obj.severity || "", msg: obj.message });
        Object.keys(obj).forEach(function(k) {
          if (k === "node" || k === "edges" || k === "nodes" || typeof obj[k] === "object") walkExtract(obj[k], depth + 1, lines);
        });
      }
    }
    const lines = [];
    walkExtract(r.data, 0, lines);
    lines.slice(-25).forEach(function(l, idx) {
      const ts = l.ts ? new Date(l.ts).toLocaleString() : "";
      console.log("   [" + String(idx+1).padStart(2,"0") + "] [" + ts + "] [" + l.lv + "] " + l.msg.slice(0, 260));
    });
  }
})();
