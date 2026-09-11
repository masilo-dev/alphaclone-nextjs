import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';
import { geocodeAddress } from '@/lib/location/geocodeAddress';

const schema = z.object({ address: z.string().trim().min(2).max(1000) });

export async function POST(req: NextRequest) {
  try {
    await requireAuthenticatedUser(req);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Valid address is required' }, { status: 400 });
    const result = await geocodeAddress(parsed.data.address);
    return NextResponse.json(result, { status: result.valid ? 200 : 422 });
  } catch (error) { return routeErrorResponse(error, 'Address could not be validated', req); }
}
