import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // ====================================================================================
  // WEEK 1 SECURITY FIX: COMPREHENSIVE SECURITY HEADERS
  // ====================================================================================
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          // Content Security Policy (CSP)
          // Prevents XSS attacks by controlling which resources can be loaded
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co https://api.stripe.com https://api.daily.co https://ipapi.co https://api.calendly.com https://generativelanguage.googleapis.com wss://*.supabase.co wss://*.daily.co",
              "frame-src 'self' https://js.stripe.com https://daily.co https://calendly.com",
              "worker-src 'self' blob:",
              "media-src 'self' blob: data: https:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
          },

          // Prevent clickjacking attacks
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },

          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },

          // Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },

          // XSS Protection (for older browsers)
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },

          // Permissions Policy (formerly Feature Policy)
          // Restricts which browser features can be used
          {
            key: 'Permissions-Policy',
            value: [
              'camera=(self)',
              'microphone=(self)',
              'geolocation=()',
              'payment=(self)',
              'usb=()',
              'magnetometer=()',
              'gyroscope=()',
              'accelerometer=()',
            ].join(', '),
          },

          // Strict Transport Security (HTTPS only)
          // NOTE: Only enable this in production with HTTPS configured
          // Uncomment when deploying to production with SSL:
          // {
          //   key: 'Strict-Transport-Security',
          //   value: 'max-age=63072000; includeSubDomains; preload',
          // },

          // Remove X-Powered-By header (don't expose Next.js)
          {
            key: 'X-Powered-By',
            value: '', // Empty value removes the header
          },

          // Cross-Origin Policies (Allow embedding and resource sharing)
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none', // Most permissive - allows all resources
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'unsafe-none', // Allow popups and cross-origin windows
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin', // Allow cross-origin resource loading
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*', // Allow requests from any origin
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-Requested-With, Content-Type, Authorization',
          },
        ],
      },
    ];
  },

  // Remove X-Powered-By header globally
  poweredByHeader: false,

  // Enable React strict mode for better development warnings
  reactStrictMode: true,

  // Compression
  compress: true,
};

export default nextConfig;
