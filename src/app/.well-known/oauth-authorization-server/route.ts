import { NextRequest } from 'next/server';
import {
  createAuthorizationServerResponse,
  createDiscoveryOptionsResponse,
} from '@/lib/mcpWellKnown';

<<<<<<< HEAD
=======
export const runtime = 'edge';
>>>>>>> origin/main
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return createAuthorizationServerResponse(req);
}

export async function OPTIONS() {
  return createDiscoveryOptionsResponse();
}
