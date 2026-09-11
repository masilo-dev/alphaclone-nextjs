/**
 * Remove large binary/base64 fields before persisting job payloads, checkpoints, or audit rows.
 */

const HEAVY_FIELD_PATTERN =
  /^(content_base64|file_base64|image_base64|media_base64|base64|data_url|file_content|binary|body_html|body_text|attachment)$/i;

const HEAVY_ARRAY_FIELDS = new Set(['media_base64_data', 'media_base64', 'attachments']);

function summarizeString(value: string): string {
  if (value.startsWith('data:') && value.includes('base64,')) {
    const mime = value.slice(5, value.indexOf(';')) || 'unknown';
    const approxBytes = Math.round((value.length * 3) / 4);
    return `[data-url ${mime} ~${approxBytes} bytes]`;
  }
  if (value.length > 256) {
    return `[string ${value.length} chars]`;
  }
  return value;
}

export function stripHeavyPayloadFields<T>(value: T, depth = 0): T {
  if (depth > 8) return '[truncated]' as T;
  if (value == null) return value;
  if (typeof value === 'string') {
    return summarizeString(value) as T;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => stripHeavyPayloadFields(item, depth + 1)) as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (HEAVY_FIELD_PATTERN.test(key) || HEAVY_ARRAY_FIELDS.has(key)) {
        if (typeof child === 'string') {
          out[key] = summarizeString(child);
        } else if (Array.isArray(child)) {
          out[key] = `[array ${child.length} items]`;
        } else {
          out[key] = '[redacted]';
        }
        continue;
      }
      out[key] = stripHeavyPayloadFields(child, depth + 1);
    }
    return out as T;
  }
  return value;
}
