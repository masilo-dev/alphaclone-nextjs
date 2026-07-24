const fs = require("fs");
const path = require("path");

const files = [
  ".env.production.local",
  ".env.local",
  ".env.vercel.local",
  ".env.preview.local",
  ".env.local.bak",
  ".env",
];

for (const file of files) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;

  console.log(`\n=== File: ${file} ===`);
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split("=");
    const key = parts[0].trim();
    let val = parts
      .slice(1)
      .join("=")
      .trim()
      .replace(/^"|"$/g, "")
      .replace(/^'|'$/g, "");
    if (val) {
      if (val.length > 8) {
        val = val.substring(0, 4) + "..." + val.slice(-4);
      }
      console.log(`  ${key}: ${val}`);
    }
  }
}
