/**
 * Unified MediaInput for MCP / social / email / documents.
 * All variants resolve to a tenant-scoped media_assets row + https URL.
 */

export type MediaInput =
  | { type: 'url'; url: string; filename?: string }
  | { type: 'base64'; data: string; mimeType: string; filename: string }
  | { type: 'data_url'; dataUrl: string; filename?: string }
  | { type: 'asset_id'; assetId: string }
  | { type: 'document_id'; documentId: string }
  | { type: 'storage_path'; bucket: string; path: string };

export type IngestedMediaAsset = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  status: 'ready';
  width?: number | null;
  height?: number | null;
  checksum?: string | null;
};
