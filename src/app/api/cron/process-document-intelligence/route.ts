import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { processQueuedDocumentIntelligence } from '@/services/documentIntelligenceService';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const denied = denyIfCronUnauthorized(request);
  if (denied) return denied;
  const limit = Number(new URL(request.url).searchParams.get('limit') || 8);
  const results = await processQueuedDocumentIntelligence(limit);
  return NextResponse.json({ processed: results.length, results });
}
