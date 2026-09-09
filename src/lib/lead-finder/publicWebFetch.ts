import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(network, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
blocked.addSubnet('2001:db8::', 32, 'ipv6');
blocked.addSubnet('2002::', 16, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  return family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

export function validateCrawlUrl(value: string): URL {
  const url = new URL(value);
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && !['80', '443'].includes(url.port)) ||
      /(^|\.)(localhost|local|internal|supabase\.co|supabase\.in)$/.test(host) ||
      (isIP(host) && !isPublicAddress(host))) throw new Error('CRAWL_URL_BLOCKED');
  return url;
}

/** DNS is validated and pinned to the actual socket; redirects are returned, never followed. */
export async function fetchPublicPage(value: string, maxBytes = 1_500_000, timeoutMs = 8000) {
  const url = validateCrawlUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await Promise.race([
    lookup(hostname, { all: true }),
    new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('CRAWL_DNS_TIMEOUT')), timeoutMs);
      timer.unref();
    }),
  ]);
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error('CRAWL_PRIVATE_ADDRESS');
  const pinned = addresses[0];
  return new Promise<{ status: number; contentType: string; body: string; bytes: number }>((resolve, reject) => {
    const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = transport(url, {
      agent: false,
      lookup: (_host, _options, callback) => {
        if (_options.all) callback(null, [pinned]);
        else callback(null, pinned.address, pinned.family);
      },
      headers: { 'User-Agent': 'AlphaCloneBot/1.0 (+https://alphaclonesystems.com)', 'Accept-Encoding': 'identity' },
    }, (res) => {
      const chunks: Buffer[] = []; let bytes = 0;
      res.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > maxBytes) req.destroy(new Error('CRAWL_SIZE_LIMIT'));
        else chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode || 0, contentType: String(res.headers['content-type'] || ''), body: Buffer.concat(chunks).toString('utf8'), bytes }));
    });
    const timer = setTimeout(() => req.destroy(new Error('CRAWL_TIMEOUT')), timeoutMs);
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject);
    req.end();
  });
}
