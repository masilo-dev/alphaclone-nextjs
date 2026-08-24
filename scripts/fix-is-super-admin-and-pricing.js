#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");

const PROJECT_REF = "ehekzoioqvtweugemktn";
const envContent = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
let MANAGEMENT_KEY = "";
for (const line of envContent.split("\n")) {
  const parts = line.split("=");
  if (parts[0].trim() === "SUPABASE_ACCESS_TOKEN") {
    MANAGEMENT_KEY = parts.slice(1).join("=").trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
    break;
  }
}

function post(hostname, reqPath, headers, body) {
  return new Promise(function(resolve) {
    const data = JSON.stringify(body);
    const options = {
      hostname: hostname,
      port: 443,
      path: reqPath,
      method: "POST",
      headers: Object.assign(
        { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
        headers
      ),
    };
    const req = https.request(options, function(res) {
      let buf = "";
      res.on("data", function(c) { buf += c; });
      res.on("end", function() { resolve({ status: res.statusCode, body: buf }); });
    });
    req.on("error", function(e) { resolve({ status: 500, body: e.message }); });
    req.setTimeout(120000, function() { req.destroy(new Error("timeout")); });
    req.write(data);
    req.end();
  });
}

async function runSql(description, sql) {
  console.log("\n⚡ " + description + "...");
  const res = await post(
    "api.supabase.com",
    "/v1/projects/" + PROJECT_REF + "/database/query",
    { Authorization: "Bearer " + MANAGEMENT_KEY },
    { query: sql }
  );
  if (res.status >= 200 && res.status < 300) {
    console.log("   ✅ OK (HTTP " + res.status + ")");
    return true;
  }
  const snippet = res.body.slice(0, 400);
  const lower = snippet.toLowerCase();
  const already = lower.includes("already exists") || lower.includes("duplicate");
  if (already) {
    console.log("   ⚠️  Already applied");
    return true;
  }
  console.log("   ❌ HTTP " + res.status + ": " + snippet);
  return false;
}

async function main() {
  console.log("================================================================");
  console.log("  Fix: Add is_super_admin column + Pricing system supplement    ");
  console.log("================================================================");

  const step1 = "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;";
  await runSql("Add is_super_admin column to profiles", step1);

  const step2 = "CREATE INDEX IF NOT EXISTS idx_profiles_is_super_admin ON public.profiles(is_super_admin) WHERE is_super_admin = TRUE;";
  await runSql("Add index on is_super_admin", step2);

  const step3 = `UPDATE public.profiles
SET is_super_admin = TRUE
WHERE (
  lower(COALESCE(role::text, '')) IN ('super_admin', 'admin', 'platform_admin', 'platform_owner')
  OR lower(email) IN ('bonnie@alphaclonesystems.com', 'bonnie@alphaclone.tech')
)
AND is_super_admin = FALSE;`;
  await runSql("Backfill is_super_admin = TRUE for admins/bonnie", step3);

  const step4 = `CREATE OR REPLACE FUNCTION public.sync_is_super_admin_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_super_admin := (
    lower(COALESCE(NEW.role::text, '')) IN ('super_admin','admin','platform_admin','platform_owner')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_sync_is_super_admin ON public.profiles;
CREATE TRIGGER trg_sync_is_super_admin
BEFORE INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_is_super_admin_column();`;
  await runSql("Create trigger to auto-sync is_super_admin from role", step4);

  console.log("\n---------- Re-applying pricing_system_supplement ----------");
  const pricingPath = path.join(process.cwd(), "supabase", "migrations", "20260825000000_pricing_system_supplement.sql");
  const pricingSql = fs.readFileSync(pricingPath, "utf8");
  await runSql("20260825 pricing system supplement", pricingSql);

  console.log("\n✅ Fix complete.");
}

main().catch(function(e) { console.error("FATAL:", e); process.exit(1); });
