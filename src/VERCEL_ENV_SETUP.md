# Vercel Environment Variables Setup Guide

## Critical: Fix AI Features

The platform now supports **multiple AI providers**:
- **Gemini (Google)** - Free tier available, recommended
- **Claude (Anthropic)** - High quality, great for content
- **OpenAI** - Premium option

You only need **ONE** API key configured. The system will automatically use whichever is available.

### Step 1: Get Your AI API Key (Choose ONE)

**Option A: Gemini (Recommended - Free Tier)**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Get API Key" or "Create API Key"
4. Copy the generated API key (starts with `AIzaSy...`)

**Option B: Claude (Anthropic)**
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Go to API Keys section
4. Create a new API key
5. Copy the API key (starts with `sk-ant-...`)

**Option C: OpenAI**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign up or log in
3. Create a new API key
4. Copy the API key (starts with `sk-...`)

### Step 2: Add Environment Variable to Vercel

1. Go to your Vercel Dashboard: https://vercel.com/dashboard
2. Select your project: **Alphaclone-systems-legasso**
3. Click on **Settings** tab
4. Click on **Environment Variables** in the left sidebar
5. Add the following variable:

```
Variable Name: VITE_GEMINI_API_KEY
Value: AIzaSy... (your actual API key from Step 1)
Environment: Production, Preview, Development (select all)
```

6. Click **Save**

### Step 3: Redeploy Your Application

After adding the environment variable, you MUST redeploy:

**Option A: Trigger redeploy in Vercel Dashboard**
1. Go to **Deployments** tab
2. Click the three dots (...) on the latest deployment
3. Click **Redeploy**

**Option B: Push a new commit**
```bash
git commit --allow-empty -m "Trigger redeploy with env vars"
git push
```

### Step 4: Verify It's Working

1. Open your live site: https://alphaclone.tech
2. Login to the dashboard
3. Go to **Sales Agent** tab
4. Enter an industry (e.g., "Construction") and location (e.g., "Zimbabwe")
5. Click **Find Leads**
6. You should see AI-generated leads appear!

## What Was Fixed

1. **CSP Headers**: Added `Content-Security-Policy` header to allow Google AI scripts to run
   - Added `'unsafe-eval'` for Google Generative AI library
   - Added `https://generativelanguage.googleapis.com` to connect-src

2. **Error Handling**: Improved error messages to clearly show when API key is missing
   - Console logs now show: ❌ or ✅ status
   - Toast notifications explain the exact issue
   - Better validation before API calls

3. **API Key Validation**: Added checks to ensure API key is configured before making requests

## All Required Environment Variables

Here's the complete list of environment variables you should have in Vercel:

### Required for AI Features
```
VITE_GEMINI_API_KEY=AIzaSy... (your key)
```

### Required for Database
```
VITE_SUPABASE_URL=https://ehekzoioqvtweugemktn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Required for Video Calls
```
VITE_DAILY_DOMAIN=your-domain.daily.co
DAILY_API_KEY=your_daily_api_key_here
```

### Optional (for payments)
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
```

### Optional (for emails)
```
RESEND_API_KEY=re_...
```

## Troubleshooting

### Error: "AI API key is not configured"
- The `VITE_GEMINI_API_KEY` is not set in Vercel
- Go to Settings → Environment Variables and add it
- Make sure to redeploy after adding

### Error: "AI service returned an error"
- The API key might be invalid
- Check the key is correct in Google AI Studio
- Make sure you copied the entire key (no spaces or line breaks)

### Error: "CSP prevents evaluation"
- This has been fixed in `vercel.json`
- Make sure you've pushed the latest code
- Redeploy your application

### AI is still not working after setup
1. Open browser console (F12)
2. Look for messages starting with ❌ or ⚠️
3. Check if `VITE_GEMINI_API_KEY is not set!` appears
4. If yes, the environment variable wasn't applied - try redeploying

## Testing the Fix Locally

To test locally before deploying:

1. Add the API key to your `.env` file:
   ```
   VITE_GEMINI_API_KEY=AIzaSy...
   ```

2. Restart your dev server:
   ```bash
   npm run dev
   ```

3. Open http://localhost:5173
4. Go to Sales Agent and test lead generation

## Support

If you still have issues:
1. Check the browser console for error messages
2. Check Vercel deployment logs for build errors
3. Verify all environment variables are set correctly
4. Make sure you redeployed after adding variables
