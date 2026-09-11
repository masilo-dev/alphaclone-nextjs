import { NextRequest } from 'next/server';
import { respondWithHubStats } from '@/lib/dashboard/hubStatsRoute';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return respondWithHubStats(request, 'invoicing', 'Failed to load invoice stats');
}
