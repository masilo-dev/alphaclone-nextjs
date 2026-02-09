/**
 * Video URL Service
 * Abstracts video provider URLs to show AlphaClone branding
 *
 * This service ensures users never see third-party video provider domains.
 * All video URLs are proxied through AlphaClone's domain for brand consistency.
 */

/**
 * Get a branded video meeting URL for sharing with clients
 * This creates a clean AlphaClone URL instead of exposing the underlying provider
 *
 * @param roomId - The room identifier
 * @param useProxy - Whether to use AlphaClone proxy URL (recommended for client-facing)
 * @returns Clean AlphaClone-branded URL
 */
export function getVideoMeetingUrl(roomId: string, useProxy: boolean = true): string {
    if (useProxy) {
        // Client-facing URL: Uses AlphaClone domain
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclone.com';
        return `${baseUrl}/meet/${roomId}`;
    } else {
        // Direct provider URL for internal use only
        return getProviderUrl(roomId);
    }
}

/**
 * Get the underlying provider URL (internal use only)
 * Users should never see this URL
 *
 * @param roomId - The room identifier
 * @returns Provider-specific URL
 */
function getProviderUrl(roomId: string): string {
    const domain = process.env.NEXT_PUBLIC_DAILY_DOMAIN || 'alphaclone';
    return `https://${domain}.daily.co/${roomId}`;
}

/**
 * Get shareable meeting link with AlphaClone branding
 * This is what you send to clients
 *
 * @param roomId - The room identifier
 * @param meetingName - Optional friendly meeting name
 * @returns Branded shareable URL
 */
export function getShareableMeetingLink(roomId: string, meetingName?: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclone.com';
    const path = meetingName
        ? `/meet/${roomId}?name=${encodeURIComponent(meetingName)}`
        : `/meet/${roomId}`;
    return `${baseUrl}${path}`;
}

/**
 * Extract room ID from any video meeting URL
 * Handles both AlphaClone proxy URLs and provider URLs
 *
 * @param url - Any meeting URL
 * @returns Room ID or null if invalid
 */
export function extractRoomId(url: string): string | null {
    try {
        const urlObj = new URL(url);

        // Handle AlphaClone proxy URLs: /meet/room-id
        if (urlObj.pathname.startsWith('/meet/')) {
            return urlObj.pathname.replace('/meet/', '').split('?')[0];
        }

        // Handle direct provider URLs: https://domain.daily.co/room-id
        if (urlObj.hostname.includes('daily.co')) {
            return urlObj.pathname.replace('/', '').split('?')[0];
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Generate a demo meeting URL for testing
 * Always uses AlphaClone branding for demos
 *
 * @returns Demo meeting URL
 */
export function getDemoMeetingUrl(): string {
    const roomId = `demo-${Math.random().toString(36).substring(7)}`;
    return getShareableMeetingLink(roomId, 'Demo Meeting');
}

/**
 * Validate if a URL is a valid AlphaClone meeting URL
 *
 * @param url - URL to validate
 * @returns true if valid meeting URL
 */
export function isValidMeetingUrl(url: string): boolean {
    return extractRoomId(url) !== null;
}
