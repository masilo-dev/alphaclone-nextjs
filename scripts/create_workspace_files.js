const { Client } = require("pg");

async function run() {
  const databaseUrl =
    "postgresql://postgres.ehekzoioqvtweugemktn:Amgseries%40gmail.com@aws-1-eu-central-1.pooler.supabase.com:6543/postgres";

  console.log("Connecting to database via pooler...");
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Connected. Creating table workspace_files...");

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

    ALTER TABLE public.workspace_files ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'workspace_files' AND policyname = 'tenant_isolation'
      ) THEN
        CREATE POLICY tenant_isolation ON public.workspace_files
          FOR ALL USING (tenant_id = (coalesce(auth.jwt() ->> 'tenant_id', '00000000-0000-0000-0000-000000000000'))::uuid);
      END IF;
    END $$;
  `;

  try {
    await client.query(sql);
    console.log(
      "workspace_files table and RLS policy verified/created successfully!",
    );
  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
