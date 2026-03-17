# ⚡ AlphaClone Systems - Quick Reference Card

## 🚀 Quick Start

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🔧 Environment Variables (Required)

### Client-Side (VITE_ prefix)
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
VITE_LIVEKIT_URL=wss://xxx.livekit.cloud
VITE_LIVEKIT_API_KEY=APIxxx
VITE_LIVEKIT_API_SECRET=xxx
VITE_GEMINI_API_KEY=AIzaSyxxx
VITE_STRIPE_PUBLIC_KEY=pk_test_xxx
VITE_APP_URL=http://localhost:3000
```

### Server-Side (NO VITE_ prefix - Vercel only)
```env
LIVEKIT_API_KEY=APIxxx
LIVEKIT_API_SECRET=xxx
STRIPE_SECRET_KEY=sk_test_xxx
SUPABASE_SERVICE_KEY=eyJxxx...
```

---

## 📦 Database Setup

```bash
# Apply all migrations
npx supabase migration up

# Create admin user (in Supabase SQL Editor)
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'your@email.com';
```

---

## 🌐 Deployment

```bash
# Deploy to Vercel
vercel --prod

# Check deployment status
vercel ls

# View logs
vercel logs
```

---

## 🔍 Troubleshooting

### Issue: Build Fails
```bash
rm -rf node_modules dist
npm install --legacy-peer-deps
npm run build
```

### Issue: Environment Variables Not Working
1. Add to Vercel: Settings → Environment Variables
2. Redeploy after adding variables
3. Check variable names (VITE_ for client, none for server)

### Issue: Database Connection Fails
1. Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
2. Check migrations are applied
3. Ensure RLS policies are enabled

### Issue: API 429 Error (Rate Limited)
- Wait 15 minutes or contact admin to reset
- Rate limit: 100 requests per 15 minutes

### Issue: CORS Error
- Update `vercel.json` with your domain
- Redeploy after updating

---

## 📊 Key URLs

### Development
- **Local App**: http://localhost:3000
- **Local API**: http://localhost:3000/api/*

### Production
- **App**: https://your-domain.vercel.app
- **API**: https://your-domain.vercel.app/api/*
- **Supabase Dashboard**: https://app.supabase.com
- **Vercel Dashboard**: https://vercel.com/dashboard

---

## 🎯 Important Files

| File | Purpose |
|------|---------|
| `.env.local` | Local environment variables |
| `vercel.json` | Deployment configuration |
| `tsconfig.json` | TypeScript configuration |
| `vite.config.ts` | Build configuration |
| `supabase/migrations/` | Database schema |

---

## 🔐 Security Checklist

- [ ] Environment variables set correctly
- [ ] CORS configured for your domain
- [ ] Rate limiting active on APIs
- [ ] Admin user credentials secure
- [ ] Stripe keys in live mode (production)
- [ ] Supabase RLS policies enabled

---

## 📱 Testing Checklist

- [ ] User registration works
- [ ] User login works
- [ ] Projects can be created
- [ ] Messages can be sent
- [ ] Video calls work (LiveKit)
- [ ] AI features work (Gemini)
- [ ] Payments work (Stripe)
- [ ] PWA installs on mobile

---

## 🆘 Emergency Contacts

### Service Status Pages
- Supabase: https://status.supabase.com
- Vercel: https://vercel-status.com
- LiveKit: https://status.livekit.io
- Stripe: https://status.stripe.com

### Support
- Supabase: support@supabase.com
- Vercel: support@vercel.com
- LiveKit: support@livekit.io

---

## 🚨 Common Commands

```bash
# View service status
vercel inspect [deployment-url]

# View real-time logs
vercel logs --follow

# List all deployments
vercel ls

# Remove old deployment
vercel remove [deployment-id]

# Database migrations
npx supabase migration list
npx supabase migration up
npx supabase db reset  # CAUTION: Deletes all data

# Check TypeScript errors
npx tsc --noEmit

# Build analysis
npm run build -- --analyze
```

---

## 💡 Pro Tips

1. **Use Vercel Preview Deployments** for testing
2. **Check Vercel logs** for API errors
3. **Monitor Supabase metrics** for performance
4. **Use React Query DevTools** in development
5. **Test on real mobile devices** before launch
6. **Set up alerts** in Sentry for production errors
7. **Review Stripe webhooks** for payment issues
8. **Keep dependencies updated** monthly

---

## 📈 Performance Targets

| Metric | Target | Check With |
|--------|--------|------------|
| Lighthouse Performance | 90+ | Chrome DevTools |
| First Contentful Paint | <1.5s | Lighthouse |
| Time to Interactive | <3s | Lighthouse |
| Bundle Size | <700 KB | `npm run build` |
| API Response Time | <500ms | Network tab |

---

## 🎨 Customization

### Change Brand Colors
Edit `tailwind.config.js`:
```javascript
colors: {
  primary: '#your-color',
  secondary: '#your-color',
}
```

### Change Logo
Replace `/public/logo.png`

### Change Company Name
Edit `constants.ts`:
```typescript
export const COMPANY_NAME = 'Your Company';
```

---

## 📚 Documentation

- **Full Setup**: See `SETUP_GUIDE.md`
- **All Fixes**: See `FIXES_AND_IMPROVEMENTS.md`
- **Complete Analysis**: See `PROJECT_ANALYSIS_SUMMARY.md`

---

**Version**: 1.0.0  
**Last Updated**: December 2025  
**Status**: Production Ready ✅

---

*Keep this reference handy for quick lookups during development and deployment!*

