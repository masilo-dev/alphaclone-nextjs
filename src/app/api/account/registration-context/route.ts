import { NextRequest, NextResponse } from 'next/server';
import { getRequestCountry } from '@/lib/server/requestGeo';

const EU_COUNTRIES = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','UK'
]);

export async function GET(req: NextRequest) {
  const country = getRequestCountry(req.headers);
  return NextResponse.json({
    country,
    isEULike: EU_COUNTRIES.has(country),
    requiresGdprConsent: EU_COUNTRIES.has(country),
  });
}
