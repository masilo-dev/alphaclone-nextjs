# Apply All Database Migrations - Complete Guide

This guide will help you apply all 5 database migrations to your Supabase instance.

---

## 📋 MIGRATIONS TO APPLY (In Order)

1. ✅ `20260209_user_security_2fa.sql` - 2FA & User Security
2. ✅ `20260209_stripe_webhook_idempotency.sql` - Stripe Webhooks
3. ✅ `20260209_esign_compliance.sql` - E-Signature Compliance
4. ✅ `20260209_quota_enforcement.sql` - Quota Enforcement
5. ✅ `20260209_gdpr_compliance.sql` - GDPR Compliance

---

## 🚀 OPTION 1: Supabase Dashboard (Recommended - Easiest)

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click on "SQL Editor" in the left sidebar
4. Click "+ New query"

### Step 2: Apply Each Migration
For each migration file, follow these steps:

#### Migration 1: User Security & 2FA
1. Open file: `src/supabase/migrations/20260209_user_security_2fa.sql`
2. Copy entire contents (Ctrl+A, Ctrl+C)
3. Paste into Supabase SQL Editor
4. Click "Run" button (or press Ctrl+Enter)
5. ✅ Verify success message appears

#### Migration 2: Stripe Webhook Idempotency
1. Open file: `src/supabase/migrations/20260209_stripe_webhook_idempotency.sql`
2. Copy entire contents
3. Paste into SQL Editor
4. Click "Run"
5. ✅ Verify success

#### Migration 3: E-Signature Compliance
1. Open file: `src/supabase/migrations/20260209_esign_compliance.sql`
2. Copy entire contents
3. Paste into SQL Editor
4. Click "Run"
5. ✅ Verify success

#### Migration 4: Quota Enforcement
1. Open file: `src/supabase/migrations/20260209_quota_enforcement.sql`
2. Copy entire contents
3. Paste into SQL Editor
4. Click "Run"
5. ✅ Verify success

#### Migration 5: GDPR Compliance
1. Open file: `src/supabase/migrations/20260209_gdpr_compliance.sql`
2. Copy entire contents
3. Paste into SQL Editor
4. Click "Run"
5. ✅ Verify success

---

## 🔧 OPTION 2: Using psql (Command Line)

### Prerequisites
```bash
# Install PostgreSQL client
# Windows: https://www.postgresql.org/download/windows/
# Mac: brew install postgresql
# Linux: sudo apt-get install postgresql-client
```

### Get Your Database Connection String
1. Go to Supabase Dashboard → Settings → Database
2. Copy the "Connection string" (Direct connection)
3. Replace `[YOUR-PASSWORD]` with your actual database password

### Apply Migrations
```bash
# Navigate to project directory
cd "C:\Users\Alphacone IO\alphaclone-nextjs-6"

# Set your connection string (replace with your actual connection string)
$DATABASE_URL = "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

# Apply each migration
psql $DATABASE_URL -f src/supabase/migrations/20260209_user_security_2fa.sql
psql $DATABASE_URL -f src/supabase/migrations/20260209_stripe_webhook_idempotency.sql
psql $DATABASE_URL -f src/supabase/migrations/20260209_esign_compliance.sql
psql $DATABASE_URL -f src/supabase/migrations/20260209_quota_enforcement.sql
psql $DATABASE_URL -f src/supabase/migrations/20260209_gdpr_compliance.sql
```

---

## ✅ VERIFICATION CHECKLIST

After applying all migrations, verify they were successful:

### Check New Tables Exist

Run this in Supabase SQL Editor:

```sql
-- Should return 20 new tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    -- Migration 1: 2FA
    'user_security',

    -- Migration 2: Stripe
    'stripe_webhook_events',
    'stripe_payments',
    'webhook_failures',

    -- Migration 3: E-Signature
    'contract_audit_trail',
    'esignature_consents',
    'signature_events',
    'signature_certificates',
    'contract_versions',

    -- Migration 4: Quotas
    'subscription_tier_limits',
    'tenant_usage_tracking',
    'usage_events',
    'quota_alerts',

    -- Migration 5: GDPR
    'user_consents',
    'data_export_requests',
    'data_deletion_requests',
    'data_processing_log',
    'privacy_policy_versions',
    'terms_of_service_versions'
)
ORDER BY table_name;
```

**Expected Result:** Should show 20 tables

### Check Functions Exist

```sql
-- Should return multiple functions
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'track_usage',
    'can_perform_action',
    'get_tenant_usage_summary',
    'record_consent',
    'request_data_export',
    'request_data_deletion',
    'anonymize_user_data'
)
ORDER BY routine_name;
```

**Expected Result:** Should show 7+ functions

### Check Subscription Tiers Were Inserted

```sql
-- Should return 4 tiers
SELECT tier_name, users_limit, projects_limit, storage_mb_limit
FROM subscription_tier_limits
ORDER BY users_limit;
```

**Expected Result:**
```
tier_name    | users_limit | projects_limit | storage_mb_limit
-------------|-------------|----------------|------------------
free         | 2           | 3              | 500
starter      | 10          | 25             | 5000
pro          | 50          | 100            | 25000
enterprise   | 999999      | 999999         | 999999
```

---

## ❌ TROUBLESHOOTING

### Error: "relation already exists"
**Cause:** Migration was partially applied before
**Solution:** This is OK - tables that already exist will be skipped due to `IF NOT EXISTS` clauses

### Error: "permission denied"
**Cause:** Insufficient database permissions
**Solution:** Make sure you're using the correct connection string with full permissions

### Error: "syntax error"
**Cause:** Incomplete SQL copied
**Solution:** Make sure you copied the ENTIRE migration file, including all lines

### Error: "function does not exist"
**Cause:** Functions from earlier migrations are missing
**Solution:** Apply migrations in order (1 → 2 → 3 → 4 → 5)

---

## 🧪 TEST YOUR MIGRATIONS

After applying all migrations, test that everything works:

### Test 1: User Security (2FA)
```sql
-- Create test user security record
INSERT INTO user_security (user_id, two_factor_enabled, two_factor_secret)
VALUES ('00000000-0000-0000-0000-000000000001', false, 'test-secret-123')
ON CONFLICT (user_id) DO NOTHING;

-- Verify it was created
SELECT * FROM user_security WHERE two_factor_secret = 'test-secret-123';
```

### Test 2: Quota Tracking
```sql
-- Test quota tracking
SELECT track_usage(
    (SELECT id FROM tenants LIMIT 1),
    'api_calls',
    1
);

-- View usage
SELECT * FROM tenant_usage_tracking LIMIT 5;
```

### Test 3: GDPR Consent
```sql
-- Test consent recording
SELECT record_consent(
    '00000000-0000-0000-0000-000000000001',
    'privacy_policy',
    true,
    '1.0',
    'Test consent text',
    '127.0.0.1',
    'Test User Agent'
);

-- View consents
SELECT * FROM user_consents LIMIT 5;
```

---

## 📊 MIGRATION SUMMARY

| Migration | Tables Created | Functions Created | Status |
|-----------|----------------|-------------------|--------|
| 1. User Security | 1 | 0 | ⏳ Pending |
| 2. Stripe Webhooks | 3 | 3 | ⏳ Pending |
| 3. E-Signature | 5 | 5 | ⏳ Pending |
| 4. Quotas | 4 | 4 | ⏳ Pending |
| 5. GDPR | 6 | 4 | ⏳ Pending |
| **TOTAL** | **19 tables** | **16 functions** | |

---

## 🔐 SECURITY NOTE

⚠️ **IMPORTANT:** Never commit your database password or connection string to git!

Keep these secure:
- Database passwords
- Connection strings
- Supabase service role keys
- Any secrets or API keys

---

## ✅ COMPLETION CHECKLIST

Once all migrations are applied:

- [ ] All 5 migrations executed successfully
- [ ] 20 new tables verified in database
- [ ] 7+ new functions verified in database
- [ ] 4 subscription tiers inserted
- [ ] Test queries all pass
- [ ] RLS policies are active
- [ ] No error messages in SQL Editor

---

## 🆘 NEED HELP?

If you encounter any issues:

1. Check the error message in Supabase SQL Editor
2. Verify you copied the entire migration file
3. Make sure migrations are applied in order (1-5)
4. Check the Troubleshooting section above
5. Review Supabase logs: Dashboard → Logs → Postgres Logs

---

## 📞 SUPPORT RESOURCES

- **Supabase Docs:** https://supabase.com/docs/guides/database
- **SQL Editor Guide:** https://supabase.com/docs/guides/database/overview#sql-editor
- **Migration Guide:** https://supabase.com/docs/guides/database/migrations

---

**Ready to apply migrations? Start with Option 1 (Supabase Dashboard) - it's the easiest!** 🚀
