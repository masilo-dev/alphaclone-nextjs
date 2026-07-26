# Operator actions required

1. Confirm a current Supabase backup and staging availability.
2. Enable Docker for a clean migration rebuild.
3. Review the 15-migration production dry run.
4. Verify Railway has the platform Brevo key; local audit could not confirm it.
5. Verify Auth Site URL, redirect allow-list, branded templates, SMTP, and link-tracking behavior.
6. Verify SPF, DKIM, DMARC, return path, bounce and complaint webhooks.
7. Decide whether the three local-only Edge Functions should be deployed or retired.
8. Review the 38 mutable-search-path security-definer functions.
9. Run authenticated Playwright route crawls.
10. Apply no production changes until items 1–3 are complete.
