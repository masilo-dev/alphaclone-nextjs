import { NextRequest, NextResponse } from 'next/server';
import { PUBLIC_APP_ORIGIN } from '@/lib/config/public-origin';

/** Legacy public invoice PDF path — delegates to branded unified pipeline. */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const token = req.nextUrl.searchParams.get('token') || '';
  const target = new URL(`/api/invoices/${id}/pdf`, PUBLIC_APP_ORIGIN);
  if (token) target.searchParams.set('token', token);
  return NextResponse.redirect(target);
}
