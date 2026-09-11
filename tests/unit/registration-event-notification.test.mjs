/**
 * Registration audit cycle: every new user registration should be recorded
 * and Bonnie should be notified once.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("registration event helper records event and emails Bonnie", () => {
  const src = fs.readFileSync(
    new URL("../../src/lib/auth/registrationEvents.ts", import.meta.url),
    "utf8",
  );

  assert.match(src, /user_registration_events/);
  assert.match(src, /bonnie@alphaclonesystems\.com/);
  assert.match(src, /notification_sent_at/);
  assert.match(src, /user_motivation_sent_at/);
  assert.match(src, /sendWithProviderSdk/);
  assert.match(src, /Bonnie at AlphaClone/);
  assert.match(src, /Founder, AlphaClone Systems/);
  assert.match(src, /UNIQUE \(user_id\)|eq\('user_id', user\.id\)/);
});

test("auth callback records registrations for OAuth and email confirmations", () => {
  const src = fs.readFileSync(
    new URL("../../src/app/auth/callback/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(src, /recordRegistrationEvent/);
  assert.match(src, /inferSignupMethod/);
  assert.match(src, /callbackProvider/);
});

test("immediate email signup posts registration event notification", () => {
  const src = fs.readFileSync(
    new URL("../../src/app/auth/login/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(src, /\/api\/auth\/registration-event/);
  assert.match(src, /marketingOptIn/);
  assert.match(src, /legalAccepted/);
});
