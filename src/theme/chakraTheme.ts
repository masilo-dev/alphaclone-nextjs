/**
 * AlphaClone Chakra theme — teal / dark slate enterprise look.
 * No purple/indigo AI-saas defaults.
 */

import { extendTheme, type ThemeConfig } from '@chakra-ui/react';
import { COLORS } from '@/constants/design';

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

export const alphacloneChakraTheme = extendTheme({
  config,
  fonts: {
    heading: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
    body: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
  },
  colors: {
    brand: {
      50: COLORS.primary[50],
      100: COLORS.primary[100],
      200: COLORS.primary[200],
      300: COLORS.primary[300],
      400: COLORS.primary[400],
      500: COLORS.primary[500],
      600: COLORS.primary[600],
      700: COLORS.primary[700],
      800: COLORS.primary[800],
      900: COLORS.primary[900],
      950: COLORS.primary[950],
    },
    slate: {
      50: COLORS.neutral[50],
      100: COLORS.neutral[100],
      200: COLORS.neutral[200],
      300: COLORS.neutral[300],
      400: COLORS.neutral[400],
      500: COLORS.neutral[500],
      600: COLORS.neutral[600],
      700: COLORS.neutral[700],
      800: COLORS.neutral[800],
      900: COLORS.neutral[900],
      950: COLORS.neutral[950],
    },
  },
  radii: {
    md: '0.5rem',
    lg: '0.75rem',
    xl: '0.75rem', // flatten AI-slop 2xl defaults toward enterprise lg
    '2xl': '0.75rem',
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'teal',
      },
      baseStyle: {
        borderRadius: 'md',
        fontWeight: 'semibold',
      },
    },
    Badge: {
      baseStyle: {
        borderRadius: 'md',
        textTransform: 'none',
        fontWeight: 'semibold',
      },
    },
    Input: {
      defaultProps: {
        focusBorderColor: 'teal.500',
      },
      variants: {
        outline: {
          field: {
            borderRadius: 'md',
            bg: 'gray.900',
            borderColor: 'whiteAlpha.200',
            _hover: { borderColor: 'whiteAlpha.300' },
            _placeholder: { color: 'gray.500' },
          },
        },
      },
    },
    Select: {
      defaultProps: {
        focusBorderColor: 'teal.500',
      },
      variants: {
        outline: {
          field: {
            borderRadius: 'md',
            bg: 'gray.900',
            borderColor: 'whiteAlpha.200',
          },
        },
      },
    },
    Textarea: {
      defaultProps: {
        focusBorderColor: 'teal.500',
      },
      variants: {
        outline: {
          borderRadius: 'md',
          bg: 'gray.900',
          borderColor: 'whiteAlpha.200',
        },
      },
    },
  },
  styles: {
    global: {
      body: {
        bg: 'gray.950',
        color: 'whiteAlpha.900',
      },
    },
  },
});

/** Flat prop helpers for dashboard modules */
export const AC = {
  bg: 'gray.950',
  panel: 'gray.900',
  border: 'whiteAlpha.200',
  muted: 'gray.400',
  subtle: 'gray.500',
  ink: 'whiteAlpha.900',
  teal: 'teal.400',
  tealSolid: 'teal.600',
  radius: 'lg',
  control: 'md',
} as const;
