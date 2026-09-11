/** Extremely subtle grain via CSS — no SVG filter cost on first paint. */
export default function BackgroundNoise() {
  return <div className="mkt-bg-noise" aria-hidden="true" />;
}
