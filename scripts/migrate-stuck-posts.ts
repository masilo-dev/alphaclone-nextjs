import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

function getEnv(key: string): string | undefined {
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
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  console.log("=== STUCK SOCIAL POSTS MIGRATION AUDIT ===");
  console.log("Current ISO Time:", now.toISOString());
  console.log("Stale Cutoff Threshold (7 days ago):", sevenDaysAgo);

  const { data: stuckPosts, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", now.toISOString());

  if (error) {
    console.error("Error querying stuck posts:", error);
    process.exit(1);
  }

  if (!stuckPosts || stuckPosts.length === 0) {
    console.log("✅ No stuck social posts found!");
    return;
  }

  console.log(`Found ${stuckPosts.length} stuck social posts.`);

  let markedStaleCount = 0;
  let requeuedCount = 0;

  for (const post of stuckPosts) {
    const isStale = new Date(post.scheduled_at) < new Date(sevenDaysAgo);

    if (isStale) {
      console.log(`[STALE] Post ID ${post.id} (Scheduled at: ${post.scheduled_at}) -> Marking FAILED (stale post policy)`);
      const { error: updateErr } = await supabase
        .from("social_posts")
        .update({
          status: "failed",
          error_message: "Stale scheduled post (>7 days overdue) audited & marked failed by Autonomous OS migration",
          attempt_count: Math.max(post.attempt_count || 0, 1),
          updated_at: new Date().toISOString(),
        })
        .eq("id", post.id);

      if (updateErr) {
        console.error(`Failed updating post ${post.id}:`, updateErr);
      } else {
        markedStaleCount++;
      }
    } else {
      console.log(`[REQUEUE] Post ID ${post.id} (Scheduled at: ${post.scheduled_at}) -> Preserving for worker processing`);
      requeuedCount++;
    }
  }

  console.log("\n=== MIGRATION AUDIT COMPLETE ===");
  console.log(`- Total Audited: ${stuckPosts.length}`);
  console.log(`- Marked Stale & Failed: ${markedStaleCount}`);
  console.log(`- Requeued / Preserved: ${requeuedCount}`);
}

migrateStuckPosts().catch(console.error);
