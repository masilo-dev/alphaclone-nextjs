import { classifyActionRisk } from "../../src/lib/mcp/capabilityManifest.ts";

export function isHighRiskActionProxy(action) {
  return (
    action === "send_outreach" ||
    action === "send_invoice_reminder" ||
    String(action).startsWith("bulk_") ||
    classifyActionRisk(action) !== "none"
  );
}
