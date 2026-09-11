/** Best-effort country code from common proxy/CDN headers (Railway has no built-in geo). */
export function getRequestCountry(headers: Headers, fallback = 'XX'): string {
  const candidates = [
    headers.get('cf-ipcountry'),
    headers.get('x-country'),
    headers.get('x-appengine-country'),
  ];

  for (const value of candidates) {
    const code = String(value || '').trim().toUpperCase();
    if (code && code !== 'XX' && code !== 'T1') return code;
  }

  return fallback;
}
