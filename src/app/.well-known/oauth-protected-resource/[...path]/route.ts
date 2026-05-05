import { NextRequest } from 'next/server';
import {
  createDiscoveryOptionsResponse,
  createProtectedResourceResponse,
} from '@/lib/mcpWellKnown';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return createProtectedResourceResponse(req);
}

export async function OPTIONS() {
  return createDiscoveryOptionsResponse();
}
