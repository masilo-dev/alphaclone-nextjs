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
  typescript: {
    ignoreBuildErrors: false,
  },
  transpilePackages: ['@blocknote/core', '@blocknote/react', '@blocknote/mantine'],
  env: {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
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
    // Critical: Increase timeout for long-running builds/bundling to prevent stalls
    config.output.chunkLoadTimeout = 180000;
    return config;
  },
  async rewrites() {
    return [];
  },

  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    const cspHeader = `
      default-src 'self';
      script-src 'self' ${isDev ? "'unsafe-eval'" : ''} 'unsafe-inline' blob: https://*.supabase.co https://*.stripe.com https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://va.vercel-scripts.com https://*.daily.co https://*.sentry.io https://challenges.cloudflare.com https://alphaclone.tech https://challenges.cloudflare.com/cdn-cgi/challenge-platform https://challenges.cloudflare.com/cdn-cgi/challenge-platform;
      script-src-elem 'self' 'unsafe-inline' blob: https://*.supabase.co https://*.stripe.com https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://va.vercel-scripts.com https://*.daily.co https://*.sentry.io https://challenges.cloudflare.com https://alphaclone.tech https://challenges.cloudflare.com/cdn-cgi/challenge-platform https://challenges.cloudflare.com/cdn-cgi/challenge-platform;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      img-src 'self' blob: data: https: http:;
      media-src 'self' blob:;
      font-src 'self' data: https://fonts.gstatic.com;
      object-src 'self' blob: data:;
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'self';
      frame-src 'self' blob: data: https://*.stripe.com https://js.stripe.com https://*.daily.co https://challenges.cloudflare.com https://www.loom.com https://*.loom.com;
      connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co *.upstash.io *.stripe.com https://*.dicebear.com https://*.daily.co wss://*.daily.co https://*.sentry.io https://cdn.jsdelivr.net https://challenges.cloudflare.com https://*.hubspot.com https://images.unsplash.com https://alphaclone.tech wss://alphaclone.tech https://challenges.cloudflare.com/cdn-cgi/challenge-platform https://api.anthropic.com https://api.openai.com https://openrouter.ai https://*.basemaps.cartocdn.com https://raw.githubusercontent.com https://unpkg.com;
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
        value: 'camera=(), microphone=(), geolocation=(), xr-spatial-tracking=()',
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

export default withSentryConfig(
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
);
