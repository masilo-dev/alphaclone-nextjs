import { NextRequest, NextResponse } from 'next/server';
import { createMessageBatch, getBatchStatus, getBatchResults, cancelBatch } from '@/services/ai/messageBatchService';
<<<<<<< HEAD
import { requireAuthenticatedUser } from '@/lib/apiAuth';
=======
>>>>>>> origin/main

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

<<<<<<< HEAD
function errorStatus(err: any): number {
  return typeof err?.status === 'number' ? err.status : 500;
}

/** POST /api/ai/batches — Create a new message batch */
export async function POST(req: NextRequest) {
  try {
    await requireAuthenticatedUser();
=======
/** POST /api/ai/batches — Create a new message batch */
export async function POST(req: NextRequest) {
  try {
>>>>>>> origin/main
    const body = await req.json();
    const { requests, model, system_prompt } = body;

    if (!Array.isArray(requests) || requests.length === 0) {
      return NextResponse.json({ error: 'requests array is required and must not be empty' }, { status: 400 });
    }

    const batchId = await createMessageBatch(requests, model, system_prompt);
    return NextResponse.json({ success: true, batch_id: batchId });
  } catch (err: any) {
<<<<<<< HEAD
    return NextResponse.json({ error: err.message }, { status: errorStatus(err) });
=======
    return NextResponse.json({ error: err.message }, { status: 500 });
>>>>>>> origin/main
  }
}

/** GET /api/ai/batches?batch_id=xxx — Check batch status; add &results=true for results */
export async function GET(req: NextRequest) {
  try {
<<<<<<< HEAD
    await requireAuthenticatedUser();
=======
>>>>>>> origin/main
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batch_id');
    const fetchResults = searchParams.get('results') === 'true';

    if (!batchId) {
      return NextResponse.json({ error: 'batch_id query param is required' }, { status: 400 });
    }

    const status = await getBatchStatus(batchId);

    if (fetchResults && status.status === 'ended') {
      const results = await getBatchResults(batchId);
      return NextResponse.json({ ...status, results });
    }

    return NextResponse.json(status);
  } catch (err: any) {
<<<<<<< HEAD
    return NextResponse.json({ error: err.message }, { status: errorStatus(err) });
=======
    return NextResponse.json({ error: err.message }, { status: 500 });
>>>>>>> origin/main
  }
}

/** DELETE /api/ai/batches?batch_id=xxx — Cancel a batch */
export async function DELETE(req: NextRequest) {
  try {
<<<<<<< HEAD
    await requireAuthenticatedUser();
=======
>>>>>>> origin/main
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batch_id');

    if (!batchId) {
      return NextResponse.json({ error: 'batch_id query param is required' }, { status: 400 });
    }

    await cancelBatch(batchId);
    return NextResponse.json({ success: true, cancelled: batchId });
  } catch (err: any) {
<<<<<<< HEAD
    return NextResponse.json({ error: err.message }, { status: errorStatus(err) });
=======
    return NextResponse.json({ error: err.message }, { status: 500 });
>>>>>>> origin/main
  }
}
