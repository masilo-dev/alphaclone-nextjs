# 🚀 Deployment Guide - AlphaClone Systems

## Prerequisites Checklist

Before deploying, ensure you have:
- [ ] GitHub account
- [ ] Vercel account (sign up at vercel.com)
- [ ] Supabase project created
- [ ] Git installed
- [ ] Supabase CLI installed (`npm install -g supabase`)

---

## Step 1: Push to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit your changes
git commit -m "Production ready: All 45 audit fixes implemented"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/alphaclone-systems.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy Database to Supabase

### 2.1 Link to your Supabase project

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF
```

### 2.2 Apply all migrations

```bash
# Apply migrations in order
supabase db push

# Or apply individually:
supabase migration up --file supabase/migrations/20241207000001_initial_schema.sql
supabase migration up --file supabase/migrations/20241207000002_rls_policies.sql
supabase migration up --file supabase/migrations/20241207000003_storage_buckets.sql
supabase migration up --file supabase/migrations/20241207000005_security_tracking.sql
supabase migration up --file supabase/migrations/20251209_activity_tracking.sql
supabase migration up --file supabase/migrations/20251209_fix_rls_insert.sql
```

### 2.3 Get your Supabase credentials

```bash
# Get your project URL and keys
supabase status
```

Save these values:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## Step 3: Deploy to Vercel

### Option A: Using Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Follow the prompts:
# - Link to existing project? No
# - Project name: alphaclone-systems
# - Directory: ./
# - Override settings? No

# Deploy to production
vercel --prod
```

### Option B: Using Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

---

## Step 4: Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Gemini AI
VITE_GEMINI_API_KEY=your_gemini_key

# LiveKit (Video)
VITE_LIVEKIT_URL=your_livekit_url
VITE_LIVEKIT_API_KEY=your_api_key
VITE_LIVEKIT_API_SECRET=your_api_secret

# Stripe (Payments)
VITE_STRIPE_PUBLIC_KEY=your_stripe_public_key
STRIPE_SECRET_KEY=your_stripe_secret_key
```

After adding variables, redeploy:
```bash
vercel --prod
```

---

## Step 5: Verify Deployment

### Test these features:

1. **Registration**
   - Go to your Vercel URL
   - Click "Sign Up"
   - Create an account
   - Verify it works

2. **Login**
   - Sign in with your credentials
   - Check dashboard loads

3. **Database Connection**
   - Create a test project
   - Send a test message
   - Verify data appears

4. **Performance**
   - Run Lighthouse audit
   - Should score 90+

---

## Quick Deploy Commands

```bash
# Full deployment in one go
git add .
git commit -m "Deploy to production"
git push origin main
vercel --prod
```

---

## Troubleshooting

### Build fails on Vercel
- Check build logs in Vercel dashboard
- Verify all dependencies are in package.json
- Ensure environment variables are set

### Database connection fails
- Verify Supabase URL and keys
- Check RLS policies are applied
- Ensure migrations ran successfully

### Environment variables not working
- Make sure they start with `VITE_` for client-side
- Redeploy after adding variables
- Check they're set for Production environment

---

## Post-Deployment

1. **Set up custom domain** (optional)
   - Vercel Dashboard → Domains
   - Add your domain

2. **Enable analytics**
   - Vercel Dashboard → Analytics
   - Enable Web Analytics

3. **Set up monitoring**
   - Add Sentry DSN for error tracking
   - Monitor Vercel logs

---

## Need Help?

If you encounter issues:
1. Check Vercel deployment logs
2. Check Supabase logs
3. Verify all environment variables
4. Test locally first with `npm run build && npm run preview`

---

**Your app is production-ready! All 45 audit fixes are complete.** 🎉
