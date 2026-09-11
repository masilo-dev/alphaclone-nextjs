import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBonnieDeepLink,
  normalizeBonnieNavPath,
  parseBonnieDeepLink,
} from "../../src/lib/bonnie/bonnieDeepLink.ts";

test("buildBonnieDeepLink encodes record focus params", () => {
  const url = buildBonnieDeepLink({
    route: "/dashboard/crm/leads/lead_123",
    tab: "activity",
    focus: "follow-up",
    workflowId: "wf_456",
    reason: "Bonnie queued a follow-up",
  });
  assert.match(url, /tab=activity/);
  assert.match(url, /focus=follow-up/);
  assert.match(url, /workflow=wf_456/);
});

test("normalizeBonnieNavPath accepts route objects from assistant nav", () => {
  const path = normalizeBonnieNavPath({
    route: "/dashboard/crm",
    tab: "deals",
    recordId: "deal_1",
  });
  assert.ok(path);
  assert.match(path, /\/dashboard\/crm/);
  assert.match(path, /id=deal_1/);
});

test("parseBonnieDeepLink handles plain dashboard paths", () => {
  const parsed = parseBonnieDeepLink("/dashboard/mail?tab=inbox&focus=draft");
  assert.equal(parsed?.route, "/dashboard/mail?tab=inbox&focus=draft");
  assert.equal(parsed?.tab, "inbox");
  assert.equal(parsed?.focus, "draft");
});
