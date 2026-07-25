/**
 * Extremely subtle grain — felt more than seen.
 * Single SVG turbulence layer; no raster image.
 */
export default function BackgroundNoise() {
  return (
    <div className="mkt-bg-noise" aria-hidden="true">
      <svg className="mkt-bg-noise-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <filter id="mkt-noise-filter" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.75
                    0 0 0 0 0.82
                    0 0 0 0 0.95
                    0 0 0 0.45 0"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#mkt-noise-filter)" />
      </svg>
    </div>
  );
}
