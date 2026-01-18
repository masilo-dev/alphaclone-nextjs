import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Allowed origins for CORS
 * Add your production domains here
 */
const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://alphaclone.tech',
    'https://www.alphaclone.tech',
    // Add your Vercel preview/production URLs
    process.env.VITE_APP_URL || '',
].filter(Boolean);

/**
 * CORS middleware for API routes
 */
export function configureCors(req: VercelRequest, res: VercelResponse): boolean {
    const origin = req.headers.origin;

    // Check if origin is allowed
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
        // Allow requests with no origin (e.g., mobile apps, Postman)
        res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return true; // Indicates preflight was handled
    }

    return false; // Continue with normal request
}

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) return true; // Allow requests with no origin
    return ALLOWED_ORIGINS.includes(origin);
}

