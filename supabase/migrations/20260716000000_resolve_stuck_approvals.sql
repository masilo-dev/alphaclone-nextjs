-- Resolve or clear the two currently-stuck queued actions so they can be safely discarded/marked rejected
UPDATE public.autonomous_runner_approvals
SET status = 'rejected', updated_at = NOW()
WHERE id IN ('7b3528f5-dcc5-4961-b4dd-a6594208d1be', 'dd59a718-7333-4c2c-a87c-feae2ec156b8')
  AND status = 'pending';
