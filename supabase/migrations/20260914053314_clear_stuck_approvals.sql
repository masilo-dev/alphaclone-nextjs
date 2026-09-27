-- Safely clear or cancel the two stuck approval actions
UPDATE public.autonomous_runner_approvals
SET status = 'cancelled', reason = 'Cleared by system administrator as part of autonomous mode upgrade.'
WHERE id IN ('7b3528f5-dcc5-4961-b4dd-a6594208d1be', 'dd59a718-7333-4c2c-a87c-feae2ec156b8')
  AND status = 'pending';
