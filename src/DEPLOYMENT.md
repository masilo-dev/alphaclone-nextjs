# Supabase Deployment Guide

## Prerequisites
- Supabase project created at https://supabase.com
- Project URL: https://ehekzoiogvtweugeinktn.supabase.co

## Step 1: Deploy Database Migrations

### Option A: Using Supabase Dashboard (Recommended)
1. Go to https://supabase.com/dashboard/project/ehekzoiogvtweugeinktn/sql/new
2. Copy and paste the contents of each migration file in order:
   - `supabase/migrations/20241207000001_initial_schema.sql`
   - `supabase/migrations/20241207000002_rls_policies.sql`
   - `supabase/migrations/20241207000003_storage_buckets.sql`
   - `supabase/migrations/20241207000004_functions.sql`
3. Click "Run" for each file

### Option B: Using Supabase CLI
```bash
# Install Supabase CLI (via Scoop on Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref ehekzoiogvtweugeinktn

# Push migrations
supabase db push
```

## Step 2: Create Admin Accounts

### Using Supabase Dashboard
1. Go to Authentication > Users
2. Click "Add user" > "Create new user"
3. Create first admin:
   - Email: `info@alphaclone.tech`
   - Password: `Amgseries@gmail.com`
   - Auto Confirm User: ✓
4. Create second admin:
   - Email: `alphaclonesystems@hotmail.com`
   - Password: `Amgseries@gmail.com`
   - Auto Confirm User: ✓

### Update User Roles to Admin
1. Go to SQL Editor
2. Run this query:
```sql
UPDATE public.profiles 
SET role = 'admin' 
WHERE email IN ('info@alphaclone.tech', 'alphaclonesystems@hotmail.com');
```

## Step 3: Verify Setup

### Check Tables
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

### Check Admin Accounts
```sql
SELECT id, email, name, role FROM public.profiles WHERE role = 'admin';
```

### Check Storage Buckets
```sql
SELECT * FROM storage.buckets;
```

## Step 4: Test the Application

1. Start the development server:
```bash
npm run dev
```

2. Open http://localhost:5173

3. Test login with admin credentials:
   - Email: `info@alphaclone.tech`
   - Password: `Amgseries@gmail.com`

4. Verify:
   - ✓ Login works
   - ✓ Admin dashboard is accessible
   - ✓ Can create projects
   - ✓ Can send messages
   - ✓ Contact form creates notifications

## Troubleshooting

### Migration Errors
- If you get "relation already exists" errors, the table was already created. You can skip that migration or drop the table first.
- Check the Supabase logs in Dashboard > Database > Logs

### Authentication Errors
- Verify environment variables in `.env` are correct
- Check Supabase Dashboard > Settings > API for correct keys
- Ensure RLS policies are enabled

### Email Notifications Not Working
- Verify Resend API key in `.env`
- Check Resend dashboard for email logs
- Ensure sender domain is verified in Resend

## Next Steps

1. Add sample projects via admin dashboard
2. Test contact form submissions
3. Test real-time chat functionality
4. Upload files to test storage buckets
5. Deploy to production (Vercel/Netlify)
