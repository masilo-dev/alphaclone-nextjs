import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { SocialPublishingService } from "@/lib/social/SocialPublishingService";

function getDbClient() {
  const envFiles = [".env.local", ".env.production.local", ".env"];
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    for (const file of envFiles) {
      try {
        const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
        for (const line of content.split("\n")) {
          const [k, ...v] = line.split("=");
          const trimmedK = k.trim();
          const val = v.join("=").trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
          if (!url && (trimmedK === "NEXT_PUBLIC_SUPABASE_URL" || trimmedK === "VITE_SUPABASE_URL")) url = val;
          if (!key && trimmedK === "SUPABASE_SERVICE_ROLE_KEY") key = val;
        }
      } catch (e) {}
    }
  }

  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

export class SocialAutopilot {
  private static instance: SocialAutopilot;

  public static getInstance(): SocialAutopilot {
    if (!SocialAutopilot.instance) {
      SocialAutopilot.instance = new SocialAutopilot();
    }
    return SocialAutopilot.instance;
  }

  /**
   * Execute scheduled post publishing safely through SocialPublishingService.
   */
  public async publishScheduledPost(postId: string): Promise<boolean> {
    const supabase = getDbClient();
    console.log(`[SocialAutopilot] Publishing scheduled post ID: ${postId}`);

    const { data: post, error } = await supabase
      .from("social_posts")
      .select("*")
      .eq("id", postId)
      .single();

    if (error || !post) {
      console.error(`[SocialAutopilot] Post ${postId} not found:`, error?.message);
      return false;
    }

    if (post.status === "published") {
      console.log(`[SocialAutopilot] Post ${postId} is already published.`);
      return true;
    }

    try {
      // Delegate to canonical SocialPublishingService
      const success = await SocialPublishingService.publishPost(postId);
      console.log(`[SocialAutopilot] Publishing result for post ${postId}: ${success ? "SUCCESS" : "FAILED"}`);
      return success;
    } catch (err: any) {
      console.error(`[SocialAutopilot] Error publishing post ${postId}:`, err.message);

      await supabase
        .from("social_posts")
        .update({
          status: "failed",
          error_message: err.message,
          attempt_count: (post.attempt_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);

      return false;
    }
  }

  /**
   * Scans due scheduled social posts and enqueues them into background job queue.
   */
  public async syncDueScheduledPosts(tenantId?: string): Promise<number> {
    const supabase = getDbClient();
    const now = new Date().toISOString();

    let query = supabase
      .from("social_posts")
      .select("id, tenant_id, scheduled_at")
      .eq("status", "scheduled")
      .lte("scheduled_at", now);

    if (tenantId) query = query.eq("tenant_id", tenantId);

    const { data: duePosts } = await query;
    if (!duePosts || duePosts.length === 0) return 0;

    let queuedCount = 0;
    for (const post of duePosts) {
      // Mark as claiming or publish directly
      const success = await this.publishScheduledPost(post.id);
      if (success) queuedCount++;
    }

    return queuedCount;
  }
}

export const socialAutopilot = SocialAutopilot.getInstance();
