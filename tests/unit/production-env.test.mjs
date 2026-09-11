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
    TURNSTILE_SECRET: "turnstile-secret",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAD53DAgC52ZBZnji",
    ...overrides,
  };
}

test("accepts the critical production environment", () => {
  const result = validateProductionEnv(validEnv());
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("accepts TURNSTILE_SECRET_KEY as legacy alias for Turnstile secret", () => {
  const env = validEnv({
    TURNSTILE_SECRET: "",
    TURNSTILE_SECRET_KEY: "legacy-turnstile-secret",
  });
  assert.equal(validateProductionEnv(env).ok, true);
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

test("rejects public-prefixed server secrets", () => {
  const result = validateProductionEnv(validEnv({
    NEXT_PUBLIC_SERVICE_ROLE_KEY: "must-never-be-public",
  }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /public environment prefix/);
});

test("rejects contradictory public origins", () => {
  const result = validateProductionEnv(validEnv({
    PUBLIC_APP_ORIGIN: "https://alphaclonesystems.com",
    NEXT_PUBLIC_SITE_URL: "https://wrong.example.com",
  }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /contradictory public URL/);
});

test("rejects partial SMTP and missing Stripe webhook configuration", () => {
  const result = validateProductionEnv(validEnv({
    SMTP_HOST: "smtp.example.com",
    STRIPE_SECRET_KEY: "configured",
  }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /SMTP configuration is incomplete/);
  assert.match(result.errors.join("\n"), /STRIPE_WEBHOOK_SECRET/);
});
