<<<<<<< HEAD
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
=======
const fs = require('fs');
const path = require('path');

function getEnv(key) {
  const envFiles = ['.env.local', '.env.production.local', '.env'];
  for (const file of envFiles) {
    try {
      const content = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k.trim() === key) return v.join('=').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
>>>>>>> origin/main
      }
    } catch (e) {}
  }
  return process.env[key];
}

async function checkExec() {
<<<<<<< HEAD
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) return;

  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/query`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "SELECT 1" }),
  });

  if (res.ok) {
    console.log("SQL QUERY: AVAILABLE");
  } else {
    console.log("SQL QUERY: NOT AVAILABLE", res.status, await res.text());
=======
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) return;

  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/query`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: 'SELECT 1' })
  });

  if (res.ok) {
    console.log('SQL QUERY: AVAILABLE');
  } else {
    console.log('SQL QUERY: NOT AVAILABLE', res.status, await res.text());
>>>>>>> origin/main
  }
}

checkExec().catch(console.error);
