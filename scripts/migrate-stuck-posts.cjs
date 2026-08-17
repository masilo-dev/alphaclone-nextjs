const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

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

async function migrateStuckPosts() {
  console.log("Reading env...");
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  console.log("Supabase URL:", url);

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  console.log("Querying stuck posts...");
  const { data: stuckPosts, error } = await supabase
    .from("social_posts")
    .select("id, scheduled_at, attempt_count, status")
    .eq("status", "scheduled")
    .lte("scheduled_at", now.toISOString());

  if (error) {
    console.error("Error querying stuck posts:", error);
    process.exit(1);
  }

  console.log(`Found ${stuckPosts?.length || 0} stuck posts.`);

  if (!stuckPosts || stuckPosts.length === 0) {
    console.log("✅ No stuck social posts found!");
    process.exit(0);
  }

  const staleIds = stuckPosts
    .filter(p => new Date(p.scheduled_at) < new Date(sevenDaysAgo))
    .map(p => p.id);

  console.log(`Updating ${staleIds.length} stale posts to 'failed'...`);

  if (staleIds.length > 0) {
    const { error: updateErr } = await supabase
      .from("social_posts")
      .update({
        status: "failed",
        error_message: "Stale scheduled post (>7 days overdue) audited & marked failed by Autonomous OS migration",
        updated_at: new Date().toISOString(),
      })
      .in("id", staleIds);

    if (updateErr) {
      console.error("Failed bulk update:", updateErr);
    } else {
      console.log(`✅ Bulk updated ${staleIds.length} stale posts successfully!`);
    }
  }

  console.log("Migration finished.");
  process.exit(0);
}

migrateStuckPosts().catch((e) => {
  console.error(e);
  process.exit(1);
});
