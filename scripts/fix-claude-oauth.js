#!/usr/bin/env node
/**
 * Fix Claude.ai MCP OAuth Client Registration
 *
 * This script registers the correct OAuth client for Claude.ai to connect
 * via the Model Context Protocol (MCP). Run this if users get the error:
 * "Couldn't register with Alphaclone's sign-in service" with error ID "ofid_..."
 *
 * Usage:
 *   node scripts/fix-claude-oauth.js
 *
 * Requires:
 *   - VITE_SUPABASE_URL in .env.local
 *   - SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Load environment variables from .env.local
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("❌ Error: .env.local file not found");
    console.log(
      "Please ensure .env.local exists with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, "utf8");
  const url = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim();
  const key = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

  if (!url || !key) {
    console.error("❌ Error: Missing required environment variables");
    console.log("Please ensure .env.local contains:");
    console.log("  VITE_SUPABASE_URL=your-supabase-url");
    console.log("  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key");
    process.exit(1);
  }

  return { url, key };
}

// Claude.ai OAuth client configurations
const CLAUDE_CLIENTS = [
  {
    client_id: "1778309945386-41bab8272f61",
    client_name: "Claude Desktop (Anthropic)",
    redirect_uris: [
      "https://claude.ai/api/mcp/auth_callback",
      "https://claude.ai/settings/oauth-callback",
      "https://api.claude.ai/v1/oauth/callback",
      "https://claude.ai/api/oauth/callback",
    ],
    is_public: true,
    client_secret: null,
    scopes: [
      "read",
      "write",
      "mcp:tools",
      "mcp:resources",
      "openid",
      "profile",
    ],
    is_active: true,
  },
  {
    client_id: "CLAUDE",
    client_name: "Claude AI (Legacy)",
    redirect_uris: [
      "https://claude.ai/api/mcp/auth_callback",
      "https://claude.ai/api/oauth/callback",
      "https://claude.ai/auth/callback",
    ],
    is_public: true,
    client_secret: null,
    scopes: ["read", "write", "mcp:tools", "mcp:resources"],
    is_active: true,
  },
  {
    client_id: "claude-web",
    client_name: "Claude Web (Anthropic)",
    redirect_uris: [
      "https://claude.ai/api/mcp/auth_callback",
      "https://claude.ai/api/oauth/callback",
      "https://www.claude.ai/api/mcp/auth_callback",
    ],
    is_public: true,
    client_secret: null,
    scopes: [
      "read",
      "write",
      "mcp:tools",
      "mcp:resources",
      "openid",
      "profile",
    ],
    is_active: true,
  },
];

async function main() {
  console.log("🔧 Fixing Claude.ai MCP OAuth Client Registration...\n");

  const { url, key } = loadEnv();
  const supabase = createClient(url, key);

  console.log("📡 Connecting to Supabase...");

  let successCount = 0;
  let errorCount = 0;

  for (const client of CLAUDE_CLIENTS) {
    try {
      const { error } = await supabase
        .from("mcp_oauth_clients")
        .upsert(client, { onConflict: "client_id" });

      if (error) {
        console.error(
          `❌ Failed to register ${client.client_id}:`,
          error.message,
        );
        errorCount++;
      } else {
        console.log(`✅ Registered: ${client.client_id}`);
        console.log(`   Name: ${client.client_name}`);
        console.log(
          `   Redirect URIs: ${client.redirect_uris.length} configured`,
        );
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Error registering ${client.client_id}:`, err.message);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`Results: ${successCount} succeeded, ${errorCount} failed`);
  console.log("=".repeat(50));

  if (successCount > 0) {
    console.log("\n✨ Claude.ai OAuth clients are now registered!");
    console.log("\nNext steps:");
    console.log("1. Ask the user to try connecting Claude.ai again");
    console.log("2. If the issue persists, verify the MCP OAuth tables exist:");
    console.log("   - mcp_oauth_clients");
    console.log("   - mcp_oauth_codes");
    console.log("   - mcp_oauth_tokens");
    console.log("\nFor support, share this reference: ofid_39198e394feb99f2");
  }

  if (errorCount > 0) {
    console.log("\n⚠️  Some registrations failed. Please check:");
    console.log("1. Database connection is working");
    console.log("2. mcp_oauth_clients table exists");
    console.log("3. You have the correct service role key");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
