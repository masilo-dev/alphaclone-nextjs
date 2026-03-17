# Vercel Deployment Guide

## Status: Code Pushed to GitHub ✅

All changes have been successfully pushed to GitHub:
- Repository: `https://github.com/masilo-dev/Alphaclone-systems-legasso.git`
- Branch: `main`
- Commit: `23c41b8` - "Complete platform fixes: Multi-page website, portfolio editing, performance optimizations, and dashboard improvements"

## Deployment Options

### Option 1: Automatic Deployment (Recommended)

If your Vercel project is already connected to GitHub:

1. **Vercel will automatically deploy** when it detects the new push
2. Go to your Vercel dashboard: https://vercel.com/dashboard
3. Check the "Deployments" tab
4. You should see a new deployment in progress or completed

### Option 2: Manual Deployment via Vercel CLI

If you prefer to deploy manually:

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

### Option 3: Connect Repository (First Time)

If this is the first time deploying:

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your GitHub repository: `masilo-dev/Alphaclone-systems-legasso`
4. Vercel will auto-detect the settings:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install --legacy-peer-deps`
5. Click "Deploy"

## Environment Variables Required

Make sure these are set in Vercel Dashboard → Settings → Environment Variables:

### Server-Side (API Routes)
- `LIVEKIT_API_KEY` - Your LiveKit API key
- `LIVEKIT_API_SECRET` - Your LiveKit API secret
- `STRIPE_SECRET_KEY` - Your Stripe secret key

### Client-Side (Build Time)
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `VITE_GEMINI_API_KEY` - Your Google Gemini API key
- `VITE_STRIPE_PUBLIC_KEY` - Your Stripe publishable key (optional)

## Vercel Configuration

The `vercel.json` file is already configured with:
- ✅ API route rewrites
- ✅ SPA routing (all routes → index.html)
- ✅ Security headers
- ✅ CORS configuration
- ✅ Cache headers for assets
- ✅ Build settings

## Post-Deployment Checklist

After deployment:

1. ✅ Verify the site loads: https://alphaclone.tech
2. ✅ Test all public pages:
   - Home: `/`
   - Ecosystem: `/ecosystem`
   - Services: `/services`
   - About: `/about`
   - Contact: `/contact`
   - Portfolio: `/portfolio`
3. ✅ Test dashboard login
4. ✅ Verify portfolio editing works
5. ✅ Check API endpoints are working
6. ✅ Test messaging functionality
7. ✅ Verify video conferencing (LiveKit)

## Troubleshooting

### Build Fails
- Check Vercel build logs
- Ensure all environment variables are set
- Verify `npm install --legacy-peer-deps` works locally

### API Routes Not Working
- Verify environment variables are set correctly
- Check CORS settings in `vercel.json`
- Ensure API routes are in `/api` folder

### Routing Issues
- Verify `vercel.json` has SPA rewrite rules
- Check that all routes point to `/index.html`

## Monitoring

After deployment, monitor:
- Build logs in Vercel dashboard
- Function logs for API routes
- Error tracking (if Sentry is configured)
- Performance metrics

## Next Steps

1. **Deploy to Vercel** (if not auto-deployed)
2. **Set environment variables** in Vercel dashboard
3. **Test the live site**
4. **Monitor for any issues**
5. **Update DNS** if needed (should already be configured)

---

**Current Status**: ✅ Code pushed to GitHub
**Next Action**: Deploy to Vercel (automatic or manual)

