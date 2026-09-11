export type ValidatedAddress = {
  valid: boolean;
  formattedAddress?: string;
  location?: { lat: number; lng: number };
  error?: string;
};

export async function geocodeAddress(address: string): Promise<ValidatedAddress> {
  const query = address.trim();
  if (!query) return { valid: false, error: 'Address is required' };

  const hereKey = process.env.HERE_API_KEY;
  if (hereKey) {
    try {
      const response = await fetch(`https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(query)}&limit=1&apiKey=${encodeURIComponent(hereKey)}`, {
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
      });
      if (response.ok) {
        const payload = await response.json();
        const item = payload.items?.[0];
        if (item?.position && Number.isFinite(item.position.lat) && Number.isFinite(item.position.lng)) {
          return {
            valid: true,
            formattedAddress: item.address?.label || item.title || query,
            location: { lat: Number(item.position.lat), lng: Number(item.position.lng) },
          };
        }
      }
    } catch (error) {
      console.warn('[location] HERE geocoding failed; using OpenStreetMap fallback', error);
    }
  }

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=1`, {
      headers: { 'User-Agent': 'AlphaClone-AddressValidation/1.0 (support@alphaclonesystems.com)', Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    if (!response.ok) return { valid: false, error: `Address provider returned ${response.status}` };
    const payload = await response.json();
    const item = payload?.[0];
    const lat = Number(item?.lat);
    const lng = Number(item?.lon);
    if (!item || !Number.isFinite(lat) || !Number.isFinite(lng)) return { valid: false, error: 'Address could not be located' };
    return { valid: true, formattedAddress: item.display_name || query, location: { lat, lng } };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Address validation failed' };
  }
}
