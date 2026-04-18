/**
 * LiveKit bridge (planned)
 *
 * Product direction: extend sessions beyond Daily.co limits by handing off to LiveKit
 * when a room policy requires it. This module is a placeholder so configuration keys
 * and imports stay centralized until the full handoff flow ships.
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
