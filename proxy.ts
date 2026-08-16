import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/middleware";
import { rateLimit, rateLimitConfigs } from "@/lib/rateLimit";

type PlatformPolicy = {
  maintenanceMode: boolean;
  openRegistration: boolean;
};

let cachedPolicy: PlatformPolicy | null = null;
let cachedPolicyAt = 0;
const POLICY_TTL_MS = 30_000;

async function fetchPlatformPolicy(): Promise<PlatformPolicy> {
  const now = Date.now();
  if (cachedPolicy && now - cachedPolicyAt < POLICY_TTL_MS) {
    return cachedPolicy;
  }

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return process.env.NODE_ENV === "production"
      ? { maintenanceMode: true, openRegistration: false }
      : { maintenanceMode: false, openRegistration: true };
  }

  try {
    const baseUrl = supabaseUrl.replace(/\/+$/, "");
    const response = await fetch(
      `${baseUrl}/rest/v1/platform_global_settings?singleton_key=eq.default&select=settings&limit=1`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        cache: "no-store",
      },
    );
    const rows = response.ok ? await response.json() : [];
    const settings =
      Array.isArray(rows) && rows.length > 0 ? rows[0]?.settings || {} : {};
    const policy: PlatformPolicy = {
      maintenanceMode: Boolean(settings?.security?.maintenanceMode),
      openRegistration: settings?.security?.openRegistration !== false,
    };
    cachedPolicy = policy;
    cachedPolicyAt = now;
    return policy;
  } catch {
    if (cachedPolicy) return cachedPolicy;
    return process.env.NODE_ENV === "production"
      ? { maintenanceMode: true, openRegistration: false }
      : { maintenanceMode: false, openRegistration: true };
  }
}

function applyRequiredOwaspHeaders(response: NextResponse) {
  const csp = `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' 'unsafe-inline' blob: https://*.supabase.co https://*.stripe.com https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://*.daily.co https://*.sentry.io https://challenges.cloudflare.com https://alphaclone.tech https://*.claude.ai https://www.googletagmanager.com https://www.google-analytics.com;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      img-src 'self' blob: data: https: http:;
      media-src 'self' blob: data: https:;
      font-src 'self' data: https://fonts.gstatic.com;
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'self' https://*.zoom.us https://zoom.us https://alphaclonesystems.com https://*.railway.app;
      frame-src 'self' blob: data: https://*.stripe.com https://js.stripe.com https://*.daily.co https://challenges.cloudflare.com https://www.loom.com https://*.loom.com https://*.claude.ai https://*.segment.com;
      connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co *.upstash.io *.stripe.com https://*.dicebear.com https://*.daily.co wss://*.daily.co https://*.livekit.cloud wss://*.livekit.cloud https://*.sentry.io https://cdn.jsdelivr.net https://challenges.cloudflare.com https://*.hubspot.com https://images.unsplash.com https://alphaclone.tech wss://alphaclone.tech https://api.anthropic.com https://api.openai.com https://openrouter.ai https://*.claude.ai https://nominatim.openstreetmap.org https://screendemos.com https://*.fbcdn.net https://*.xx.fbcdn.net https://*.facebook.com https://*.instagram.com https://*.basemaps.cartocdn.com https://raw.githubusercontent.com https://unpkg.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://graph.microsoft.com https://*.graph.microsoft.com https://login.microsoftonline.com https://*.microsoft.com https://assets.mixkit.co https://*.zohostatic.eu https://*.zohostatic.com https://mailtrack.io https://*.mailtrack.io;
      worker-src 'self' blob: https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net;
      upgrade-insecure-requests;
    `
    .replace(/\s{2,}/g, " ")
    .trim();

  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "127.0.0.1"
  );
}

/** OAuth AS endpoints must not share the MCP JSON-RPC bucket (or get 429 mid-handshake). */
function isMcpOAuthProtocolPath(pathname: string): boolean {
  return (
    pathname === "/api/mcp/token" ||
    pathname === "/api/mcp/authorize" ||
    pathname === "/api/mcp/register" ||
    pathname === "/api/mcp/oauth/approve" ||
    pathname.startsWith("/api/mcp/token/")
  );
}

async function applyGlobalApiRateLimit(
  request: NextRequest,
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/")) return null;
  if (
    pathname === "/api/health" ||
    pathname === "/api/readiness" ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/webhooks/") ||
    // Never rate-limit OAuth code/token exchange — Claude maps 429 → McpAuthorizationError
    isMcpOAuthProtocolPath(pathname)
  ) {
    return null;
  }

  const ip = clientIp(request);
  const isAuth =
    pathname.startsWith("/api/auth/") ||
    pathname.includes("/login") ||
    pathname.includes("/signup");
  const isMcp = pathname === "/api/mcp" || pathname.startsWith("/api/mcp/");
  const config = isAuth
    ? rateLimitConfigs.auth.login
    : isMcp
      ? rateLimitConfigs.api.mcp
      : rateLimitConfigs.api.standard;
  // Bucket MCP by IP only (not path) so initialize + tools/list share one generous budget
  const key = isMcp
    ? `mcp:${ip}`
    : `${isAuth ? "auth" : "api"}:${ip}:${pathname.split("/").slice(0, 4).join("/")}`;

  const result = await rateLimit(request, config, key);
  if (result.success) return null;

  return NextResponse.json(
    {
      error: "Too many requests. Please try again later.",
      code: "RATE_LIMITED",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(
          Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
        ),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const host = request.headers.get("host");

  // Canonical redirect: www → apex (only runs after www DNS exists).
  // If www is NXDOMAIN, OAuth returns fail before this code — see docs/auth/WWW_DNS_OAUTH_FIX.md
  if (host === "www.alphaclonesystems.com") {
    const url = request.nextUrl.clone();
    url.hostname = "alphaclonesystems.com";
    return NextResponse.redirect(url, 301);
  }

  // Global sliding-window rate limit for API surfaces (incl. MCP)
  const rateLimited = await applyGlobalApiRateLimit(request);
  if (rateLimited) return rateLimited;

  // CRITICAL: Bypass remaining middleware logic for MCP API routes to ensure no interference with SSE/JSON-RPC
  // and to eliminate latency from platform policy fetches (prevents handshake timeouts).
  if (pathname === "/api/mcp" || pathname.startsWith("/api/mcp/")) {
    return NextResponse.next();
  }

  // Liveness, cron jobs, and inbound webhooks authenticate in-route.
  // Skip session refresh and platform policy fetch to keep these routes fast and reliable.
  if (
    pathname === "/api/health" ||
    pathname === "/api/readiness" ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/webhooks/")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/.well-known")) {
    // MCP Discovery routes should bypass complex OWASP headers (like CSP) to ensure compatibility
    // This includes OAuth metadata and the MCP well-known endpoint itself
    if (
      pathname.startsWith("/.well-known/mcp") ||
      pathname.startsWith("/.well-known/oauth-protected-resource") ||
      pathname.startsWith("/.well-known/oauth-authorization-server") ||
      pathname.startsWith("/.well-known/microsoft-identity-association")
    ) {
      return NextResponse.next();
    }
    return applyRequiredOwaspHeaders(NextResponse.next());
  }

  const policy = await fetchPlatformPolicy();

  // Canonical route consolidation to close legacy entry points.
  if (pathname === "/dashboard/gmail") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/mail";
    return applyRequiredOwaspHeaders(NextResponse.redirect(url));
  }
  if (pathname === "/dashboard/business/referrals") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/business/clients";
    return applyRequiredOwaspHeaders(NextResponse.redirect(url));
  }

  const maintenanceAllowedPaths = [
    "/maintenance",
    "/api/admin/platform-settings",
    "/auth/login",
  ];

  if (policy.maintenanceMode) {
    const isAllowed =
      maintenanceAllowedPaths.some((path) => pathname.startsWith(path)) ||
      pathname.startsWith("/_next/") ||
      pathname === "/favicon.ico";
    if (!isAllowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/maintenance";
      return applyRequiredOwaspHeaders(NextResponse.redirect(url));
    }
  }

  if (!policy.openRegistration) {
    if (pathname === "/register") {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.delete("register");
      return applyRequiredOwaspHeaders(NextResponse.redirect(url));
    }
    if (pathname === "/auth/login" && searchParams.get("register") === "true") {
      const url = request.nextUrl.clone();
      url.searchParams.delete("register");
      return applyRequiredOwaspHeaders(NextResponse.redirect(url));
    }
  }

  /**
   * Facebook/WhatsApp Webhook Verification Rewrite
   */
  if (
    pathname === "/dashboard/business/facebook" &&
    searchParams.has("hub.mode") &&
    searchParams.has("hub.verify_token") &&
    searchParams.has("hub.challenge")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/webhooks/facebook/whatsapp";
    return applyRequiredOwaspHeaders(NextResponse.rewrite(url));
  }

  /**
   * Facebook/WhatsApp Webhook POST Rewrite
   */
  if (
    pathname === "/dashboard/business/facebook" &&
    request.method === "POST"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/webhooks/facebook/whatsapp";
    return applyRequiredOwaspHeaders(NextResponse.rewrite(url));
  }

  /**
   * MCP OAuth2 Token Rewrite
   */
  if (pathname === "/token") {
    const url = request.nextUrl.clone();
    url.pathname = "/api/mcp/token";
    return NextResponse.rewrite(url);
  }

  const response = await updateSession(request);
  return applyRequiredOwaspHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Root must be listed explicitly; the catch-all below can omit pathname "/".
     */
    "/",
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|manifest.webmanifest|robots.txt|sitemap.xml|sw.js|workbox-.*\\.js|.well-known/workflow/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|json|map|txt|xml|webmanifest)$).*)",
  ],
};
