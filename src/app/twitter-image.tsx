import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

export const size = {
  width: 1200,
  height: 600,
};

export const contentType = 'image/png';

export default function TwitterImage() {
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
          background: 'linear-gradient(135deg, #020617 0%, #0f172a 55%, #115e59 100%)',
          color: 'white',
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: -1 }}>AlphaClone</div>
        <div style={{ marginTop: 16, fontSize: 30, fontWeight: 600, opacity: 0.92 }}>
          CRM, billing, contracts, scheduling, messaging, documents, and operations
        </div>
      </div>
    ),
    size
  );
}
