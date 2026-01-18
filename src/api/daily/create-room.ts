import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Serverless function to create Daily.co rooms
 * This keeps your API key secure on the backend
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
        const { name, properties } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Room name is required' });
        }

        const DAILY_API_KEY = process.env.DAILY_API_KEY;

        if (!DAILY_API_KEY) {
            console.error('DAILY_API_KEY not configured');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Enforce max participants limit (cap at 10)
        const maxParticipants = Math.min(properties?.max_participants || 10, 10);

        // Create room via Daily.co API - FAST, no delays
        let response: Response;

        try {
            response = await fetch('https://api.daily.co/v1/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DAILY_API_KEY}`
                },
                body: JSON.stringify({
                    name,
                    properties: {
                        // Media Settings
                        enable_screenshare: true,
                        enable_chat: true,
                        max_participants: maxParticipants,
                        start_video_off: false, // Video ON by default
                        start_audio_off: false, // Audio ON by default

                        // UI Settings - Only confirmed valid properties
                        enable_prejoin_ui: true,
                        enable_network_ui: true,
                        enable_advanced_chat: true,
                        enable_people_ui: true,
                        enable_video_processing_ui: true, // Background blur, virtual backgrounds

                        // Permissions & Visibility
                        owner_only_broadcast: false, // Everyone can broadcast

                        // REMOVED INVALID PROPERTIES:
                        // - enable_emoji_reactions (invalid)
                        // - enable_hand_raising (invalid)
                        // - enable_live_streaming (invalid)
                        // - enable_recording (invalid in properties)
                        // - enable_chat_autolinks (invalid)
                        // - enable_breakout_rooms (invalid)
                        // - enable_active_speaker (invalid)

                        // Removed ...otherProperties to prevent invalid properties from being passed through
                    }
                })
            });
        } catch (error) {
            console.error('Daily.co API error:', error);
            return res.status(500).json({
                error: error instanceof Error ? error.message : 'Failed to create room'
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Daily.co API error:', {
                status: response.status,
                error: errorData,
                requestedName: name,
                requestedProperties: properties
            });
            return res.status(response.status).json({
                error: errorData?.error || errorData?.info || 'Failed to create room',
                details: errorData
            });
        }

        const room = await response.json();

        return res.status(200).json({
            id: room.id,
            name: room.name,
            url: room.url,
            config: room.config
        });
    } catch (error) {
        console.error('Error creating Daily room:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to create room'
        });
    }
}
