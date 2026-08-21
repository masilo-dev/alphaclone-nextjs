/**
 * Backward-compatible Lead Sync URL.
 *
 * LinkedIn uses the same HMAC challenge and signed-notification contract here
 * as the canonical application webhook. Delegation prevents the former
 * plaintext challenge and unsigned POST path from bypassing validation.
 */
export { GET, POST } from '../../../linkedin/webhook/route';
