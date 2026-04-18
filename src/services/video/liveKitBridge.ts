/**
 * LiveKit bridge
 *
 * Multi-tenant isolation: each `video_calls.id` (UUID) maps to one Daily room and one
 * LiveKit room name `alphaclone-${callId}`. Businesses never share a room name; capacity
 * scales with Daily/LiveKit plans and Postgres, not with a single shared room.
 *
 * Required environment:
 * - LIVEKIT_URL (WebSocket URL, e.g. wss://your-project.livekit.cloud)
 * - LIVEKIT_API_KEY
 * - LIVEKIT_API_SECRET
 *
 * Optional: NEXT_PUBLIC_LIVEKIT_URL if you prefer a public duplicate of the WS URL for documentation;
 * the token route returns the server LIVEKIT_URL to the client.
 */

export type LiveKitBridgeConfig = {
  url: string | null;
  apiKey: string | null;
  apiSecret: string | null;
};

export function readLiveKitEnv(): LiveKitBridgeConfig {
  return {
    url: process.env.LIVEKIT_URL || null,
    apiKey: process.env.LIVEKIT_API_KEY || null,
    apiSecret: process.env.LIVEKIT_API_SECRET || null,
  };
}

export function isLiveKitConfigured(): boolean {
  const c = readLiveKitEnv();
  return !!(c.url && c.apiKey && c.apiSecret);
}
