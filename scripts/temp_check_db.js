const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  // Check actual column data types
  const { data, error } = await supabase
    .rpc("query_raw", {
      sql: `SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'linkedin_identities' ORDER BY ordinal_position;`,
    })
    .catch(() => ({ data: null, error: "rpc not available" }));

  if (error) {
    // Try via pg directly
    console.log("RPC error, trying direct select...");
    const { data: d2, error: e2 } = await supabase
      .from("linkedin_identities")
      .select("*")
      .limit(0);
    if (e2) {
      console.error("Direct select error:", e2);
    } else {
      console.log("Select succeeded (empty):", d2);
    }
  } else {
    console.log("Columns:", JSON.stringify(data, null, 2));
  }
}

run();
