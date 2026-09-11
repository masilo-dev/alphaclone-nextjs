# Email event matrix

The repository uses Brevo as the platform transactional provider and contains an additive unified email outbox migration. That migration is not deployed to production.

| Event class | Current evidence | Target |
| --- | --- | --- |
| Auth confirmation/recovery | Supabase Auth templates/config external | Verify branded production templates and link rewriting |
| Data request | Direct Brevo send in API request | Move to durable outbox |
| Invoice/contract/task/social | Multiple existing services and migrations | Consolidate behind unified outbox |
| Delivery/bounce/complaint | Existing suppressions/webhook tables | Validate provider signatures and reconciliation |
| Digests | Existing digest code and cron routes | Verify preferences, quiet hours, deduplication |

No claim is made that production DNS, SPF, DKIM, DMARC, or provider quotas are configured.
