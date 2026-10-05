/**
 * AlphaClone mobile theme — mirrors web brand.ts / alphaclone-theme tokens.
 * Hex lives ONLY here. Screens and components import from this module.
 */

export const colors = {
  /** Brand anchors (AlphaClone identity) */
  navy: '#212446',
  teal: '#4199A4',
  coral: '#FB7268',
  coralHover: '#F56359',

  /** Surfaces (dark default for native app chrome) */
  background: '#0D0F18',
  surface: '#171A26',
  surfaceSecondary: '#1B1E2B',
  card: '#171A26',

  /** Text */
  text: '#F7F8FB',
  textSecondary: '#B9BDCA',
  textMuted: '#9095A5',
  textInverse: '#FFFFFF',
  textOnBrand: '#0D0F18',

  /** Borders */
  border: 'rgba(255, 255, 255, 0.12)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',

  /** Semantic */
  primary: '#4199A4',
  secondary: '#388A94',
  success: '#16A36A',
  warning: '#E69222',
  error: '#D64545',
  info: '#3196E8',

  /** Module accents */
  lead: '#3196E8',
  project: '#4199A4',
  finance: '#E69222',
  calendar: '#DE4C7A',

  /** Shadows */
  shadow: '#000000',
} as const;

/** Light-mode palette for future Appearance preference support */
export const lightColors = {
  navy: '#212446',
  teal: '#4199A4',
  coral: '#FB7268',
  coralHover: '#F56359',
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceSecondary: '#F9FAFB',
  card: '#FFFFFF',
  text: '#171923',
  textSecondary: '#5F6472',
  textMuted: '#747A88',
  textInverse: '#FFFFFF',
  textOnBrand: '#FFFFFF',
  border: 'rgba(33, 36, 70, 0.14)',
  borderStrong: 'rgba(33, 36, 70, 0.24)',
  primary: '#4199A4',
  secondary: '#388A94',
  success: '#16A36A',
  warning: '#E69222',
  error: '#D64545',
  info: '#3196E8',
  lead: '#3196E8',
  project: '#4199A4',
  finance: '#E69222',
  calendar: '#DE4C7A',
  shadow: '#101828',
} as const;

export type ThemeColors = typeof colors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold' as const,
    color: colors.text,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: colors.text,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
  },
  body: {
    fontSize: 16,
    color: colors.text,
  },
  bodySmall: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  caption: {
    fontSize: 12,
    color: colors.textMuted,
  },
};

import { StyleSheet } from 'react-native';

export const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.textOnBrand,
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shadow: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
});
