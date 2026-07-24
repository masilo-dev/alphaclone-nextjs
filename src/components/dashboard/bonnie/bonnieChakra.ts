/**
 * Bonnie Chakra + AlphaClone enterprise chrome tokens.
 * Teal/dark slate only — no indigo/purple AI-saas gradients.
 */

import { COLORS, WORKSPACE } from '@/constants/design';

export const BONNIE_CHAKRA = {
  colors: {
    bg: COLORS.neutral[950],
    panel: COLORS.neutral[900],
    panelElevated: COLORS.neutral[800],
    border: 'whiteAlpha.200',
    borderSolid: COLORS.neutral[700],
    text: 'whiteAlpha.900',
    muted: 'gray.400',
    subtle: 'gray.500',
    accent: COLORS.primary[400],
    accentSolid: 'teal.500',
    accentSoft: 'teal.600',
    danger: 'rose.400',
    warn: 'amber.400',
  },
  radii: {
    panel: 'lg', // enterprise: avoid rounded-2xl/3xl
    control: 'md',
    chip: 'md',
  },
  panelProps: {
    bg: 'gray.900',
    borderWidth: '1px',
    borderColor: 'whiteAlpha.200',
    borderRadius: 'lg',
  } as const,
  toolbarProps: {
    h: '12',
    px: { base: 3, md: 4 },
    borderBottomWidth: '1px',
    borderColor: 'whiteAlpha.200',
    bg: 'gray.950',
    alignItems: 'center',
  } as const,
  sectionLabel: WORKSPACE.typography.sectionLabel,
  panelTitle: WORKSPACE.typography.panelTitle,
} as const;

/** Flat token alias for quick Chakra prop usage */
export const BC = {
  bg: 'gray.950',
  panel: 'gray.900',
  surfaceAlt: 'whiteAlpha.50',
  border: 'whiteAlpha.200',
  ink: 'whiteAlpha.900',
  muted: 'gray.400',
  subtle: 'gray.500',
  teal: 'teal.400',
  tealSolid: 'teal.600',
  tealSoft: 'teal.600',
  tealBorder: 'teal.500',
  radius: 'lg',
  controlRadius: 'md',
  radii: BONNIE_CHAKRA.radii,
  panelProps: BONNIE_CHAKRA.panelProps,
  toolbarProps: BONNIE_CHAKRA.toolbarProps,
} as const;
