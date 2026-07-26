type SectionConnectorProps = {
  variant?: 'arc' | 'fade';
};

/**
 * Subtle continuity between major sections — edge-only, never through content.
 */
export default function SectionConnector({ variant = 'arc' }: SectionConnectorProps) {
  if (variant === 'fade') {
    return <div className="mkt-section-connector mkt-section-connector--fade" aria-hidden="true" />;
  }

  return (
    <div className="mkt-section-connector mkt-section-connector--arc" aria-hidden="true">
      <svg
        className="mkt-section-connector-svg"
        viewBox="0 0 1200 48"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="mkt-connector-fade" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(24,199,200,0)" />
            <stop offset="22%" stopColor="rgba(40,119,232,0.22)" />
            <stop offset="50%" stopColor="rgba(24,199,200,0.28)" />
            <stop offset="78%" stopColor="rgba(122,75,224,0.16)" />
            <stop offset="100%" stopColor="rgba(24,199,200,0)" />
          </linearGradient>
        </defs>
        <path
          className="wave-path"
          d="M40 36 C 220 8, 380 8, 600 28 S 980 44, 1160 18"
          stroke="url(#mkt-connector-fade)"
          strokeWidth="0.9"
          fill="none"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx="220" cy="18" r="1.4" fill="rgba(24,199,200,0.35)" />
        <circle cx="600" cy="28" r="1.6" fill="rgba(109,232,226,0.4)" />
        <circle cx="980" cy="36" r="1.3" fill="rgba(122,75,224,0.28)" />
      </svg>
    </div>
  );
}
