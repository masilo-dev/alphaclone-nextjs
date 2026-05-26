/**
 * Anthropic Files API Service
 *
 * Implements the Anthropic Files API for uploading, referencing, and deleting files
 * (PDFs, documents, text) so they can be referenced in Claude messages without
 * re-uploading on every request.
 *
 * Reference: https://docs.anthropic.com/en/docs/build-with-claude/files
 */

import Anthropic from '@anthropic-ai/sdk';
import { ENV } from '@/config/env';

const anthropic = ENV.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ENV.ANTHROPIC_API_KEY })
  : null;

export interface UploadedFile {
  id: string;
  filename: string;
  size: number;
  created_at: number;
  purpose: string;
}

/**
 * Uploads a file to Anthropic Files API.
 * Returns the file ID for use in subsequent messages.
 */
export async function uploadFileToAnthropic(
  content: Blob | Buffer | string,
  filename: string,
  mimeType = 'application/pdf'
): Promise<UploadedFile> {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }

  // Convert string/Buffer to Blob if needed
  let blob: Blob;
  if (typeof content === 'string') {
    blob = new Blob([content], { type: mimeType });
  } else if (Buffer.isBuffer(content)) {
    blob = new Blob([content as any], { type: mimeType });
  } else {
    blob = content as Blob;
  }

  const file = await (anthropic as any).beta.files.upload({
    file: new File([blob], filename, { type: mimeType }),
  });

  return {
    id: file.id,
    filename: file.filename || filename,
    size: file.size || blob.size,
    created_at: file.created_at,
    purpose: file.purpose || 'assistants',
  };
}

/**
 * Creates an Anthropic message that references an uploaded file by ID.
 * Useful for contract analysis, document review, or referencing persistent PDFs.
 */
export async function callClaudeWithFile(params: {
  fileId: string;
  filename: string;
  mimeType?: string;
  userMessage: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }

  const model = params.model || 'claude-sonnet-4-20250514';

  const response = await (anthropic as any).beta.messages.create({
    model,
    max_tokens: params.maxTokens || 4096,
    ...(params.systemPrompt ? { system: params.systemPrompt } : {}),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'file',
              file_id: params.fileId,
            },
            ...(params.filename ? { title: params.filename } : {}),
          },
          {
            type: 'text',
            text: params.userMessage,
          },
        ],
      },
    ],
    betas: ['files-api-2025-04-14'],
  });

  return response.content?.[0]?.type === 'text' ? response.content[0].text : '';
}

/**
 * Lists all uploaded files for this API key.
 */
export async function listUploadedFiles(): Promise<UploadedFile[]> {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }

  const response = await (anthropic as any).beta.files.list();
  return (response.data || []).map((f: any) => ({
    id: f.id,
    filename: f.filename,
    size: f.size,
    created_at: f.created_at,
    purpose: f.purpose,
  }));
}

/**
 * Deletes a file from Anthropic Files API.
 */
export async function deleteUploadedFile(fileId: string): Promise<void> {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }
  await (anthropic as any).beta.files.delete(fileId);
}
