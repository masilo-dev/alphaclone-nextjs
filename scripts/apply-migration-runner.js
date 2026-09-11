const fs = require("fs");
const path = require("path");
const https = require("https");

function getEnv(key) {
  const envFiles = [".env.local", ".env.production.local", ".env"];
  for (const file of envFiles) {
    try {
      const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      const lines = content.split("\n");
      for (const line of lines) {
        const [k, ...v] = line.split("=");
        if (k.trim() === key)
          return v.join("=").trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
      }
    } catch (e) {}
  }
  return process.env[key];
}

const SUPABASE_URL =
  getEnv("NEXT_PUBLIC_SUPABASE_URL") ||
  getEnv("VITE_SUPABASE_URL") ||
  getEnv("SUPABASE_URL");
const SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found");
  process.exit(1);
}

function requestRpc(pathName, payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);
    const parsed = new URL(SUPABASE_URL);
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: pathName,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length,
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        resolve({ statusCode: res.statusCode, body });
      });
    });

    req.on("error", (err) => resolve({ statusCode: 500, error: err.message }));
    req.write(data);
    req.end();
  });
}

async function run() {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260603130000_add_runner_action_and_email_rules.sql",
  );
  const sql = fs.readFileSync(migrationPath, "utf8");

  console.log("Trying /rest/v1/rpc/exec ...");
  let result = await requestRpc("/rest/v1/rpc/exec", { query: sql });
  console.log(`Result: Status ${result.statusCode}, Body: ${result.body}`);

  if (result.statusCode >= 200 && result.statusCode < 300) {
    console.log("✅ Migration succeeded via exec");
    process.exit(0);
  }

  console.log("Trying /rest/v1/rpc/exec_sql ...");
  result = await requestRpc("/rest/v1/rpc/exec_sql", { sql_query: sql });
  console.log(`Result: Status ${result.statusCode}, Body: ${result.body}`);

  if (result.statusCode >= 200 && result.statusCode < 300) {
    console.log("✅ Migration succeeded via exec_sql");
    process.exit(0);
  }

  console.error("❌ Both RPC methods failed");
  process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
