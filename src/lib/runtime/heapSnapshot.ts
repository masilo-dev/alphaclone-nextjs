/**
 * Optional heap snapshot for controlled debugging.
 * NEVER enable continuously in production — set ENABLE_HEAP_SNAPSHOT=true only during investigations.
 */

import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';

export function maybeWriteHeapSnapshot(reason: string): string | null {
  if (process.env.ENABLE_HEAP_SNAPSHOT !== 'true') return null;

  const dir = process.env.HEAP_SNAPSHOT_DIR || '/tmp/alphaclone-heaps';
  fs.mkdirSync(dir, { recursive: true });
  const filename = `heap-${Date.now()}-${reason.replace(/[^a-z0-9_-]+/gi, '_')}.heapsnapshot`;
  const filepath = path.join(dir, filename);
  v8.writeHeapSnapshot(filepath);
  console.warn('[heap-snapshot] written', { filepath, reason });
  return filepath;
}
