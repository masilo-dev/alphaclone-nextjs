import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./App.tsx",
        "./main.tsx",
        "./index.tsx"
    ],
    darkMode: 'class',
    theme: {
        extend: {
            screens: {
                'xs': '475px',
                'sm': '640px',
                'md': '768px',
                'lg': '1024px',
                'xl': '1280px',
                '2xl': '1536px',
                'small-laptop': '1440px',  // For 13-14" laptops
                'tablet': '768px',
                'mobile': '640px'
            },
            colors: {
                teal: {
                    50: '#f0fdfa',
                    100: '#ccfbf1',
                    200: '#99f6e4',
                    300: '#5eead4',
                    400: '#2dd4bf',
                    500: '#14b8a6',
                    600: '#0d9488',
                    700: '#0f766e',
                    800: '#115e59',
                    900: '#134e4a',
                    950: '#042f2e',
                },
                violet: {
                    500: '#8b5cf6',
                    600: '#7c3aed',
                },
                slate: {
                    850: '#1e293b',
                    900: '#0f172a',
                    950: '#020617',
                },
                dashboard: {
                    green: '#639922',
                    greenBg: '#EAF3DE',
                    amber: '#EF9F27',
                    amberBg: '#FAEEDA',
                    red: '#E24B4A',
                    redBg: '#FCEBEB',
                    blue: '#378ADD',
                    blueBg: '#E6F1FB',
                },
                surface: {
                    1: 'var(--surface-1)',
                },
            },
            fontFamily: {
                sans: ['var(--font-ui)'],
                brand: ['var(--font-brand)'],
                serif: [
                    'Cambria',          // Microsoft serif
                    'Georgia',
                    'serif'
                ],
                mono: [
                    'Consolas',         // Microsoft monospace
                    'SF Mono',
                    'Monaco',
                    'Inconsolata',
                    'Roboto Mono',
                    'monospace'
                ]
            },
            // STRICT APP TYPOGRAPHY SCALE
            fontSize: {
                xs: ['var(--text-xs)', 'var(--leading-ui)'],
                sm: ['var(--text-sm)', 'var(--leading-ui)'],
                base: ['var(--text-base)', 'var(--leading-body)'],
                md: ['var(--text-base)', 'var(--leading-body)'],
                lg: ['var(--text-lg)', 'var(--leading-body)'],
                xl: ['var(--text-xl)', 'var(--leading-ui)'],
                '2xl': ['var(--text-2xl)', 'var(--leading-heading)'],
                '3xl': ['var(--text-3xl)', 'var(--leading-heading)'],
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out',
                'slide-up': 'slideUp 0.5s ease-out',
                'blob': 'blob 7s infinite',
                'float': 'float 6s ease-in-out infinite',
                'glow': 'glow 2s ease-in-out infinite alternate',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                blob: {
                    '0%': { transform: 'translate(0px, 0px) scale(1)' },
                    '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
                    '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
                    '100%': { transform: 'translate(0px, 0px) scale(1)' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                glow: {
                    'from': { boxShadow: '0 0 10px -10px #2dd4bf' },
                    'to': { boxShadow: '0 0 20px 5px #2dd4bf33' },
                }
            }
        },
    },
    plugins: [
        typography,
        // Add responsive text plugin
        function({ addUtilities }) {
            addUtilities({
                '.text-responsive-xs': {
                    'font-size': '0.75rem',
                    '@screen sm': { 'font-size': '0.875rem' }
                },
                '.text-responsive-sm': {
                    'font-size': '0.875rem',
                    '@screen sm': { 'font-size': '1rem' }
                },
                '.text-responsive-base': {
                    'font-size': '0.875rem',
                    '@screen sm': { 'font-size': '1rem' },
                    '@screen lg': { 'font-size': '1.125rem' }
                },
                '.text-responsive-lg': {
                    'font-size': '1.125rem',
                    '@screen sm': { 'font-size': '1.25rem' },
                    '@screen lg': { 'font-size': '1.5rem' }
                }
            });
        }
    ],
}
