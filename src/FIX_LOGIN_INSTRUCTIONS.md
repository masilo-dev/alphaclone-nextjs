# Restoring Access After Deployment

Your login failed because the new environment (Supabase Project) likely has an empty database and no user accounts.

## Step 1: Run Migrations
Ensure your new database has all the tables.
Run the command in your terminal:
```bash
npx supabase migration up
```
Or paste the contents of `supabase/migrations/combined_migration.sql` into the Supabase Dashboard SQL Editor.

## Step 2: Create Your User
Since your old login details are on the *old* database, they won't work here.
1. Go to your **Supabase Dashboard** > **Authentication** > **Users**.
2. Click **Add User**.
3. Create a new user with your email and password.
4. *Note:* The system will automatically create a user profile for you via triggers.

## Step 3: Promote to Admin (Optional)
If you need admin access, run this SQL in the Supabase SQL Editor:
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

## Troubleshooting
If you still see "Invalid login details", double check your Vercel Environment Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
Ensure they match the project you are looking at in the Supabase Dashboard.
