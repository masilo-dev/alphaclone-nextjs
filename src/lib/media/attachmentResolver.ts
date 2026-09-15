import 'server-only';

import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { basename, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { assertPublicMediaUrl } from '@/lib/social/mediaUpload';

export type ResolvedAttachment = {
  stream: ReadableStream<Uint8Array>;
  filename: string;
  declaredMimeType?: string;
  expectedBytes?: number;
  sourceType: 'local_path' | 'openai_file' | 'https_url';
};

function configuredRoots(): string[] {
  return String(process.env.MCP_ATTACHMENT_ROOTS || '/workspace/scratch,/mnt/data')
    .split(',').map((root) => resolve(root.trim())).filter(Boolean);
}

async function resolveLocalPath(path: string): Promise<ResolvedAttachment> {
  const actual = await realpath(path);
  const permitted = configuredRoots().some((root) => actual === root || actual.startsWith(`${root}${sep}`));
  if (!permitted) throw new Error('LOCAL_PATH_FORBIDDEN: attachment is outside configured MCP attachment roots');
  const info = await stat(actual);
  if (!info.isFile()) throw new Error('LOCAL_PATH_INVALID: attachment must be a regular file');
  return {
    stream: Readable.toWeb(createReadStream(actual)) as ReadableStream<Uint8Array>,
    filename: basename(actual), expectedBytes: info.size, sourceType: 'local_path',
  };
}

async function resolveOpenAiFile(fileId: string): Promise<ResolvedAttachment> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_FILE_AUTH_UNAVAILABLE: OPENAI_API_KEY is not configured');
  const response = await fetch(`https://api.openai.com/v1/files/${encodeURIComponent(fileId)}/content`, {
    headers: { Authorization: `Bearer ${apiKey}` }, redirect: 'error',
  });
  if (!response.ok || !response.body) {
    throw new Error(`OPENAI_FILE_DOWNLOAD_FAILED: HTTP ${response.status}`);
  }
  return {
    stream: response.body,
    filename: response.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/i)?.[1] || fileId,
    declaredMimeType: response.headers.get('content-type')?.split(';')[0],
    expectedBytes: Number(response.headers.get('content-length') || 0) || undefined,
    sourceType: 'openai_file',
  };
}

async function resolveHttps(url: string): Promise<ResolvedAttachment> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('MEDIA_SOURCE_PROTOCOL_INVALID: HTTPS is required');
  assertPublicMediaUrl(parsed);
  const response = await fetch(parsed, { redirect: 'error', headers: { Accept: 'image/*,video/*' } });
  if (!response.ok || !response.body) throw new Error(`MEDIA_SOURCE_DOWNLOAD_FAILED: HTTP ${response.status}`);
  return {
    stream: response.body, filename: basename(parsed.pathname) || 'remote-media',
    declaredMimeType: response.headers.get('content-type')?.split(';')[0],
    expectedBytes: Number(response.headers.get('content-length') || 0) || undefined,
    sourceType: 'https_url',
  };
}

export async function resolveAttachmentReference(input: {
  localFilePath?: string; openaiFileId?: string; sourceUrl?: string;
}): Promise<ResolvedAttachment> {
  const supplied = [input.localFilePath, input.openaiFileId, input.sourceUrl].filter(Boolean);
  if (supplied.length !== 1) throw new Error('MEDIA_SOURCE_AMBIGUOUS: provide exactly one attachment reference');
  if (input.localFilePath) return resolveLocalPath(input.localFilePath);
  if (input.openaiFileId) return resolveOpenAiFile(input.openaiFileId);
  return resolveHttps(input.sourceUrl!);
}

export async function readAttachmentStream(
  attachment: ResolvedAttachment,
  maxBytes: number,
): Promise<Buffer> {
  if (attachment.expectedBytes && attachment.expectedBytes > maxBytes) {
    throw new Error(`MEDIA_TOO_LARGE: source declares ${attachment.expectedBytes} bytes; maximum is ${maxBytes}`);
  }
  const reader = attachment.stream.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new Error(`MEDIA_TOO_LARGE: streamed content exceeds ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  if (attachment.expectedBytes && received !== attachment.expectedBytes) {
    throw new Error(`MEDIA_TRANSPORT_TRUNCATED: expected ${attachment.expectedBytes} bytes, received ${received}`);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), received);
}
