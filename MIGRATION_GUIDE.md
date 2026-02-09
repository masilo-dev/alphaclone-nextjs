# 🚀 Database Migration Guide

This guide will help you apply all database migrations to your Supabase instance using the automated migration script.

---

## ✅ Prerequisites

Before running migrations, ensure you have:

1. **Supabase Project** - Created at https://supabase.com/dashboard
2. **Database Connection String** - Found in Supabase Dashboard → Settings → Database
3. **Node.js Installed** - Version 18+ recommended
4. **Project Dependencies Installed** - Run `npm install`

---

## 🎯 Quick Start (Recommended)

### Step 1: Install Dependencies

```bash
npm install
```

This will install the required `pg` (PostgreSQL client) package.

### Step 2: Get Your Database Connection String

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Settings** → **Database**
4. Scroll to "Connection string" section
5. Copy the **"Connection string"** under **"Direct connection"**
6. Replace `[YOUR-PASSWORD]` with your actual database password

Example:
```
postgresql://postgres:your_password@db.abcdefghijklm.supabase.co:5432/postgres
```

### Step 3: Add Connection String to .env.local

Create or update `.env.local` in your project root:

```bash
# Database Connection
DATABASE_URL="postgresql://postgres:your_password@db.abcdefghijklm.supabase.co:5432/postgres"

# Or alternatively use:
SUPABASE_DB_URL="postgresql://postgres:your_password@db.abcdefghijklm.supabase.co:5432/postgres"
```

**⚠️ IMPORTANT:** Never commit `.env.local` to git. It's already in `.gitignore`.

### Step 4: Run Migrations

```bash
npm run migrate
```

That's it! The script will:
- ✅ Connect to your database
- ✅ Apply all 5 migrations in order
- ✅ Skip migrations that are already applied
- ✅ Verify all tables and functions were created
- ✅ Show a detailed summary

---

## 📋 What Gets Applied

The migration script applies these 5 migrations in order:

### 1. User Security & 2FA (`20260209_user_security_2fa.sql`)
- Creates `user_security` table
- Stores 2FA secrets and backup codes
- RLS policies for user privacy

### 2. Stripe Webhook Security (`20260209_stripe_webhook_idempotency.sql`)
- Creates `stripe_webhook_events` table
- Creates `stripe_payments` table
- Creates `webhook_failures` table
- Implements idempotency checking
- Payment reconciliation functions

### 3. E-Signature Compliance (`20260209_esign_compliance.sql`)
- Creates 5 tables for ESIGN Act compliance:
  - `contract_audit_trail` - Audit log for all contract actions
  - `esignature_consents` - User consent records
  - `signature_events` - Signature action tracking
  - `signature_certificates` - Completion certificates
  - `contract_versions` - Contract version history

### 4. Quota Enforcement (`20260209_quota_enforcement.sql`)
- Creates `subscription_tier_limits` table
- Creates `tenant_usage_tracking` table
- Creates `usage_events` table
- Creates `quota_alerts` table
- Inserts 4 subscription tiers (free, starter, pro, enterprise)
- Functions: `track_usage()`, `can_perform_action()`

### 5. GDPR Compliance (`20260209_gdpr_compliance.sql`)
- Creates `user_consents` table
- Creates `data_export_requests` table
- Creates `data_deletion_requests` table
- Creates `data_processing_log` table
- Creates `privacy_policy_versions` table
- Creates `terms_of_service_versions` table
- Functions: `record_consent()`, `request_data_export()`, `request_data_deletion()`, `anonymize_user_data()`

**Total:** 20 tables, 16+ functions

---

## 🔍 Verify Migrations

After running migrations, verify they were applied successfully:

```bash
npm run migrate:check
```

This will check:
- ✅ All 20 tables exist
- ✅ All required functions exist
- ✅ 4 subscription tiers are configured

---

## 🛠️ Alternative Methods

### Method 1: Using Environment Variable (One-Time)

```bash
DATABASE_URL="postgresql://..." npm run migrate
```

### Method 2: Supabase Dashboard (Manual)

If you prefer to apply migrations manually:

1. Go to Supabase Dashboard → SQL Editor
2. Open each migration file from `src/supabase/migrations/`
3. Copy the entire file contents
4. Paste into SQL Editor
5. Click "Run"

See `APPLY_MIGRATIONS.md` for detailed manual instructions.

---

## 📊 Expected Output

When migrations run successfully, you'll see:

```
╔════════════════════════════════════════════════════════════════╗
║         AlphaClone Database Migration Application              ║
╚════════════════════════════════════════════════════════════════╝

📍 Project: C:\Users\...\alphaclone-nextjs-6
📁 Migrations: src\supabase\migrations
📝 Migrations to apply: 5

🔌 Connecting to database...
✅ Connected successfully

📄 Applying migration: 20260209_user_security_2fa.sql
   Size: 3.45 KB
   Executing...
   ✅ Success!
   Duration: 0.42s

📄 Applying migration: 20260209_stripe_webhook_idempotency.sql
   Size: 5.67 KB
   Executing...
   ✅ Success!
   Duration: 0.58s

... (continues for all migrations) ...

╔════════════════════════════════════════════════════════════════╗
║                      Migration Summary                         ║
╚════════════════════════════════════════════════════════════════╝

✅ Successful: 5/5
⚠️  Skipped: 0/5
❌ Failed: 0/5
⏱️  Total time: 2.34s

🔍 Verifying migrations...

Checking tables...
  ✅ user_security
  ✅ stripe_webhook_events
  ✅ stripe_payments
  ... (all 20 tables) ...

Found 20/20 tables

Checking subscription tiers...
  ✅ Subscription tiers:
     - free: 2 users, 3 projects, 500MB
     - starter: 10 users, 25 projects, 5000MB
     - pro: 50 users, 100 projects, 25000MB
     - enterprise: 999999 users, 999999 projects, ∞

Checking functions...
  ✅ Found 7 functions:
     - anonymize_user_data()
     - can_perform_action()
     - get_tenant_usage_summary()
     - record_consent()
     - request_data_deletion()
     - request_data_export()
     - track_usage()

╔════════════════════════════════════════════════════════════════╗
║                    🎉 All Done!                                ║
╚════════════════════════════════════════════════════════════════╝

Next steps:
  1. Review the verification results above
  2. Test your application with the new migrations
  3. Configure environment variables for new features:
     - UPSTASH_REDIS_REST_URL
     - UPSTASH_REDIS_REST_TOKEN
     - SENTRY_DSN
     - SENTRY_AUTH_TOKEN
  4. Deploy to production when ready
```

---

## ❌ Troubleshooting

### Error: "Missing DATABASE_URL environment variable"

**Solution:** Add `DATABASE_URL` to your `.env.local` file or pass it as an environment variable.

### Error: "Connection refused" or "timeout"

**Solutions:**
1. Check your database password is correct
2. Verify your IP is allowed in Supabase (Settings → Database → Connection pooling)
3. Check if you're using the correct connection string (Direct connection, not Pooler)

### Error: "already exists"

**This is OK!** The migration script will skip objects that already exist. You can safely run the script multiple times.

### Error: "permission denied"

**Solution:** Make sure you're using the connection string with full permissions (the postgres user).

### Migrations partially applied

**Solution:** Just run `npm run migrate` again. The script will:
- Skip migrations that succeeded
- Retry migrations that failed
- Show detailed error messages

---

## 🔐 Security Best Practices

1. **Never commit database credentials to git**
   - `.env.local` is already in `.gitignore`
   - Use environment variables in production

2. **Use different databases for development/staging/production**
   - Create separate Supabase projects
   - Use different `.env.local` files

3. **Backup before migrating production**
   - Use Supabase's backup feature
   - Test migrations on staging first

4. **Keep your database password secure**
   - Use strong passwords
   - Rotate regularly
   - Don't share in Slack/email

---

## 🔄 Re-running Migrations

You can safely run `npm run migrate` multiple times. The script:

- ✅ Skips tables that already exist
- ✅ Skips functions that already exist
- ✅ Only applies what's missing
- ✅ Shows detailed status for each migration

---

## 📦 What's Next?

After migrations are applied, configure these features:

### 1. Rate Limiting (Upstash Redis)
```bash
# .env.local
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
```

Get keys from: https://upstash.com

### 2. Error Tracking (Sentry)
```bash
# .env.local
SENTRY_DSN="https://..."
SENTRY_AUTH_TOKEN="..."
```

Get keys from: https://sentry.io

### 3. Test New Features
- ✅ 2FA/TOTP in user settings
- ✅ Quota tracking in tenant dashboard
- ✅ E-signature compliance on contracts
- ✅ GDPR data export/deletion requests
- ✅ Stripe webhook processing

---

## 🆘 Need Help?

### Check Migration Status
```bash
npm run migrate:check
```

### View Detailed Logs
The migration script shows detailed logs for each step. If something fails, read the error message carefully.

### Manual Verification
Connect to your database and run:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check functions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- Check subscription tiers
SELECT * FROM subscription_tier_limits ORDER BY users_limit;
```

---

## 📚 Additional Resources

- **Supabase Database Docs:** https://supabase.com/docs/guides/database
- **PostgreSQL Client (pg):** https://node-postgres.com/
- **Project Documentation:** See `WEEK1_SECURITY_FIXES.md` and `WEEK2_PRODUCTION_HARDENING.md`

---

**Ready to migrate? Run `npm run migrate` now!** 🚀
