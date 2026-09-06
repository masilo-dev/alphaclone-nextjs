import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = resolve(dirname(new URL(import.meta.url).pathname), "../..");
function load(file, mocks = {}) {
  const module = { exports: {} };
  const source = readFileSync(resolve(root, file), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
    process,
    console,
    URL,
    Date,
  })(
    (id) => {
      if (id in mocks) return mocks[id];
      if (id.startsWith("@/")) return load(`src/${id.slice(2)}.ts`, mocks);
      return require(id);
    },
    module,
    module.exports,
  );
  return module.exports;
}
const response = {
  json: (body, init) => ({ body, status: init?.status ?? 200 }),
};

test("legacy profile bookings resolve to the verified demo and keep tracking parameters", () => {
  const booking = load("src/lib/marketing/booking.ts", {
    "@/constants": {
      PLATFORM_BOOKING_URL:
        "https://cal.com/alphaclonesystems/demo-for-for-alphaclone-systems",
    },
  });
  assert.equal(
    booking.resolvePlatformBookingUrl(
      "https://cal.com/alphaclonesystems/?utm_source=test",
    ),
    "https://cal.com/alphaclonesystems/demo-for-for-alphaclone-systems?utm_source=test",
  );
  assert.equal(
    booking.resolvePlatformBookingUrl("https://cal.com/another/event"),
    "https://cal.com/another/event",
  );
  assert.equal(
    booking.getCalComLink(booking.resolvePlatformBookingUrl()),
    "alphaclonesystems/demo-for-for-alphaclone-systems",
  );
  assert.notEqual(
    booking.CAL_EMBED_UI.cssVarsPerTheme.light["cal-bg"],
    booking.CAL_EMBED_UI.cssVarsPerTheme.dark["cal-bg"],
  );
});

test("walkthrough completion updates only the authenticated profile", async () => {
  let updates;
  const ids = [];
  const query = {
    select() {
      return this;
    },
    eq(key, value) {
      ids.push([key, value]);
      return this;
    },
    async maybeSingle() {
      return { data: { custom_fields: {} } };
    },
    update(value) {
      updates = value;
      return this;
    },
    async single() {
      return { data: { id: "current-user" } };
    },
  };
  const route = load("src/app/api/account/profile/route.ts", {
    "next/server": { NextResponse: response },
    "@/lib/apiAuth": {
      requireAuthenticatedUser: async () => ({ user: { id: "current-user" } }),
      routeErrorResponse: (e) => {
        throw e;
      },
    },
    "@/lib/supabase-admin": {
      createSupabaseAdminClient: () => ({ from: () => query }),
    },
  });
  const result = await route.PATCH({
    json: async () => ({ walkthrough_completed: true }),
  });
  assert.equal(result.status, 200);
  assert.equal(updates.walkthrough_completed, true);
  assert.ok(ids.every(([, id]) => id === "current-user"));
  const invalid = await route.PATCH({
    json: async () => ({ walkthrough_completed: true, role: "admin" }),
  });
  assert.equal(invalid.status, 400);
});

for (const delivered of [true, false]) {
  test(`contact saves before notification and reports delivery=${delivered}`, async () => {
    const sequence = [];
    let mail;
    const query = {
      insert() {
        sequence.push("save");
        return this;
      },
      select() {
        return this;
      },
      async single() {
        return {
          data: { id: "submission-1", created_at: "2026-09-06T09:00:00Z" },
        };
      },
    };
    const route = load("src/app/api/contact/route.ts", {
      "next/server": { NextResponse: response },
      "@/lib/apiAuth": {
        createAdminSupabaseClientOrThrow: () => ({ from: () => query }),
        routeErrorResponse: (e) => {
          throw e;
        },
      },
      "@/lib/email/sendEmailServer": {
        sendEmailServer: async (input) => {
          sequence.push("email");
          mail = input;
          return { success: delivered };
        },
      },
      "@/lib/rateLimit": {
        rateLimitMiddleware: async () => null,
        rateLimitConfigs: { public: { contact: {} } },
      },
      "@/lib/verifyTurnstile": { isTurnstileEnforced: () => false },
    });
    const result = await route.POST({
      json: async () => ({
        name: "Test Person",
        email: "test@example.com",
        subject: "Website question",
        message: "Please explain <b>your platform</b> to me.",
      }),
      headers: new Headers(),
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.notificationSent, delivered);
    assert.deepEqual(sequence, ["save", "email"]);
    assert.equal(mail.to, "bonnie@alphaclonesystems.com");
    assert.equal(mail.replyTo, "test@example.com");
    assert.match(mail.html, /&lt;b&gt;your platform&lt;\/b&gt;/);
    assert.equal(mail.idempotencyKey, "website-contact:submission-1");
  });
}

test("website owner notifications are independent of tenant send quota", async () => {
  let sent = 0;
  const sender = load("src/lib/email/sendEmailServer.ts", {
    "@/lib/email/usageMeteringService": {
      checkEmailSendQuotaAvailable: async () => ({
        allowed: false,
        message: "Quota exhausted",
      }),
    },
    "@/lib/email/emailGateway": {
      sendViaEmailGateway: async () => {
        sent++;
        return { success: true };
      },
    },
  });
  const input = {
    tenantId: "platform",
    to: "bonnie@alphaclonesystems.com",
    subject: "Inquiry",
    text: "Hello",
    templateName: "websiteContact",
    isPlatformNotification: true,
  };
  assert.equal((await sender.sendEmailServer(input)).success, true);
  assert.equal(sent, 1);
  assert.equal(
    (await sender.sendEmailServer({ ...input, isPlatformNotification: false }))
      .code,
    "QUOTA_EXCEEDED",
  );
  assert.equal(sent, 1);
});
