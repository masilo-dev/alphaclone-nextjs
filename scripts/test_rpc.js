const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.production.local" });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testRpc() {
  // Get a tenant ID to test with
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id")
    .limit(1);
  if (!tenants || tenants.length === 0) {
    console.error("No tenants found");
    return;
  }

  const tenantId = tenants[0].id;
  console.log(`Testing RPC for tenant: ${tenantId}`);

  const { data, error } = await supabase.rpc(
    "get_consolidated_dashboard_stats",
    {
      p_tenant_id: tenantId,
    },
  );

  if (error) {
    console.error("RPC Error:", error);
  } else {
    console.log("RPC Success:", JSON.stringify(data, null, 2));
  }
}

testRpc();
