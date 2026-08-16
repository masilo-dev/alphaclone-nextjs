import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const payload = {
  associatedApplications: [
    {
      applicationId: 'd8f744a0-5fab-44eb-968e-22deb247eab4',
    },
    {
      applicationId: 'a0b60afd-2c2f-467a-b546-062217e3875e',
    },
  ],
};

export async function GET() {
  return NextResponse.json(payload, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
