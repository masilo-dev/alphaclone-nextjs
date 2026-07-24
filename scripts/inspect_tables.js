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

async function inspect() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    console.error("Missing Supabase credentials");
    return;
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const targets = ["business_invoices", "invoices", "workspace_files", "deals"];

  for (const target of targets) {
    console.log(`\n--- Inspecting table: ${target} ---`);
    const { data, error } = await supabase.from(target).select("*").limit(1);
    if (error) {
      console.error(`Error querying ${target}:`, error.message, error.code);
    } else if (data && data.length > 0) {
      console.log(`Table exists and has data! Columns:`, Object.keys(data[0]));
      console.log(`Sample row:`, data[0]);
    } else {
      console.log(`Table exists but is EMPTY or returns no rows.`);
      // Let's try to query column names from information_schema
      const { data: cols, error: colErr } = await supabase
        .rpc("inspect_columns_fallback", { tbl: target })
        .catch(() => ({ error: true }));
      if (colErr) {
        // Try selecting a non-existent column to see error message which might list columns, or do another check
        const { error: dummyErr } = await supabase
          .from(target)
          .select("non_existent_column_dummy")
          .limit(1);
        if (dummyErr) {
          console.log(
            `Postgrest error (helps identify schema):`,
            dummyErr.message,
          );
        }
      }
    }
  }
}

inspect().catch(console.error);
