import { NextRequest } from 'next/server';
import {
  createDiscoveryOptionsResponse,
  createProtectedResourceResponse,
} from '@/lib/mcpWellKnown';

<<<<<<< HEAD
=======
export const runtime = 'edge';
>>>>>>> origin/main
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return createProtectedResourceResponse(req);
}

export async function OPTIONS() {
  return createDiscoveryOptionsResponse();
}
