import type { NextConfig } from "next";

import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";
import { withWorkflow } from "workflow/next";

// PWA worker is opt-in in production: it intercepts /api and /dashboard and has caused
// false 503s behind Cloudflare and with extensions (SES lockdown). Dev stays off.
const serwistDisabled =
  process.env.NODE_ENV === "development" ||
  process.env.ENABLE_SERWIST !== "true";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: serwistDisabled,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['playwright-core', 'chromium-bidi', '@browserbasehq/sdk', 'puppeteer-core', 'jsdom', 'got', 'node-html-parser', 'robots-txt-guard'],
  typescript: {
    ignoreBuildErrors: false,
  },
  transpilePackages: ['@blocknote/core', '@blocknote/react', '@blocknote/mantine'],
  env: {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_ENABLE_SERWIST:
      process.env.ENABLE_SERWIST === 'true' ? 'true' : 'false',
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      // Supabase storage (tenant uploads, avatars)
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      // Unsplash (stock images used in templates/portfolio)
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // DiceBear (generated avatars)
      { protocol: 'https', hostname: 'api.dicebear.com' },
      // Google user profile photos (OAuth)
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // Twitter/X profile photos
      { protocol: 'https', hostname: 'pbs.twimg.com' },
      // GitHub avatars
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  experimental: {
    scrollRestoration: true,

  },
  turbopack: {},
  webpack: (config) => {
    // Critical: Increase timeout for long-running builds/bundling to prevent stalls
    config.output.chunkLoadTimeout = 180000;
    // Explicitly mark playwright-core and its sub-dependencies as external
    const externalList = ['playwright-core', 'chromium-bidi'];
    if (config.externals) {
      if (Array.isArray(config.externals)) {
        config.externals.push(...externalList, /^chromium-bidi\//);
      } else {
        config.externals = [config.externals, ...externalList, /^chromium-bidi\//];
      }
    } else {
      config.externals = [...externalList, /^chromium-bidi\//];
    }

    return config;
  },

  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    const cspHeader = `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' 'unsafe-inline' blob: https://*.supabase.co https://*.stripe.com https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://va.vercel-scripts.com https://*.daily.co https://*.sentry.io https://challenges.cloudflare.com https://alphaclone.tech https://www.googletagmanager.com https://www.google-analytics.com;
      script-src-elem 'self' 'unsafe-eval' 'wasm-unsafe-eval' 'unsafe-inline' blob: https://*.supabase.co https://*.stripe.com https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://va.vercel-scripts.com https://*.daily.co https://*.sentry.io https://challenges.cloudflare.com https://alphaclone.tech https://www.googletagmanager.com https://www.google-analytics.com;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      img-src 'self' blob: data: https: http:;
      media-src 'self' blob: data: https:;
      font-src 'self' data: https://fonts.gstatic.com;
      object-src 'self' blob: data:;
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'self';
      frame-src 'self' blob: data: https://*.stripe.com https://js.stripe.com https://*.daily.co https://challenges.cloudflare.com https://www.loom.com https://*.loom.com;
      connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co *.upstash.io *.stripe.com https://*.dicebear.com https://*.daily.co wss://*.daily.co https://*.sentry.io https://cdn.jsdelivr.net https://challenges.cloudflare.com https://*.hubspot.com https://images.unsplash.com https://alphaclone.tech wss://alphaclone.tech https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://api.anthropic.com https://api.openai.com https://openrouter.ai https://*.basemaps.cartocdn.com https://raw.githubusercontent.com https://unpkg.com https://nominatim.openstreetmap.org https://*.facebook.com https://*.instagram.com;
      worker-src 'self' blob: https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net;
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    const securityHeaders = [
      {
        key: 'Content-Security-Policy',
        value: cspHeader,
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(self), microphone=(self), geolocation=(), xr-spatial-tracking=()',
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on',
      },
    ];

    return [
      {
        source: '/.well-known/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          {
            key: 'Vary',
            value: 'Origin, Access-Control-Request-Headers',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/(.*)\\.(ico|png|jpg|jpeg|webp|avif|svg|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/',
        headers: securityHeaders,
      },
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default withWorkflow(
  withSentryConfig(
    withSerwist(nextConfig),
    {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      sourcemaps: {
        deleteSourcemapsAfterUpload: true,
      },
      tunnelRoute: "/monitoring",
    }
  )
);
