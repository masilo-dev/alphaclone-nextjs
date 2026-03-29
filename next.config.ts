import type { NextConfig } from "next";

import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@blocknote/core', '@blocknote/react', '@blocknote/mantine'],
  // Expose VITE_ variables to the client-side bundle
  env: {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
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
    // Increase chunk load timeout to prevent ChunkLoadError during slow dev compilations
    config.output.chunkLoadTimeout = 180000; // 3 minutes (default is 120s)
    return config;
  },
  async headers() {
    const cspHeader = `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://*.supabase.co https://*.stripe.com https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://va.vercel-scripts.com https://*.daily.co https://*.sentry.io https://challenges.cloudflare.com;
      script-src-elem 'self' 'unsafe-inline' blob: https://*.supabase.co https://*.stripe.com https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://va.vercel-scripts.com https://*.daily.co https://*.sentry.io https://challenges.cloudflare.com;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      img-src 'self' blob: data: https://*.supabase.co https://*.dicebear.com https://*.stripe.com https://img.logo.dev https://images.unsplash.com https://*.hubspot.com;
      media-src 'self' https://assets.mixkit.co;
      font-src 'self' data: https://fonts.gstatic.com;
      object-src 'self' blob: data:;
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'self';
      frame-src 'self' blob: data: https://*.stripe.com https://js.stripe.com https://*.daily.co https://challenges.cloudflare.com https://www.loom.com https://*.loom.com;
      connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co *.upstash.io *.stripe.com https://*.dicebear.com https://*.daily.co wss://*.daily.co https://*.sentry.io https://cdn.jsdelivr.net https://challenges.cloudflare.com https://*.hubspot.com;
      worker-src 'self' blob: https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net;
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    return [
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
        source: '/(.*)\.(ico|png|jpg|jpeg|webp|avif|svg|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
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
        ],
      },
    ];
  },

};

export default withSentryConfig(
  withSerwist(nextConfig),
  {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: !process.env.CI,
    widenClientFileUpload: true,
    hideSourceMaps: true,
    disableLogger: true,
    automaticVercelMonitors: true,
  }
);
