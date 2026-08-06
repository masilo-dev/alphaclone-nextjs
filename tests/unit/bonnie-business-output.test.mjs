import test from "node:test";
import assert from "node:assert/strict";
import {
  authorityRequiresApproval,
  buildManagementByExceptionBrief,
  calculateExpectedValue,
  createExecutionAction,
  rankBusinessPriorities,
  verificationStatusFromOutcome,
} from "../../src/lib/bonnie/os/businessOutput.ts";

test("expected value calculates only when value and probability are defensible", () => {
  const calculated = calculateExpectedValue({
    potentialValue: 12000,
    probability: 0.28,
    executionCost: 7,
    riskAdjustment: 0,
  });
  assert.equal(calculated.status, "calculated");
  assert.equal(calculated.expectedValue, 3353);
  assert.match(calculated.explanation, /Expected Value/i);

  const insufficient = calculateExpectedValue({
    potentialValue: 500,
    probability: null,
    executionCost: 25,
  });
  assert.equal(insufficient.status, "insufficient_data");
  assert.equal(insufficient.expectedValue, null);
  assert.match(insufficient.explanation, /Insufficient data/i);
});

test("authority policy supports controlled autonomy", () => {
  assert.equal(authorityRequiresApproval("read").required, false);
  assert.equal(authorityRequiresApproval("financial").required, true);

  const allowed = authorityRequiresApproval(
    "financial",
    [{ permission: "financial", allowed: true, maxSpend: 100 }],
    { spendAmount: 70 },
  );
  assert.equal(allowed.required, false);

  const overLimit = authorityRequiresApproval(
    "financial",
    [{ permission: "financial", allowed: true, maxSpend: 100 }],
    { spendAmount: 120 },
  );
  assert.equal(overLimit.required, true);
  assert.match(overLimit.reason, /exceeds/i);
});

test("execution actions include status, risk, approval, expected value, and verification fields", () => {
  const action = createExecutionAction({
    id: "act-1",
    title: "Follow up warm opportunities",
    objective: "Recover pipeline from inactive opportunities",
    agentId: "sales",
    permissionLevel: "send",
    potentialValue: 9700,
    probability: 0.22,
    estimatedCost: { value: 4, currency: "USD", unit: "money", attribution: "estimated" },
    expectedOutcome: "Prepared outreach to warm opportunities",
    authorityRules: [{ permission: "send", allowed: true, requiresApproval: true }],
  });

  assert.equal(action.requiredApproval, true);
  assert.equal(action.status, "awaiting_approval");
  assert.equal(action.verificationStatus, "not_started");
  assert.equal(action.expectedValue?.status, "calculated");
  assert.ok(action.evidence?.some((item) => JSON.stringify(item).includes("authority_decision")));
});

test("priority engine ranks execute, approval, and insufficient data decisions", () => {
  const ranked = rankBusinessPriorities([
    {
      id: "recover-overdue",
      title: "Recover overdue invoices",
      action: "Prepare collection reminders",
      potentialValue: 4280,
      probability: 0.72,
      urgency: 0.95,
      effort: 0.2,
      risk: "medium",
      strategicRelevance: 0.8,
      customerImportance: 0.8,
      executionCost: 8,
    },
    {
      id: "increase-ads",
      title: "Increase advertising spend",
      action: "Launch a paid campaign",
      potentialValue: null,
      probability: null,
      urgency: 0.4,
      effort: 0.5,
      risk: "high",
      executionCost: 500,
    },
    {
      id: "bulk-send",
      title: "Send proposal follow-ups",
      action: "Send outreach to warm opportunities",
      potentialValue: 9700,
      probability: 0.28,
      urgency: 0.85,
      effort: 0.2,
      risk: "high",
      requiresApproval: true,
      executionCost: 7,
    },
  ]);

  assert.equal(ranked[0].id, "recover-overdue");
  assert.equal(ranked.find((item) => item.id === "increase-ads")?.recommended, "wait_for_evidence");
  assert.equal(ranked.find((item) => item.id === "bulk-send")?.recommended, "prepare_for_approval");
});

test("management by exception surfaces decisions and summarizes routine work", () => {
  const safe = createExecutionAction({
    id: "safe-1",
    title: "Update CRM notes",
    objective: "Preserve customer context",
    permissionLevel: "write",
    riskLevel: "medium",
    potentialValue: 300,
    probability: 0.5,
  });
  const decision = createExecutionAction({
    id: "decision-1",
    title: "Send invoice recovery sequence",
    objective: "Recover overdue invoice revenue",
    permissionLevel: "financial",
    potentialValue: 1900,
    probability: 0.6,
  });

  const brief = buildManagementByExceptionBrief({
    actions: [{ ...safe, status: "completed" }, decision],
    routineActionsHandled: 1284,
  });

  assert.match(brief.headline, /requires 1 decision/i);
  assert.equal(brief.decisions.length, 1);
  assert.equal(brief.routineActionsHandled, 1284);
  assert.equal(brief.output.successfulActions, 1);
  assert.equal(verificationStatusFromOutcome({ status: "completed" }), "verified");
});
