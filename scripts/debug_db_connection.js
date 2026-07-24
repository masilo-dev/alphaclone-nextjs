const fs = require("fs");
const path = require("path");

function getEnvFromFile(file, key) {
  try {
    const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    const lines = content.split("\n");
    for (const line of lines) {
      const [k, ...v] = line.split("=");
      if (k.trim() === key)
        return v.join("=").trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "");
    }
  } catch (e) {}
  return null;
}

const files = [".env.production.local", ".env.local"];
for (const file of files) {
  console.log(`--- Inspecting ${file} ---`);
  for (const key of [
    "DATABASE_URL",
    "SUPABASE_DB_URL",
    "POSTGRES_URL",
    "POSTGRES_HOST",
  ]) {
    const val = getEnvFromFile(file, key);
    if (val) {
      // Obfuscate user/pass if it's a URL
      let display = val;
      if (val.includes("@")) {
        const parts = val.split("@");
        const schemeHost = parts[1];
        display = `[URL obfuscated]@${schemeHost}`;
      }
      console.log(`  ${key}: ${display}`);
    }
  }
}
