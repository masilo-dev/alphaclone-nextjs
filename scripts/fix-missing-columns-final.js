#!/usr/bin/env node
const https = require("https");
const fs = require("fs");
const p = require("path");

const envContent = fs.readFileSync(p.join(process.cwd(), ".env.local"), "utf8");
const env = {};
envContent.split("\n").forEach(function(l) {
  const [k, ...v] = l.split("=");
  const key = (k || "").trim();
  if (!key || key.startsWith("#")) return;
  env[key] = v.join("=").trim().replace(/^"|"$/g, "");
});
const SUPA_REF = "ehekzoioqvtweugemktn";
const PAT = env.SUPABASE_ACCESS_TOKEN;

function supa(sql) {
  return new Promise(function(res) {
    const pd = JSON.stringify({ query: sql });
    const o = {
      hostname: "api.supabase.com", port: 443,
      path: "/v1/projects/" + SUPA_REF + "/database/query", method: "POST",
      headers: {
        "Authorization": "Bearer " + PAT,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(pd),
      },
    };
    const r = https.request(o, function(s) {
      let b = "";
      s.on("data", c => b += c);
      s.on("end", () => {
        try { res({ s, ok: s.statusCode >= 200 && s.statusCode < 300, d: JSON.parse(b), r: b }); }
        catch (e) { res({ s, ok: false, r: b }); }
      });
    });
    r.on("error", e => res({ ok: false, err: e.message }));
    r.setTimeout(60000, () => r.destroy(new Error("timeout")));
    r.write(pd);
    r.end();
  });
}

async function run() {
  console.log("================================================================");
  console.log("  🔧 Apply missing columns idempotently (ADD COLUMN IF NOT EXISTS)");
  console.log("================================================================");
  const commPrefsDefault = JSON.stringify({
    transactional: true,
    product_updates: true,
    marketing: false,
    sms: false,
  });
  const steps = [
    ["profiles.company_name TEXT",
      "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name TEXT;" +
      "CREATE INDEX IF NOT EXISTS idx_profiles_company_name ON public.profiles(company_name) WHERE company_name IS NOT NULL;"],
    ["profiles.communication_prefs JSONB",
      "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS communication_prefs JSONB NOT NULL DEFAULT '" + commPrefsDefault + "'::jsonb;"],
    ["profiles.gdpr_consent_date TIMESTAMPTZ",
      "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gdpr_consent_date TIMESTAMPTZ;"],
    ["profiles.gdpr_consent_ip TEXT",
      "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gdpr_consent_ip TEXT;"],
    ["user_registration_events.age_confirmed BOOLEAN",
      "ALTER TABLE public.user_registration_events ADD COLUMN IF NOT EXISTS age_confirmed BOOLEAN;"],
    ["tenants.subscription_plan TEXT DEFAULT free",
      "ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'free';"],
    ["tenants.subscription_status TEXT DEFAULT active",
      "ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active';"],
    ["tenants.subscription_tier TEXT DEFAULT free",
      "ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free';" +
      "CREATE INDEX IF NOT EXISTS idx_tenants_subscription_tier ON public.tenants(subscription_tier);"],
    ["tenants.stripe_customer_id TEXT",
      "ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;"],
    ["tenants.stripe_subscription_id TEXT",
      "ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;"],
    ["tenants.stripe_price_id TEXT",
      "ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;"],
    ["tenants.current_period_start TIMESTAMPTZ",
      "ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;"],
    ["tenants.current_period_end TIMESTAMPTZ",
      "ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;"],
    ["tenants.cancel_at_period_end BOOLEAN",
      "ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;"],
  ];
  for (let i = 0; i < steps.length; i++) {
    const [lbl, sql] = steps[i];
    const r = await supa(sql);
    const sample = (r.r || "").slice(0, 140).replace(/\n/g, " ");
    console.log("   " + (r.ok ? "✅" : "❌") + " " + lbl.padEnd(52) + "  " + (r.ok ? "HTTP " + r.s : ("HTTP " + r.s + "  " + sample)));
  }
  console.log("\n   🔁 Refresh PostgREST schema cache (pg_notify + ANALYZE)");
  const r1 = await supa("SELECT pg_notify('pgrst', 'reload schema'); SELECT pg_notify('pgrst', 'rebuild schema cache'); ANALYZE public.profiles, public.tenants, public.user_registration_events, public.tenant_integrations, public.lead_search_jobs;");
  console.log("   pg_notify x2 + ANALYZE → HTTP " + r1.s + (r1.ok ? " OK" : ("  " + (r1.r || "").slice(0, 100))));

  console.log("\n================================================================");
  console.log("  🔍 Verify all pattern columns present in info_schema");
  console.log("================================================================");
  const wantCols = [
    ["public", "profiles", "company_name"],
    ["public", "profiles", "communication_prefs"],
    ["public", "profiles", "gdpr_consent_date"],
    ["public", "profiles", "gdpr_consent_ip"],
    ["public", "profiles", "is_super_admin"],
    ["public", "profiles", "full_name"],
    ["public", "profiles", "company"],
    ["public", "profiles", "phone"],
    ["public", "profiles", "custom_fields"],
    ["public", "profiles", "onboarding_completed"],
    ["public", "profiles", "onboarding_completed_at"],
    ["public", "tenants", "subscription_plan"],
    ["public", "tenants", "subscription_status"],
    ["public", "tenants", "subscription_tier"],
    ["public", "tenants", "stripe_customer_id"],
    ["public", "tenants", "stripe_subscription_id"],
    ["public", "tenants", "stripe_price_id"],
    ["public", "tenants", "current_period_start"],
    ["public", "tenants", "current_period_end"],
    ["public", "tenants", "cancel_at_period_end"],
    ["public", "tenant_integrations", "configured_by"],
    ["public", "tenant_integrations", "integration_id"],
    ["public", "tenant_integrations", "connected_at"],
    ["public", "tenant_integrations", "metadata"],
    ["public", "user_registration_events", "age_confirmed"],
    ["public", "user_registration_events", "notification_sent_at"],
    ["public", "user_registration_events", "notification_error"],
    ["public", "user_registration_events", "user_motivation_sent_at"],
    ["public", "user_registration_events", "user_motivation_error"],
    ["public", "lead_search_jobs", "status"],
  ];
  // Build SQL IN-list for all cols
  const tuples = wantCols.map(function(x) {
    return "('" + x[0] + "','" + x[1] + "','" + x[2] + "')";
  }).join(",");
  const ver = await supa(
    "SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default " +
    "FROM information_schema.columns " +
    "WHERE (table_schema,table_name,column_name) IN (" + tuples + ") " +
    "ORDER BY table_schema, table_name, ordinal_position;"
  );
  let miss = 0;
  let hit = 0;
  if (ver.ok && Array.isArray(ver.d)) {
    const found = {};
    ver.d.forEach(function(x) { found[x.table_schema + "." + x.table_name + "." + x.column_name] = x; });
    wantCols.forEach(function(w) {
      const key = w[0] + "." + w[1] + "." + w[2];
      const x = found[key];
      if (x) {
        hit++;
        console.log("   ✅ " + key.padEnd(60) + "  " + (x.data_type + "").padEnd(15) + " " + (x.is_nullable || " ") + (x.column_default ? "  DEFAULT " + String(x.column_default).slice(0, 40) : ""));
      } else {
        miss++;
        console.log("   ❌ " + key.padEnd(60) + "  MISSING!");
      }
    });
  } else {
    console.log("   FAIL verify: HTTP " + ver.s + " " + (ver.r || "").slice(0, 150));
  }
  console.log("\n   Summary: " + hit + "/" + (hit + miss) + " columns present  Missing: " + miss);
  console.log("");
}

run().catch(function(e) { console.error("💥", e); process.exit(1); });
