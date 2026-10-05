/**
 * Paperless-ngx Document Engine Adapter (Isolated).
 * Handles OCR indexing and document archiving behind strict tenant boundaries.
 * Disabled by default unless PAPERLESS_API_URL and PAPERLESS_API_TOKEN are configured.
 */

export interface PaperlessConfig {
  apiUrl?: string;
  apiToken?: string;
  enabled: boolean;
}

export function getPaperlessConfig(): PaperlessConfig {
  const apiUrl = process.env.PAPERLESS_API_URL?.trim();
  const apiToken = process.env.PAPERLESS_API_TOKEN?.trim();
  return {
    apiUrl,
    apiToken,
    enabled: Boolean(apiUrl && apiToken),
  };
}

export interface PaperlessDocumentResult {
  id: number;
  title: string;
  content: string;
  created: string;
}

export async function searchPaperlessDocuments(
  tenantId: string,
  query: string
): Promise<{ documents: PaperlessDocumentResult[]; error?: string }> {
  const config = getPaperlessConfig();
  if (!config.enabled || !config.apiUrl || !config.apiToken) {
    return { documents: [], error: 'Paperless-ngx integration is not enabled or configured' };
  }

  try {
    const res = await fetch(`${config.apiUrl.replace(/\/$/, '')}/api/documents/?query=${encodeURIComponent(query)}`, {
      headers: {
        Authorization: `Token ${config.apiToken}`,
        Accept: 'application/json',
        'X-Tenant-ID': tenantId,
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return { documents: [], error: `Paperless returned HTTP ${res.status}` };
    }

    const json = await res.json();
    const results = (json.results || []).map((doc: any) => ({
      id: doc.id,
      title: doc.title || '',
      content: doc.content || '',
      created: doc.created || '',
    }));

    return { documents: results };
  } catch (err: any) {
    return { documents: [], error: err.message || 'Paperless search failed' };
  }
}
