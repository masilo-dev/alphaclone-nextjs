import crypto from 'crypto';

/**
 * Generate a random code verifier for PKCE
 */
export function generateCodeVerifier(length = 128): string {
    return crypto
        .randomBytes(length)
        .toString('base64url');
}

/**
 * Generate a code challenge from a code verifier for PKCE (S256)
 */
export function generateCodeChallenge(verifier: string): string {
    return crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64url');
}
