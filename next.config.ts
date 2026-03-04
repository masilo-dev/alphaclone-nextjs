import type { NextConfig } from "next";

import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Expose VITE_ variables to the client-side bundle
  env: {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
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
  async headers() {
    const cspHeader = `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.supabase.co https://*.stripe.com https://unpkg.com;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      img-src 'self' blob: data: https://*.supabase.co https://api.dicebear.com https://*.stripe.com https://img.logo.dev;
      font-src 'self' data: https://fonts.gstatic.com;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      frame-src 'self' https://*.stripe.com https://js.stripe.com;
      connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.upstash.io https://*.stripe.com;
      worker-src 'self' blob: https://unpkg.com;
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    return [
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
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  async rewrites() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) return [];

    return [
      {
        source: '/auth/v1/:path*',
        destination: `${supabaseUrl}/auth/v1/:path*`,
      },
      {
        source: '/rest/v1/:path*',
        destination: `${supabaseUrl}/rest/v1/:path*`,
      },
      {
        source: '/storage/v1/:path*',
        destination: `${supabaseUrl}/storage/v1/:path*`,
      },
      {
        source: '/realtime/v1/:path*',
        destination: `${supabaseUrl}/realtime/v1/:path*`,
      },
    ];
  },
};

export default withSerwist(nextConfig);
