import { type NextRequest } from 'next/server';
import { updateSession } from './lib/middleware';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Default export and named export for Next.js proxy convention
export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static image/asset files (.svg, .png, .jpg, .ico, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
};
