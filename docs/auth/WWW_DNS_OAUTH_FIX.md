# Why social OAuth shows `DNS_PROBE_FINISHED_NXDOMAIN` for www

**Date:** 2026-07-24  
**Symptom:** After Google / LinkedIn / Facebook (or any IdP) sign-in, the browser fails with:

`This site can’t be reached` · `www.alphaclonesystems.com` · `DNS_PROBE_FINISHED_NXDOMAIN`

## Root cause

| Host | DNS | App |
|------|-----|-----|
| `alphaclonesystems.com` | Resolves (Cloudflare → Railway) | Works |
| `www.alphaclonesystems.com` | **NXDOMAIN** (no A/AAAA/CNAME) | Unreachable |

OAuth always ends with an HTTP redirect back to your app. If Supabase **Site URL**, **Redirect URLs**, or an Apple/Google return URL uses `https://www.…`, the browser tries to open `www` and DNS fails — **before** our Next.js `www → apex` redirect in `proxy.ts` can run (that redirect only works if `www` already points at the app).

This is **not** an Apple/Google/Facebook bug. It is DNS + redirect configuration.

## Fix now (Cloudflare — required)

In Cloudflare DNS for `alphaclonesystems.com`, add:

```text
Type: CNAME
Name: www
Target: alphaclonesystems.com
Proxy: Proxied (orange cloud)
```

Optional but recommended — Cloudflare **Redirect Rule** (or Bulk Redirect):

```text
https://www.alphaclonesystems.com/*
→ https://alphaclonesystems.com/$1
(301)
```

Until `www` has DNS, bookmarks and OAuth returns to `www` will keep showing NXDOMAIN.

## Fix in Supabase Auth (required)

Dashboard → Authentication → URL Configuration:

- **Site URL:** `https://alphaclonesystems.com` (apex only — **not** www)
- **Redirect URLs** must include:
  - `https://alphaclonesystems.com/auth/callback`
  - `https://alphaclonesystems.com/**` (if you use wildcards)
- Remove any `https://www.alphaclonesystems.com…` entries until www DNS exists (or keep them only after the CNAME is live)

## Fix in provider consoles

Apple / Google / Facebook / LinkedIn authorized redirect URIs must use the **apex**:

- Supabase callback form: `https://<project>.supabase.co/auth/v1/callback` (provider → Supabase)
- App return / Site URL: apex as above

## Code hardening (this repo)

- Social OAuth `redirectTo` uses `getOAuthRedirectOrigin()` → always apex
- `PUBLIC_APP_ORIGIN` / `NEXT_PUBLIC_APP_URL` with `www.` are rewritten to apex
- `proxy.ts` still 301s www → apex **once www DNS exists**

## Verify

```bash
host www.alphaclonesystems.com   # must NOT say NXDOMAIN
curl -sI https://www.alphaclonesystems.com | head  # should 301/200 via Cloudflare
# Then: Sign in with Google from https://alphaclonesystems.com/auth/login
```

## Use this URL

Always open: **https://alphaclonesystems.com** (no `www`).
