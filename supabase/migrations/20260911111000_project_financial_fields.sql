-- Additive Projects V2 financial fields. Existing finance/invoice tables remain canonical.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS estimated_value numeric(18,2),
  ADD COLUMN IF NOT EXISTS actual_revenue numeric(18,2),
  ADD COLUMN IF NOT EXISTS estimated_cost numeric(18,2),
  ADD COLUMN IF NOT EXISTS actual_cost numeric(18,2),
  ADD COLUMN IF NOT EXISTS profitability numeric(18,2),
  ADD COLUMN IF NOT EXISTS projected_margin numeric(9,4);

-- Backfill only where values are absent; do not overwrite explicit project accounting.
UPDATE public.projects
SET estimated_value = COALESCE(estimated_value, approved_budget, budget_total, budget),
    estimated_cost = COALESCE(estimated_cost, 0),
    actual_cost = COALESCE(actual_cost, 0)
WHERE estimated_value IS NULL OR estimated_cost IS NULL OR actual_cost IS NULL;
