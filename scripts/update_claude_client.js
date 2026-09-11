const fs = require("fs");
const path = require("path");

function getEnv(key) {
  const envFiles = [
    ".env.local",
    ".env.production.local",
    ".env",
    ".env.vercel.local",
  ];
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

async function updateClaudeClient() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) return;

  const res = await fetch(
    `${url.replace(/\/$/, "")}/rest/v1/mcp_oauth_clients?client_id=eq.1778309945386-41bab8272f61`,
    {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        grant_types: ["authorization_code", "refresh_token"],
      }),
    },
  );

  if (res.ok) {
    console.log("CLAUDE CLIENT UPDATED: added refresh_token grant type");
  } else {
    console.log("FAILED TO UPDATE CLAUDE CLIENT", res.status, await res.text());
  }
}

updateClaudeClient().catch(console.error);
