# ✅ Apply Migrations Now - 5 Minutes

Your existing tables are SAFE. These migrations only ADD new tables, never remove anything.

---

## 🎯 Simple Steps

### Open This URL:
**https://supabase.com/dashboard/project/<your-project-ref>/sql/new**

### Then Copy/Paste Each Migration:

---

## Migration 1: User Security & 2FA

**File:** `src/supabase/migrations/20260209_user_security_2fa.sql`

1. Open the file in your editor
2. **Select All** (Ctrl+A)
3. **Copy** (Ctrl+C)
4. **Paste** into Supabase SQL Editor
5. Click **"Run"** button
6. ✅ Wait for "Success"

---

## Migration 2: Stripe Webhooks

**File:** `src/supabase/migrations/20260209_stripe_webhook_idempotency.sql`

1. Open the file
2. Select All → Copy
3. Paste into SQL Editor
4. Click Run
5. ✅ Success

---

## Migration 3: E-Signature Compliance

**File:** `src/supabase/migrations/20260209_esign_compliance.sql`

1. Open the file
2. Select All → Copy
3. Paste into SQL Editor
4. Click Run
5. ✅ Success

---

## Migration 4: Quota Enforcement

**File:** `src/supabase/migrations/20260209_quota_enforcement.sql`

1. Open the file
2. Select All → Copy
3. Paste into SQL Editor
4. Click Run
5. ✅ Success

---

## Migration 5: GDPR Compliance

**File:** `src/supabase/migrations/20260209_gdpr_compliance.sql`

1. Open the file
2. Select All → Copy
3. Paste into SQL Editor
4. Click Run
5. ✅ Success

---

## ✅ Verify Success

After running all 5 migrations, run this check query:

```sql
-- Check new tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'user_security',
    'stripe_webhook_events',
    'subscription_tier_limits',
    'user_consents'
)
ORDER BY table_name;
```

**Expected:** Should show 4 tables

---

## 🔒 Safety Guarantees

✅ All migrations use `CREATE TABLE IF NOT EXISTS`
✅ No `DROP TABLE` commands
✅ No `DELETE FROM` commands
✅ Only ADDS new tables and functions
✅ Your existing data is 100% safe

---

**Time:** 5 minutes
**Risk:** Zero (no data deletion)
**Tables Added:** 20
**Functions Added:** 16+

**Start here:** https://supabase.com/dashboard/project/<your-project-ref>/sql/new
