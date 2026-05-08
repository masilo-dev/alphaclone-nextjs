/**
 * Universal Webhook Utilities using Web Crypto API.
 * Compatible with Node.js and Vercel Edge Runtime.
 */

function hexToUint8Array(hex: string): Uint8Array {
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < arr.length; i++) {
        arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return arr;
}

function uint8ArrayToHex(arr: Uint8Array): string {
    return Array.from(arr)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let res = 0;
    for (let i = 0; i < a.length; i++) {
        res |= a[i] ^ b[i];
    }
    return res === 0;
}

/**
 * Verifies a Facebook X-Hub-Signature-256 header using HMAC-SHA256.
 * This prevents spoofing of webhook events.
 */
export async function verifyFacebookSignature(
    body: string, 
    signatureHeader: string | null | undefined, 
    appSecret: string | undefined
): Promise<boolean> {
    if (!signatureHeader || !appSecret) return false;

    try {
        const signature = signatureHeader.replace('sha256=', '');
        const encoder = new TextEncoder();
        
        const keyData = encoder.encode(appSecret);
        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const bodyData = encoder.encode(body);
        const signatureBuffer = await crypto.subtle.sign(
            'HMAC',
            key,
            bodyData
        );

        const expectedSignature = uint8ArrayToHex(new Uint8Array(signatureBuffer));
        
        const sigBuf = hexToUint8Array(signature);
        const expBuf = hexToUint8Array(expectedSignature);

        return constantTimeEqual(sigBuf, expBuf);
    } catch (error) {
        console.error('[verifyFacebookSignature] Check failed:', error);
        return false;
    }
}
