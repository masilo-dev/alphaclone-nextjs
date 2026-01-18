import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Serverless function to create or get a permanent Daily.co room for a user
 * Creates a room with a consistent name that never expires
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
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const DAILY_API_KEY = process.env.DAILY_API_KEY;

        if (!DAILY_API_KEY) {
            console.error('DAILY_API_KEY not configured');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Generate consistent room name based on user ID
        const roomName = `user-${userId.substring(0, 8)}-permanent`;

        // Try to get existing room first
        try {
            const getResponse = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${DAILY_API_KEY}`
                }
            });

            if (getResponse.ok) {
                // Room exists, return it
                const existingRoom = await getResponse.json();
                return res.status(200).json({
                    id: existingRoom.id,
                    name: existingRoom.name,
                    url: existingRoom.url,
                    exists: true
                });
            }
        } catch (getError) {
            // Room doesn't exist, proceed to create
            console.log('Room does not exist, creating new one');
        }

        // Create new permanent room
        const createResponse = await fetch('https://api.daily.co/v1/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DAILY_API_KEY}`
            },
            body: JSON.stringify({
                name: roomName,
                privacy: 'public',
                properties: {
                    // Media Settings
                    enable_screenshare: true,
                    enable_chat: true,
                    max_participants: 10,
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
                }
            })
        });

        if (!createResponse.ok) {
            const errorData = await createResponse.json();
            console.error('Daily.co API error:', errorData);
            return res.status(createResponse.status).json({
                error: errorData.error || 'Failed to create permanent room'
            });
        }

        const room = await createResponse.json();

        return res.status(200).json({
            id: room.id,
            name: room.name,
            url: room.url,
            exists: false
        });
    } catch (error) {
        console.error('Error creating permanent room:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to create permanent room'
        });
    }
}
