import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = resolve(dirname(new URL(import.meta.url).pathname), "../..");
function read(file) {
  return readFileSync(resolve(root, file), "utf8");
}
function load(file, mocks = {}) {
  const runtimeModule = { exports: {} };
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
    runtimeModule,
    runtimeModule.exports,
  );
  return runtimeModule.exports;
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
    let inserted;
    const query = {
      insert(rows) {
        sequence.push("save");
        inserted = rows;
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
        company: "Acme",
        phone: "+1 555 0100",
      }),
      headers: new Headers(),
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.notificationSent, delivered);
    assert.deepEqual(sequence, ["save", "email"]);
    assert.equal(inserted?.[0]?.status, "New");
    assert.equal(inserted?.[0]?.source, "website");
    assert.equal(inserted?.[0]?.company, "Acme");
    assert.equal(inserted?.[0]?.phone, "+1 555 0100");
    assert.equal(mail.to, "bonnie@alphaclonesystems.com");
    assert.equal(mail.replyTo, "test@example.com");
    assert.match(mail.html, /&lt;b&gt;your platform&lt;\/b&gt;/);
    assert.equal(mail.idempotencyKey, "website-contact:submission-1");
  });
}

test("contact accepts explicit Turnstile bypass after widget failure", async () => {
  const sequence = [];
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
        data: { id: "submission-bypass", created_at: "2026-10-05T15:00:00Z" },
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
      sendEmailServer: async () => {
        sequence.push("email");
        return { success: true };
      },
    },
    "@/lib/rateLimit": {
      rateLimitMiddleware: async () => null,
      rateLimitConfigs: { public: { contact: {} } },
    },
    "@/lib/verifyTurnstile": {
      isTurnstileEnforced: () => true,
      readTurnstileToken: (body) => String(body?.turnstileToken || ""),
      isTurnstileBypassToken: (token) => token === "__turnstile_bypass__",
      verifyTurnstileToken: async () => false,
      readClientIp: () => "127.0.0.1",
    },
  });
  const rejected = await route.POST({
    json: async () => ({
      name: "Test Person",
      email: "test@example.com",
      subject: "Website question",
      message: "Please help with my inquiry today.",
      turnstileToken: "not-a-real-token",
    }),
    headers: new Headers(),
  });
  assert.equal(rejected.status, 403);

  const accepted = await route.POST({
    json: async () => ({
      name: "Test Person",
      email: "test@example.com",
      subject: "Website question",
      message: "Please help with my inquiry today.",
      turnstileToken: "__turnstile_bypass__",
    }),
    headers: new Headers(),
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.success, true);
  assert.deepEqual(sequence, ["save", "email"]);
});

test("website owner notifications require explicit immediate_exception classification", async () => {
  let executed = 0;
  const sender = load("src/lib/email/sendEmailServer.ts", {
    "@/lib/email/usageMeteringService": {
      checkEmailSendQuotaAvailable: async () => ({
        allowed: false,
        message: "Quota exhausted",
      }),
    },
    "@/lib/email/emailExecutionService": {
      EmailExecutionService: {
        execute: async () => {
          executed++;
          return { success: true, emailId: "email-1" };
        },
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
  // Missing classification → digest gate blocks before quota/send.
  const internal = await sender.sendEmailServer(input);
  assert.equal(internal.success, false);
  assert.equal(internal.code, "DIGEST_REQUIRED");
  assert.equal(executed, 0);

  // Non-platform path still hits quota.
  assert.equal(
    (await sender.sendEmailServer({ ...input, isPlatformNotification: false }))
      .code,
    "QUOTA_EXCEEDED",
  );
  assert.equal(executed, 0);

  // Website contact with immediate_exception skips quota and sends.
  const immediate = await sender.sendEmailServer({
    ...input,
    internalNotificationKind: "immediate_exception",
  });
  assert.equal(immediate.success, true);
  assert.equal(executed, 1);
});

test("contact route passes immediate_exception for owner notification emails", async () => {
  const source = read("src/app/api/contact/route.ts");
  assert.match(source, /internalNotificationKind:\s*'immediate_exception'/);
  assert.match(source, /templateName:\s*'websiteContact'/);
  assert.match(source, /isPlatformNotification:\s*true/);
});

test("Turnstile bypass sentinel is defined in server-safe verifyTurnstile module", async () => {
  const verifySource = read("src/lib/verifyTurnstile.ts");
  const widgetSource = read("src/components/security/TurnstileWidget.tsx");
  assert.match(
    verifySource,
    /export const TURNSTILE_BYPASS_TOKEN = '__turnstile_bypass__'/,
  );
  assert.doesNotMatch(
    verifySource,
    /from '@\/components\/security\/TurnstileWidget'/,
  );
  assert.match(
    widgetSource,
    /import \{ TURNSTILE_BYPASS_TOKEN \} from '@\/lib\/verifyTurnstile'/,
  );
});
