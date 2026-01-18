# 🚨 Critical Fix: Supabase Connection Failed

The error **"Supabase URL is not reachable"** means your Vercel deployment doesn't know *where* your database is. The Environment Variables are likely missing or incorrect.

## How to Fix in Vercel

1.  **Go to your Vercel Dashboard.**
2.  Select your project (**Alphaclone-systems-legasso**).
3.  Click on **Settings** (top menu).
4.  Click on **Environment Variables** (left sidebar).
5.  **Check for these two variables:**
    *   `VITE_SUPABASE_URL`
    *   `VITE_SUPABASE_ANON_KEY`

### ❌ If they are missing:
You need to add them.
1.  Find your `.env` file in your local project folder.
2.  Copy the value of `VITE_SUPABASE_URL` from your local file.
3.  In Vercel, enter `VITE_SUPABASE_URL` as the Key, and paste the value.
4.  Click **Save**.
5.  Repeat for `VITE_SUPABASE_ANON_KEY`.

### ⚠️ If they exist but might be wrong:
1.  Compare the values in Vercel with your local `.env` file (which you know works).
2.  If they are different, update Vercel to match your local file.

## ⚡ FINAL STEP: Redeploy
**Crucial:** After changing environment variables, you **MUST Redeploy** for them to take effect.
1.  Go to the **Deployments** tab in Vercel.
2.  Click the **three dots** (...) on your latest deployment.
3.  Select **Redeploy**.
