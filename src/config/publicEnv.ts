/**
 * Browser-safe configuration only (NEXT_PUBLIC_*).
 * Use for Maps and other client-side SDKs. Restrict keys in Google Cloud to HTTP referrers.
 */
export function getPublicGoogleMapsApiKey(): string {
    if (typeof process === 'undefined') return '';
    return (
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
        process.env.NEXT_PUBLIC_GOOGLE_API_KEY ||
        ''
    );
}
