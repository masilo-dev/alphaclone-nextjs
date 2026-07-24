#!/usr/bin/env node
/**
 * Apply generated VAPID keys to Railway alphaclone-web.
 *
 * Usage:
 *   RAILWAY_TOKEN=... RAILWAY_SERVICE=alphaclone-web node scripts/apply-vapid-railway.mjs
 *   # or with a keys file:
 *   node scripts/apply-vapid-railway.mjs /path/to/vapid-keys.env
 *
 * Expects env file lines:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
 *   VITE_VAPID_PUBLIC_KEY=...
 *   VAPID_PRIVATE_KEY=...
 *   VAPID_EMAIL=mailto:...
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const keysPath = process.argv[2] || "/opt/cursor/artifacts/vapid-keys.env";
if (!existsSync(keysPath)) {
  console.error(`Missing keys file: ${keysPath}`);
  console.error("Generate with: npx web-push generate-vapid-keys --json");
  process.exit(1);
}

const parsed = Object.fromEntries(
  readFileSync(keysPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const required = [
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VITE_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_EMAIL",
];
for (const key of required) {
  if (!parsed[key]) {
    console.error(`Keys file missing ${key}`);
    process.exit(1);
  }
}

if (!process.env.RAILWAY_TOKEN) {
  console.error("RAILWAY_TOKEN is not set — cannot write Railway variables.");
  console.error(
    "Paste these into Railway → alphaclone-web → Variables, then redeploy:",
  );
  for (const key of required) console.error(`  ${key}=${parsed[key]}`);
  process.exit(2);
}

const args = ["variables", "set"];
for (const key of required) {
  args.push(`${key}=${parsed[key]}`);
}

const result = spawnSync("npx", ["--yes", "@railway/cli", ...args], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
