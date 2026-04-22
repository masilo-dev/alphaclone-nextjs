import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 72,
          background: 'linear-gradient(135deg, #020617 0%, #0f172a 55%, #134e4a 100%)',
          color: 'white',
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -1 }}>AlphaClone</div>
        <div style={{ marginTop: 18, fontSize: 34, fontWeight: 600, opacity: 0.92 }}>
          Unified Business OS for CRM, billing, contracts, scheduling, and operations
        </div>
      </div>
    ),
    size
  );
}
