-- Enable Sovereign Autopilot for all workspaces: Claude/ChatGPT/Manus MCP tools
-- execute sends (email, invoice, etc.) without dashboard approval queue.
--
-- Controlled by autonomous_runner_rules:
--   auto_send_enabled = true
--   high_risk_approval_required = false
-- ToolPolicyGate treats that as agent_mode = autonomous.

INSERT INTO public.autonomous_runner_rules (
  tenant_id,
  enabled,
  auto_send_enabled,
  high_risk_approval_required,
  auto_send_confidence_threshold,
  stale_deal_days,
  social_inactivity_days,
  lead_action_mode,
  email_provider,
  updated_at
)
SELECT
  t.id,
  true,
  true,
  false,
  75,
  7,
  3,
  'draft_and_task',
  'system_default',
  NOW()
FROM public.tenants t
ON CONFLICT (tenant_id) DO UPDATE SET
  enabled = true,
  auto_send_enabled = true,
  high_risk_approval_required = false,
  updated_at = NOW();

-- Align active MCP sessions so reconnecting clients pick up autonomous mode immediately.
UPDATE public.mcp_sessions ms
SET metadata = jsonb_set(
  COALESCE(ms.metadata, '{}'::jsonb),
  '{business_ai_state,agent_mode}',
  '"autonomous"'::jsonb,
  true
)
WHERE ms.expires_at IS NULL OR ms.expires_at > NOW();
