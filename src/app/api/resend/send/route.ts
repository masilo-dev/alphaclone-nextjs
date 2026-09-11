import { NextRequest } from 'next/server';
import { handleProviderSend } from '@/lib/email/handleProviderSend';

export async function POST(request: NextRequest) {
  return handleProviderSend(request, 'resend');
}
