type Dot = { cx: string; cy: string; r: string; opacity: string; key: string };

function round(value: number, digits = 2): string {
  const factor = 10 ** digits;
  return String(Math.round(value * factor) / factor);
}

/** Sparse curved-grid dots — not random polka dots. */
function buildCurvedField(
  originX: number,
  originY: number,
  cols: number,
  rows: number,
  bend: number,
  side: 'left' | 'right',
  prefix: string,
): Dot[] {
  const dots: Dot[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const t = col / Math.max(cols - 1, 1);
      const curve = Math.sin(t * Math.PI) * bend + row * 0.35;
      const x =
        side === 'right'
          ? originX + col * 18 + curve
          : originX - col * 18 - curve;
      const y = originY + row * 16 + Math.sin(col * 0.55) * 4;
      const fade = 1 - t * 0.85;
      const size = 1 + (row % 3 === 0 ? 0.4 : 0);
      dots.push({
        key: `${prefix}-${row}-${col}`,
        cx: round(x),
        cy: round(y),
        r: round(size / 2, 2),
        opacity: round(Math.max(0.08, 0.34 * fade - row * 0.008), 3),
      });
    }
  }
  return dots;
}

const UPPER_RIGHT = buildCurvedField(1180, 70, 10, 8, 22, 'right', 'tr');
const LOWER_LEFT = buildCurvedField(260, 470, 9, 7, 18, 'left', 'bl');

export default function CurvedDotField() {
  return (
    <div className="curved-dot-field" aria-hidden="true">
      <svg
        className="curved-dot-field-svg"
        viewBox="0 0 1440 720"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="mkt-dot-fade-tr" cx="82%" cy="18%" r="38%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="70%" stopColor="white" stopOpacity="0.35" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mkt-dot-fade-bl" cx="18%" cy="78%" r="36%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="70%" stopColor="white" stopOpacity="0.3" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="mkt-dot-mask-tr">
            <rect width="1440" height="720" fill="url(#mkt-dot-fade-tr)" />
          </mask>
          <mask id="mkt-dot-mask-bl">
            <rect width="1440" height="720" fill="url(#mkt-dot-fade-bl)" />
          </mask>
        </defs>
        <g mask="url(#mkt-dot-mask-tr)" className="curved-dot-field-pulse">
          {UPPER_RIGHT.map((dot) => (
            <circle
              key={dot.key}
              cx={dot.cx}
              cy={dot.cy}
              r={dot.r}
              fill={`rgba(109,232,226,${dot.opacity})`}
            />
          ))}
        </g>
        <g mask="url(#mkt-dot-mask-bl)" className="curved-dot-field-pulse curved-dot-field-pulse--alt">
          {LOWER_LEFT.map((dot) => (
            <circle
              key={dot.key}
              cx={dot.cx}
              cy={dot.cy}
              r={dot.r}
              fill={`rgba(40,119,232,${dot.opacity})`}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
