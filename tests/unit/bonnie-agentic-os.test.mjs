import test from "node:test";
import assert from "node:assert/strict";
import {
  DEPARTMENT_AGENTS,
  getAgentById,
  toOrchestratorSubagents,
} from "../../src/lib/bonnie/os/agentRegistry.ts";
import {
  collectToolsFromAgents,
  decideSupervision,
  estimateRiskLevel,
  selectAgentsForGoal,
} from "../../src/lib/bonnie/os/supervisor.ts";
import { synthesizeReflection } from "../../src/lib/bonnie/os/reflectionEngine.ts";
import {
  BONNIE_EVENT_GOALS,
  isBonnieReasoningEvent,
} from "../../src/lib/bonnie/os/eventReasoning.ts";
import { looksLikeComplexMission } from "../../src/lib/bonnie/bonnieAgentConfig.ts";

test("department agent roster includes required specialists", () => {
  const ids = new Set(DEPARTMENT_AGENTS.map((a) => a.id));
  for (const required of [
    "ceo",
    "coo",
    "sales",
    "crm",
    "marketing",
    "social",
    "finance",
    "accounting",
    "research",
    "email",
    "calendar",
    "document",
    "customer_success",
    "support",
    "compliance",
    "security",
    "reporting",
    "workflow",
    "automation",
    "knowledge",
    "supervisor",
    "audit",
    "memory",
    "evaluation",
  ]) {
    assert.equal(ids.has(required), true, `missing agent ${required}`);
  }
  assert.ok(DEPARTMENT_AGENTS.length >= 24);
});

test("supervisor selects finance agents for overdue invoice goals", () => {
  const agents = selectAgentsForGoal(
    "Chase overdue invoices and improve cash collection",
    { maxAgents: 4 },
  );
  const ids = agents.map((a) => a.id);
  assert.ok(ids.includes("finance") || ids.includes("accounting"));
  const decision = decideSupervision({
    goal: "Send overdue invoice reminders in bulk",
    selectedAgents: agents,
  });
  assert.equal(decision.riskLevel, "high");
  assert.equal(decision.requiresApproval, true);
  assert.ok(decision.primaryAgentIds.length >= 1);
});

test("supervisor maps lead_created events to research/crm/sales", () => {
  const agents = selectAgentsForGoal("New lead arrived", {
    eventType: "lead_created",
    maxAgents: 4,
  });
  const ids = new Set(agents.map((a) => a.id));
  assert.ok(ids.has("research") || ids.has("crm") || ids.has("sales"));
});

test("estimateRiskLevel and tool collection", () => {
  assert.equal(estimateRiskLevel("show me pipeline"), "low");
  assert.equal(estimateRiskLevel("create a draft email"), "medium");
  assert.equal(estimateRiskLevel("send invoice now"), "high");
  const tools = collectToolsFromAgents(
    [getAgentById("crm"), getAgentById("finance")].filter(Boolean),
  );
  assert.ok(tools.includes("get_contacts") || tools.includes("get_invoices"));
});

test("toOrchestratorSubagents preserves write flags", () => {
  const sales = getAgentById("sales");
  assert.ok(sales);
  const mapped = toOrchestratorSubagents([sales]);
  assert.equal(mapped[0].write_allowed, true);
  assert.equal(mapped[0].name, "Sales Agent");
});

test("reflection synthesizes lessons and memory updates", () => {
  const supervisor = decideSupervision({
    goal: "Qualify leads and draft outreach",
  });
  const reflection = synthesizeReflection({
    goal: "Qualify leads and draft outreach",
    stages: [
      { name: "observe", status: "completed", summary: "ok" },
      { name: "execute", status: "completed", summary: "ok" },
    ],
    supervisor,
    outcome: { status: "completed" },
    toolResults: [{ tool: "get_leads", success: true }],
  });
  assert.ok(reflection.lessons.length >= 1);
  assert.ok(reflection.memoryUpdates.length >= 1);
  assert.ok(reflection.whatWorked.length >= 1);
});

test("event reasoning catalog covers core business events", () => {
  assert.equal(isBonnieReasoningEvent("lead_created"), true);
  assert.equal(isBonnieReasoningEvent("invoice_overdue"), true);
  assert.equal(isBonnieReasoningEvent("unknown_event"), false);
  const goal = BONNIE_EVENT_GOALS.lead_created({ leadId: "abc" });
  assert.match(goal, /qualification score/i);
  assert.match(goal, /abc/);
});

test("complex mission detector still triggers cognitive path", () => {
  assert.equal(
    looksLikeComplexMission(
      "Create contact, send outreach, and then schedule follow-up after that",
    ),
    true,
  );
  assert.equal(looksLikeComplexMission("list my deals"), false);
});
