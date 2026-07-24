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

async function checkManusClient() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) return;

  const res = await fetch(
    `${url.replace(/\/$/, "")}/rest/v1/mcp_oauth_clients?client_id=eq.manus-ai`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    },
  );

  if (res.ok) {
    const data = await res.json();
    console.log("MANUS CLIENT:", JSON.stringify(data, null, 2));
  } else {
    console.log("FAILED TO FETCH MANUS CLIENT", res.status);
  }
}

checkManusClient().catch(console.error);
