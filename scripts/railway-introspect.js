#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");

const envContent = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const [k, ...v] = line.split("=");
  const key = k.trim();
  if (key && !key.startsWith("#")) env[key] = v.join("=").trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
}
const TOKEN = env.RAILWAY_TOKEN || process.env.RAILWAY_TOKEN;
const PROJECT_ID = "c75eaf5f-1ec8-4565-b3b6-8e318f1251bd";

function gql(query, variables) {
  return new Promise(function(resolve) {
    const postData = JSON.stringify({ query: query, variables: variables || {} });
    const opts = { hostname: "backboard.railway.app", port: 443, path: "/graphql/v2", method: "POST",
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
  console.log("Step 1: Introspect `Log` type fields");
  const introspect = await gql(`{
    __type(name: "Log") {
      name
      kind
      fields {
        name
        type {
          name
          kind
          ofType { name kind }
        }
      }
    }
  }`);
  if (introspect.data && introspect.data.data && introspect.data.data.__type && introspect.data.data.__type.fields) {
    console.log("✅ Log fields:");
    introspect.data.data.__type.fields.forEach(function(f) {
      const tn = f.type.name || (f.type.ofType && (f.type.ofType.name + (f.type.kind === "LIST" ? "[]" : "?")) || "");
      console.log("   • " + f.name.padEnd(25) + " " + tn);
    });
  } else if (introspect.data && introspect.data.errors) {
    introspect.data.errors.forEach(function(e) { console.log("   ERR: " + e.message); });
  }

  console.log("\nStep 2: Introspect `Deployment` type fields");
  const dInt = await gql(`{ __type(name: "Deployment") {
    name
    fields(includeDeprecated: true) {
      name
      isDeprecated
      deprecationReason
      args(includeDeprecated: true) { name type { name kind ofType { name kind } } }
      type { name kind ofType { name kind } }
    }
  }}`);
  if (dInt.data && dInt.data.data && dInt.data.data.__type && dInt.data.data.__type.fields) {
    console.log("✅ Deployment fields (with args):");
    dInt.data.data.__type.fields.forEach(function(f) {
      const tn = f.type.name || (f.type.ofType && f.type.ofType.name) || "";
      const kind = f.type.kind;
      const args = (f.args || []).map(function(a) { return a.name + ":" + (a.type.name || (a.type.ofType ? a.type.ofType.name : "?")); }).join(", ");
      const dep = f.isDeprecated ? "  ⚠️DEPRECATED: " + (f.deprecationReason || "") : "";
      console.log("   • " + f.name.padEnd(30) + " " + (kind === "LIST" || tn ? tn : "").padEnd(15) + (args ? " args(" + args + ")" : "") + dep);
    });
  } else if (dInt.data && dInt.data.errors) dInt.data.errors.forEach(function(e) { console.log("   ERR: " + e.message); });

  console.log("\nStep 3: Introspect `ServiceInstance` fields");
  const siInt = await gql(`{ __type(name: "ServiceInstance") {
    name
    fields(includeDeprecated: true) {
      name isDeprecated deprecationReason
      args(includeDeprecated: true) { name type { name kind ofType { name kind } } }
      type { name kind ofType { name kind } }
    }
  }}`);
  if (siInt.data && siInt.data.data && siInt.data.data.__type && siInt.data.data.__type.fields) {
    console.log("✅ ServiceInstance fields:");
    siInt.data.data.__type.fields.forEach(function(f) {
      const tn = f.type.name || (f.type.ofType && f.type.ofType.name) || "";
      const args = (f.args || []).map(function(a) { return a.name + ":" + (a.type.name || (a.type.ofType ? a.type.ofType.name : "?")); }).join(", ");
      const dep = f.isDeprecated ? "  ⚠️DEPRECATED: " + (f.deprecationReason || "") : "";
      console.log("   • " + f.name.padEnd(30) + " " + tn.padEnd(10) + (args ? " args(" + args + ")" : "") + dep);
    });
  } else if (siInt.data && siInt.data.errors) siInt.data.errors.forEach(function(e) { console.log("   ERR: " + e.message); });

  console.log("\nStep 4: Introspect Query root for deploymentLogs / variables routes");
  const qInt = await gql(`{ __schema {
    queryType {
      fields(includeDeprecated: true) {
        name
        isDeprecated deprecationReason
        args(includeDeprecated: true) { name type { name kind ofType { name kind } } }
        type { name kind ofType { name kind } }
      }
    }
  }}`);
  if (qInt.data && qInt.data.data && qInt.data.data.__schema && qInt.data.data.__schema.queryType && qInt.data.data.__schema.queryType.fields) {
    const relevant = qInt.data.data.__schema.queryType.fields.filter(function(f) {
      return /log|deploy|variable|service|environment|instance|runtime|build/i.test(f.name);
    });
    console.log("✅ Query root relevant fields (" + relevant.length + " of " + qInt.data.data.__schema.queryType.fields.length + "):");
    relevant.forEach(function(f) {
      const tn = f.type.name || (f.type.ofType && f.type.ofType.name) || "?";
      const args = (f.args || []).map(function(a) { return a.name + ":" + (a.type.name || (a.type.ofType ? a.type.ofType.name : "?")); }).join(", ");
      console.log("   • " + f.name.padEnd(30) + " → " + tn.padEnd(18) + (args ? " args(" + args + ")" : ""));
    });
  } else if (qInt.data && qInt.data.errors) qInt.data.errors.forEach(function(e) { console.log("   ERR: " + e.message); });
})();
