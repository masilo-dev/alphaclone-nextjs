import assert from "node:assert/strict";
import test from "node:test";
import { validateProductionEnv } from "../../scripts/production-env.mjs";

function validEnv(overrides = {}) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    NEXT_PUBLIC_APP_URL: "https://alphaclonesystems.com",
    INTERNAL_API_KEY: "internal-secret",
    ENCRYPTION_SECRET: "12345678901234567890123456789012",
    BREVO_PLATFORM_API_KEY: "platform-email-key",
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site-key",
    ...overrides,
  };
}

test("accepts the critical production environment", () => {
  const result = validateProductionEnv(validEnv());
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("accepts supported Supabase and cron aliases", () => {
  const env = validEnv({
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    INTERNAL_API_KEY: "",
    VITE_SUPABASE_URL: "https://example.supabase.co",
    VITE_SUPABASE_ANON_KEY: "anon-key",
    CRON_SECRET: "cron-secret",
  });
  assert.equal(validateProductionEnv(env).ok, true);
});

test("rejects missing critical values without returning their contents", () => {
  const result = validateProductionEnv({});
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 9);
  assert.equal(
    result.errors.some((error) => error.includes("undefined")),
    false,
  );
});

test("rejects local, insecure, and Vercel production URLs", () => {
  for (const appUrl of [
    "http://localhost:3000",
    "http://alphaclonesystems.com",
    "https://alphaclone.vercel.app",
  ]) {
    const result = validateProductionEnv(
      validEnv({ NEXT_PUBLIC_APP_URL: appUrl }),
    );
    assert.equal(result.ok, false, appUrl);
  }
});

test("rejects an invalid encryption-secret length", () => {
  const result = validateProductionEnv(
    validEnv({ ENCRYPTION_SECRET: "too-short" }),
  );
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /exactly 32 characters/);
});
