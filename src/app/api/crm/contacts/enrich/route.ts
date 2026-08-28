import { NextResponse } from 'next/server';

import { requireAuthenticatedUser, RouteAuthError } from '@/lib/apiAuth';
import { freePlacesService } from '@/services/freePlacesService';

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser(request);

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const company = typeof body.company === 'string' ? body.company.trim() : undefined;

    if (!name) {
      return NextResponse.json({ error: 'Contact name is required' }, { status: 400 });
    }

    const enrichment = await freePlacesService.enrichContactData(name, company);

    return NextResponse.json({ enrichment });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[CRMContactEnrich] Failed to enrich contact:', error);
    return NextResponse.json({ error: 'Failed to enrich contact' }, { status: 500 });
  }
}
