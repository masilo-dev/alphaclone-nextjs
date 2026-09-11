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

async function run() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const sql = `
    CREATE TABLE IF NOT EXISTS public.workspace_files (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      user_id            UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
      uploaded_by        UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
      anthropic_file_id  TEXT NULL,
      filename           TEXT NOT NULL,
      file_name          TEXT NOT NULL,
      mime_type          TEXT NOT NULL,
      file_type          TEXT NOT NULL,
      file_size          BIGINT NOT NULL DEFAULT 0,
      storage_url        TEXT NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  console.log("Attempting to create table using RPC...");
  const { data, error } = await supabase.rpc("secure_read_only_query", {
    query_string: sql,
  });
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Success:", data);
  }
}

run().catch(console.error);
