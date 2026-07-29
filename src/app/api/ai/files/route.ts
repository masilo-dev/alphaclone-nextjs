import { NextRequest, NextResponse } from 'next/server';
import { uploadFileToAnthropic, listUploadedFiles, deleteUploadedFile, callClaudeWithFile } from '@/services/ai/filesApiService';
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

/** POST /api/ai/files — Upload a file or call Claude with an existing file */
export async function POST(req: NextRequest) {
  try {
    await requireAuthenticatedUser();
=======
/** POST /api/ai/files — Upload a file or call Claude with an existing file */
export async function POST(req: NextRequest) {
  try {
>>>>>>> origin/main
    const contentType = req.headers.get('content-type') || '';

    // Handle file upload (multipart form)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'file field is required in multipart form' }, { status: 400 });
      }

      const uploaded = await uploadFileToAnthropic(
        await file.arrayBuffer().then(buf => Buffer.from(buf)),
        file.name,
        file.type || 'application/pdf'
      );

      return NextResponse.json({ success: true, file: uploaded });
    }

    // Handle calling Claude with an uploaded file (JSON)
    const body = await req.json();
    const { file_id, filename, mime_type, user_message, system_prompt, model, max_tokens } = body;

    if (!file_id || !user_message) {
      return NextResponse.json({ error: 'file_id and user_message are required' }, { status: 400 });
    }

    const content = await callClaudeWithFile({
      fileId: file_id,
      filename: filename || 'document',
      mimeType: mime_type || 'application/pdf',
      userMessage: user_message,
      systemPrompt: system_prompt,
      model,
      maxTokens: max_tokens,
    });

    return NextResponse.json({ success: true, content });
  } catch (err: any) {
<<<<<<< HEAD
    return NextResponse.json({ error: err.message }, { status: errorStatus(err) });
=======
    return NextResponse.json({ error: err.message }, { status: 500 });
>>>>>>> origin/main
  }
}

/** GET /api/ai/files — List uploaded files */
export async function GET() {
  try {
<<<<<<< HEAD
    await requireAuthenticatedUser();
    const files = await listUploadedFiles();
    return NextResponse.json({ files });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: errorStatus(err) });
=======
    const files = await listUploadedFiles();
    return NextResponse.json({ files });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
>>>>>>> origin/main
  }
}

/** DELETE /api/ai/files?file_id=xxx — Delete an uploaded file */
export async function DELETE(req: NextRequest) {
  try {
<<<<<<< HEAD
    await requireAuthenticatedUser();
=======
>>>>>>> origin/main
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('file_id');

    if (!fileId) {
      return NextResponse.json({ error: 'file_id query param is required' }, { status: 400 });
    }

    await deleteUploadedFile(fileId);
    return NextResponse.json({ success: true, deleted: fileId });
  } catch (err: any) {
<<<<<<< HEAD
    return NextResponse.json({ error: err.message }, { status: errorStatus(err) });
=======
    return NextResponse.json({ error: err.message }, { status: 500 });
>>>>>>> origin/main
  }
}
