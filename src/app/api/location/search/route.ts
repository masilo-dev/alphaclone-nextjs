import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';

const schema = z.object({
  query: z.string().trim().min(2).max(1000),
  limit: z.number().int().min(1).max(10).optional(),
});

type LocationSearchItem = {
  displayName: string;
  lat: number;
  lng: number;
  type: string;
};

function isLocationSearchItem(value: LocationSearchItem | null): value is LocationSearchItem {
  return value !== null;
}

export async function POST(req: NextRequest) {
  try {
    await requireAuthenticatedUser(req);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Valid query is required' }, { status: 400 });

    const query = parsed.data.query.trim();
    const limit = parsed.data.limit ?? 5;

    const hereKey = process.env.HERE_API_KEY;
    if (hereKey) {
      try {
        const response = await fetch(
          `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(limit))}&apiKey=${encodeURIComponent(hereKey)}`,
          { signal: AbortSignal.timeout(10_000), cache: 'no-store' }
        );
        if (response.ok) {
          const payload = await response.json();
          const items: LocationSearchItem[] = (payload.items || [])
            .map((item: any) => {
              const lat = Number(item?.position?.lat);
              const lng = Number(item?.position?.lng);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
              return {
                displayName: String(item?.address?.label || item?.title || query),
                lat,
                lng,
                type: String(item?.resultType || item?.houseNumberType || 'place'),
              } satisfies LocationSearchItem;
            })
            .filter(isLocationSearchItem);

          if (items.length) return NextResponse.json({ items, provider: 'here' });
        }
      } catch {
      }
    }

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=${encodeURIComponent(String(limit))}`,
      {
        headers: {
          'User-Agent': 'AlphaClone-LeadFinder/1.0 (support@alphaclonesystems.com)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
      }
    );
    if (!response.ok) return NextResponse.json({ items: [], provider: 'nominatim' }, { status: 200 });
    const payload = await response.json();
    const items: LocationSearchItem[] = (Array.isArray(payload) ? payload : [])
      .map((item: any) => {
        const lat = Number(item?.lat);
        const lng = Number(item?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          displayName: String(item?.display_name || query),
          lat,
          lng,
          type: String(item?.type || ''),
        } satisfies LocationSearchItem;
      })
      .filter(isLocationSearchItem);

    return NextResponse.json({ items, provider: 'nominatim' });
  } catch (error) {
    return routeErrorResponse(error, 'Location search failed', req);
  }
}
