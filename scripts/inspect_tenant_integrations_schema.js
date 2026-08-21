const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function getEnv(key) {
  const envFiles = [".env.local", ".env.production.local", ".env"];
  for (const file of envFiles) {
    try {
      const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      for (const line of content.split("\n")) {
        const [k, ...v] = line.split("=");
        if (k.trim() === key)
          return v.join("=").trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
      }
    } catch (e) {}
  }
  return process.env[key];
}

const supabase = createClient(
  getEnv("NEXT_PUBLIC_SUPABASE_URL"),
  getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);

async function check() {
  console.log("=== tenant_integrations: all real columns (insert test) ===");
  // fetch all known possible columns
  const possible = [
    "id","tenant_id","status","created_at","updated_at",
    "integration_id","configured_by","connected_at","metadata","user_id",
    "provider","provider_id","name","type","enabled","config","scope","external_id"
  ];
  for (const col of possible) {
    const { error } = await supabase.from("tenant_integrations").select(col).limit(1);
    const exists = !error || (error.code !== "42703");
    console.log(`${exists ? "✅" : "❌"} ${col}${error ? " -> " + error.message : ""}`);
  }

  console.log("\n=== integrations: all real columns ===");
  const colsToTest = [
    "id","user_id","tenant_id","type","name","enabled","config","created_at","updated_at",
    "provider","status","connected_at","configured_by","integration_id","metadata","external_id"
  ];
  for (const col of colsToTest) {
    const { error } = await supabase.from("integrations").select(col).limit(1);
    const exists = !error || (error.code !== "42703");
    console.log(`${exists ? "✅" : "❌"} integrations.${col}${error ? " -> " + error.message : ""}`);
  }
}

check().catch(console.error);
