/**
 * Universal AES-256-GCM encryption using Web Crypto API.
 * Compatible with Node.js and Vercel Edge Runtime.
 */

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12;

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

async function getKey(secret: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const secretBytes = encoder.encode(secret);
    const keyData =
        secret.length === 32
            ? secretBytes
            : new Uint8Array(await crypto.subtle.digest('SHA-256', secretBytes));
    return await crypto.subtle.importKey(
        'raw',
        keyData,
        ALGORITHM,
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypts a string using AES-256-GCM
 * @param text The plain text to encrypt
 * @param secret The 32-character encryption secret
 */
export async function encrypt(text: string, secret: string): Promise<string> {
    if (secret.length < 32) {
        throw new Error('Encryption secret must be at least 32 characters long');
    }

    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const key = await getKey(secret);
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv: iv as any },
        key,
        data as any
    );

    const fullArray = new Uint8Array(encryptedBuffer);
    // Web Crypto appends the 16-byte auth tag at the end of the ciphertext
    const tagLength = 16;
    const ciphertext = fullArray.slice(0, fullArray.length - tagLength);
    const authTag = fullArray.slice(fullArray.length - tagLength);

    // Format: iv:authTag:encrypted (matching existing format)
    return `${uint8ArrayToHex(iv)}:${uint8ArrayToHex(authTag)}:${uint8ArrayToHex(ciphertext)}`;
}

/**
 * Decrypts a string using AES-256-GCM
 * @param encryptedText The encrypted text in format iv:authTag:encrypted
 * @param secret The 32-character encryption secret
 */
export async function decrypt(encryptedText: string, secret: string): Promise<string> {
    if (secret.length < 32) {
        throw new Error('Encryption secret must be at least 32 characters long');
    }

    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted text format');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = hexToUint8Array(ivHex);
    const authTag = hexToUint8Array(authTagHex);
    const ciphertext = hexToUint8Array(encryptedHex);

    const key = await getKey(secret);
    
    // Concatenate ciphertext and auth tag for Web Crypto
    const dataWithTag = new Uint8Array(ciphertext.length + authTag.length);
    dataWithTag.set(ciphertext);
    dataWithTag.set(authTag, ciphertext.length);

    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv: iv as any },
        key,
        dataWithTag as any
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
}
