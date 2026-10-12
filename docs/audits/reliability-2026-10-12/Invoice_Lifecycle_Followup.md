# Invoice lifecycle follow-up — 2026-10-12

Confirmed production observation: seven agent_tasks of type invoice.send remain READY. Maximum attempt_count is zero. Oldest created_at: 2026-10-01 10:58:39.657433 UTC; newest: 2026-10-12 10:04:08.89949 UTC. No automation_cron_logs entries for bonnie-runtime-worker in the previous seven days. Queries were aggregate, read-only and contained no recipients or business content.

This proves these tasks have not been attempted by this task executor. Missing cron records support a worker dispatch problem; the exact scheduling/infrastructure failure is not yet established. Separate direct-send paths or provider records were not reconciled, so this is not a claim that recipients received nothing by every possible path.

Source defects repaired locally:
- Lifecycle API uses the established guarded invoice-send command instead of directly queuing outside its permission and idempotency boundary.
- Approved invoices are accepted alongside drafts, matching the send endpoint.
- Dashboard helper preserves run_id; three button handlers display the server queued status and tracking ID instead of claiming automated sending and reminders.

Verification: 43 isolated mocked tests passed, including guarded route approval denial, approved-invoice acceptance, run ID propagation, and failure without automatic retry. TypeScript noEmit and git diff --check passed. No real emails were sent. The prior production build predates these additional edits; no new build or deployment is claimed.

BLOCKED: production worker recovery and actual email outcome verification. Do not drain the seven legacy tasks blindly: the specialized invoice worker executes before the generic high-risk approval gate. Inspect approvals, recipient/content/sender revisions and provider/local send evidence before enabling processing. Bind valid approval to the exact invoice PDF and email payload; pause tasks requiring renewed approval. Unknown prior delivery must reconcile before resend. Restore a supported scheduled worker only after that review, then verify with a controlled inbox and stable operation identity.

Rollback: reverse the four invoice route/helper/UI file edits in the source diff. Preserve task, approval, delivery and receipt records. Do not delete pending tasks or release duplicate-send protection to force retries.
