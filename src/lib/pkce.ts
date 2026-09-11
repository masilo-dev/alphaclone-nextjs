/**
 * Universal PKCE (Proof Key for Code Exchange) helpers using Web Crypto API.
 * Compatible with Node.js and Vercel Edge Runtime.
 */

/**
 * Generate a random code verifier for PKCE
 */
export function generateCodeVerifier(length = 128): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const values = crypto.getRandomValues(new Uint8Array(length));
    let result = '';
    for (let i = 0; i < length; i++) {
        result += charset[values[i] % charset.length];
    }
    return result;
}

/**
 * Generate a code challenge from a code verifier for PKCE (S256)
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data as any);
    
    // Base64url encode the digest
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}
