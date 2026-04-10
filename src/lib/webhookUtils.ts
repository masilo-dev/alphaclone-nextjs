import crypto from 'crypto';

/**
 * Verifies a Facebook X-Hub-Signature-256 header using HMAC-SHA256.
 * This prevents spoofing of webhook events.
 */
export function verifyFacebookSignature(
    body: string, 
    signatureHeader: string | null | undefined, 
    appSecret: string | undefined
): boolean {
    if (!signatureHeader || !appSecret) return false;

    try {
        const signature = signatureHeader.replace('sha256=', '');
        const expectedSignature = crypto
            .createHmac('sha256', appSecret)
            .update(body)
            .digest('hex');

        // timingSafeEqual prevents timing attacks
        const sigBuf = Buffer.from(signature, 'hex');
        const expBuf = Buffer.from(expectedSignature, 'hex');

        if (sigBuf.length !== expBuf.length) return false;
        
        return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch (error) {
        console.error('[verifyFacebookSignature] Check failed:', error);
        return false;
    }
}
