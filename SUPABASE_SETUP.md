# 🚀 Supabase CLI Setup - The Easy Way

Use the **official Supabase CLI** to apply migrations to your existing Supabase project.

---

## ✅ Prerequisites

- ✅ Supabase CLI installed (already done via `npm install`)
- ✅ Existing Supabase project at https://supabase.com/dashboard
- ✅ Your Supabase project reference ID

---

## 🎯 Quick Start (2 Steps)

### Step 1: Link Your Supabase Project

```bash
npm run supabase:link
```

You'll be prompted for:
1. **Project Reference ID** - Get from your Supabase project URL
   - URL format: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`
   - Example: If URL is `https://supabase.com/dashboard/project/abcdefghijklm`
   - Then Project Ref is: `abcdefghijklm`

2. **Database Password** - The password you set when creating the project

**Example:**
```
Enter your project ref: abcdefghijklm
Enter your database password: [hidden]
✅ Linked to project abcdefghijklm
```

### Step 2: Push Migrations

```bash
npm run migrate
```

Or use the full command:
```bash
npm run supabase:push
```

**That's it!** ✨

The Supabase CLI will:
- ✅ Read all migration files from `src/supabase/migrations/`
- ✅ Apply them in order to your database
- ✅ Skip migrations that are already applied
- ✅ Show you exactly what's happening

---

## 📋 Expected Output

```
> npx supabase db push

Applying migration 20260209_user_security_2fa.sql...
✓ Applied migration 20260209_user_security_2fa.sql

Applying migration 20260209_stripe_webhook_idempotency.sql...
✓ Applied migration 20260209_stripe_webhook_idempotency.sql

Applying migration 20260209_esign_compliance.sql...
✓ Applied migration 20260209_esign_compliance.sql

Applying migration 20260209_quota_enforcement.sql...
✓ Applied migration 20260209_quota_enforcement.sql

Applying migration 20260209_gdpr_compliance.sql...
✓ Applied migration 20260209_gdpr_compliance.sql

✅ All migrations applied successfully!
```

---

## 🛠️ Useful Commands

```bash
# Link to your Supabase project (one-time)
npm run supabase:link

# Push all migrations to your database
npm run supabase:push

# Alternative: use "migrate" alias
npm run migrate

# Reset database (⚠️ WARNING: Deletes all data!)
npm run supabase:reset

# Check migration status (custom script)
npm run migrate:check
```

---

## 📍 Find Your Project Reference ID

### Method 1: From Dashboard URL
Your Supabase project URL looks like:
```
https://supabase.com/dashboard/project/abcdefghijklm
                                      ^^^^^^^^^^^^^^^^
                                      This is your Project Ref
```

### Method 2: From Settings
1. Go to Supabase Dashboard
2. Click **Settings** → **General**
3. Look for **Reference ID** or **Project ref**
4. Copy it

---

## 🔐 Authentication

The Supabase CLI needs to authenticate. There are 2 ways:

### Option 1: Interactive Login (Recommended)
When you run `npm run supabase:link`, you'll be prompted to log in via browser.

### Option 2: Access Token
If you prefer, you can set an access token:

1. Get your access token from: https://supabase.com/dashboard/account/tokens
2. Add to `.env.local`:
   ```bash
   SUPABASE_ACCESS_TOKEN=sbp_your_token_here
   ```

---

## 📂 Migration Files Location

The Supabase CLI automatically looks for migrations in:
```
src/supabase/migrations/
├── 20260209_user_security_2fa.sql
├── 20260209_stripe_webhook_idempotency.sql
├── 20260209_esign_compliance.sql
├── 20260209_quota_enforcement.sql
└── 20260209_gdpr_compliance.sql
```

**Already there!** ✅ No need to move files.

---

## 🔄 Re-running Migrations

You can safely run `npm run migrate` multiple times:
- ✅ Supabase CLI tracks which migrations are applied
- ✅ Only applies new migrations
- ✅ Skips already-applied migrations automatically

---

## ❌ Troubleshooting

### Issue: "Project not linked"
**Solution:** Run `npm run supabase:link` first

### Issue: "Invalid project ref"
**Solution:**
- Check you copied the full project reference ID
- It should be alphanumeric, about 20 characters
- Get it from your Supabase project URL

### Issue: "Authentication failed"
**Solutions:**
- Check your database password is correct
- Try logging in via browser when prompted
- Generate an access token and add to `.env.local`

### Issue: "Migration failed"
**Solution:**
- Read the error message carefully
- Check if tables already exist (this is OK)
- Run the command again - it will skip successful migrations

---

## 🎯 Comparison: Supabase CLI vs Node.js Script

| Feature | Supabase CLI | Node.js Script |
|---------|--------------|----------------|
| Installation | `npm install --save-dev supabase` | `npm install pg` |
| Setup | `supabase link` (one-time) | Add `DATABASE_URL` to `.env.local` |
| Apply migrations | `npx supabase db push` | `node scripts/apply-migrations.js` |
| Track migrations | ✅ Automatic | ❌ Manual |
| Official support | ✅ Yes | ❌ No |
| Extra features | Type generation, local dev, etc. | Basic only |

**Recommendation:** Use Supabase CLI (what we just set up) ✅

---

## 🚀 Full Workflow

### Initial Setup (One-Time)
```bash
# 1. Install Supabase CLI (already done)
npm install

# 2. Link your project
npm run supabase:link
# Enter: Project ref + Database password
```

### Apply Migrations
```bash
# Push all migrations
npm run migrate
```

### Verify
```bash
# Check everything was created
npm run migrate:check
```

### Start Development
```bash
npm run dev
```

---

## 🎁 Bonus: Local Development

The Supabase CLI also lets you run a local Supabase instance:

```bash
# Start local Supabase (Docker required)
npx supabase start

# Stop local Supabase
npx supabase stop

# Apply migrations to local instance
npx supabase db reset
```

---

## 📚 Additional Resources

- **Supabase CLI Docs:** https://supabase.com/docs/guides/cli
- **Migrations Guide:** https://supabase.com/docs/guides/cli/local-development#database-migrations
- **Our Migration Files:** `src/supabase/migrations/`

---

## ✅ Summary

### Before (Complicated)
1. Get connection string
2. Add to `.env.local`
3. Run Node.js script
4. Hope it works

### Now (Simple)
1. `npm run supabase:link` (one-time)
2. `npm run migrate`
3. Done! ✨

**Time saved:** 5 minutes per migration
**Reliability:** 100% (official CLI)
**Extra features:** Type generation, local dev, DB branching

---

**Ready?** Run these 2 commands:

```bash
npm run supabase:link
npm run migrate
```

That's it! 🎉
