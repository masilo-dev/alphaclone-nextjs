const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

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

async function checkTenants() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log("--- Tenant Users ---");
  const { data: tu, error: tuErr } = await supabase
    .from("tenant_users")
    .select("*")
    .limit(10);
  if (tuErr) console.error(tuErr);
  else console.log(tu);

  console.log("--- business_invoices ---");
  const { data: inv, error: invErr } = await supabase
    .from("business_invoices")
    .select("id, tenant_id, invoice_number, total, status")
    .limit(5);
  if (invErr) console.error(invErr);
  else console.log(inv);
}

checkTenants().catch(console.error);
