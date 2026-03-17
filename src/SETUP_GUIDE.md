# 🚀 AlphaClone Systems - Complete Setup Guide

## 📋 Prerequisites

Before you begin, ensure you have:
- **Node.js** 18+ installed
- **npm** or **yarn** package manager
- **Git** for version control
- Accounts for:
  - [Supabase](https://supabase.com) - Database & Auth
  - [LiveKit](https://livekit.io) - Video calling
  - [Google AI Studio](https://ai.google.dev) - AI features
  - [Stripe](https://stripe.com) - Payments (optional)
  - [Vercel](https://vercel.com) - Deployment (optional)

---

## 🛠️ Local Development Setup

### Step 1: Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd Alphaclone-systems-legasso-1

# Install dependencies
npm install --legacy-peer-deps
```

### Step 2: Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Copy from .env.example and fill in your values

# SUPABASE (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# LIVEKIT (Required for video)
VITE_LIVEKIT_URL=wss://your-project.livekit.cloud
VITE_LIVEKIT_API_KEY=your-api-key
VITE_LIVEKIT_API_SECRET=your-api-secret

# GOOGLE GEMINI (Optional - for AI)
VITE_GEMINI_API_KEY=your-gemini-key

# STRIPE (Optional - for payments)
VITE_STRIPE_PUBLIC_KEY=pk_test_your-key
STRIPE_SECRET_KEY=sk_test_your-secret

# APP URL
VITE_APP_URL=http://localhost:3000
```

### Step 3: Database Setup

```bash
# Option 1: Using Supabase CLI (Recommended)
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase migration up

# Option 2: Manual SQL Execution
# Go to Supabase Dashboard > SQL Editor
# Run the files in supabase/migrations/ in order
```

### Step 4: Create Initial Admin User

**Method 1: Supabase Dashboard**
1. Go to Authentication > Users
2. Click "Add User"
3. Enter email and password
4. Click "Create User"

**Method 2: SQL**
```sql
-- After user is created via Supabase Auth, promote to admin
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

### Step 5: Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000

---

## ☁️ Production Deployment (Vercel)

### Step 1: Prepare for Deployment

```bash
# Build locally to test
npm run build
npm run preview
```

### Step 2: Deploy to Vercel

**Option A: Vercel CLI**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

**Option B: Vercel Dashboard**
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Configure:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install --legacy-peer-deps`

### Step 3: Configure Environment Variables in Vercel

Go to Project Settings > Environment Variables and add:

**Client-Side Variables (VITE_ prefix)**:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GEMINI_API_KEY=your-gemini-key
VITE_LIVEKIT_URL=wss://your-project.livekit.cloud
VITE_LIVEKIT_API_KEY=your-api-key
VITE_LIVEKIT_API_SECRET=your-api-secret
VITE_STRIPE_PUBLIC_KEY=pk_live_your-key
VITE_APP_URL=https://your-domain.vercel.app
```

**Server-Side Variables (NO VITE_ prefix)**:
```
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
STRIPE_SECRET_KEY=sk_live_your-secret
SUPABASE_SERVICE_KEY=your-service-role-key
```

### Step 4: Update Supabase Auth URLs

1. Go to Supabase Dashboard > Authentication > URL Configuration
2. Update:
   - **Site URL**: `https://your-domain.vercel.app`
   - **Redirect URLs**: `https://your-domain.vercel.app/**`

### Step 5: Update CORS in vercel.json

Update the domain in `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "https://your-domain.vercel.app"
        }
      ]
    }
  ]
}
```

### Step 6: Redeploy

After adding environment variables, trigger a new deployment:
- Vercel CLI: `vercel --prod`
- Dashboard: Deployments tab > Click "..." > Redeploy

---

## 🧪 Testing Your Deployment

### 1. Authentication Test
- [ ] Sign up with new account
- [ ] Sign in with existing account
- [ ] Google OAuth (if configured)
- [ ] Sign out

### 2. Core Features Test
- [ ] Create project
- [ ] Send message in chat
- [ ] Upload files
- [ ] Generate contract
- [ ] Video call functionality

### 3. Performance Test
- [ ] Run Lighthouse audit (should be 90+)
- [ ] Check network waterfall
- [ ] Test on mobile device

---

## 🐛 Troubleshooting

### Issue: "Supabase URL not reachable"

**Solution**:
1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel
2. Check they match your Supabase Dashboard values
3. Redeploy after adding variables

### Issue: "Invalid login credentials"

**Solution**:
1. Ensure database migrations have run
2. Check user exists in Supabase Dashboard > Authentication
3. Verify RLS policies are active

### Issue: "LiveKit token generation failed"

**Solution**:
1. Add server-side variables: `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` (without VITE_ prefix)
2. Keep client-side variables with VITE_ prefix
3. Redeploy

### Issue: Build fails with TypeScript errors

**Solution**:
```bash
# Clear caches
rm -rf node_modules dist .turbo
npm install --legacy-peer-deps
npm run build
```

### Issue: PWA not installing

**Solution**:
1. Ensure you're using HTTPS
2. Check `manifest.json` is accessible
3. Verify service worker registration in DevTools > Application
4. Generate missing icon assets

---

## 📦 Database Migrations

### View Applied Migrations

```bash
npx supabase migration list
```

### Create New Migration

```bash
npx supabase migration new migration_name
```

### Apply Specific Migration

```bash
npx supabase migration up --version 20241207000001
```

### Rollback Migration

```bash
npx supabase migration down --version 20241207000001
```

---

## 🔐 Security Best Practices

### 1. Environment Variables
- ✅ Never commit `.env.local` or `.env`
- ✅ Use VITE_ prefix only for client-safe variables
- ✅ Keep secrets (API keys, service keys) without VITE_ prefix
- ✅ Rotate keys periodically

### 2. Supabase RLS
- ✅ All tables have Row Level Security enabled
- ✅ Policies restrict access by user_id
- ✅ Service role key only used server-side

### 3. API Security
- ✅ CORS restricted to your domain
- ✅ Rate limiting on API endpoints
- ✅ Input validation with Zod schemas

### 4. Authentication
- ✅ Auto-logout after 10 minutes inactivity
- ✅ Failed login attempt tracking
- ✅ Secure password requirements

---

## 📊 Performance Optimization

### 1. Code Splitting
All major components are lazy-loaded:
- Dashboard tabs
- Video components
- Analytics charts

### 2. Caching Strategy
- React Query: 5-minute stale time
- Service Worker: Cache static assets
- Browser: Leverage browser caching

### 3. Build Optimization
```bash
# Analyze bundle size
npm run build -- --analyze

# Check build output
ls -lh dist/assets/
```

---

## 🎨 Customization

### Change Brand Colors

Edit `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      primary: '#your-color',
      secondary: '#your-color',
    }
  }
}
```

### Update Logo

Replace files in `/public/`:
- `logo.png` - Main logo
- `logo-192.png` - PWA icon
- `logo-512.png` - PWA icon

### Modify Constants

Edit `constants.ts`:
```typescript
export const LOGO_URL = '/your-logo.png';
export const COMPANY_NAME = 'Your Company';
```

---

## 🤝 Contributing

### Development Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes
# ...

# Test locally
npm run build
npm run preview

# Commit with descriptive message
git commit -m "feat: add your feature"

# Push and create PR
git push origin feature/your-feature
```

### Code Style

- Use TypeScript strict mode
- Follow existing patterns
- Add JSDoc comments for complex functions
- Write descriptive commit messages

---

## 📞 Support

### Common Resources
- [Supabase Docs](https://supabase.com/docs)
- [LiveKit Docs](https://docs.livekit.io)
- [Vite Docs](https://vitejs.dev)
- [React Query Docs](https://tanstack.com/query)

### Get Help
- Check `FIXES_AND_IMPROVEMENTS.md` for known issues
- Review deployment logs in Vercel
- Check browser console for errors
- Verify all environment variables are set

---

## ✅ Post-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] Admin user created and can login
- [ ] Video calls working (LiveKit)
- [ ] AI features working (Gemini)
- [ ] Payments working (Stripe) - if enabled
- [ ] PWA installable on mobile
- [ ] Lighthouse score 90+
- [ ] All routes accessible (no 404s)
- [ ] CORS properly configured
- [ ] Custom domain configured (optional)

---

**Last Updated**: December 2025
**Version**: 1.0.0

🎉 **Congratulations! Your AlphaClone Systems platform is now live!**

