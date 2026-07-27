import type { NextConfig } from "next";
import path from "node:path";

import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";
import { withWorkflow } from "workflow/next";

const srcDir = path.resolve(process.cwd(), "src");

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
  register: false,
} as Parameters<typeof withSerwistInit>[0]);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['playwright-core', 'chromium-bidi', '@browserbasehq/sdk', 'puppeteer-core', 'jsdom', 'got', 'node-html-parser', 'robots-txt-guard', 'workflow', '@workflow/core', '@sendgrid/mail', '@sendgrid/helpers', '@upstash/qstash', '@upstash/ratelimit', '@upstash/redis', 'nodemailer'],
  typescript: {
    ignoreBuildErrors: false,
  },
  transpilePackages: [
    '@blocknote/core',
    '@blocknote/react',
    '@blocknote/mantine',
    '@tiptap/core',
    '@tiptap/react',
    '@tiptap/pm'
  ],
  env: {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_ENABLE_SERWIST: 'true',
    NEXT_PUBLIC_ENABLE_PWA: 'true',
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
    webpackMemoryOptimizations: true,
    webpackBuildWorker: true,
    optimizePackageImports: [
      '@heroicons/react',
      '@tremor/react',
      'date-fns',
      'framer-motion',
      'lucide-react',
      'react-icons',
      'recharts',
    ],
  },
  turbopack: {},
  async redirects() {
    // Consolidate the older /legal/* summaries onto the canonical, full-length
    // legal documents. Sources are exact paths, so sub-routes such as
    // /legal/dpa/download and /legal/data-request keep working.
    return [
      { source: '/legal/privacy', destination: '/privacy-policy', permanent: true },
      { source: '/legal/terms', destination: '/terms-of-service', permanent: true },
      { source: '/legal/cookies', destination: '/cookie-policy', permanent: true },
      { source: '/legal/dpa', destination: '/dpa', permanent: true },
      { source: '/legal/sla', destination: '/sla', permanent: true },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/.well-known/mcp',
        destination: '/api/mcp/well-known/oauth-protected-resource',
      },
      {
        source: '/.well-known/oauth-protected-resource',
        destination: '/api/mcp/well-known/oauth-protected-resource',
      },
      {
        source: '/.well-known/oauth-authorization-server',
        destination: '/api/mcp/well-known/oauth-authorization-server',
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Critical: Increase timeout for long-running builds/bundling to prevent stalls
    config.output.chunkLoadTimeout = 180000;

    // Belt-and-suspenders: pin @ -> src even if a conflicting root app/ directory
    // confuses Next's jsconfig-paths plugin during Railway/Nixpacks builds.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": srcDir,
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        dns: false,
        child_process: false,
        fs: false,
        tls: false,
      };
    }
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
      script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' 'unsafe-inline' blob: https://*.supabase.co https://*.stripe.com https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://*.daily.co https://*.sentry.io https://challenges.cloudflare.com https://*.claude.ai https://assets.calendly.com https://www.googletagmanager.com https://www.google-analytics.com;
      script-src-elem 'self' 'unsafe-eval' 'wasm-unsafe-eval' 'unsafe-inline' blob: https://*.supabase.co https://*.stripe.com https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://*.daily.co https://*.sentry.io https://challenges.cloudflare.com https://*.claude.ai https://assets.calendly.com https://www.googletagmanager.com https://www.google-analytics.com;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://assets.calendly.com;
      img-src 'self' blob: data: https: http:;
      media-src 'self' blob: data: https:;
      font-src 'self' data: https://fonts.gstatic.com;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'self' https://*.zoom.us https://zoom.us https://alphaclonesystems.com https://*.railway.app;
      frame-src 'self' blob: data: https://*.stripe.com https://js.stripe.com https://*.daily.co https://challenges.cloudflare.com https://www.loom.com https://*.loom.com https://*.claude.ai https://*.segment.com https://calendly.com https://*.calendly.com;
      connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co *.upstash.io *.stripe.com https://*.dicebear.com https://*.daily.co wss://*.daily.co https://*.livekit.cloud wss://*.livekit.cloud https://*.sentry.io https://cdn.jsdelivr.net https://challenges.cloudflare.com https://*.hubspot.com https://images.unsplash.com https://api.anthropic.com https://api.openai.com https://openrouter.ai https://*.claude.ai https://nominatim.openstreetmap.org https://screendemos.com https://*.fbcdn.net https://*.xx.fbcdn.net https://*.facebook.com https://*.instagram.com https://*.basemaps.cartocdn.com https://raw.githubusercontent.com https://unpkg.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://graph.microsoft.com https://login.microsoftonline.com https://*.linkedin.com https://api.linkedin.com https://*.twitter.com https://api.twitter.com https://*.x.com https://api.x.com https://*.googleusercontent.com https://assets.mixkit.co https://files.manuscdn.com https://*.manuscdn.com https://*.zohostatic.eu https://*.zohostatic.com https://mailtrack.io https://*.mailtrack.io;
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
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, max-age=0',
          },
        ],
      },
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

// Apply plugins sequentially to resolve type mismatches between various HOC signatures
const baseConfig = withSerwist(nextConfig);
const workflowConfig = withWorkflow(baseConfig as any, {
  workflows: {},
} as any);

export default withSentryConfig(workflowConfig as any, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  // Full client upload balloons webpack memory during CI builds.
  widenClientFileUpload: false,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  tunnelRoute: "/monitoring",
});
