import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import sharp from 'sharp';

const MAX_BYTES = 10 * 1024 * 1024;
const blocked = new BlockList();
for (const [ip, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16], ['224.0.0.0', 4], ['240.0.0.0', 4]] as const) blocked.addSubnet(ip, prefix, 'ipv4');
for (const [ip, prefix] of [['::', 128], ['::1', 128], ['::ffff:0:0', 96], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) blocked.addSubnet(ip, prefix, 'ipv6');

/** Anonymous HTTPS fetch with pinned public DNS, bounded bytes and checked redirects. */
export async function fetchFacebookImage(url: string, redirects = 0): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || (parsed.port && parsed.port !== '443')) throw new Error('Facebook images require a public HTTPS URL without credentials');
  if (redirects > 4) throw new Error('Too many media redirects');
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some(({ address, family }) => blocked.check(address, family === 6 ? 'ipv6' : 'ipv4'))) throw new Error('Media URL resolves to a non-public address');
  const address = addresses[0];
  const result = await new Promise<{ buffer: Buffer; mimeType: string; location?: string }>((resolve, reject) => {
    const req = https.get(parsed, {
      headers: { Accept: 'image/*' },
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode || 0) && res.headers.location) {
        res.resume(); resolve({ buffer: Buffer.alloc(0), mimeType: '', location: res.headers.location }); return;
      }
      const mimeType = String(res.headers['content-type'] || '').split(';')[0].toLowerCase();
      if (res.statusCode !== 200 || !mimeType.startsWith('image/')) { res.resume(); reject(new Error(`Media validation failed: HTTP ${res.statusCode}, Content-Type ${mimeType || 'missing'}`)); return; }
      if (Number(res.headers['content-length']) > MAX_BYTES) { res.destroy(); reject(new Error('Facebook image exceeds 10 MB')); return; }
      const chunks: Buffer[] = []; let size = 0;
      res.on('data', (chunk: Buffer) => { size += chunk.length; if (size > MAX_BYTES) { res.destroy(); reject(new Error('Facebook image exceeds 10 MB')); } else chunks.push(chunk); });
      res.on('error', reject);
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), mimeType }));
    });
    const timer = setTimeout(() => req.destroy(new Error('Media download timed out')), 20000);
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject);
  });
  if (result.location) return fetchFacebookImage(new URL(result.location, parsed).href, redirects + 1);
  await validateFacebookImageBytes(result.buffer, result.mimeType);
  return { ...result, filename: parsed.pathname.split('/').pop() || 'image' };
}

export async function validateFacebookImageBytes(buffer: Buffer, mimeType: string): Promise<void> {
  if (!buffer.length || buffer.length > MAX_BYTES) throw new Error('Facebook image must contain between 1 byte and 10 MB');
  if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)) throw new Error(`Unsupported Facebook image Content-Type: ${mimeType}`);
  const metadata = await sharp(buffer, { limitInputPixels: 40_000_000 }).metadata();
  const supportedFormats: Partial<Record<NonNullable<typeof metadata.format>, string>> = {
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  const expected = metadata.format ? supportedFormats[metadata.format] : undefined;
  if (!expected || expected !== mimeType || !metadata.width || !metadata.height || metadata.width * metadata.height > 40_000_000) throw new Error('Invalid Facebook image format or dimensions');
  // Decode as well as inspect headers, rejecting truncated/corrupt bodies.
  await sharp(buffer, { limitInputPixels: 40_000_000 }).resize({ width: 1, height: 1 }).raw().toBuffer();
}