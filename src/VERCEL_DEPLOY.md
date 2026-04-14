# Vercel Deployment Guide for AlphaClone Systems

## Prerequisites
- Supabase database deployed (migrations run)
- Admin accounts created
- Vercel account (free tier works)

## Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

## Step 2: Login to Vercel

```bash
vercel login
```

## Step 3: Deploy to Vercel

```bash
vercel
```

Follow the prompts:
- **Set up and deploy?** Yes
- **Which scope?** Select your account
- **Link to existing project?** No
- **Project name?** alphaclone-systems (or your preferred name)
- **Directory?** ./ (current directory)
- **Override settings?** No

## Step 4: Add Environment Variables

After initial deployment, add environment variables:

```bash
vercel env add VITE_SUPABASE_URL
```
Enter: `https://your-project-ref.supabase.co`

```bash
vercel env add VITE_SUPABASE_ANON_KEY
```
Enter: `<your-supabase-anon-key>`

```bash
vercel env add VITE_SUPABASE_SERVICE_KEY
```
Enter: `<your-supabase-service-role-key>`

```bash
vercel env add VITE_RESEND_API_KEY
```
Enter: `re_your_resend_key`

## Step 5: Redeploy with Environment Variables

```bash
vercel --prod
```

## Alternative: Deploy via Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your Git repository (GitHub/GitLab/Bitbucket)
3. Configure project:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add environment variables in project settings
5. Deploy!

## Environment Variables (Dashboard Method)

Go to Project Settings > Environment Variables and add:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | `https://your-project-ref.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `VITE_SUPABASE_SERVICE_KEY` | Your Supabase service key |
| `VITE_RESEND_API_KEY` | `re_your_resend_key` |

## Step 6: Update Supabase Auth Settings

After deployment, update Supabase Auth settings:

1. Go to Supabase Dashboard > Authentication > URL Configuration
2. Add your Vercel URL to **Site URL**: `https://your-project.vercel.app`
3. Add to **Redirect URLs**: `https://your-project.vercel.app/**`

## Step 7: Test Production Deployment

1. Visit your Vercel URL
2. Test login with admin credentials
3. Verify all features work:
   - Authentication
   - Projects CRUD
   - Real-time chat
   - Contact form
   - Email notifications

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify TypeScript has no errors

### Environment Variables Not Working
- Make sure variable names start with `VITE_`
- Redeploy after adding variables
- Check they're set for Production environment

### Authentication Issues
- Verify Supabase URL in Auth settings
- Check redirect URLs include your Vercel domain
- Ensure environment variables are correct

## Custom Domain (Optional)

1. Go to Project Settings > Domains
2. Add your custom domain (e.g., alphaclone.tech)
3. Update DNS records as instructed
4. Update Supabase Auth URLs to use custom domain

## Automatic Deployments

If you connected a Git repository:
- Every push to `main` branch triggers production deployment
- Pull requests get preview deployments
- Rollback to previous deployments anytime

## Done! 🎉

Your AlphaClone Systems is now live on Vercel with:
- ✅ Supabase backend
- ✅ Real-time features
- ✅ Email notifications
- ✅ Secure authentication
- ✅ Global CDN
- ✅ Automatic HTTPS
