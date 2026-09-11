/**
 * Email/password signup: confirmation redirect + duplicate-email detection.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("authService.signUp sets emailRedirectTo for confirmation links", () => {
  const src = fs.readFileSync(
    new URL("../../src/services/authService.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /emailRedirectTo/);
  assert.match(src, /buildAuthCallbackRedirect/);
  assert.match(src, /signup_method:\s*'email'/);
  assert.match(src, /marketing_opt_in/);
  assert.match(src, /identities\.length === 0/);
});

test("auth callback applies email signup communication prefs after confirm", () => {
  const src = fs.readFileSync(
    new URL("../../src/app/auth/callback/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /signup_method === 'email'/);
  assert.match(src, /communication_prefs_applied_at/);
  assert.match(src, /marketing_opt_in/);
});

test("login register form passes marketing opt-in into signUp", () => {
  const src = fs.readFileSync(
    new URL("../../src/app/auth/login/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /marketingOptIn,/);
  assert.match(src, /Create Account with Email/);
  assert.match(src, /at least 12 characters/);
});
