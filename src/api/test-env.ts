import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Test endpoint to verify environment variables
 */
export default async function handler(
    _req: VercelRequest,
    res: VercelResponse
) {
    const DAILY_API_KEY = process.env.DAILY_API_KEY;

    return res.status(200).json({
        hasApiKey: !!DAILY_API_KEY,
        keyLength: DAILY_API_KEY?.length || 0,
        keyPreview: DAILY_API_KEY ? DAILY_API_KEY.substring(0, 10) + '...' : 'NOT SET',
        allEnvVars: Object.keys(process.env).filter(key => key.includes('DAILY'))
    });
}
