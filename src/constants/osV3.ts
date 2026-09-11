/**
 * AlphaClone OS v3 interaction contracts.
 * Brand colours continue to come from brand.ts; this module intentionally
 * contains no replacement colour palette.
 */

export const OS_V3_SPRINGS = {
  responsive: { type: 'spring', stiffness: 520, damping: 36, mass: 0.72 },
  standard: { type: 'spring', stiffness: 360, damping: 34, mass: 0.86 },
  expressive: { type: 'spring', stiffness: 250, damping: 30, mass: 0.96 },
} as const;

export const OS_V3_MOTION = {
  tapScale: 0.985,
  hoverLiftPx: -1,
  reducedMotionDuration: 0.001,
} as const;

export const OS_V3_MATERIAL = {
  canvas: 'ac-v3-canvas',
  content: 'ac-v3-content',
  elevated: 'ac-v3-elevated',
  floating: 'ac-v3-floating',
  intelligence: 'ac-v3-intelligence',
  command: 'ac-v3-command-surface',
  sheet: 'ac-v3-sheet',
  popover: 'ac-v3-popover',
} as const;

export type OsV3MaterialLevel = keyof typeof OS_V3_MATERIAL;
