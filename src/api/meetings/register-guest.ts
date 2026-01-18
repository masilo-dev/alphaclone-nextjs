import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Register guest participant joining via permanent link
 * Saves guest info to database for tracking
 */
export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { name, roomId, roomUrl } = req.body;

        if (!name || !roomId) {
            return res.status(400).json({ error: 'Name and roomId are required' });
        }

        // Initialize Supabase client
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.error('Supabase configuration missing');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Create guest participant record
        const { data: guestData, error: guestError } = await supabase
            .from('guest_participants')
            .insert({
                name,
                room_id: roomId,
                room_url: roomUrl,
                joined_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (guestError) {
            console.error('Failed to register guest:', guestError);
            return res.status(500).json({ error: 'Failed to register guest participant' });
        }

        return res.status(200).json({
            success: true,
            guestId: guestData.id,
            message: 'Guest registered successfully'
        });
    } catch (error) {
        console.error('Error in register-guest:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to register guest'
        });
    }
}
