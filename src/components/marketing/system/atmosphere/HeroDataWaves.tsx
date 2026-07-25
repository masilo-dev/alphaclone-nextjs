const MOBILE_LEFT_PATHS = [
  'M-20 150 C 40 140, 90 185, 140 170 S 210 135, 250 160',
  'M-20 168 C 45 158, 95 203, 145 188 S 215 153, 255 178',
  'M-20 186 C 50 176, 100 221, 150 206 S 220 171, 260 196',
  'M-20 204 C 55 194, 105 239, 155 224 S 225 189, 265 214',
  'M-20 222 C 60 212, 110 257, 160 242 S 230 207, 270 232',
] as const;

const MOBILE_RIGHT_PATHS = [
  'M410 210 C 350 198, 300 245, 250 230 S 180 195, 140 220',
  'M410 228 C 345 216, 295 263, 245 248 S 175 213, 135 238',
  'M410 246 C 340 234, 290 281, 240 266 S 170 231, 130 256',
  'M410 264 C 335 252, 285 299, 235 284 S 165 249, 125 274',
  'M410 282 C 330 270, 280 317, 230 302 S 160 267, 120 292',
] as const;

type WaveStroke = {
  d: string;
  stroke: string;
  opacity: number;
};

const LEFT_STROKES: WaveStroke[] = [
  {
    d: 'M-40 170 C 80 155, 160 210, 240 195 S 380 145, 460 175 S 560 230, 620 210',
    stroke: 'rgba(24,199,200,0.20)',
    opacity: 1,
  },
  {
    d: 'M-40 188 C 90 172, 170 228, 250 212 S 390 160, 470 190 S 570 248, 640 224',
    stroke: 'rgba(30,177,240,0.12)',
    opacity: 0.95,
  },
  {
    d: 'M-40 206 C 100 190, 180 246, 260 228 S 400 178, 480 206 S 580 264, 650 238',
    stroke: 'rgba(40,119,232,0.18)',
    opacity: 0.9,
  },
  {
    d: 'M-40 224 C 85 208, 175 262, 255 246 S 395 196, 475 224 S 575 280, 655 255',
    stroke: 'rgba(24,199,200,0.14)',
    opacity: 0.85,
  },
  {
    d: 'M-40 242 C 95 226, 185 280, 265 262 S 405 212, 485 242 S 585 298, 660 270',
    stroke: 'rgba(30,177,240,0.10)',
    opacity: 0.8,
  },
  {
    d: 'M-40 260 C 110 244, 195 298, 275 280 S 415 230, 495 258 S 595 316, 670 286',
    stroke: 'rgba(40,119,232,0.14)',
    opacity: 0.75,
  },
  {
    d: 'M-40 278 C 105 262, 205 316, 285 298 S 425 248, 505 276 S 605 334, 680 302',
    stroke: 'rgba(24,199,200,0.12)',
    opacity: 0.7,
  },
  {
    d: 'M-40 296 C 120 280, 215 334, 295 314 S 435 266, 515 292 S 615 352, 690 318',
    stroke: 'rgba(30,177,240,0.09)',
    opacity: 0.65,
  },
  {
    d: 'M-40 314 C 115 298, 225 352, 305 332 S 445 284, 525 310 S 625 370, 700 334',
    stroke: 'rgba(40,119,232,0.12)',
    opacity: 0.6,
  },
  {
    d: 'M-40 332 C 130 316, 235 370, 315 350 S 455 302, 535 328 S 635 388, 710 350',
    stroke: 'rgba(24,199,200,0.10)',
    opacity: 0.55,
  },
  {
    d: 'M-40 350 C 125 334, 245 388, 325 366 S 465 320, 545 344 S 645 404, 720 366',
    stroke: 'rgba(30,177,240,0.08)',
    opacity: 0.5,
  },
  {
    d: 'M-40 368 C 140 352, 255 406, 335 384 S 475 338, 555 362 S 655 422, 730 382',
    stroke: 'rgba(40,119,232,0.10)',
    opacity: 0.45,
  },
];

const RIGHT_STROKES: WaveStroke[] = [
  {
    d: 'M1480 230 C 1360 215, 1280 270, 1200 255 S 1060 205, 980 235 S 880 290, 820 270',
    stroke: 'rgba(40,119,232,0.18)',
    opacity: 1,
  },
  {
    d: 'M1480 248 C 1350 232, 1270 288, 1190 270 S 1050 220, 970 250 S 870 308, 800 286',
    stroke: 'rgba(122,75,224,0.12)',
    opacity: 0.95,
  },
  {
    d: 'M1480 266 C 1340 250, 1260 306, 1180 288 S 1040 238, 960 266 S 860 324, 790 300',
    stroke: 'rgba(30,177,240,0.12)',
    opacity: 0.9,
  },
  {
    d: 'M1480 284 C 1355 268, 1250 324, 1170 304 S 1030 254, 950 282 S 850 340, 780 316',
    stroke: 'rgba(24,199,200,0.16)',
    opacity: 0.85,
  },
  {
    d: 'M1480 302 C 1345 286, 1240 342, 1160 322 S 1020 272, 940 298 S 840 356, 770 332',
    stroke: 'rgba(122,75,224,0.10)',
    opacity: 0.8,
  },
  {
    d: 'M1480 320 C 1335 304, 1230 360, 1150 338 S 1010 288, 930 316 S 830 374, 760 348',
    stroke: 'rgba(40,119,232,0.14)',
    opacity: 0.75,
  },
  {
    d: 'M1480 338 C 1340 322, 1220 378, 1140 356 S 1000 306, 920 332 S 820 390, 750 364',
    stroke: 'rgba(30,177,240,0.10)',
    opacity: 0.7,
  },
  {
    d: 'M1480 356 C 1325 340, 1210 396, 1130 372 S 990 324, 910 348 S 810 408, 740 380',
    stroke: 'rgba(122,75,224,0.09)',
    opacity: 0.65,
  },
  {
    d: 'M1480 374 C 1330 358, 1200 414, 1120 390 S 980 340, 900 366 S 800 424, 730 396',
    stroke: 'rgba(24,199,200,0.12)',
    opacity: 0.6,
  },
  {
    d: 'M1480 392 C 1315 376, 1190 432, 1110 406 S 970 358, 890 382 S 790 440, 720 412',
    stroke: 'rgba(40,119,232,0.11)',
    opacity: 0.55,
  },
  {
    d: 'M1480 410 C 1320 394, 1180 450, 1100 424 S 960 376, 880 400 S 780 458, 710 428',
    stroke: 'rgba(122,75,224,0.08)',
    opacity: 0.5,
  },
  {
    d: 'M1480 428 C 1305 412, 1170 468, 1090 440 S 950 392, 870 416 S 770 474, 700 444',
    stroke: 'rgba(30,177,240,0.09)',
    opacity: 0.45,
  },
];

const MOBILE_LEFT_STROKES: WaveStroke[] = MOBILE_LEFT_PATHS.map((d, index) => ({
  d,
  stroke: index % 2 === 0 ? 'rgba(24,199,200,0.16)' : 'rgba(40,119,232,0.12)',
  opacity: 0.75 - index * 0.06,
}));

const MOBILE_RIGHT_STROKES: WaveStroke[] = MOBILE_RIGHT_PATHS.map((d, index) => ({
  d,
  stroke: index % 2 === 0 ? 'rgba(40,119,232,0.14)' : 'rgba(122,75,224,0.09)',
  opacity: 0.72 - index * 0.06,
}));

function WaveGroup({
  strokes,
  maskId,
}: {
  strokes: WaveStroke[];
  maskId: string;
}) {
  return (
    <g mask={`url(#${maskId})`}>
      {strokes.map((stroke) => (
        <path
          key={`${maskId}-${stroke.d}`}
          className="wave-path"
          d={stroke.d}
          stroke={stroke.stroke}
          opacity={Math.min(stroke.opacity, 0.42)}
        />
      ))}
    </g>
  );
}

/**
 * Side data-wave fields framing the hero — custom SVG paths, not stock art.
 * Fades before the central headline; curves toward the product preview.
 */
export default function HeroDataWaves() {
  return (
    <div className="hero-data-wave" aria-hidden="true">
      <svg
        className="hero-data-wave-svg hero-data-wave-svg--desktop"
        viewBox="0 0 1440 720"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="mkt-wave-mask-left" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="55%" stopColor="white" stopOpacity="0.55" />
            <stop offset="78%" stopColor="white" stopOpacity="0.12" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mkt-wave-mask-right" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="55%" stopColor="white" stopOpacity="0.5" />
            <stop offset="78%" stopColor="white" stopOpacity="0.1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id="mkt-left-wave-mask">
            <rect width="1440" height="720" fill="url(#mkt-wave-mask-left)" />
          </mask>
          <mask id="mkt-right-wave-mask">
            <rect width="1440" height="720" fill="url(#mkt-wave-mask-right)" />
          </mask>
        </defs>
        <g className="hero-data-wave-drift hero-data-wave-drift--left">
          <WaveGroup strokes={LEFT_STROKES} maskId="mkt-left-wave-mask" />
        </g>
        <g className="hero-data-wave-drift hero-data-wave-drift--right">
          <WaveGroup strokes={RIGHT_STROKES} maskId="mkt-right-wave-mask" />
        </g>
      </svg>

      <svg
        className="hero-data-wave-svg hero-data-wave-svg--mobile"
        viewBox="0 0 390 640"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="mkt-wave-mask-left-m" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0.9" />
            <stop offset="42%" stopColor="white" stopOpacity="0.35" />
            <stop offset="68%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mkt-wave-mask-right-m" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0.85" />
            <stop offset="42%" stopColor="white" stopOpacity="0.3" />
            <stop offset="68%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id="mkt-left-wave-mask-m">
            <rect width="390" height="640" fill="url(#mkt-wave-mask-left-m)" />
          </mask>
          <mask id="mkt-right-wave-mask-m">
            <rect width="390" height="640" fill="url(#mkt-wave-mask-right-m)" />
          </mask>
        </defs>
        <g className="hero-data-wave-drift hero-data-wave-drift--left">
          <WaveGroup strokes={MOBILE_LEFT_STROKES} maskId="mkt-left-wave-mask-m" />
        </g>
        <g className="hero-data-wave-drift hero-data-wave-drift--right">
          <WaveGroup strokes={MOBILE_RIGHT_STROKES} maskId="mkt-right-wave-mask-m" />
        </g>
      </svg>
    </div>
  );
}
